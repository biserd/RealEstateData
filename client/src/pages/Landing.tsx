import { Link, useLocation } from "wouter";
import { useState } from "react";
import { ArrowRight, BarChart3, Target, Shield, Zap, MapPin, TrendingUp, Search, Building2, Receipt, GitCompare, Database, Loader2, Code, Heart, FileText, Crown, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  metadata?: { tier?: string };
  prices?: Array<{
    id: string;
    unit_amount: number;
    recurring?: { interval: string };
  }>;
}

interface PlatformStats {
  properties: number;
  sales: number;
  marketAggregates: number;
  comps: number;
  aiChats: number;
  dataSources: number;
}

export default function Landing() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: platformStats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/stats/platform"],
  });

  const { data: productsData, isLoading: isProductsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["/api/products"],
  });

  const proProduct = productsData?.data?.find(p => p.metadata?.tier === "pro" || p.name === "Pro Plan");
  const proMonthlyPrice = proProduct?.prices?.find(p => p.recurring?.interval === "month");
  const isCheckoutReady = !isProductsLoading && !!proMonthlyPrice?.id;

  const guestCheckoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/checkout/guest", { priceId });
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/market-explorer?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleGetPro = () => {
    if (proMonthlyPrice?.id) {
      guestCheckoutMutation.mutate(proMonthlyPrice.id);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return Math.floor(num / 1000000) + "M+";
    }
    if (num >= 1000) {
      return Math.floor(num / 1000) + "K+";
    }
    return num.toLocaleString() + "+";
  };

  const features = [
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Market Intelligence",
      description: "Instant pricing bands (P25/P50/P75) for any ZIP, city, or neighborhood across NY, NJ, and CT.",
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Opportunity Scoring",
      description: "Proprietary 0-100 scores with transparent breakdowns showing mispricing, confidence, and risk.",
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Up and Coming ZIPs",
      description: "Identify trending neighborhoods with our algorithm analyzing price appreciation and momentum.",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Grounded AI",
      description: "AI insights backed by real data with citations. No hallucinations, just evidence-based analysis.",
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: "Watchlists & Alerts",
      description: "Save properties, monitor price changes, and get notified when opportunities arise.",
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Deal Memo Generator",
      description: "AI-powered deal memos with market context, comparable sales, and investment analysis.",
    },
    {
      icon: <Code className="h-6 w-6" />,
      title: "Developer API",
      description: "RESTful API access for Pro subscribers to integrate property data into their own applications.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Export & Reports",
      description: "Export market reports, property dossiers, and opportunity lists for clients and analysis.",
    },
  ];

  const realStats = platformStats ? [
    { 
      value: formatNumber(platformStats.properties), 
      label: "Properties",
      icon: <Building2 className="h-5 w-5" />,
    },
    { 
      value: formatNumber(platformStats.sales), 
      label: "Sales Records",
      icon: <Receipt className="h-5 w-5" />,
    },
    { 
      value: formatNumber(platformStats.comps), 
      label: "Comp Analyses",
      icon: <GitCompare className="h-5 w-5" />,
    },
    { 
      value: formatNumber(platformStats.marketAggregates), 
      label: "Market Data Points",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    { 
      value: platformStats.dataSources.toString(), 
      label: "Data Sources",
      icon: <Database className="h-5 w-5" />,
    },
  ] : [];

  const coverageAreas = [
    { state: "New York", areas: "NYC, Long Island, Hudson Valley, Upstate" },
    { state: "New Jersey", areas: "Statewide coverage" },
    { state: "Connecticut", areas: "Statewide coverage" },
  ];

  return (
    <>
      <SEO 
        title="Realtors Dashboard - Real Estate Market Intelligence"
        description="AI-powered real estate intelligence for NY, NJ, and CT. Find underpriced properties, analyze market trends, and make data-driven investment decisions."
      />
      <div className="min-h-screen bg-background">
        <MarketingHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Find Underpriced Properties{" "}
                <span className="text-primary">Before Anyone Else</span>
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                Our proprietary Opportunity Score surfaces mispriced listings across NY, NJ, and CT. 
                Get AI-powered analysis, comparable sales data, and deal memos—all backed by real data.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                <Button 
                  size="lg" 
                  className="h-14 px-8 text-lg" 
                  data-testid="button-hero-get-pro"
                  onClick={handleGetPro}
                  disabled={!isCheckoutReady || guestCheckoutMutation.isPending}
                >
                  {isProductsLoading || guestCheckoutMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : null}
                  Get Pro - $29/mo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Link href="/investment-opportunities">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg" data-testid="button-hero-see-screener">
                    <Target className="mr-2 h-5 w-5" />
                    See Opportunity Screener
                  </Button>
                </Link>
              </div>

              <form onSubmit={handleSearch} className="mx-auto mb-8 max-w-xl">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search by ZIP code, city, or address..."
                      className="h-12 pl-12 pr-4 text-base"
                      data-testid="input-hero-search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="lg" className="h-12 px-6" data-testid="button-hero-search">
                    Search
                  </Button>
                </div>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
                {coverageAreas.map((area) => (
                  <div key={area.state} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>
                      <strong>{area.state}:</strong> {area.areas}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-12">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold text-muted-foreground">Our Database</h2>
            </div>
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
                {realStats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {stat.icon}
                    </div>
                    <p className="text-2xl font-bold text-primary md:text-3xl" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground md:text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="py-12 border-b">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-8 text-center">
              <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl">
                Explore Our Platform
              </h2>
              <p className="text-muted-foreground">
                Browse our tools without signing up
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link href="/market-intelligence">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-market-explorer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Market Explorer</p>
                      <p className="text-sm text-muted-foreground">Pricing by ZIP & city</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/investment-opportunities">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-opportunity-screener">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Opportunity Screener</p>
                      <p className="text-sm text-muted-foreground">Find underpriced properties</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/up-and-coming">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-up-and-coming">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Up and Coming</p>
                      <p className="text-sm text-muted-foreground">Trending ZIP codes</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/admin-console">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-coverage-map">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Coverage Map</p>
                      <p className="text-sm text-muted-foreground">Data availability</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                Data-Driven Real Estate Intelligence
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Make confident decisions with transparent pricing data, opportunity scoring, 
                and AI insights grounded in real market information.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card key={feature.title} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {feature.icon}
                    </div>
                    <h3 className="mb-2 font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">
                  Understand Market Pricing at a Glance
                </h2>
                <p className="mb-6 text-lg text-muted-foreground">
                  See exactly where a property stands relative to the market. Our pricing bands 
                  show you the 25th, 50th, and 75th percentile prices for any segment.
                </p>
                <ul className="space-y-4">
                  {[
                    "Filter by property type, beds, baths, year built, and size",
                    "Compare pricing across neighborhoods and ZIPs",
                    "Track 3, 6, and 12-month trends",
                    "Export market reports for clients",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <TrendingUp className="h-3 w-3" />
                      </div>
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border bg-card p-6 shadow-lg">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Median Price</p>
                    <p className="text-3xl font-bold">$685,000</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">$/sqft</p>
                    <p className="text-3xl font-bold">$425</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">P25</span>
                    <span className="font-medium">$520K</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200 dark:from-emerald-900/50 dark:via-amber-900/50 dark:to-red-900/50" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">3BR SFH • 1990-2009</span>
                    <span className="font-medium">P75: $875K</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Ready to Find Your Next Opportunity?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
              Join investors, agents, and analysts using Realtors Dashboard to make 
              smarter real estate decisions.
            </p>
            <Button 
              size="lg" 
              className="h-12 px-8 text-lg" 
              data-testid="button-cta"
              onClick={handleGetPro}
              disabled={!isCheckoutReady || guestCheckoutMutation.isPending}
            >
              {isProductsLoading || guestCheckoutMutation.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : null}
              Get Pro - $29/mo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>
      </main>

      <Footer />
      </div>
    </>
  );
}
