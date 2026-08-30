import type Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";

export const TRIAL_PERIOD_DAYS = 14;

function productForPrice(price: Stripe.Price): Stripe.Product | null {
  return typeof price.product === "object" && !price.product.deleted
    ? price.product
    : null;
}

function planTier(product: Stripe.Product | null): "pro" | "premium" | null {
  if (product?.name === "Premium Plan") return "premium";
  if (product?.name === "Pro Plan") return "pro";
  return null;
}

export class StripeService {
  async createCustomer(email: string, userId: string, name?: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.customers.create({ email, name: name || undefined, metadata: { userId } });
  }

  async createCheckoutSession(customerId: string, priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    const appSlug = process.env.APP_SLUG || "realtorsdashboard";
    return stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { app: appSlug },
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { app: appSlug },
      },
    });
  }

  async createGuestCheckoutSession(priceId: string, successUrl: string, cancelUrl: string) {
    const stripe = await getUncachableStripeClient();
    const appSlug = process.env.APP_SLUG || "realtorsdashboard";
    return stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { app: appSlug },
      subscription_data: {
        trial_period_days: TRIAL_PERIOD_DAYS,
        metadata: { app: appSlug },
      },
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  }

  async getProduct(productId: string) {
    const stripe = await getUncachableStripeClient();
    const product = await stripe.products.retrieve(productId);
    return product.deleted ? null : product;
  }

  async listProducts(active = true) {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({ active, limit: 100 });
    return products.data;
  }

  async listProductsWithPrices(active = true) {
    const stripe = await getUncachableStripeClient();
    const [productsPage, pricesPage] = await Promise.all([
      stripe.products.list({ active, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] }),
    ]);
    const pricesByProduct = new Map<string, Stripe.Price[]>();
    for (const price of pricesPage.data) {
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      const existing = pricesByProduct.get(productId) || [];
      existing.push(price);
      pricesByProduct.set(productId, existing);
    }

    return productsPage.data.flatMap<Record<string, unknown>>((product) => {
      const prices = pricesByProduct.get(product.id) || [];
      if (prices.length === 0) {
        return [{
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_active: product.active,
          product_metadata: product.metadata,
          price_id: null,
          unit_amount: null,
          currency: null,
          recurring: null,
          price_active: null,
          price_metadata: null,
        }];
      }
      return prices.map((price) => ({
        product_id: product.id,
        product_name: product.name,
        product_description: product.description,
        product_active: product.active,
        product_metadata: product.metadata,
        price_id: price.id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring,
        price_active: price.active,
        price_metadata: price.metadata,
      }));
    });
  }

  async getPrice(priceId: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.prices.retrieve(priceId, { expand: ["product"] });
  }

  async isValidProPrice(priceId: string): Promise<boolean> {
    const result = await this.isValidSubscriptionPrice(priceId);
    return result.valid && result.tier === "pro";
  }

  async isValidPremiumPrice(priceId: string): Promise<boolean> {
    const result = await this.isValidSubscriptionPrice(priceId);
    return result.valid && result.tier === "premium";
  }

  async isValidSubscriptionPrice(priceId: string): Promise<{ valid: boolean; tier: "pro" | "premium" | null }> {
    try {
      const price = await this.getPrice(priceId);
      const tier = planTier(productForPrice(price));
      return { valid: Boolean(price.active && tier), tier };
    } catch {
      return { valid: false, tier: null };
    }
  }

  async getValidPriceIds(): Promise<string[]> {
    const stripe = await getUncachableStripeClient();
    const page = await stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] });
    return page.data.filter((price) => planTier(productForPrice(price)) !== null).map((price) => price.id);
  }

  async getPricesForPlan(planName: "Pro Plan" | "Premium Plan"): Promise<Stripe.Price[]> {
    const stripe = await getUncachableStripeClient();
    const page = await stripe.prices.list({ active: true, limit: 100, expand: ["data.product"] });
    return page.data
      .filter((price) => productForPrice(price)?.name === planName)
      .sort((a, b) => (a.unit_amount || 0) - (b.unit_amount || 0));
  }

  async getSubscription(subscriptionId: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
  }

  async getCustomerSubscriptions(customerId: string) {
    const stripe = await getUncachableStripeClient();
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    return subscriptions.data;
  }
}

export const stripeService = new StripeService();
