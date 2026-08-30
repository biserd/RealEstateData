import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return secretKey;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return stripeClient;
}

export async function getStripePublishableKey(): Promise<string> {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    throw new Error("STRIPE_PUBLISHABLE_KEY is not configured");
  }
  return publishableKey;
}

export function getStripeWebhookSecret(): string {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return webhookSecret;
}
