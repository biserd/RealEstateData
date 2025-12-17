import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, X, Zap, Crown, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

interface SubscriptionData {
  tier: string;
  status: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: { plan?: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: { tier?: string; features?: string } | null;
  prices: Price[];
}

const FREE_FEATURES = [
  { name: "Market Explorer", included: true, limit: "5 searches/day" },
  { name: "Opportunity Screener", included: true, limit: "View top 10 only" },
  { name: "Full Property Insights", included: true, limit: "3/day" },
  { name: "AI Assistant", included: false },
  { name: "Deal Memo Generator", included: false },
  { name: "PDF Reports", included: true, limit: "1/week" },
  { name: "Watchlists", included: true, limit: "1 list, 5 properties" },
  { name: "Alerts & Notifications", included: false },
  { name: "CSV/Bulk Exports", included: false },
  { name: "Developer API Access", included: false },
];

const PRO_FEATURES = [
  { name: "Market Explorer", included: true, limit: "Unlimited" },
  { name: "Opportunity Screener", included: true, limit: "Full access + filters" },
  { name: "Full Property Insights", included: true, limit: "Unlimited" },
  { name: "AI Assistant", included: true, limit: "Unlimited queries" },
  { name: "Deal Memo Generator", included: true, limit: "Unlimited" },
  { name: "PDF Reports", included: true, limit: "Unlimited" },
  { name: "Watchlists", included: true, limit: "Unlimited" },
  { name: "Basic Alerts", included: true, limit: "5 active alerts" },
  { name: "CSV/Bulk Exports", included: false },
  { name: "Developer API Access", included: false },
];

const PREMIUM_FEATURES = [
  { name: "Everything in Pro", included: true },
  { name: "Unlimited Alerts", included: true, limit: "Price & score changes" },
  { name: "Portfolio dashboard", included: true },
  { name: "Bulk CSV exports", included: true },
  { name: "Batch PDF generation", included: true },
  { name: "Branded client reports", included: true },
  { name: "Developer API Access", included: true, limit: "100K requests/day" },
  { name: "Priority support", included: true },
];

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data: subscription } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    enabled: !!user,
  });

  const { data: productsData, isLoading: isProductsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["/api/products"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/checkout", { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing-portal", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const proProduct = productsData?.data?.find(p => p.metadata?.tier === "pro" || p.name === "Pro Plan");
  const premiumProduct = productsData?.data?.find(p => p.metadata?.tier === "premium" || p.name === "Premium Plan");
  
  const proMonthlyPrice = proProduct?.prices?.find(p => p.recurring?.interval === "month");
  const proYearlyPrice = proProduct?.prices?.find(p => p.recurring?.interval === "year");
  const premiumMonthlyPrice = premiumProduct?.prices?.find(p => p.recurring?.interval === "month");
  const premiumYearlyPrice = premiumProduct?.prices?.find(p => p.recurring?.interval === "year");

  const proMonthlyAmount = proMonthlyPrice?.unit_amount ? proMonthlyPrice.unit_amount / 100 : 29;
  const proYearlyAmount = proYearlyPrice?.unit_amount ? proYearlyPrice.unit_amount / 100 : 290;
  const premiumMonthlyAmount = premiumMonthlyPrice?.unit_amount ? premiumMonthlyPrice.unit_amount / 100 : 79;
  const premiumYearlyAmount = premiumYearlyPrice?.unit_amount ? premiumYearlyPrice.unit_amount / 100 : 790;
  
  const proYearlySavings = (proMonthlyAmount * 12) - proYearlyAmount;
  const premiumYearlySavings = (premiumMonthlyAmount * 12) - premiumYearlyAmount;

  const currentTier = subscription?.tier || "free";
  const isActive = subscription?.status === "active";
  const isPro = currentTier === "pro" && isActive;
  const isPremium = currentTier === "premium" && isActive;

  const handleUpgrade = (tier: "pro" | "premium") => {
    if (!user) {
      setLocation("/login?redirect=/pricing");
      return;
    }
    if (isProductsLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we load pricing information...",
      });
      return;
    }
    
    let selectedPrice;
    if (tier === "pro") {
      selectedPrice = isYearly ? proYearlyPrice : proMonthlyPrice;
    } else {
      selectedPrice = isYearly ? premiumYearlyPrice : premiumMonthlyPrice;
    }
    
    if (!selectedPrice?.id) {
      toast({
        title: "Error",
        description: "Pricing not available. Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    checkoutMutation.mutate(selectedPrice.id);
  };

  const handleManageBilling = () => {
    portalMutation.mutate();
  };

  const renderTierButton = (tier: "free" | "pro" | "premium") => {
    if (tier === "free") {
      if (user) {
        return (
          <Button variant="outline" className="w-full" disabled data-testid="button-current-plan-free">
            {currentTier === "free" ? "Current Plan" : "Downgrade"}
          </Button>
        );
      }
      return (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setLocation("/register")}
          data-testid="button-get-started-free"
        >
          Get Started Free
        </Button>
      );
    }
    
    if (tier === "pro") {
      if (isPro) {
        return (
          <Button
            className="w-full"
            variant="outline"
            onClick={handleManageBilling}
            disabled={portalMutation.isPending}
            data-testid="button-manage-billing-pro"
          >
            {portalMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Manage Subscription"
            )}
          </Button>
        );
      }
      if (isPremium) {
        return (
          <Button variant="outline" className="w-full" disabled data-testid="button-downgrade-pro">
            Downgrade to Pro
          </Button>
        );
      }
      return (
        <Button
          className="w-full"
          onClick={() => handleUpgrade("pro")}
          disabled={checkoutMutation.isPending || isAuthLoading}
          data-testid="button-upgrade-pro"
        >
          {checkoutMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "Upgrade to Pro"
          )}
        </Button>
      );
    }
    
    if (tier === "premium") {
      if (isPremium) {
        return (
          <Button
            className="w-full"
            variant="outline"
            onClick={handleManageBilling}
            disabled={portalMutation.isPending}
            data-testid="button-manage-billing-premium"
          >
            {portalMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Manage Subscription"
            )}
          </Button>
        );
      }
      return (
        <Button
          className="w-full"
          onClick={() => handleUpgrade("premium")}
          disabled={checkoutMutation.isPending || isAuthLoading}
          data-testid="button-upgrade-premium"
        >
          {checkoutMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            "Upgrade to Premium"
          )}
        </Button>
      );
    }
    
    return null;
  };

  return (
    <>
      <SEO 
        title="Pricing - Plans for Every Real Estate Professional"
        description="Choose the plan that fits your needs. Free to get started, Pro for full access, or Premium for power users. Starting at $29/month."
      />
      <div className="min-h-screen bg-background">
      <MarketingHeader />
      
      <main className="container max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Pricing
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-pricing-title">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you need more. Pro unlocks full access, Premium adds power features for serious investors.
          </p>
          {user && (
            <p className="mt-4 text-sm text-muted-foreground">
              Logged in as <span className="font-medium text-foreground">{user.email}</span>
              {isPro && <Badge variant="default" className="ml-2">Pro</Badge>}
              {isPremium && <Badge className="ml-2 bg-gradient-to-r from-purple-500 to-pink-500">Premium</Badge>}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 mb-12">
          <Label htmlFor="billing-toggle" className={!isYearly ? "font-semibold" : "text-muted-foreground"}>
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={isYearly}
            onCheckedChange={setIsYearly}
            data-testid="switch-billing-toggle"
          />
          <Label htmlFor="billing-toggle" className={isYearly ? "font-semibold" : "text-muted-foreground"}>
            Yearly
          </Label>
          {isYearly && (
            <Badge variant="default" className="ml-2">
              Save up to ${premiumYearlySavings}
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Free Tier */}
          <Card className="relative">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Free</CardTitle>
              </div>
              <CardDescription>
                Get started with essential market intelligence
              </CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.name}
                      </span>
                      {feature.limit && (
                        <span className="text-sm text-muted-foreground ml-1">
                          ({feature.limit})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderTierButton("free")}
            </CardFooter>
          </Card>

          {/* Pro Tier */}
          <Card className="relative border-primary">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge variant="default">Most Popular</Badge>
            </div>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-primary" />
                <CardTitle>Pro</CardTitle>
              </div>
              <CardDescription>
                Full access to all core features and AI insights
              </CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">
                  ${isYearly ? Math.round(proYearlyAmount / 12) : proMonthlyAmount}
                </span>
                <span className="text-muted-foreground">/month</span>
                {isYearly && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed annually (${proYearlyAmount}/year) - Save ${proYearlySavings}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.name}
                      </span>
                      {feature.limit && (
                        <span className="text-sm text-muted-foreground ml-1">
                          ({feature.limit})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderTierButton("pro")}
            </CardFooter>
          </Card>

          {/* Premium Tier */}
          <Card className="relative border-2 border-transparent bg-gradient-to-b from-purple-500/10 to-pink-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Power User</Badge>
            </div>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <CardTitle>Premium</CardTitle>
              </div>
              <CardDescription>
                Advanced features for serious investors and teams
              </CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">
                  ${isYearly ? Math.round(premiumYearlyAmount / 12) : premiumMonthlyAmount}
                </span>
                <span className="text-muted-foreground">/month</span>
                {isYearly && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed annually (${premiumYearlyAmount}/year) - Save ${premiumYearlySavings}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PREMIUM_FEATURES.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                    <div>
                      <span>{feature.name}</span>
                      {feature.limit && (
                        <span className="text-sm text-muted-foreground ml-1">
                          ({feature.limit})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              {renderTierButton("premium")}
            </CardFooter>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="max-w-2xl mx-auto text-left space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground">
                We accept all major credit cards through Stripe, our secure payment processor.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground">
                Our Free tier gives you access to core features so you can explore the platform. Upgrade to Pro or Premium when you're ready for more.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What's the difference between Pro and Premium?</h3>
              <p className="text-muted-foreground">
                Pro gives you unlimited access to all core features including AI assistant, Deal Memo, and 5 active alerts. Premium adds unlimited alerts, portfolio dashboard, bulk exports, Developer API access, and priority support for power users.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I upgrade or downgrade later?</h3>
              <p className="text-muted-foreground">
                Absolutely! You can change your plan at any time through the billing portal. When upgrading, you'll be charged a prorated amount.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center text-muted-foreground">
          <p>
            Questions? Contact us at{" "}
            <a href="mailto:hello@realtorsdashboard.com" className="text-primary hover:underline">
              hello@realtorsdashboard.com
            </a>
          </p>
        </div>
      </main>
      
      <Footer />
      </div>
    </>
  );
}
