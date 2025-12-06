import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, X, Zap, Crown, Loader2 } from "lucide-react";
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
  { name: "Property Details", included: true, limit: "Limited fields" },
  { name: "AI Assistant", included: false },
  { name: "Deal Memo Generator", included: false },
  { name: "Watchlists", included: true, limit: "1 list, 5 properties" },
  { name: "Alerts & Notifications", included: false },
  { name: "Export Reports", included: false },
  { name: "Developer API Access", included: false },
];

const PRO_FEATURES = [
  { name: "Market Explorer", included: true, limit: "Unlimited" },
  { name: "Opportunity Screener", included: true, limit: "Full access + filters" },
  { name: "Property Details", included: true, limit: "Complete data" },
  { name: "AI Assistant", included: true, limit: "Unlimited queries" },
  { name: "Deal Memo Generator", included: true, limit: "Unlimited" },
  { name: "Watchlists", included: true, limit: "Unlimited" },
  { name: "Alerts & Notifications", included: true, limit: "Unlimited" },
  { name: "Export Reports", included: true, limit: "Full access" },
  { name: "Developer API Access", included: true, limit: "10K requests/day" },
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

  const { data: productsData } = useQuery<{ data: Product[] }>({
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
  const monthlyPrice = proProduct?.prices?.find(p => p.recurring?.interval === "month");
  const yearlyPrice = proProduct?.prices?.find(p => p.recurring?.interval === "year");

  const selectedPrice = isYearly ? yearlyPrice : monthlyPrice;
  const monthlyAmount = monthlyPrice?.unit_amount ? monthlyPrice.unit_amount / 100 : 29;
  const yearlyAmount = yearlyPrice?.unit_amount ? yearlyPrice.unit_amount / 100 : 290;
  const yearlySavings = (monthlyAmount * 12) - yearlyAmount;

  const isPro = subscription?.tier === "pro" && subscription?.status === "active";

  const handleUpgrade = () => {
    if (!user) {
      setLocation("/login?redirect=/pricing");
      return;
    }
    if (!selectedPrice?.id) {
      toast({
        title: "Error",
        description: "Pricing not available. Please try again later.",
        variant: "destructive",
      });
      return;
    }
    checkoutMutation.mutate(selectedPrice.id);
  };

  const handleManageBilling = () => {
    portalMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      
      <main className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Pricing
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-pricing-title">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade when you need more. Pro unlocks the full power of real estate intelligence.
          </p>
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
              Save ${yearlySavings}
            </Badge>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
              {user ? (
                <Button variant="outline" className="w-full" disabled data-testid="button-current-plan">
                  {isPro ? "Downgrade" : "Current Plan"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setLocation("/register")}
                  data-testid="button-get-started-free"
                >
                  Get Started Free
                </Button>
              )}
            </CardFooter>
          </Card>

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
                Full access to all features and AI-powered insights
              </CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">
                  ${isYearly ? Math.round(yearlyAmount / 12) : monthlyAmount}
                </span>
                <span className="text-muted-foreground">/month</span>
                {isYearly && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed annually (${yearlyAmount}/year)
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature.name} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
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
              {isPro ? (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={portalMutation.isPending}
                  data-testid="button-manage-billing"
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
              ) : (
                <Button
                  className="w-full"
                  onClick={handleUpgrade}
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
              )}
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
                Our Free tier gives you access to core features so you can explore the platform. Upgrade to Pro when you're ready for unlimited access.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What's included in the AI features?</h3>
              <p className="text-muted-foreground">
                Pro members get access to our AI-powered property analysis, Deal Memo generator, and investment scenario calculator powered by advanced language models.
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
  );
}
