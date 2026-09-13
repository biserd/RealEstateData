/** Public, fixed Stripe catalog for the RealtorsDashboard live account.
 * Change the Price ID and displayed amount together when publishing a new price.
 * These IDs are public identifiers, never Stripe API credentials.
 */
export const SUBSCRIPTION_PLANS = {
  pro: {
    id: "prod_URb0JkdMRX0Xod",
    name: "Pro Plan",
    description: "Full access for real estate professionals",
    prices: {
      month: { id: "price_1TTXmP2MffYVRFnwHUJ4HKuo", unit_amount: 5900, currency: "usd", recurring: { interval: "month" } },
      year: { id: "price_1TTXmP2MffYVRFnw4QxyTFfT", unit_amount: 59000, currency: "usd", recurring: { interval: "year" } },
    },
  },
  premium: {
    id: "prod_URb0bqcoqdvLCi",
    name: "Premium Plan",
    description: "Advanced tools for power users and teams",
    prices: {
      month: { id: "price_1TTXmQ2MffYVRFnw4UdNNZGl", unit_amount: 14900, currency: "usd", recurring: { interval: "month" } },
      year: { id: "price_1TTXmQ2MffYVRFnwZBsxx9xF", unit_amount: 149000, currency: "usd", recurring: { interval: "year" } },
    },
  },
} as const;

export type SubscriptionPlanTier = keyof typeof SUBSCRIPTION_PLANS;

/** The server uses the same allowlist as the UI; client-supplied amounts are never trusted. */
export function subscriptionTierForPrice(priceId: string): SubscriptionPlanTier | null {
  for (const tier of Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanTier[]) {
    if (Object.values(SUBSCRIPTION_PLANS[tier].prices).some(price => price.id === priceId)) return tier;
  }
  return null;
}

export const PUBLIC_SUBSCRIPTION_PRODUCTS = Object.entries(SUBSCRIPTION_PLANS).map(([tier, plan]) => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  active: true,
  metadata: { tier },
  prices: Object.values(plan.prices).map(price => ({ ...price, active: true, metadata: { tier } })),
}));
