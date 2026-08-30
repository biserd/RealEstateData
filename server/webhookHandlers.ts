import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { generateActivationToken } from "./auth";
import { sendActivationEmail, sendTrialStartedNotificationToAdmin } from "./emailService";
import { getStripeWebhookSecret, getUncachableStripeClient } from "./stripeClient";

const APP_SLUG = process.env.APP_SLUG || "realtorsdashboard";
const processedEventIds = new Set<string>();
const MAX_RECENT_EVENT_IDS = 1_000;

function rememberEvent(eventId: string): boolean {
  if (processedEventIds.has(eventId)) return false;
  processedEventIds.add(eventId);
  if (processedEventIds.size > MAX_RECENT_EVENT_IDS) {
    const oldest = processedEventIds.values().next().value;
    if (oldest) processedEventIds.delete(oldest);
  }
  return true;
}

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function subscriptionId(value: string | Stripe.Subscription | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function tierForSubscription(subscription: Stripe.Subscription): Promise<"pro" | "premium"> {
  const stripe = await getUncachableStripeClient();
  for (const item of subscription.items.data) {
    const price = item.price;
    let product = price.product;
    if (typeof product === "string") {
      product = await stripe.products.retrieve(product);
    }
    if (typeof product === "object" && !product.deleted && product.name === "Premium Plan") {
      return "premium";
    }
  }
  return "pro";
}

async function notifyNewTrial(customer: string): Promise<void> {
  const result = await db.execute(sql`
    SELECT id, email, first_name, last_name, subscription_tier
    FROM users
    WHERE stripe_customer_id = ${customer}
      AND subscription_status = 'trialing'
      AND trial_notification_sent_at IS NULL
      AND email IS NOT NULL
    LIMIT 1
  `);
  if (result.rows.length === 0) return;
  const user = result.rows[0] as any;
  const sent = await sendTrialStartedNotificationToAdmin(
    user.email,
    user.subscription_tier || "pro",
    user.first_name,
    user.last_name,
  );
  if (sent) {
    await db.execute(sql`
      UPDATE users
      SET trial_notification_sent_at = NOW()
      WHERE id = ${user.id} AND trial_notification_sent_at IS NULL
    `);
  }
}

async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const customer = customerId(subscription.customer);
  if (!customer) return;
  const tier = await tierForSubscription(subscription);
  const active = subscription.status === "active" || subscription.status === "trialing";
  await db.execute(sql`
    UPDATE users
    SET
      stripe_subscription_id = ${active ? subscription.id : null},
      subscription_tier = ${active ? tier : "free"},
      subscription_status = ${subscription.status},
      updated_at = NOW()
    WHERE stripe_customer_id = ${customer}
  `);
  if (subscription.status === "trialing") await notifyNewTrial(customer);
}

async function applyCheckoutSession(eventSession: Stripe.Checkout.Session): Promise<void> {
  if (eventSession.metadata?.app && eventSession.metadata.app !== APP_SLUG) return;
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(eventSession.id, {
    expand: ["customer", "subscription", "subscription.items.data.price.product"],
  });
  const customer = customerId(session.customer);
  const subscription =
    typeof session.subscription === "object" && session.subscription
      ? session.subscription
      : session.subscription
        ? await stripe.subscriptions.retrieve(session.subscription, {
            expand: ["items.data.price.product"],
          })
        : null;
  const expandedCustomer =
    session.customer && typeof session.customer === "object" && !session.customer.deleted
      ? session.customer
      : null;
  const email = session.customer_details?.email || expandedCustomer?.email || null;
  if (!customer || !subscription || !email) return;

  const tier = await tierForSubscription(subscription);
  const existingCustomer = await db.execute(sql`
    SELECT id FROM users WHERE stripe_customer_id = ${customer} LIMIT 1
  `);
  if (existingCustomer.rows.length > 0) {
    await applySubscription(subscription);
    return;
  }

  const existingEmail = await db.execute(sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `);
  if (existingEmail.rows.length > 0) {
    const userId = (existingEmail.rows[0] as any).id;
    await db.execute(sql`
      UPDATE users
      SET stripe_customer_id = ${customer},
          stripe_subscription_id = ${subscription.id},
          subscription_tier = ${tier},
          subscription_status = ${subscription.status},
          updated_at = NOW()
      WHERE id = ${userId}
    `);
    if (subscription.status === "trialing") await notifyNewTrial(customer);
    return;
  }

  const { token, hash, expiresAt } = generateActivationToken();
  const inserted = await db.execute(sql`
    INSERT INTO users (
      email, status, activation_token_hash, activation_token_expires_at,
      stripe_customer_id, stripe_subscription_id, subscription_tier,
      subscription_status
    ) VALUES (
      ${email}, 'pending_activation', ${hash}, ${expiresAt},
      ${customer}, ${subscription.id}, ${tier}, ${subscription.status}
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `);
  if (inserted.rows.length > 0) {
    await sendActivationEmail(email, token, tier);
    if (subscription.status === "trialing") await notifyNewTrial(customer);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) throw new Error("Stripe webhook payload must be raw bytes");
    const stripe = await getUncachableStripeClient();
    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      getStripeWebhookSecret(),
    );
    if (!rememberEvent(event.id)) return;

    switch (event.type) {
      case "checkout.session.completed":
        await applyCheckoutSession(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object);
        break;
      default:
        break;
    }
  }
}
