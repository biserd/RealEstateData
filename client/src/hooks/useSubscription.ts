import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface SubscriptionDetails {
  currentPeriodEnd: number | null;
  currentPeriodStart: number | null;
  cancelAtPeriodEnd: boolean | null;
  cancelAt: number | null;
  canceledAt: number | null;
}

interface SubscriptionData {
  tier: "free" | "pro";
  status: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionDetails: SubscriptionDetails | null;
}

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    enabled: isAuthenticated,
  });

  const tier = data?.tier || "free";
  const isPro = tier === "pro" && data?.status === "active";
  const isFree = !isPro;

  const canAccess = (feature: string): boolean => {
    if (isPro) return true;

    const freeFeatures = [
      "market_explorer_basic",
      "screener_view_only",
      "property_details_basic",
      "watchlist_single",
    ];

    return freeFeatures.includes(feature);
  };

  const getFeatureLimit = (feature: string): number | null => {
    if (isPro) return null;

    const limits: Record<string, number> = {
      daily_searches: 5,
      screener_results: 10,
      watchlist_count: 1,
      watchlist_properties: 5,
    };

    return limits[feature] ?? null;
  };

  return {
    tier,
    isPro,
    isFree,
    status: data?.status || null,
    isLoading,
    error,
    canAccess,
    getFeatureLimit,
    hasCustomer: !!data?.stripeCustomerId,
    hasSubscription: !!data?.stripeSubscriptionId,
    subscriptionDetails: data?.subscriptionDetails || null,
  };
}
