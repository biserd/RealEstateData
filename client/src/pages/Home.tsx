import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Home as HomeIcon, Bell, ArrowRight, MapPin, Building2, Target, Square, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layouts";
import { MarketStatsCard } from "@/components/MarketStatsCard";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { MarketAggregate, Notification } from "@shared/schema";

type TopOpportunity = {
  id: string;
  entityType: "building" | "unit";
  address: string;
  city: string;
  state: string;
  zipCode: string;
  borough?: string | null;
  price: number;
  priceType: "estimated" | "verified";
  pricePerSqft?: number | null;
  sqft?: number | null;
  yearBuilt?: number | null;
  propertyType?: string;
  opportunityScore: number;
  confidenceLevel?: string | null;
  unitBbl?: string;
  unitDesignation?: string | null;
  baseBbl?: string;
  lastSaleDate?: string | null;
  propertyId?: string;
};

function formatPrice(value: number | null | undefined): string {
  if (!value) return "N/A";
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function OpportunityCard({ opportunity }: { opportunity: TopOpportunity }) {
  const isUnit = opportunity.entityType === "unit";
  const href = isUnit 
    ? `/unit/${opportunity.unitBbl}` 
    : `/properties/${opportunity.address.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}-${opportunity.city.toLowerCase().replace(/\s+/g, '-')}-${opportunity.zipCode}-${opportunity.propertyId}`;
  
  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };
  
  const getScoreBg = (score: number) => {
    if (score >= 75) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (score >= 50) return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  return (
    <Link href={href}>
      <Card className="group hover-elevate h-full cursor-pointer" data-testid={`card-opportunity-${opportunity.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={isUnit 
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" 
                  : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                }
              >
                {isUnit ? <HomeIcon className="h-3 w-3 mr-1" /> : <Building2 className="h-3 w-3 mr-1" />}
                {isUnit ? "UNIT" : "BUILDING"}
              </Badge>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={opportunity.priceType === "verified"
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 cursor-help" 
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 cursor-help"
                    }
                  >
                    {opportunity.priceType === "verified" 
                      ? <><CheckCircle className="h-3 w-3 mr-1" />VERIFIED</> 
                      : <><AlertCircle className="h-3 w-3 mr-1" />ESTIMATED</>
                    }
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">
                    {opportunity.priceType === "verified" 
                      ? "Price from recorded sale transaction" 
                      : "Modeled estimate based on assessments"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="secondary" className={cn("cursor-help", getScoreBg(opportunity.opportunityScore))}>
              <Target className="h-3 w-3 mr-1" />
              <span className={cn("font-bold", getScoreColor(opportunity.opportunityScore))}>
                {opportunity.opportunityScore}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="text-lg font-bold leading-tight line-clamp-2">
              {opportunity.address}
            </h3>
            <p className="text-sm text-muted-foreground">
              {opportunity.city}, {opportunity.state} {opportunity.zipCode}
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatPrice(opportunity.price)}</span>
            <span className="text-sm text-muted-foreground">
              {opportunity.priceType === "verified" ? "Sale Price" : "Est. Value"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {opportunity.pricePerSqft && (
              <span>${opportunity.pricePerSqft}/sqft</span>
            )}
            {opportunity.sqft && (
              <div className="flex items-center gap-1">
                <Square className="h-3 w-3" />
                <span>{opportunity.sqft.toLocaleString()} sqft</span>
              </div>
            )}
            {opportunity.yearBuilt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{opportunity.yearBuilt}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();

  const { data: topOpportunities, isLoading: loadingOpportunities } = useQuery<TopOpportunity[]>({
    queryKey: ["/api/opportunities/top"],
    queryFn: async () => {
      const res = await fetch("/api/opportunities/top?limit=6");
      if (!res.ok) throw new Error("Failed to fetch opportunities");
      return res.json();
    },
  });

  const { data: marketStats, isLoading: loadingStats } = useQuery<MarketAggregate[]>({
    queryKey: ["/api/market/overview"],
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

  const quickActions = [
    {
      icon: <BarChart3 className="h-5 w-5" />,
      label: "Market Explorer",
      description: "Analyze pricing by ZIP, city, or neighborhood",
      href: "/market-intelligence",
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: "Opportunity Screener",
      description: "Find underpriced properties with filters",
      href: "/investment-opportunities",
    },
    {
      icon: <HomeIcon className="h-5 w-5" />,
      label: "My Watchlists",
      description: "Track saved properties and markets",
      href: "/saved-properties",
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-welcome">
            Welcome back, {user?.firstName || "there"}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening in your real estate markets
          </p>
        </div>

        {unreadCount > 0 && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">You have {unreadCount} new alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Properties matching your criteria have updates
                  </p>
                </div>
              </div>
              <Link href="/saved-properties">
                <Button variant="outline" data-testid="button-view-alerts">
                  View Alerts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="h-full hover-elevate cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {action.icon}
                  </div>
                  <div>
                    <p className="font-semibold">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Market Overview</h2>
            <Link href="/market-intelligence">
              <Button variant="ghost" size="sm" data-testid="link-explore-markets">
                Explore Markets
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingStats ? (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <LoadingState type="spinner" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-4">
              <MarketStatsCard
                label="NYC Median"
                value="$725K"
                trend={2.3}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
              <MarketStatsCard
                label="Long Island Median"
                value="$595K"
                trend={1.8}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
              <MarketStatsCard
                label="NJ Median"
                value="$485K"
                trend={-0.5}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
              <MarketStatsCard
                label="CT Median"
                value="$395K"
                trend={1.2}
                trendLabel="vs 3mo ago"
                icon={<MapPin className="h-5 w-5" />}
              />
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Top Opportunities</h2>
              <p className="text-sm text-muted-foreground">
                Highest scoring properties in your coverage areas
              </p>
            </div>
            <Link href="/investment-opportunities">
              <Button variant="ghost" size="sm" data-testid="link-view-all-opportunities">
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {loadingOpportunities ? (
            <LoadingState type="skeleton-cards" count={3} />
          ) : topOpportunities && topOpportunities.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {topOpportunities.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold">No opportunities yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Use the screener to find properties that match your criteria
                </p>
                <Link href="/investment-opportunities">
                  <Button data-testid="button-go-to-screener">
                    Open Screener
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
