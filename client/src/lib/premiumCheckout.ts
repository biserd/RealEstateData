import { apiRequest } from "@/lib/queryClient";

import { SUBSCRIPTION_PLANS } from "@shared/subscriptionPlans";

/**
 * Starts a Stripe checkout session for the Premium plan and redirects the
 * browser to the Stripe-hosted page. Works for both authenticated users
 * (via /api/checkout) and anonymous visitors (via /api/checkout/guest).
 */
export async function startPremiumCheckout(opts: { authenticated: boolean }): Promise<void> {
  const priceId = SUBSCRIPTION_PLANS.premium.prices.month.id;
  const endpoint = opts.authenticated ? "/api/checkout" : "/api/checkout/guest";
  const response = await apiRequest("POST", endpoint, { priceId });
  const data = (await response.json()) as { url?: string };
  if (data.url) {
    window.location.href = data.url;
  } else {
    window.location.href = "/pricing";
  }
}
