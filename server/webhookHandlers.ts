import { getStripeSync } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';

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

async function handleSubscriptionEvent(subscription: any): Promise<void> {
  try {
    const customerId = typeof subscription.customer === 'object' 
      ? subscription.customer.id 
      : subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;

    const tier = (status === 'active' || status === 'trialing') ? 'pro' : 'free';

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
      console.log(`[Webhook] Updated subscription for user: ${result.rows[0].id}, tier: ${tier}, status: ${status}`);
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

    if (subscriptionId) {
      const result = await db.execute(
        sql`UPDATE users SET 
          stripe_subscription_id = ${subscriptionId},
          subscription_tier = 'pro',
          subscription_status = 'active',
          updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
        RETURNING id`
      );

      if (result.rows.length > 0) {
        console.log(`[Webhook] Checkout completed for user: ${result.rows[0].id}`);
      }
    }
  } catch (error) {
    console.error('[Webhook] Error handling checkout completed:', error);
  }
}
