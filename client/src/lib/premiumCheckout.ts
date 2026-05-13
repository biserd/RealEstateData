import { apiRequest } from "@/lib/queryClient";

interface StripePrice {
  id: string;
  recurring?: { interval?: string } | null;
  unit_amount?: number | null;
}

interface StripeProduct {
  id: string;
  name?: string;
  metadata?: { tier?: string };
  prices?: StripePrice[];
}

interface ProductsResponse {
  data?: StripeProduct[];
}

/**
 * Resolves the Stripe price id for the Premium monthly plan, falling back to
 * the yearly price if monthly is unavailable.
 */
async function getPremiumPriceId(): Promise<string | null> {
  const res = await fetch("/api/stripe/products");
  if (!res.ok) return null;
  const json = (await res.json()) as ProductsResponse;
  const premium = json.data?.find(
    (p) => p.metadata?.tier === "premium" || p.name === "Premium Plan",
  );
  if (!premium?.prices?.length) return null;
  const monthly = premium.prices.find((p) => p.recurring?.interval === "month");
  return (monthly || premium.prices[0]).id;
}

/**
 * Starts a Stripe checkout session for the Premium plan and redirects the
 * browser to the Stripe-hosted page. Works for both authenticated users
 * (via /api/checkout) and anonymous visitors (via /api/checkout/guest).
 */
export async function startPremiumCheckout(opts: { authenticated: boolean }): Promise<void> {
  const priceId = await getPremiumPriceId();
  if (!priceId) {
    window.location.href = "/pricing";
    return;
  }
  const endpoint = opts.authenticated ? "/api/checkout" : "/api/checkout/guest";
  const response = await apiRequest("POST", endpoint, { priceId });
  const data = (await response.json()) as { url?: string };
  if (data.url) {
    window.location.href = data.url;
  } else {
    window.location.href = "/pricing";
  }
}
