import { getStripeSync } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { generateActivationToken } from './auth';
import { sendActivationEmail } from './emailService';

let eventHandlersRegistered = false;

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    if (!eventHandlersRegistered) {
      sync.on('subscription.created', handleSubscriptionEvent);
      sync.on('subscription.updated', handleSubscriptionEvent);
      sync.on('subscription.deleted', handleSubscriptionDeleted);
      sync.on('checkout_session.completed', handleCheckoutCompleted);
      eventHandlersRegistered = true;
    }
    
    await sync.processWebhook(payload, signature, uuid);
  }
}

async function determineTierFromSubscription(subscription: any): Promise<'free' | 'pro' | 'premium'> {
  const status = subscription.status;
  if (status !== 'active' && status !== 'trialing') {
    return 'free';
  }
  
  // Check the product via items
  const items = subscription.items?.data || [];
  for (const item of items) {
    const priceId = typeof item.price === 'object' ? item.price.id : item.price;
    
    // Check if this price belongs to Premium Plan
    const premiumCheck = await db.execute(
      sql`
        SELECT p.name FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.id = ${priceId} AND p.name = 'Premium Plan'
      `
    );
    
    if (premiumCheck.rows.length > 0) {
      return 'premium';
    }
  }
  
  return 'pro';
}

async function handleSubscriptionEvent(subscription: any): Promise<void> {
  try {
    const customerId = typeof subscription.customer === 'object' 
      ? subscription.customer.id 
      : subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;

    const tier = await determineTierFromSubscription(subscription);

    const result = await db.execute(
      sql`UPDATE users SET 
        stripe_subscription_id = ${subscriptionId},
        subscription_tier = ${tier},
        subscription_status = ${status},
        updated_at = NOW()
      WHERE stripe_customer_id = ${customerId}
      RETURNING id`
    );

    if (result.rows.length > 0) {
      console.log(`[Webhook] Updated subscription for user: ${(result.rows[0] as any).id}, tier: ${tier}, status: ${status}`);
    } else {
      console.log(`[Webhook] No user found with customerId: ${customerId}`);
    }
  } catch (error) {
    console.error('[Webhook] Error handling subscription event:', error);
  }
}

async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  try {
    const customerId = typeof subscription.customer === 'object' 
      ? subscription.customer.id 
      : subscription.customer;

    const result = await db.execute(
      sql`UPDATE users SET 
        stripe_subscription_id = NULL,
        subscription_tier = 'free',
        subscription_status = 'canceled',
        updated_at = NOW()
      WHERE stripe_customer_id = ${customerId}
      RETURNING id`
    );

    if (result.rows.length > 0) {
      console.log(`[Webhook] Subscription canceled for user: ${result.rows[0].id}`);
    }
  } catch (error) {
    console.error('[Webhook] Error handling subscription deleted:', error);
  }
}

async function handleCheckoutCompleted(session: any): Promise<void> {
  try {
    const customerId = typeof session.customer === 'object' 
      ? session.customer.id 
      : session.customer;
    const subscriptionId = typeof session.subscription === 'object'
      ? session.subscription.id
      : session.subscription;
    
    // Get customer email from session
    const customerEmail = session.customer_details?.email || 
      (typeof session.customer === 'object' ? session.customer.email : null);

    if (!subscriptionId) {
      console.log('[Webhook] No subscription in checkout session, skipping');
      return;
    }

    // Determine tier from the line items
    let tier: 'pro' | 'premium' = 'pro';
    const lineItems = session.line_items?.data || [];
    
    for (const item of lineItems) {
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

    // First, try to find user by stripe customer ID
    let result = await db.execute(
      sql`UPDATE users SET 
        stripe_subscription_id = ${subscriptionId},
        subscription_tier = ${tier},
        subscription_status = 'active',
        updated_at = NOW()
      WHERE stripe_customer_id = ${customerId}
      RETURNING id, email, status`
    );

    if (result.rows.length > 0) {
      console.log(`[Webhook] Checkout completed for existing user: ${(result.rows[0] as any).id}, tier: ${tier}`);
      return;
    }

    // No user with that customer ID - check by email
    if (customerEmail) {
      const existingUser = await db.execute(
        sql`SELECT id, status FROM users WHERE email = ${customerEmail}`
      );

      if (existingUser.rows.length > 0) {
        // User exists - attach subscription to them
        const userId = (existingUser.rows[0] as any).id;
        await db.execute(
          sql`UPDATE users SET 
            stripe_customer_id = ${customerId},
            stripe_subscription_id = ${subscriptionId},
            subscription_tier = ${tier},
            subscription_status = 'active',
            updated_at = NOW()
          WHERE id = ${userId}`
        );
        console.log(`[Webhook] Attached subscription to existing user by email: ${userId}, tier: ${tier}`);
        return;
      }

      // No user exists - create pending_activation user
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
        ) RETURNING id`
      );

      if (newUser.rows.length > 0) {
        console.log(`[Webhook] Created pending user: ${(newUser.rows[0] as any).id}, sending activation email`);
        
        // Send activation email with the unhashed token
        await sendActivationEmail(customerEmail, token, tier);
      }
    } else {
      console.log('[Webhook] No customer email available, cannot create user');
    }
  } catch (error) {
    console.error('[Webhook] Error handling checkout completed:', error);
  }
}
