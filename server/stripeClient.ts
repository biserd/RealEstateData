import Stripe from 'stripe';

let connectionSettings: any;
let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;

async function getCredentialsFromConnector(): Promise<{ publishableKey: string; secretKey: string } | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    if (!hostname) {
      return null;
    }

    const xReplitToken = process.env.REPL_IDENTITY
      ? 'repl ' + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
        ? 'depl ' + process.env.WEB_REPL_RENEWAL
        : null;

    if (!xReplitToken) {
      return null;
    }

    const connectorName = 'stripe';
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    const targetEnvironment = isProduction ? 'production' : 'development';

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings || !connectionSettings.settings?.publishable || !connectionSettings.settings?.secret) {
      console.log(`Stripe ${targetEnvironment} connector not configured, falling back to environment variable`);
      return null;
    }

    return {
      publishableKey: connectionSettings.settings.publishable,
      secretKey: connectionSettings.settings.secret,
    };
  } catch (error) {
    console.log('Failed to get Stripe credentials from connector, falling back to environment variable:', error);
    return null;
  }
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // Try Replit Connector first
  const connectorCreds = await getCredentialsFromConnector();
  if (connectorCreds) {
    cachedCredentials = connectorCreds;
    return connectorCreds;
  }

  // Fall back to environment variable
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Stripe credentials not available. Configure Replit Stripe Connector or set STRIPE_SECRET_KEY environment variable.');
  }

  // Determine publishable key from secret key pattern
  // Live keys start with sk_live_, test keys start with sk_test_
  const isLive = secretKey.startsWith('sk_live_');
  const publishableKey = isLive 
    ? (process.env.STRIPE_PUBLISHABLE_KEY || 'pk_live_placeholder')
    : (process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

  console.log(`Using STRIPE_SECRET_KEY environment variable (${isLive ? 'live' : 'test'} mode)`);
  
  cachedCredentials = { publishableKey, secretKey };
  return cachedCredentials;
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
