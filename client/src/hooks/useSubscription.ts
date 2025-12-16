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
  tier: "free" | "pro" | "premium";
  status: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionDetails: SubscriptionDetails | null;
}

export type SubscriptionTier = "free" | "pro" | "premium";

export function useSubscription() {
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    enabled: isAuthenticated,
  });

  const tier: SubscriptionTier = (data?.tier as SubscriptionTier) || "free";
  const isActive = data?.status === "active";
  const isPremium = tier === "premium" && isActive;
  const isPro = (tier === "pro" || tier === "premium") && isActive;
  const isFree = !isPro;

  const canAccess = (feature: string): boolean => {
    if (isPremium) return true;

    const proFeatures = [
      "ai_assistant",
      "deal_memo",
      "full_comps",
      "pdf_export",
      "unlimited_searches",
      "unlimited_unlocks",
      "unlimited_watchlists",
      "api_access",
      "investment_simulator",
    ];

    const premiumOnlyFeatures = [
      "alerts",
      "portfolio_dashboard",
      "bulk_csv_export",
      "batch_pdf",
      "branded_reports",
      "priority_support",
    ];

    if (premiumOnlyFeatures.includes(feature)) {
      return isPremium;
    }

    if (proFeatures.includes(feature)) {
      return isPro;
    }

    const freeFeatures = [
      "market_explorer_basic",
      "screener_view_only",
      "property_details_basic",
      "watchlist_single",
      "basic_comps",
    ];

    return freeFeatures.includes(feature);
  };

  const getFeatureLimit = (feature: string): number | null => {
    if (isPremium) return null;
    if (isPro && !["api_requests_day"].includes(feature)) return null;

    const limits: Record<string, number> = {
      daily_searches: isFree ? 5 : (isPro ? Infinity : 5),
      daily_unlocks: isFree ? 3 : Infinity,
      weekly_pdfs: isFree ? 1 : Infinity,
      screener_results: isFree ? 10 : Infinity,
      watchlist_count: isFree ? 1 : Infinity,
      watchlist_properties: isFree ? 5 : Infinity,
      api_requests_day: isPremium ? 50000 : (isPro ? 10000 : 0),
    };

    return limits[feature] ?? null;
  };

  const getRequiredTier = (feature: string): SubscriptionTier => {
    const premiumOnlyFeatures = [
      "alerts",
      "portfolio_dashboard",
      "bulk_csv_export",
      "batch_pdf",
      "branded_reports",
      "priority_support",
    ];

    const proFeatures = [
      "ai_assistant",
      "deal_memo",
      "full_comps",
      "pdf_export",
      "unlimited_searches",
      "unlimited_unlocks",
      "unlimited_watchlists",
      "api_access",
      "investment_simulator",
    ];

    if (premiumOnlyFeatures.includes(feature)) {
      return "premium";
    }

    if (proFeatures.includes(feature)) {
      return "pro";
    }

    return "free";
  };

  return {
    tier,
    isPro,
    isPremium,
    isFree,
    isActive,
    status: data?.status || null,
    isLoading,
    error,
    canAccess,
    getFeatureLimit,
    getRequiredTier,
    hasCustomer: !!data?.stripeCustomerId,
    hasSubscription: !!data?.stripeSubscriptionId,
    subscriptionDetails: data?.subscriptionDetails || null,
  };
}
