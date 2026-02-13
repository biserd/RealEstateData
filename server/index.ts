import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { checkAndSyncProductionData } from './productionDataSync';

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    // Use custom domain in production, REPLIT_DOMAINS in development
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
    const webhookBaseUrl = isProduction 
      ? 'https://realtorsdashboard.com'
      : `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    console.log(`Using webhook base URL: ${webhookBaseUrl} (production: ${isProduction})`);
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'Managed webhook for Stripe sync',
      }
    );
    console.log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('Stripe data synced');
      })
      .catch((err: any) => {
        console.error('Error syncing Stripe data:', err);
      });
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

// Initialize Stripe asynchronously (wrapped in IIFE for CommonJS compatibility)
(async () => {
  await initStripe();
})();

app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const { uuid } = req.params;
    const signature = req.headers['stripe-signature'];
    
    console.log(`[Webhook] Received webhook request for UUID: ${uuid}`);
    console.log(`[Webhook] Has signature: ${!!signature}`);
    console.log(`[Webhook] Body type: ${typeof req.body}, isBuffer: ${Buffer.isBuffer(req.body)}`);

    if (!signature) {
      console.error('[Webhook] ERROR: Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('[Webhook] ERROR: req.body is not a Buffer - middleware order issue');
        console.error('[Webhook] Body content type:', req.headers['content-type']);
        return res.status(500).json({ error: 'Webhook processing error: body not buffer' });
      }

      console.log(`[Webhook] Processing webhook with UUID: ${uuid}, body size: ${req.body.length} bytes`);
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      console.log(`[Webhook] Successfully processed webhook for UUID: ${uuid}`);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Webhook] ERROR processing webhook:');
      console.error('[Webhook] Error name:', error.name);
      console.error('[Webhook] Error message:', error.message);
      console.error('[Webhook] Error stack:', error.stack);
      
      // Check for common Stripe errors
      if (error.message?.includes('signature')) {
        console.error('[Webhook] SIGNATURE VERIFICATION FAILED - webhook secret mismatch');
      }
      if (error.message?.includes('uuid') || error.message?.includes('UUID')) {
        console.error('[Webhook] UUID MISMATCH - webhook URL has wrong UUID');
      }
      
      res.status(400).json({ error: 'Webhook processing error', details: error.message });
    }
  }
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      checkAndSyncProductionData().catch((err) => {
        console.error("[DataSync] Background sync error:", err);
      });
    },
  );
})();
