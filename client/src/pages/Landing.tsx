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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateOpportunitySlug } from "@/lib/propertySlug";
import { SUBSCRIPTION_PLANS } from "@shared/subscriptionPlans";
import { useEffect, useRef, useState } from "react";
import type { HomepageStats } from "@shared/homepageStats";
import { homepageMarketCopy } from "@shared/homepageMarketCopy";

function useNearViewport() {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const section = ref.current;
    if (!section || !window.IntersectionObserver) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: "600px 0px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return { ref, near };
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
  trend12m: number | null;
  trend6m: number | null;
  trend3m: number | null;
  medianPrice: number | null;
  transactionCount: number | null;
  avgOpportunityScore: number | null;
  momentum: "accelerating" | "steady" | "decelerating";
  latitude: number;
  longitude: number;
}

export default function Landing() {
  const { toast } = useToast();
  const statsSection = useNearViewport();
  const opportunitiesSection = useNearViewport();
  const trendingSection = useNearViewport();
  
  const { data: homepageStats, isLoading: statsQueryLoading, isError: statsError, refetch: refetchStats } = useQuery<HomepageStats>({
    queryKey: ["/api/stats/homepage"],
    enabled: statsSection.near,
    refetchInterval: (query) => query.state.status === "error" ? 30_000 : false,
  });

  const { data: topOpportunities, isLoading: opportunitiesQueryLoading, isError: opportunitiesError, isFetching: opportunitiesFetching, refetch: refetchOpportunities } = useQuery<TopOpportunity[]>({
    queryKey: ["/api/units/top-opportunities", { borough: "Manhattan", limit: 9 }],
    enabled: opportunitiesSection.near,
    queryFn: async () => {
      const res = await fetch("/api/units/top-opportunities?borough=Manhattan&limit=9", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch published opportunity candidates`);
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
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
    refetchInterval: (query) => query.state.status === "error" ? 30_000 : false,
  });

  const { data: trendingAreas, isLoading: trendingQueryLoading, isError: trendingError, isFetching: trendingFetching, refetch: refetchTrending } = useQuery<TrendingArea[]>({
    queryKey: ["/api/market/trending-zips", { limit: 6 }],
    enabled: trendingSection.near,
    queryFn: async () => {
      const res = await fetch("/api/market/trending-zips?limit=6", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}: Failed to fetch trending areas`);
      return res.json();
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
    refetchInterval: (query) => query.state.status === "error" ? 30_000 : false,
  });

  const statsLoading = statsQueryLoading || (!statsSection.near && !homepageStats);
  const opportunitiesLoading = opportunitiesQueryLoading || (!opportunitiesSection.near && !topOpportunities);
  const trendingLoading = trendingQueryLoading || (!trendingSection.near && !trendingAreas);

  const proMonthlyPrice = SUBSCRIPTION_PLANS.pro.prices.month;
  const proMonthlyAmount = proMonthlyPrice.unit_amount / 100;

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
    guestCheckoutMutation.mutate(proMonthlyPrice.id);
  };

  const formatNumber = (num: number): string => num.toLocaleString("en-US");

  const features = [
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: "Verified Sale Prices",
      description: "Review qualifying recorded sales in Florida and exact sale matches on eligible NYC property and condo pages.",
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Score Drivers Explained",
      description: "Transparent scoring with breakdowns like 'Below building median: 12%' and 'High liquidity: 8 sales'.",
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Market Intelligence",
      description: "Compare nationwide housing estimates and asking prices. See recorded-sale pricing bands in covered markets.",
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Up and Coming ZIPs",
      description: "Compare eligible ZIPs using current recorded-price trend, transaction velocity, liquidity, comp depth, and confidence.",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Grounded AI",
      description: "Optional AI summaries use displayed source-backed facts and citations. Verify every material statement before relying on it.",
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: "Watchlists & Alerts",
      description: "Save properties, monitor price changes, and get notified when opportunities arise.",
    },
    {
      icon: <Code className="h-6 w-6" />,
      title: "API and MCP access",
      description: "Use the REST API in your product or connect a compatible AI assistant to the published datasets.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Export & Reports",
      description: "Export market reports, property dossiers, and opportunity lists for clients and analysis.",
    },
  ];

  const realStats = homepageStats ? [
    { 
      value: formatNumber(homepageStats.saleBackedUnits),
      label: "Sale-Backed Units",
      icon: <HomeIcon className="h-5 w-5" />,
      highlight: true,
    },
    { 
      value: formatNumber(homepageStats.publicProperties),
      label: "Published Properties",
      icon: <Building2 className="h-5 w-5" />,
    },
    { 
      value: formatNumber(homepageStats.recordedSaleRows),
      label: "Recorded-Sale Rows",
      icon: <Receipt className="h-5 w-5" />,
    },
    { 
      value: formatNumber(homepageStats.publishedMarketSnapshots),
      label: "Published Market Snapshots",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    { 
      value: formatNumber(homepageStats.approvedDataFeeds),
      label: "Active Approved Feeds",
      icon: <Database className="h-5 w-5" />,
    },
  ] : [];

  return (
    <>
      <SEO 
        title={homepageMarketCopy.title}
        description={homepageMarketCopy.description}
      />
      <OrganizationJsonLd />
      <WebSiteJsonLd searchUrlTemplate="https://realtorsdashboard.com/housing-markets/search?q={search_term_string}" />
      <div className="min-h-screen bg-background">
        <MarketingHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl" data-testid="text-hero-headline">
                {homepageMarketCopy.headline[0]}{" "}
                <span className="text-primary">{homepageMarketCopy.headline[1]}</span>
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl" data-testid="text-hero-subhead">
                {homepageMarketCopy.intro}
              </p>
              
              <div className="mb-3 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-14 px-6 text-base">
                  <a href="/housing-markets">Explore U.S. housing markets <ArrowRight className="ml-2 h-5 w-5" /></a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-6 text-base"
                  data-testid="button-hero-get-pro"
                  onClick={handleGetPro}
                  disabled={guestCheckoutMutation.isPending}
                >
                  {guestCheckoutMutation.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : null}
                  Start 14-Day Pro Trial
                </Button>
              </div>
              <p className="mb-3 text-sm text-muted-foreground" data-testid="text-hero-trial">
                Free for 14 days, then ${proMonthlyAmount}/mo · No charge during trial · Cancel anytime
              </p>
              <div className="mx-auto mt-6 max-w-xl">
                <p className="mb-2 text-sm font-semibold">Search NYC properties and condo units</p>
                <SmartAddressSearch placeholder="Enter a NYC address or ZIP code" />
              </div>

              <nav className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm" aria-label="Published market data">
                {homepageMarketCopy.markets.map((area) => (
                  <a key={area.id} className="font-medium text-primary underline underline-offset-4" href={area.href}>{area.label}</a>
                ))}
              </nav>
            </div>
          </div>
        </section>

        <section className="border-t bg-background py-12" aria-labelledby="market-coverage">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-8 text-center">
              <h2 id="market-coverage" className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">What you can research</h2>
              <p className="text-muted-foreground">Choose a market to see the available data, measures, and reporting periods.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {homepageMarketCopy.markets.map((area) => (
                <div key={area.id} className="rounded-lg border bg-card p-5" data-testid={"coverage-row-" + area.id}>
                  <h3 className="font-semibold"><a className="text-primary underline underline-offset-4" href={area.href}>{area.label}</a></h3>
                  <p className="mt-2 text-sm text-muted-foreground">{area.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30 py-12" aria-labelledby="data-access">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 id="data-access" className="text-2xl font-bold tracking-tight md:text-3xl">Use our real estate data in your own workflow</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Access U.S. housing market data, Florida recorded sales, and verified New York City records.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {homepageMarketCopy.access.map(({ href, title, description }) => (
                <div key={href} className="rounded-lg border bg-card p-4">
                  <h3 className="font-semibold"><a className="text-primary underline underline-offset-4" href={href}>{title}</a></h3>
                  <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section ref={statsSection.ref} className="border-y bg-muted/30 py-12">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold text-muted-foreground">NYC recorded-sales publication</h2>
              {homepageStats && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {homepageStats.snapshotStatus === "last_known" ? "Last verified market snapshot published " : "Current market snapshot published "}
                  {new Date(homepageStats.publishedAt).toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "long", day: "numeric" })}
                </p>
              )}
            </div>
            {statsError && !homepageStats ? (
              <div className="rounded-lg border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                NYC publication counts are temporarily unavailable.
                <Button variant="outline" size="sm" className="ml-3" onClick={() => void refetchStats()}>Retry</Button>
              </div>
            ) : statsLoading ? (
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
            {homepageStats && (
              <p className="mt-5 text-center text-xs text-muted-foreground">
                These counts describe the NYC publication. Recorded-sale rows include transactions awaiting a match to a public property or unit.
              </p>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Link href="/tools">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-free-tools">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Free Data Tools</p>
                      <p className="text-sm text-muted-foreground">Instant NYC ZIP answers</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/market-intelligence">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-market-explorer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">NYC Market Explorer</p>
                      <p className="text-sm text-muted-foreground">Recorded pricing by ZIP and city</p>
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
                      <p className="text-sm text-muted-foreground">NYC ZIP momentum</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/methodology/data-coverage">
                <Card className="hover-elevate cursor-pointer h-full" data-testid="card-cta-coverage-data">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">Coverage Methodology</p>
                      <p className="text-sm text-muted-foreground">Sources, dates, limitations</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        <section ref={opportunitiesSection.ref} className="py-12 border-b bg-gradient-to-b from-emerald-50/50 to-background dark:from-emerald-950/20 dark:to-background">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="mb-2 text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-3">
                  <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <Flame className="h-4 w-4 relative" />
                  </span>
                  NYC Opportunity Candidates
                </h2>
                <p className="text-muted-foreground flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Updated on manual dataset publication</span>
                  </span>
                  <span aria-hidden>·</span>
                  <span>Published sale-backed units ranked by score</span>
                  {opportunitiesFetching && !opportunitiesLoading ? <><span aria-hidden>·</span><span>Refreshing…</span></> : null}
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
            ) : opportunitiesError ? (
              <Card data-testid="homepage-opportunities-error">
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="font-medium">Opportunity candidates are temporarily unavailable</p>
                  <p className="text-sm text-muted-foreground">The published feed did not respond after multiple attempts. The rest of the site remains available.</p>
                  <Button variant="outline" onClick={() => { void refetchOpportunities(); }}>Retry candidates</Button>
                </CardContent>
              </Card>
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
                        <CardContent className="pt-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <Badge variant={opp.priceType === "verified" ? "default" : "secondary"} className="text-xs">
                              {opp.priceType === "verified" ? "Verified sale" : "Estimated value"}
                            </Badge>
                            <span className={`text-sm font-bold ${isStrong ? "text-emerald-600" : "text-foreground"}`}>Score {opp.opportunityScore}/100</span>
                          </div>
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
                  <p className="font-medium">No opportunity candidates currently pass publication rules</p>
                  <p className="mt-2 text-sm text-muted-foreground">Browse the full screener or return after the next manually validated dataset publication.</p>
                </CardContent>
              </Card>
            )}

            <div className="mt-12 grid gap-6 md:grid-cols-3" data-testid="audience-proof-cards">
              {[
                {
                  icon: <TrendingUp className="h-5 w-5" />,
                  title: "For investors",
                  body: "Shortlist published condo candidates by comparing recorded transactions with verified sales, building-level context, and local market signals.",
                  testId: "audience-investors",
                },
                {
                  icon: <Target className="h-5 w-5" />,
                  title: "For buyer's agents",
                  body: "Walk clients through recorded pricing with clearer comps, score explanations, and market context before independent diligence.",
                  testId: "audience-agents",
                },
                {
                  icon: <BarChart3 className="h-5 w-5" />,
                  title: "For analysts",
                  body: "Turn published property, recorded-sale, and market data into a repeatable screening workflow with explicit geographic coverage.",
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

        <section ref={trendingSection.ref} className="py-12 border-b bg-gradient-to-b from-amber-50/40 to-background dark:from-amber-950/20 dark:to-background">
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
                  Published NYC ZIPs ranked by recorded-price momentum, transaction velocity, liquidity, and comp depth
                  {trendingFetching && !trendingLoading ? " · Refreshing…" : ""}
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
            ) : trendingError ? (
              <Card data-testid="homepage-trending-error">
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="font-medium">Published ZIP rankings are temporarily unavailable</p>
                  <p className="text-sm text-muted-foreground">The ranking feed did not respond after multiple attempts.</p>
                  <Button variant="outline" onClick={() => { void refetchTrending(); }}>Retry rankings</Button>
                </CardContent>
              </Card>
            ) : trendingAreas && trendingAreas.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trendingAreas.map((area) => {
                  const displayedTrend = area.trend6m;
                  const isUp = (displayedTrend ?? 0) >= 0;
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
                        <CardContent className="pt-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-xs font-mono">ZIP {area.zipCode}</Badge>
                            <Badge className={`text-xs capitalize ${momentumColor}`}>{area.momentum}</Badge>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 mb-2">
                            <p className="font-semibold truncate">{area.city}, {area.state}</p>
                            <span
                              className={`text-sm font-bold flex items-center gap-0.5 ${
                                isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {displayedTrend === null ? "Not reported" : `${isUp ? "+" : ""}${displayedTrend.toFixed(1)}%`}
                              {displayedTrend !== null ? <ArrowUpRight className={`h-3 w-3 ${isUp ? "" : "rotate-90"}`} /> : null}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Sales</p>
                              <p className="font-semibold">{area.transactionCount?.toLocaleString() ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Trend Score</p>
                              <p className="font-semibold">{area.trendScore}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Avg Score</p>
                              <p className="font-semibold">{area.avgOpportunityScore ?? "—"}</p>
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
                  <p className="font-medium">No ZIP currently passes the ranking publication rules</p>
                  <p className="mt-2 text-sm text-muted-foreground">The prior snapshot remains unchanged until a manually validated replacement is published.</p>
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

        <section className="border-t bg-muted/30 py-12">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto mb-10 max-w-3xl text-center" data-testid="data-sources-proof">
              <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
                See the source behind each number
              </h2>
              <p className="text-muted-foreground">
                Home values, asking prices, recorded sale prices, and price-index changes have different sources and reporting periods. Open a market report to see when each figure was published.
              </p>
            </div>
            <p className="mb-6 text-center text-sm font-medium uppercase tracking-wide text-muted-foreground">Powered by data from</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-muted-foreground">
              {[
                "U.S. Census Bureau",
                "Federal Housing Finance Agency",
                "Realtor.com Economic Research",
                "Florida Department of Revenue",
                "NYC Department of Finance",
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
              <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">How to use the published data</h2>
              <p className="text-muted-foreground">Start with market context, then check the recorded sales behind a property decision.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  type: "Screen",
                  quote: "Compare locations using published rents, home values, asking prices, and price changes from their stated periods.",
                  name: "Step 1",
                  role: "Market comparison",
                  location: "U.S. housing markets",
                  metric: "Published values and asking prices",
                },
                {
                  type: "Verify",
                  quote: "Check Florida recorded sales or NYC property and condo histories. Review the sale date or month, geography, and sample before drawing a conclusion.",
                  name: "Step 2",
                  role: "Evidence review",
                  location: "Source-backed records",
                  metric: "Visible provenance",
                },
                {
                  type: "Underwrite",
                  quote: "Include the geography, date, and source in your brief so another team member can reproduce your research.",
                  name: "Step 3",
                  role: "Research handoff",
                  location: "Reports and deal notes",
                  metric: "Source and reporting period",
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
                disabled={guestCheckoutMutation.isPending}
              >
                {guestCheckoutMutation.isPending ? (
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
              disabled={guestCheckoutMutation.isPending}
            >
              {guestCheckoutMutation.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : null}
              Get Pro - ${proMonthlyAmount}/mo
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
