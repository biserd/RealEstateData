import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { stripeService } from './stripeService';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { generateActivationToken } from './auth';
import { sendActivationEmail } from './emailService';

const APP_SLUG = process.env.APP_SLUG || 'realtorsdashboard';

const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 10000;

function trackEventId(eventId: string): boolean {
  if (processedEventIds.has(eventId)) {
    return false;
  }
  if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
    const firstKey = processedEventIds.values().next().value;
    if (firstKey) processedEventIds.delete(firstKey);
  }
  processedEventIds.add(eventId);
  return true;
}

function extractOwnerApp(event: any): string | null {
  const obj = event?.data?.object;
  if (!obj) return null;

  if (obj.metadata?.app) {
    return obj.metadata.app;
  }

  if (event.type?.startsWith('invoice.')) {
    const lines = obj.lines?.data || [];
    for (const line of lines) {
      if (line.metadata?.app) return line.metadata.app;
    }
  }

  return null;
}

function extractPriceIds(event: any): string[] {
  const obj = event?.data?.object;
  if (!obj) return [];
  const priceIds: string[] = [];

  if (event.type?.startsWith('invoice.')) {
    const lines = obj.lines?.data || [];
    for (const line of lines) {
      if (line.price?.id) priceIds.push(line.price.id);
      if (line.pricing?.price_details?.price) priceIds.push(line.pricing.price_details.price);
    }
  }

  if (event.type?.startsWith('customer.subscription')) {
    const items = obj.items?.data || [];
    for (const item of items) {
      if (item.price?.id) priceIds.push(item.price.id);
    }
  }

  if (event.type?.startsWith('checkout.session')) {
    const lineItems = obj.line_items?.data || [];
    for (const item of lineItems) {
      if (item.price?.id) priceIds.push(item.price.id);
    }
  }

  return priceIds;
}

async function shouldProcessBusinessLogic(event: any): Promise<boolean> {
  const eventId = event.id;
  const eventType = event.type;

  const ownerApp = extractOwnerApp(event);

  if (ownerApp && ownerApp !== APP_SLUG) {
    console.log(`[Webhook] Skipping business logic for event ${eventId} (${eventType}) - belongs to app "${ownerApp}"`);
    return false;
  }

  if (ownerApp === APP_SLUG) {
    console.log(`[Webhook] Event ${eventId} (${eventType}) belongs to "${APP_SLUG}"`);
    return true;
  }

  const priceIds = extractPriceIds(event);
  if (priceIds.length > 0) {
    try {
      const validPriceIds = await stripeService.getValidPriceIds();
      const hasMatch = priceIds.some(id => validPriceIds.includes(id));
      if (!hasMatch) {
        console.log(`[Webhook] Skipping business logic for event ${eventId} (${eventType}) - price IDs [${priceIds.join(', ')}] don't match this app's products`);
        return false;
      }
      console.log(`[Webhook] Event ${eventId} (${eventType}) matched by price ID fallback`);
      return true;
    } catch (err: any) {
      console.warn(`[Webhook] Could not validate price IDs, processing event anyway: ${err.message}`);
      return true;
    }
  }

  const safeEventTypes = [
    'product.', 'price.', 'coupon.', 'promotion_code.',
    'tax_rate.', 'billing_portal.',
  ];
  const isSafeEvent = safeEventTypes.some(prefix => eventType?.startsWith(prefix));
  if (isSafeEvent) {
    console.log(`[Webhook] Event ${eventId} (${eventType}) is account-level - processing`);
    return true;
  }

  console.log(`[Webhook] Skipping business logic for event ${eventId} (${eventType}) - no app metadata or matching price IDs`);
  return false;
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    console.log(`[Webhook] Processing webhook with UUID: ${uuid}`);
    
    if (!Buffer.isBuffer(payload)) {
      const errorMsg = 'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const sync = await getStripeSync();
    
    try {
      console.log(`[Webhook] Calling processWebhook on stripeSync...`);
      await sync.processWebhook(payload, signature, uuid);
      console.log(`[Webhook] stripeSync.processWebhook completed successfully`);
    } catch (error: any) {
      if (error.message && error.message.includes('Unhandled webhook event')) {
        console.log(`[Webhook] Ignoring unhandled event type (this is normal): ${error.message}`);
        return;
      }
      console.error(`[Webhook] stripeSync.processWebhook failed:`, error.message);
      console.error(`[Webhook] Full error:`, error);
      throw error;
    }

    let event: any;
    try {
      event = JSON.parse(payload.toString('utf8'));
    } catch {
      console.warn('[Webhook] Could not parse payload for routing check, running business logic anyway');
      event = null;
    }

    if (event) {
      const eventId = event.id;
      const eventType = event.type;

      if (eventId && !trackEventId(eventId)) {
        console.log(`[Webhook] Duplicate event ${eventId} (${eventType}) - skipping business logic`);
        return;
      }

      const shouldProcess = await shouldProcessBusinessLogic(event);
      if (!shouldProcess) {
        return;
      }
    }
    
    try {
      console.log(`[Webhook] Syncing user subscriptions from Stripe tables...`);
      await syncUserSubscriptions();
      console.log(`[Webhook] User subscription sync completed`);
    } catch (error: any) {
      console.error(`[Webhook] Error syncing user subscriptions:`, error.message);
    }
  }
}

async function syncUserSubscriptions(): Promise<void> {
  // Find all active subscriptions and update corresponding users
  const result = await db.execute(sql`
    WITH active_subs AS (
      SELECT 
        s.id as subscription_id,
        s.customer as customer_id,
        s.status,
        p.name as product_name
      FROM stripe.subscriptions s
      LEFT JOIN stripe.subscription_items si ON si.subscription = s.id
      LEFT JOIN stripe.prices pr ON si.price = pr.id
      LEFT JOIN stripe.products p ON pr.product = p.id
      WHERE s.status IN ('active', 'trialing')
    )
    UPDATE users u
    SET 
      stripe_subscription_id = active_subs.subscription_id,
      subscription_tier = CASE 
        WHEN active_subs.product_name = 'Premium Plan' THEN 'premium'
        WHEN active_subs.product_name = 'Pro Plan' THEN 'pro'
        ELSE 'pro'
      END,
      subscription_status = active_subs.status,
      updated_at = NOW()
    FROM active_subs
    WHERE u.stripe_customer_id = active_subs.customer_id
    RETURNING u.id, u.subscription_tier, u.subscription_status
  `);
  
  if (result.rows.length > 0) {
    for (const row of result.rows) {
      console.log(`[Webhook] Updated user ${(row as any).id}: tier=${(row as any).subscription_tier}, status=${(row as any).subscription_status}`);
    }
  }
  
  // Also handle canceled subscriptions - find users whose subscriptions are no longer active
  // Include both 'active' and 'trialing' statuses, and clear stripe_subscription_id
  const canceledResult = await db.execute(sql`
    UPDATE users u
    SET 
      stripe_subscription_id = NULL,
      subscription_tier = 'free',
      subscription_status = 'canceled',
      updated_at = NOW()
    WHERE u.stripe_subscription_id IS NOT NULL
    AND u.subscription_status IN ('active', 'trialing')
    AND NOT EXISTS (
      SELECT 1 FROM stripe.subscriptions s 
      WHERE s.id = u.stripe_subscription_id 
      AND s.status IN ('active', 'trialing')
    )
    RETURNING u.id
  `);
  
  if (canceledResult.rows.length > 0) {
    for (const row of canceledResult.rows) {
      console.log(`[Webhook] Canceled subscription for user ${(row as any).id}`);
    }
  }
  
  // Handle checkout sessions for new customers who don't have accounts yet
  await processNewCheckoutSessions();
}

async function processNewCheckoutSessions(): Promise<void> {
  // Find recent completed checkout sessions that don't have users attached
  const stripe = await getUncachableStripeClient();
  
  // Get checkout sessions from last hour that resulted in subscriptions
  const sessions = await stripe.checkout.sessions.list({
    limit: 10,
    expand: ['data.customer', 'data.subscription', 'data.line_items'],
  });
  
  for (const session of sessions.data) {
    if (session.payment_status !== 'paid' || !session.subscription) {
      continue;
    }
    
    const sessionApp = session.metadata?.app;
    if (sessionApp && sessionApp !== APP_SLUG) {
      continue;
    }
    
    const customerId = typeof session.customer === 'object' 
      ? session.customer?.id 
      : session.customer;
    const subscriptionId = typeof session.subscription === 'object'
      ? session.subscription?.id
      : session.subscription;
    const customerEmail = session.customer_details?.email;
    
    if (!customerId || !subscriptionId || !customerEmail) {
      continue;
    }
    
    // Check if user already exists with this customer ID
    const existingByCustomer = await db.execute(
      sql`SELECT id FROM users WHERE stripe_customer_id = ${customerId}`
    );
    
    if (existingByCustomer.rows.length > 0) {
      continue; // Already linked
    }
    
    // Check if user exists by email
    const existingByEmail = await db.execute(
      sql`SELECT id, status FROM users WHERE email = ${customerEmail}`
    );
    
    // Determine tier from subscription
    let tier: 'pro' | 'premium' = 'pro';
    const subscription = typeof session.subscription === 'object' ? session.subscription : null;
    if (subscription) {
      const items = subscription.items?.data || [];
      for (const item of items) {
        const priceId = typeof item.price === 'object' ? item.price.id : item.price;
        if (priceId) {
          const premiumCheck = await db.execute(
            sql`
              SELECT p.name FROM stripe.prices pr
              JOIN stripe.products p ON pr.product = p.id
              WHERE pr.id = ${priceId} AND p.name = 'Premium Plan'
            `
          );
          if (premiumCheck.rows.length > 0) {
            tier = 'premium';
            break;
          }
        }
      }
    }
    
    if (existingByEmail.rows.length > 0) {
      // Link subscription to existing user
      const userId = (existingByEmail.rows[0] as any).id;
      await db.execute(
        sql`UPDATE users SET 
          stripe_customer_id = ${customerId},
          stripe_subscription_id = ${subscriptionId},
          subscription_tier = ${tier},
          subscription_status = 'active',
          updated_at = NOW()
        WHERE id = ${userId}`
      );
      console.log(`[Webhook] Linked subscription to existing user by email: ${userId}, tier: ${tier}`);
    } else {
      // Create pending activation user
      console.log(`[Webhook] Creating pending activation user for: ${customerEmail}`);
      
      const { token, hash, expiresAt } = generateActivationToken();
      
      const newUser = await db.execute(
        sql`INSERT INTO users (
          email, 
          status, 
          activation_token_hash, 
          activation_token_expires_at,
          stripe_customer_id, 
          stripe_subscription_id, 
          subscription_tier, 
          subscription_status
        ) VALUES (
          ${customerEmail}, 
          'pending_activation', 
          ${hash}, 
          ${expiresAt},
          ${customerId}, 
          ${subscriptionId}, 
          ${tier}, 
          'active'
        ) 
        ON CONFLICT (email) DO NOTHING
        RETURNING id`
      );

      if (newUser.rows.length > 0) {
        console.log(`[Webhook] Created pending user: ${(newUser.rows[0] as any).id}, sending activation email`);
        await sendActivationEmail(customerEmail, token, tier);
      }
    }
  }
}
