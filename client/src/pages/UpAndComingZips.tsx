import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowRight,
  MapPin,
  Home,
  Building2,
  Activity,
  ChevronUp,
  ChevronDown,
  Minus,
  Sparkles,
  Info,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { PropertyMap } from "@/components/PropertyMap";
import { cn } from "@/lib/utils";
import type { UpAndComingZip } from "@shared/schema";

export default function UpAndComingZips() {
  const [stateFilter, setStateFilter] = useState<string>("all");

  const { data: upAndComingZips, isLoading, error } = useQuery<UpAndComingZip[]>({
    queryKey: ["/api/market/up-and-coming", stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateFilter !== "all") {
        params.append("state", stateFilter);
      }
      params.append("limit", "50");
      
      const res = await fetch(`/api/market/up-and-coming?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch trending areas");
      return res.json();
    },
  });

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(2)}M`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatTrend = (trend: number | null) => {
    if (trend === null || trend === undefined) return "N/A";
    const sign = trend >= 0 ? "+" : "";
    return `${sign}${trend.toFixed(1)}%`;
  };

  const getMomentumIcon = (momentum: string) => {
    switch (momentum) {
      case "accelerating":
        return <ChevronUp className="h-4 w-4" />;
      case "decelerating":
        return <ChevronDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case "accelerating":
        return "text-emerald-600 bg-emerald-50 dark:bg-emerald-950";
      case "decelerating":
        return "text-amber-600 bg-amber-50 dark:bg-amber-950";
      default:
        return "text-blue-600 bg-blue-50 dark:bg-blue-950";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-emerald-600";
    if (score >= 50) return "text-blue-600";
    if (score >= 25) return "text-amber-600";
    return "text-muted-foreground";
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return "bg-emerald-500";
    if (score >= 50) return "bg-blue-500";
    if (score >= 25) return "bg-amber-500";
    return "bg-muted";
  };

  const mapProperties = upAndComingZips
    ?.filter(z => z.latitude && z.longitude)
    .map(z => ({
      id: z.zipCode,
      address: z.city,
      city: z.city,
      state: z.state,
      zipCode: z.zipCode,
      latitude: z.latitude,
      longitude: z.longitude,
      opportunityScore: z.trendScore,
      estimatedValue: z.medianPrice,
      propertyType: "SFH",
      beds: null,
      baths: null,
      sqft: null,
      county: null,
      neighborhood: null,
      lotSize: null,
      yearBuilt: null,
      lastSalePrice: null,
      lastSaleDate: null,
      pricePerSqft: null,
      confidenceLevel: null,
      imageUrl: null,
      createdAt: null,
      updatedAt: null,
    })) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
                  Up & Coming ZIP Codes
                </h1>
              </div>
              <p className="text-muted-foreground mt-1">
                Discover trending neighborhoods with strong appreciation and investment potential
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-state-filter">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="NJ">New Jersey</SelectItem>
                  <SelectItem value="CT">Connecticut</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <LoadingState type="skeleton-cards" count={6} />
          ) : error ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="Unable to load data"
              description="There was an error fetching trending ZIP codes. Please try again."
            />
          ) : !upAndComingZips || upAndComingZips.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="No trending areas found"
              description="No ZIP codes with positive growth trends found in the selected area."
            />
          ) : (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 flex items-start gap-2">
                <HelpCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">How it works:</span> We analyze price trends, 
                  transaction volume, and market momentum to identify ZIP codes with strong appreciation potential. 
                  Higher trend scores indicate better investment opportunities.
                </p>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Trending Areas</p>
                        <p className="text-2xl font-semibold" data-testid="text-total-zips">
                          {upAndComingZips.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                        <Activity className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                              Avg Trend Score
                              <Info className="h-3 w-3" />
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px]">
                            <p className="text-xs">
                              Composite score (0-100) based on price appreciation, market momentum, 
                              and transaction volume. Higher = stronger growth trend.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <p className="text-2xl font-semibold" data-testid="text-avg-score">
                          {Math.round(upAndComingZips.reduce((sum, z) => sum + z.trendScore, 0) / upAndComingZips.length)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                        <ChevronUp className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 cursor-help">
                              Accelerating
                              <Info className="h-3 w-3" />
                            </p>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[220px]">
                            <p className="text-xs">
                              Areas where recent 3-month growth exceeds 6-month growth—momentum is increasing.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <p className="text-2xl font-semibold" data-testid="text-accelerating">
                          {upAndComingZips.filter(z => z.momentum === "accelerating").length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Properties</p>
                        <p className="text-2xl font-semibold" data-testid="text-total-properties">
                          {upAndComingZips.reduce((sum, z) => sum + z.propertyCount, 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {mapProperties.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4" />
                      Trending Areas Map
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <PropertyMap
                      properties={mapProperties as any}
                      height="350px"
                      showClustering={false}
                    />
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upAndComingZips.map((zip, index) => (
                  <Card 
                    key={zip.zipCode} 
                    className="hover-elevate transition-all"
                    data-testid={`card-zip-${zip.zipCode}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div className="relative cursor-help">
                                <div className={cn(
                                  "w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg",
                                  getScoreBg(zip.trendScore)
                                )}>
                                  {zip.trendScore}
                                </div>
                                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border flex items-center justify-center text-xs font-medium">
                                  {index + 1}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px]">
                              <div className="space-y-1">
                                <p className="font-medium text-xs">Trend Score: {zip.trendScore}</p>
                                <p className="text-xs text-muted-foreground">
                                  {zip.trendScore >= 75 
                                    ? "Hot market—strong appreciation potential"
                                    : zip.trendScore >= 50 
                                    ? "Warming up—positive growth signals"
                                    : "Emerging—early signs of growth"}
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg" data-testid={`text-zip-${zip.zipCode}`}>
                                {zip.zipCode}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {zip.state}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {zip.city}
                            </p>
                          </div>
                        </div>
                        
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              <Badge 
                                className={cn(
                                  "flex items-center gap-1 shrink-0",
                                  getMomentumColor(zip.momentum)
                                )}
                                variant="secondary"
                              >
                                {getMomentumIcon(zip.momentum)}
                                <span className="capitalize">{zip.momentum}</span>
                              </Badge>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[200px]">
                            <p className="text-xs">
                              {zip.momentum === "accelerating"
                                ? "Growth is speeding up—recent appreciation exceeds historical rate."
                                : zip.momentum === "decelerating"
                                ? "Growth is slowing—still positive but losing momentum."
                                : "Stable growth—consistent appreciation over time."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">12M</p>
                          <p className={cn(
                            "font-semibold text-sm",
                            (zip.trend12m ?? 0) > 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatTrend(zip.trend12m)}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">6M</p>
                          <p className={cn(
                            "font-semibold text-sm",
                            (zip.trend6m ?? 0) > 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatTrend(zip.trend6m)}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">3M</p>
                          <p className={cn(
                            "font-semibold text-sm",
                            (zip.trend3m ?? 0) > 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {formatTrend(zip.trend3m)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Home className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{zip.propertyCount} properties</span>
                          </div>
                          {zip.avgOpportunityScore && (
                            <div className="flex items-center gap-1.5">
                              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>Opp: {zip.avgOpportunityScore}</span>
                            </div>
                          )}
                        </div>
                        <div className="font-medium">
                          {formatPrice(zip.medianPrice)}
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <Link href={`/investment-opportunities?zipCodes=${zip.zipCode}`}>
                          <Button 
                            variant="outline" 
                            className="w-full"
                            data-testid={`button-view-properties-${zip.zipCode}`}
                          >
                            View Properties
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
