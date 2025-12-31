import { storage } from './storage';
import { getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';

export class StripeService {
  async createCustomer(email: string, userId: string, name?: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      name: name || undefined,
      metadata: { userId },
    });
  }

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  // Guest checkout - no account required, Stripe collects email
  async createGuestCheckoutSession(priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // For subscription mode, Stripe automatically creates/requires customers
      // Customer email is collected during checkout
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active}`
    );
    return result.rows;
  }

  async listProductsWithPrices(active = true) {
    const result = await db.execute(
      sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = ${active}
        ORDER BY p.id, pr.unit_amount
      `
    );
    return result.rows;
  }

  async getPrice(priceId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }

  async isValidProPrice(priceId: string): Promise<boolean> {
    const result = await db.execute(
      sql`
        SELECT pr.id 
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.id = ${priceId}
          AND pr.active = true
          AND p.active = true
          AND p.name = 'Pro Plan'
      `
    );
    return result.rows.length > 0;
  }

  async isValidPremiumPrice(priceId: string): Promise<boolean> {
    const result = await db.execute(
      sql`
        SELECT pr.id 
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.id = ${priceId}
          AND pr.active = true
          AND p.active = true
          AND p.name = 'Premium Plan'
      `
    );
    return result.rows.length > 0;
  }

  async isValidSubscriptionPrice(priceId: string): Promise<{ valid: boolean; tier: 'pro' | 'premium' | null }> {
    const result = await db.execute(
      sql`
        SELECT pr.id, p.name 
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.id = ${priceId}
          AND pr.active = true
          AND p.active = true
          AND p.name IN ('Pro Plan', 'Premium Plan')
      `
    );
    if (result.rows.length === 0) {
      return { valid: false, tier: null };
    }
    const productName = (result.rows[0] as any).name;
    return { 
      valid: true, 
      tier: productName === 'Premium Plan' ? 'premium' : 'pro' 
    };
  }
  
  async getValidPriceIds(): Promise<string[]> {
    const result = await db.execute(
      sql`
        SELECT pr.id 
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.active = true
          AND p.active = true
          AND p.name IN ('Pro Plan', 'Premium Plan')
      `
    );
    return result.rows.map((row: any) => row.id);
  }

  async getPricesForPlan(planName: 'Pro Plan' | 'Premium Plan'): Promise<any[]> {
    const result = await db.execute(
      sql`
        SELECT pr.* 
        FROM stripe.prices pr
        JOIN stripe.products p ON pr.product = p.id
        WHERE pr.active = true
          AND p.active = true
          AND p.name = ${planName}
        ORDER BY pr.unit_amount ASC
      `
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async getCustomerSubscriptions(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} ORDER BY created DESC`
    );
    return result.rows;
  }
}

export const stripeService = new StripeService();
