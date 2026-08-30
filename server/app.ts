import express, { type NextFunction, type Request, type Response } from "express";
import compression from "compression";
import { createServer } from "node:http";
import { registerRoutes } from "./routes";
import { WebhookHandlers } from "./webhookHandlers";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export type RuntimeMode = "node" | "cloudflare";

export function log(message: string, source = "express") {
  console.log(JSON.stringify({
    level: "info",
    source,
    message,
    timestamp: new Date().toISOString(),
  }));
}

export async function createApp(options: { runtime: RuntimeMode }) {
  const app = express();
  const httpServer = createServer(app);
  app.disable("x-powered-by");

  app.post(
    ["/api/stripe/webhook", "/api/stripe/webhook/:uuid"],
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const { uuid } = req.params;
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature" });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        if (!Buffer.isBuffer(req.body)) {
          return res.status(500).json({ error: "Webhook processing error: body not buffer" });
        }
        await WebhookHandlers.processWebhook(req.body, sig);
        return res.status(200).json({ received: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown webhook error";
        console.error(JSON.stringify({ level: "error", source: "stripe-webhook", message, uuid, timestamp: new Date().toISOString() }));
        return res.status(400).json({ error: "Webhook processing error" });
      }
    },
  );

  if (options.runtime === "node") {
    app.use(
      compression({
        threshold: 1024,
        filter: (req, res) => {
          if (req.headers["x-no-compression"]) return false;
          const contentType = String(res.getHeader("Content-Type") || "");
          if (/^(image|video|audio)\//i.test(contentType)) return false;
          return compression.filter(req, res);
        },
      }),
    );
  }

  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        req.rawBody = buffer;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      console.log(JSON.stringify({ level: "info", source: "http", method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start, timestamp: new Date().toISOString() }));
    });
    next();
  });

  await registerRoutes(httpServer, app);

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status) || 500
        : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error(JSON.stringify({ level: "error", source: "express", message, status, timestamp: new Date().toISOString() }));
    if (!res.headersSent) res.status(status).json({ message });
  });

  return { app, httpServer };
}
