import { Link } from "wouter";
import { ArrowRight, BarChart3, Target, Shield, Zap, MapPin, TrendingUp, Building2, Receipt, Database, Loader2, Code, Heart, FileText, Crown, Bell, CheckCircle, Home as HomeIcon, Flame, Activity, Sparkles, ArrowUpRight } from "lucide-react";
import { ScoreDriversList } from "@/components/ScoreDriversList";
import { SmartAddressSearch } from "@/components/SmartAddressSearch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { StaticMapImage } from "@/components/StaticMapImage";
import { StreetViewImage } from "@/components/StreetViewImage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateOpportunitySlug } from "@/lib/propertySlug";

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
  condoUnits?: number;
}

interface ScoreDriver {
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
}

interface TopOpportunity {
  id: string;
  entityType: "building" | "unit";
  address: string;
  city: string;
  zipCode: string;
  price: number;
  priceType: "estimated" | "verified";
  opportunityScore: number;
  scoreDrivers?: ScoreDriver[];
  unitSlug?: string | null;
  unitBbl?: string;
  propertyId?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface TrendingArea {
  zipCode: string;
  city: string;
  state: string;
  trendScore: number;
  trend12m: number;
  trend6m: number;
  trend3m: number;
  medianPrice: number;
  transactionCount: number;
  avgOpportunityScore: number;
  momentum: "accelerating" | "steady" | "decelerating";
  latitude: number;
  longitude: number;
}

export default function Landing() {
  const { toast } = useToast();
  
  const { data: platformStats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/stats/platform"],
  });

  const { data: topOpportunities, isLoading: opportunitiesLoading } = useQuery<TopOpportunity[]>({
    queryKey: ["/api/units/top-opportunities", { borough: "Manhattan", limit: 9 }],
    queryFn: async () => {
      const res = await fetch("/api/units/top-opportunities?borough=Manhattan&limit=9");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: {
        units: Array<{
          unitBbl: string;
          slug: string | null;
          unitDesignation: string | null;
          unitDisplayAddress: string | null;
          buildingDisplayAddress: string | null;
          borough: string | null;
          zipCode: string | null;
          latitude: number | null;
          longitude: number | null;
          lastSalePrice: number;
          opportunityScore: number;
          scoreDrivers?: ScoreDriver[];
        }>;
      } = await res.json();
      return (data.units || []).map((u) => ({
        id: u.unitBbl,
        entityType: "unit" as const,
        address: u.unitDisplayAddress || u.buildingDisplayAddress || "",
        city: u.borough || "Manhattan",
        zipCode: u.zipCode || "",
        price: u.lastSalePrice,
        priceType: "verified" as const,
        opportunityScore: u.opportunityScore,
        scoreDrivers: u.scoreDrivers,
        unitSlug: u.slug,
        unitBbl: u.unitBbl,
        latitude: u.latitude,
        longitude: u.longitude,
      }));
    },
  });

  const { data: trendingAreas, isLoading: trendingLoading } = useQuery<TrendingArea[]>({
    queryKey: ["/api/market/up-and-coming", { limit: 6 }],
    queryFn: async () => {
      const res = await fetch("/api/market/up-and-coming?limit=6");
      if (!res.ok) throw new Error("Failed to fetch trending areas");
      return res.json();
    },
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
      icon: <CheckCircle className="h-6 w-6" />,
      title: "Verified Sale Prices",
      description: "300K+ NYC condo units with real transaction data. See actual sale prices, not estimates.",
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Score Drivers Explained",
      description: "Transparent scoring with breakdowns like 'Below building median: 12%' and 'High liquidity: 8 sales'.",
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Market Intelligence",
      description: "Instant pricing bands (P25/P50/P75) for any ZIP, city, or neighborhood across NY, NJ, and CT.",
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
      value: formatNumber(platformStats.condoUnits || 304000), 
      label: "Condo Units",
      icon: <HomeIcon className="h-5 w-5" />,
      highlight: true,
    },
    { 
      value: formatNumber(platformStats.properties), 
      label: "Properties",
      icon: <Building2 className="h-5 w-5" />,
    },
    { 
      value: formatNumber(platformStats.sales), 
      label: "Verified Sales",
      icon: <Receipt className="h-5 w-5" />,
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
      <OrganizationJsonLd />
      <WebSiteJsonLd searchUrlTemplate="https://realtorsdashboard.com/market-intelligence?q={search_term_string}" />
      <div className="min-h-screen bg-background">
        <MarketingHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl" data-testid="text-hero-headline">
                Transparent Opportunity Scoring{" "}
                <span className="text-primary">for NYC and Tri-State Real Estate</span>
              </h1>
              <p className="mb-4 text-lg text-muted-foreground md:text-xl" data-testid="text-hero-subhead">
                Verified sales intelligence across NY, NJ, and CT. Every Opportunity Score is built from public-record transactions, shows its inputs, and links the verified comps behind it - no black-box AVMs, no blended estimates.
              </p>
              <p className="mb-8 text-base text-foreground/80 font-medium" data-testid="text-hero-audience">
                Opportunity intelligence for investors, agents, analysts, and PropTech teams.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
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
                  Start 14-Day Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Link href="/investment-opportunities">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg" data-testid="button-hero-see-screener">
                    <Target className="mr-2 h-5 w-5" />
                    See Opportunity Screener
                  </Button>
                </Link>
              </div>
              <p className="mb-3 text-sm text-muted-foreground" data-testid="text-hero-trial">
                Free for 14 days, then $59/mo · No charge during trial · Cancel anytime
              </p>
              <p className="mx-auto mb-8 max-w-3xl text-sm font-medium text-foreground/80" data-testid="text-hero-credibility">
                300K+ verified NYC condo sales analyzed · NY, NJ, CT coverage · Transparent Opportunity Score · 14-day free trial, no charge today
              </p>

              <SmartAddressSearch 
                className="mx-auto mb-8 max-w-xl"
                placeholder="Search by address, ZIP, or city..."
              />

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
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center relative">
                    {i === 1 && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-xs animate-pulse opacity-60 pointer-events-none select-none" aria-hidden>Verified</Badge>
                      </div>
                    )}
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted animate-pulse" />
                    <p className="text-2xl font-bold md:text-3xl">
                      <span className="inline-block h-8 w-16 bg-muted rounded animate-pulse" aria-hidden />
                    </p>
                    <p className="text-xs text-muted-foreground md:text-sm">
                      <span className="inline-block h-4 w-20 bg-muted rounded animate-pulse" aria-hidden />
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
                {realStats.map((stat) => (
                  <div key={stat.label} className={`text-center ${stat.highlight ? "relative" : ""}`}>
                    {stat.highlight && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-xs">Verified</Badge>
                      </div>
                    )}
                    <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${stat.highlight ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
                      {stat.icon}
                    </div>
                    <p className={`text-2xl font-bold md:text-3xl ${stat.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-primary"}`} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
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

        <section className="py-12 border-b bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20 dark:to-background">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <Flame className="h-4 w-4 relative" />
                  </span>
                  Live Top Opportunities
                </h2>
                <p className="text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Refreshed in real time</span>
                  </span>
                  <span aria-hidden>·</span>
                  <span>Underpriced properties scored 70+</span>
                </p>
              </div>
              <Link href="/investment-opportunities">
                <Button variant="outline" data-testid="link-view-all-opportunities">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            {opportunitiesLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                  <Card key={i} className="h-full overflow-hidden">
                    <div className="aspect-[16/9] bg-muted animate-pulse" />
                    <CardContent className="pt-4 space-y-2">
                      <div className="h-5 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
                      <div className="h-6 w-20 rounded bg-muted animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : topOpportunities && topOpportunities.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topOpportunities.map((opp) => {
                  const isStrong = opp.opportunityScore >= 70;
                  const href = opp.entityType === "unit" 
                    ? (opp.unitSlug ? `/unit/${opp.unitSlug}` : `/unit/${opp.unitBbl}`)
                    : `/properties/${generateOpportunitySlug(opp)}`;
                  return (
                    <Link key={opp.id} href={href}>
                      <Card 
                        className={`hover-elevate cursor-pointer h-full overflow-hidden ${isStrong ? "border-emerald-300 dark:border-emerald-700" : ""}`}
                        data-testid={`card-live-opportunity-${opp.id}`}
                      >
                        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                          <StreetViewImage
                            lat={opp.latitude}
                            lng={opp.longitude}
                            address={opp.address}
                            width={640}
                            height={360}
                            rounded={false}
                            alt={`Photo of ${opp.address}`}
                          />
                          <div className="absolute top-2 right-2">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shadow-md ring-2 ring-background ${
                              isStrong 
                                ? "bg-emerald-500 text-white" 
                                : opp.opportunityScore >= 50 
                                  ? "bg-amber-500 text-white"
                                  : "bg-muted text-muted-foreground"
                            }`} title={`Opportunity Score ${opp.opportunityScore}/100`}>
                              {opp.opportunityScore}
                            </div>
                          </div>
                          <div className="absolute top-2 left-2">
                            <Badge variant={opp.priceType === "verified" ? "default" : "secondary"} className="text-xs shadow-md">
                              {opp.priceType === "verified" ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </>
                              ) : "Estimated"}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="pt-4">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <span className="text-xl font-bold">
                              ${opp.price >= 1000000 
                                ? (opp.price / 1000000).toFixed(2) + "M" 
                                : Math.round(opp.price / 1000) + "K"}
                            </span>
                          </div>
                          <p className="font-medium truncate" title={opp.address}>{opp.address}</p>
                          <p className="text-sm text-muted-foreground mb-3 truncate">{opp.city}, {opp.zipCode}</p>
                          <div className="min-h-[2.5rem]">
                            {opp.scoreDrivers && opp.scoreDrivers.length > 0 && (
                              <ScoreDriversList drivers={opp.scoreDrivers} mode="compact" maxItems={2} />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">Loading opportunities...</p>
                </CardContent>
              </Card>
            )}

            <div className="mt-12 grid gap-6 md:grid-cols-3" data-testid="audience-proof-cards">
              {[
                {
                  icon: <TrendingUp className="h-5 w-5" />,
                  title: "For investors",
                  body: "Shortlist underpriced condo opportunities faster by comparing each listing against verified sales, building-level pricing, and local market signals.",
                  testId: "audience-investors",
                },
                {
                  icon: <Target className="h-5 w-5" />,
                  title: "For buyer's agents",
                  body: "Walk clients through pricing with clearer comps, opportunity explanations, and market context before making an offer.",
                  testId: "audience-agents",
                },
                {
                  icon: <BarChart3 className="h-5 w-5" />,
                  title: "For analysts",
                  body: "Turn scattered property, sales, and neighborhood data into a repeatable screening workflow for NY, NJ, and CT markets.",
                  testId: "audience-analysts",
                },
              ].map((card) => (
                <Card key={card.title} className="h-full" data-testid={`card-${card.testId}`}>
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {card.icon}
                    </div>
                    <h3 className="mb-2 font-semibold">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">{card.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 border-b bg-gradient-to-b from-amber-50/40 to-background dark:from-amber-950/20 dark:to-background">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  Trending Neighborhoods
                </h2>
                <p className="text-muted-foreground">
                  Up and coming ZIPs ranked by price momentum and sales activity
                </p>
              </div>
              <Link href="/up-and-coming">
                <Button variant="outline" data-testid="link-view-all-trending">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            {trendingLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="h-full overflow-hidden">
                    <div className="aspect-[16/9] bg-muted animate-pulse" />
                    <CardContent className="pt-4 space-y-2">
                      <div className="h-5 w-1/2 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : trendingAreas && trendingAreas.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trendingAreas.map((area) => {
                  const trend12mPct = (area.trend12m * 100).toFixed(1);
                  const isUp = area.trend12m >= 0;
                  const momentumColor =
                    area.momentum === "accelerating"
                      ? "bg-emerald-500 text-white"
                      : area.momentum === "decelerating"
                        ? "bg-rose-500 text-white"
                        : "bg-amber-500 text-white";
                  return (
                    <Link key={area.zipCode} href={`/neighborhood/${area.zipCode}?geoType=zip`}>
                      <Card
                        className="hover-elevate cursor-pointer h-full overflow-hidden"
                        data-testid={`card-trending-zip-${area.zipCode}`}
                      >
                        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                          <StaticMapImage
                            center={{ lat: area.latitude, lng: area.longitude }}
                            zoom={12}
                            markers={[{ lat: area.latitude, lng: area.longitude, color: "orange" }]}
                            width={480}
                            height={270}
                            rounded={false}
                            alt={`Map of ZIP ${area.zipCode} in ${area.city}, ${area.state}`}
                          />
                          <div className="absolute top-2 right-2">
                            <Badge className={`text-xs shadow-md capitalize ${momentumColor}`}>
                              <Activity className="h-3 w-3 mr-1" />
                              {area.momentum}
                            </Badge>
                          </div>
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary" className="text-xs shadow-md font-mono">
                              {area.zipCode}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="pt-4">
                          <div className="flex items-baseline justify-between gap-2 mb-2">
                            <p className="font-semibold truncate">{area.city}, {area.state}</p>
                            <span
                              className={`text-sm font-bold flex items-center gap-0.5 ${
                                isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {isUp && "+"}{trend12mPct}%
                              <ArrowUpRight className={`h-3 w-3 ${isUp ? "" : "rotate-90"}`} />
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Sales</p>
                              <p className="font-semibold">{area.transactionCount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Trend Score</p>
                              <p className="font-semibold">{area.trendScore}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Score</p>
                              <p className="font-semibold">{area.avgOpportunityScore}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No trending areas yet.</p>
                </CardContent>
              </Card>
            )}
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

        <section className="border-t bg-background py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-10 text-center">
              <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">Coverage Across the Tri-State</h2>
              <p className="text-muted-foreground">Comprehensive data across New York, New Jersey, and Connecticut</p>
            </div>
            <div className="grid gap-8 lg:grid-cols-5 items-center">
              <div className="lg:col-span-3 aspect-[16/10] overflow-hidden rounded-lg border" data-testid="map-coverage">
                <StaticMapImage
                  center={{ lat: 40.95, lng: -73.85 }}
                  zoom={8}
                  markers={[
                    { lat: 40.7128, lng: -74.0060, color: "blue", label: "N" },
                    { lat: 40.7357, lng: -74.1724, color: "blue", label: "J" },
                    { lat: 41.7658, lng: -72.6734, color: "blue", label: "C" },
                  ]}
                  width={640}
                  height={400}
                  rounded={false}
                  alt="Coverage map of NY, NJ, and CT"
                />
              </div>
              <div className="lg:col-span-2 space-y-5">
                {coverageAreas.map((area) => (
                  <div key={area.state} className="flex items-start gap-3" data-testid={`coverage-row-${area.state.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold">{area.state}</p>
                      <p className="text-sm text-muted-foreground">{area.areas}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-12">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto mb-10 max-w-3xl text-center" data-testid="data-sources-proof">
              <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
                Built on the data investors already try to piece together manually
              </h2>
              <p className="text-muted-foreground">
                Realtors Dashboard brings together verified sales, property records, permits, violations, complaints, market trends, and neighborhood signals so you can evaluate opportunities with more context in one place.
              </p>
            </div>
            <p className="mb-6 text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">Powered by data from</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-muted-foreground">
              {[
                "NYC Open Data",
                "PLUTO",
                "DOB Permits",
                "311 Complaints",
                "HPD Violations",
                "CT Open Data (CAMA)",
                "NJ MOD-IV",
                "Zillow Research",
              ].map((src) => (
                <div key={src} className="flex items-center gap-2 text-sm font-medium" data-testid={`source-${src.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <Database className="h-4 w-4" />
                  <span>{src}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-12 text-center">
              <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">How teams use Realtors Dashboard</h2>
              <p className="text-muted-foreground">Three real workflows from across our user base</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  type: "Investor case study",
                  quote: "I filter the Opportunity Screener for Bronx and Hudson County multi-family scoring 75+ with verified comps in the last 12 months. Underwrote 6 deals in week one and closed on a 6-unit at $42K under the comp median. Recouped the annual Pro fee in two weeks.",
                  name: "Jordan M.",
                  role: "Multi-family Investor",
                  location: "Northern NJ",
                  metric: "$42K under comp median",
                },
                {
                  type: "Buyer-agent workflow",
                  quote: "Every morning I run a saved screener over my buyer's target ZIPs in Brooklyn and Queens, export the top 20 to CSV, then pull the Neighborhood Report Card for each shortlist. Cuts what used to be a 3-hour comp pull down to 20 minutes per buyer.",
                  name: "Priya R.",
                  role: "Buyer's Agent",
                  location: "NYC",
                  metric: "3 hrs to 20 min per buyer",
                },
                {
                  type: "API / developer integration",
                  quote: "We pull /api/properties and /api/market/stats nightly into our internal valuation model and trace every verified sale back to ACRIS. The 10K req/day Pro quota covers our entire NJ/CT analyst team without a custom enterprise contract.",
                  name: "Daniel K.",
                  role: "Head of Data, PropTech startup",
                  location: "Connecticut",
                  metric: "10K req/day Pro API",
                },
              ].map((t) => (
                <Card
                  key={t.name}
                  className="h-full flex flex-col"
                  data-testid={`testimonial-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <CardContent className="p-6 flex flex-col flex-1 gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" data-testid={`testimonial-type-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                        {t.type}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                    <div className="rounded-md bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                      {t.metric}
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.role} &middot; {t.location}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t py-16">
          <div className="mx-auto max-w-3xl px-4 text-center md:px-6" data-testid="conversion-reassurance">
            <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
              Start with the properties most worth a second look
            </h2>
            <p className="text-muted-foreground">
              Instead of scanning every listing manually, use the Opportunity Score to focus on properties with pricing, liquidity, and market signals that may deserve deeper review.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 px-8"
                data-testid="button-reassurance-trial"
                onClick={handleGetPro}
                disabled={!isCheckoutReady || guestCheckoutMutation.isPending}
              >
                {isProductsLoading || guestCheckoutMutation.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : null}
                Start 14-Day Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/investment-opportunities">
                <Button size="lg" variant="outline" className="h-12 px-8" data-testid="link-reassurance-screener">
                  Explore Opportunity Screener
                </Button>
              </Link>
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
              Get Pro - $59/mo
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
