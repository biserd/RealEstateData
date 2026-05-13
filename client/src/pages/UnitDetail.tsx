import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Home, 
  MapPin, 
  DollarSign, 
  Calendar, 
  History, 
  Building2, 
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Target,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Loader2,
  Info,
  FileText,
  XCircle,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { ResidenceJsonLd, BreadcrumbsJsonLd } from "@/components/JsonLd";
import { StreetViewImage } from "@/components/StreetViewImage";
import { InteractiveStreetView } from "@/components/InteractiveStreetView";
import { PropertyMap } from "@/components/PropertyMap";
import type { Property } from "@shared/schema";
import { AppLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NearbySchools } from "@/components/NearbySchools";
import { PropertyBreadcrumbs, BuildingContext } from "@/components/BuildingContext";
import { PageNarrative } from "@/components/PageNarrative";
import { PageFaq, buildUnitFaq } from "@/components/PageFaq";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ScoreDriversList, type ScoreDriver } from "@/components/ScoreDriversList";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useAnonUnitViewLimit } from "@/hooks/useAnonViewLimit";
import { PriceGate, LoginGateCard, AnonLimitDialog } from "@/components/UnitGating";

interface CondoUnit {
  unitBbl: string;
  baseBbl: string;
  unitDesignation: string | null;
  unitTypeHint: string | null;
  buildingDisplayAddress: string | null;
  unitDisplayAddress: string | null;
  borough: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface UnitSale {
  id: string;
  salePrice: number;
  saleDate: string;
  rawAddress: string | null;
  rawAptNumber: string | null;
}

interface OpportunityData {
  unitBbl: string;
  baseBbl: string;
  buildingMedianPrice: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  opportunityScore: number | null;
  scoreBreakdown: {
    vsMedian: number;
    trend: number;
    recency: number;
  } | null;
  buildingAvgPricePerYear: Array<{
    year: number;
    avgPrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    saleCount: number;
    yoyPct: number | null;
  }>;
  buildingTrendSummary: {
    threeYearPct: number | null;
    lastYearPct: number | null;
    direction: "up" | "down" | "flat";
  } | null;
  buildingSales?: Array<{ salePrice: number; saleDate: string }>;
}

interface AIInsights {
  answerSummary: string;
  keyNumbers?: Array<{ label: string; value: string; unit?: string }>;
  evidence?: Array<{ type: string; id: string; description: string }>;
  confidence?: string;
  limitations?: string[];
  context?: any;
  sources?: string[];
}

const unitTypeLabels: Record<string, string> = {
  residential: "Residential Unit",
  parking: "Parking Space",
  storage: "Storage Unit",
  commercial: "Commercial Unit",
};

function OpportunityScoreCard({ score, breakdown, opportunityData }: { 
  score: number | null; 
  breakdown: OpportunityData["scoreBreakdown"];
  opportunityData?: OpportunityData;
}) {
  const scoreDrivers: Array<{ label: string; value: string; impact: "positive" | "neutral" | "negative" }> = [];
  
  if (opportunityData?.buildingMedianPrice && opportunityData?.lastSalePrice) {
    const pctBelowMedian = ((opportunityData.buildingMedianPrice - opportunityData.lastSalePrice) / opportunityData.buildingMedianPrice) * 100;
    if (pctBelowMedian > 5) {
      scoreDrivers.push({
        label: "Below building median",
        value: `${Math.round(pctBelowMedian)}% below`,
        impact: "positive",
      });
    } else if (pctBelowMedian < -5) {
      scoreDrivers.push({
        label: "Above building median", 
        value: `${Math.abs(Math.round(pctBelowMedian))}% above`,
        impact: "negative",
      });
    }
  }
  
  if (opportunityData?.buildingSales?.length) {
    const salesCount = opportunityData.buildingSales.length;
    if (salesCount >= 8) {
      scoreDrivers.push({
        label: "High liquidity",
        value: `${salesCount} sales in building`,
        impact: "positive",
      });
    } else if (salesCount >= 4) {
      scoreDrivers.push({
        label: "Moderate activity",
        value: `${salesCount} sales in building`,
        impact: "neutral",
      });
    }
  }
  
  if (opportunityData?.lastSaleDate) {
    const daysSinceSale = (Date.now() - new Date(opportunityData.lastSaleDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSale < 180) {
      scoreDrivers.push({
        label: "Recent sale",
        value: `${Math.round(daysSinceSale)} days ago`,
        impact: "positive",
      });
    }
  }

  if (score === null) {
    return (
      <Card data-testid="card-opportunity-score-na">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            Opportunity Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not enough data to calculate score
          </p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (s >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 70) return "Strong Opportunity";
    if (s >= 50) return "Moderate Opportunity";
    return "Limited Opportunity";
  };

  return (
    <Card data-testid="card-opportunity-score">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" />
          Opportunity Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`} data-testid="text-opportunity-score">
            {score}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <Badge 
          variant="secondary"
          className={score >= 70 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : 
                    score >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}
          data-testid="badge-score-label"
        >
          {getScoreLabel(score)}
        </Badge>
        
        {scoreDrivers.length > 0 && (
          <div className="pt-2 border-t">
            <ScoreDriversList drivers={scoreDrivers} mode="compact" showHeader />
          </div>
        )}
        
        {breakdown && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">Score Components:</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">vs Median</span>
                <span className="font-medium">{breakdown.vsMedian}/40</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Market Trend</span>
                <span className="font-medium">{breakdown.trend}/30</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data Recency</span>
                <span className="font-medium">{breakdown.recency}/30</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketComparisonCard({ data, isAuthenticated }: { data: OpportunityData | undefined; isAuthenticated: boolean }) {
  if (!data || !data.buildingMedianPrice) {
    return null;
  }

  const priceDiff = data.lastSalePrice 
    ? ((data.buildingMedianPrice - data.lastSalePrice) / data.buildingMedianPrice * 100)
    : null;

  return (
    <Card data-testid="card-market-comparison">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Building Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Building Median</p>
          <p className="text-lg font-semibold" data-testid="text-building-median">
            ${data.buildingMedianPrice.toLocaleString()}
          </p>
        </div>
        {data.lastSalePrice && (
          <div>
            <p className="text-xs text-muted-foreground">Last Unit Sale</p>
            <p className="text-lg font-semibold" data-testid="text-last-unit-sale">
              <PriceGate value={data.lastSalePrice} authenticated={isAuthenticated} />
            </p>
          </div>
        )}
        {priceDiff !== null && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              {priceDiff > 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-600 dark:text-emerald-400" data-testid="text-price-diff">
                    {priceDiff.toFixed(1)}% below median
                  </span>
                </>
              ) : priceDiff < -10 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400" data-testid="text-price-diff">
                    {Math.abs(priceDiff).toFixed(1)}% above median
                  </span>
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground" data-testid="text-price-diff">
                    At market median
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AIInsightsSection({ unitBbl }: { unitBbl: string }) {
  const { data, isLoading, error } = useQuery<AIInsights>({
    queryKey: ["/api/units", unitBbl, "insights"],
    queryFn: async () => {
      const res = await fetch(`/api/units/${unitBbl}/insights`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!unitBbl,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-ai-insights-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Analysis
          </CardTitle>
          <CardDescription>Analyzing unit data...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card data-testid="card-ai-insights-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Unable to generate AI insights at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Helper function to get score color
  const getScoreColor = (score: number | null) => {
    if (score === null) return { bg: "bg-muted", text: "text-muted-foreground", ring: "stroke-muted" };
    if (score >= 80) return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-600 dark:text-emerald-400", ring: "stroke-emerald-500" };
    if (score >= 60) return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", ring: "stroke-blue-500" };
    if (score >= 40) return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-600 dark:text-yellow-400", ring: "stroke-yellow-500" };
    return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400", ring: "stroke-red-500" };
  };

  // Helper function to get confidence styling
  const getConfidenceStyle = (confidence: string | undefined) => {
    switch (confidence) {
      case "High":
        return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 };
      case "Medium":
        return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", icon: AlertTriangle };
      default:
        return { bg: "bg-muted", text: "text-muted-foreground", icon: Info };
    }
  };

  const confidenceStyle = getConfidenceStyle(data.confidence);
  const ConfidenceIcon = confidenceStyle.icon;

  return (
    <Card data-testid="card-ai-insights">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Analysis
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Investment insights based on available data
          {data.confidence && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${confidenceStyle.bg} ${confidenceStyle.text}`}>
              <ConfidenceIcon className="h-3 w-3" />
              {data.confidence} confidence
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Visual Score Dashboard */}
        {data.keyNumbers && data.keyNumbers.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.keyNumbers.slice(0, 5).map((num, i) => {
              const isScore = num.label.toLowerCase().includes("score");
              // Handle all forms of missing data: null, undefined, "N/A", "undefined", empty string
              const rawValue = num.value;
              const isNA = rawValue === "N/A" || rawValue === null || rawValue === undefined || 
                          rawValue === "undefined" || rawValue === "" || rawValue === "Unknown";
              const displayValue = isNA ? "N/A" : rawValue;
              const numValue = isScore && !isNA ? parseInt(String(rawValue).replace(/[^0-9]/g, "")) : null;
              const colors = isScore ? getScoreColor(numValue) : { bg: "bg-muted/50", text: "text-foreground", ring: "" };
              
              return (
                <div 
                  key={i} 
                  className={`relative flex flex-col items-center justify-center p-4 rounded-xl ${colors.bg} transition-all`}
                >
                  {isScore && numValue !== null ? (
                    <>
                      {/* Circular Progress Ring */}
                      <div className="relative w-16 h-16 mb-2">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="none"
                            className="text-muted/30"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            strokeWidth="6"
                            fill="none"
                            strokeLinecap="round"
                            className={colors.ring}
                            strokeDasharray={`${(numValue / 100) * 176} 176`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-lg font-bold ${colors.text}`} data-testid={`stat-ai-${i}`}>
                            {numValue}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-center text-muted-foreground font-medium">{num.label}</p>
                    </>
                  ) : (
                    <>
                      <p className={`text-2xl font-bold ${isNA ? "text-muted-foreground" : colors.text}`} data-testid={`stat-ai-${i}`}>
                        {displayValue}{num.unit && !isNA ? ` ${num.unit}` : ""}
                      </p>
                      <p className="text-xs text-center text-muted-foreground mt-1">{num.label}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary with better formatting */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-ai-response">
              {data.answerSummary}
            </div>
          </div>
        </div>

        {/* Data Quality Indicators */}
        {data.limitations && data.limitations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Data Quality Notes
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.limitations.slice(0, 4).map((lim, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-2 p-2 rounded-md bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30"
                >
                  <XCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-800 dark:text-amber-200">{lim}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Sources */}
        {data.evidence && data.evidence.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">Data Sources</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.evidence.map((ev, i) => (
                <span 
                  key={i} 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {ev.type}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimilarUnitsCard({ baseBbl, currentBbl, isAuthenticated }: { baseBbl: string; currentBbl: string; isAuthenticated: boolean }) {
  const { data } = useQuery<{ units: Array<{ unitBbl: string; slug: string | null; unitDesignation: string | null; unitDisplayAddress: string | null; lastSalePrice: number | null; lastSaleDate: string | null }> }>({
    queryKey: ["/api/buildings", baseBbl, "top-units", currentBbl],
    queryFn: async () => {
      const params = new URLSearchParams({ excludeBbl: currentBbl, limit: "6" });
      const res = await fetch(`/api/buildings/${baseBbl}/top-units?${params}`);
      if (!res.ok) return { units: [] };
      return res.json();
    },
    enabled: !!baseBbl,
  });

  const units = data?.units ?? [];
  if (!units.length) return null;

  return (
    <Card data-testid="card-similar-units">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          More Units in This Building
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {units.map((u) => {
          const href = u.slug ? `/unit/${u.slug}` : `/unit/${u.unitBbl}`;
          const label = u.unitDesignation || u.unitBbl.slice(-4);
          return (
            <Link key={u.unitBbl} href={href}>
              <div
                className="flex items-center justify-between gap-2 p-2.5 rounded-md hover-elevate cursor-pointer"
                data-testid={`row-similar-unit-${u.unitBbl}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Unit {label}</p>
                  {u.lastSalePrice && (
                    <p className="text-xs text-muted-foreground">
                      <PriceGate value={u.lastSalePrice} authenticated={isAuthenticated} />
                      {u.lastSaleDate ? ` · ${new Date(u.lastSaleDate).getFullYear()}` : ""}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </Link>
          );
        })}
        <Link href={`/building/${baseBbl}`}>
          <div
            className="flex items-center justify-between gap-2 p-2.5 rounded-md hover-elevate cursor-pointer mt-1 border-t pt-3"
            data-testid="link-view-all-units"
          >
            <span className="text-sm text-muted-foreground">View all units</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function UnitDetail() {
  const { unitBbl: idOrSlug } = useParams<{ unitBbl: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { isPro, isPremium } = useSubscription();
  const hasPro = isPro || isPremium;
  const anonView = useAnonUnitViewLimit(idOrSlug, !isAuthenticated);

  // First resolve the slug/id to get the actual unit data
  const { data: unit, isLoading, error } = useQuery<CondoUnit>({
    queryKey: ["/api/units/resolve", idOrSlug],
    queryFn: async () => {
      const res = await fetch(`/api/units/resolve/${encodeURIComponent(idOrSlug || "")}`);
      if (!res.ok) throw new Error("Failed to fetch unit");
      const data = await res.json();
      // The resolve endpoint returns { unitBbl, slug, unit: {...} }
      return data.unit || data;
    },
    enabled: !!idOrSlug,
  });

  // Use the resolved unitBbl for subsequent queries
  const resolvedUnitBbl = unit?.unitBbl;

  const { data: salesData } = useQuery<{ sales: UnitSale[]; count: number }>({
    queryKey: ["/api/units", resolvedUnitBbl, "sales"],
    queryFn: async () => {
      const res = await fetch(`/api/units/${resolvedUnitBbl}/sales`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
    enabled: !!resolvedUnitBbl,
  });

  const { data: opportunityData } = useQuery<OpportunityData>({
    queryKey: ["/api/units", resolvedUnitBbl, "opportunity"],
    queryFn: async () => {
      const res = await fetch(`/api/units/${resolvedUnitBbl}/opportunity`);
      if (!res.ok) throw new Error("Failed to fetch opportunity data");
      return res.json();
    },
    enabled: !!resolvedUnitBbl,
  });

  const nearbyZip = unit?.zipCode || "";
  const { data: nearbyProperties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties/area", { geoType: "zip", geoId: nearbyZip, limit: 50 }],
    queryFn: async () => {
      const res = await fetch(
        `/api/properties/area?geoType=zip&geoId=${encodeURIComponent(nearbyZip)}&limit=50`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!nearbyZip,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <LoadingState type="skeleton-details" />
        </div>
      </AppLayout>
    );
  }

  if (error || !unit) {
    return (
      <AppLayout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <EmptyState
            icon={<Home className="h-12 w-12" />}
            title="Unit not found"
            description="We couldn't find this condo unit in our database."
          />
        </div>
      </AppLayout>
    );
  }

  const lastSale = salesData?.sales?.[0];
  const unitTypeLabel = unitTypeLabels[unit.unitTypeHint || "residential"] || "Unit";
  const unitTitle = unit.unitDesignation 
    ? unit.unitDesignation 
    : unit.unitBbl.slice(-4);

  const seoTitle = `${unit.unitDisplayAddress || (unit.buildingDisplayAddress + ", " + unitTitle)} | ${unit.borough || "NYC"} Condo | Realtors Dashboard`;
  const seoDescription = `View ${unitTitle} at ${unit.buildingDisplayAddress || "NYC"}: sales history, market analysis, and AI-powered investment insights. ${unit.borough ? `Located in ${unit.borough}` : ""} ${unit.zipCode ? `ZIP ${unit.zipCode}` : ""}.`;

  return (
    <AppLayout>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={`https://realtorsdashboard.com${(unit as any).slug ? `/unit/${(unit as any).slug}` : `/unit/${unit.unitBbl}`}`}
      />
      <ResidenceJsonLd
        name={unit.unitDisplayAddress || `${unit.buildingDisplayAddress}, ${unitTitle}`}
        description={seoDescription}
        streetAddress={unit.buildingDisplayAddress || undefined}
        addressLocality={unit.borough || undefined}
        addressRegion="NY"
        postalCode={unit.zipCode || undefined}
        latitude={(unit as any).latitude}
        longitude={(unit as any).longitude}
        url={`https://realtorsdashboard.com${(unit as any).slug ? `/unit/${(unit as any).slug}` : `/unit/${unit.unitBbl}`}`}
      />
      <BreadcrumbsJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: unit.borough || "NYC", url: `/browse/ny` },
          { name: unit.buildingDisplayAddress || "Building", url: `/building/${unit.baseBbl}` },
          { name: unitTitle, url: `/unit/${(unit as any).slug || unit.unitBbl}` },
        ]}
      />

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PropertyBreadcrumbs
          borough={unit.borough}
          buildingAddress={unit.buildingDisplayAddress}
          buildingBbl={unit.baseBbl}
          unitDesignation={unit.unitDesignation}
        />

        {((unit as any).latitude && (unit as any).longitude) && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 aspect-[16/9] overflow-hidden rounded-lg border" data-testid="hero-streetview-unit">
              <InteractiveStreetView
                lat={(unit as any).latitude}
                lng={(unit as any).longitude}
                address={unit.buildingDisplayAddress}
              />
            </div>
            <div className="aspect-[16/9] md:aspect-auto overflow-hidden rounded-lg border" data-testid="map-unit-location">
              <PropertyMap
                properties={nearbyProperties}
                subjectProperty={{
                  id: unit.unitBbl,
                  address: unit.buildingDisplayAddress || "",
                  unit: unit.unitDesignation || null,
                  city: unit.borough || "",
                  state: "NY",
                  zipCode: unit.zipCode || "",
                  propertyType: "Condo",
                  beds: (unit as any).beds ?? null,
                  baths: (unit as any).baths ?? null,
                  sqft: (unit as any).sqft ?? null,
                  latitude: (unit as any).latitude,
                  longitude: (unit as any).longitude,
                } as Property}
                center={{ lat: (unit as any).latitude, lng: (unit as any).longitude }}
                zoom={15}
                height="100%"
              />
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card data-testid="card-unit-header">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <h1 className="text-xl font-semibold tracking-tight" data-testid="text-unit-title">
                      {unit.unitDisplayAddress || `${unit.buildingDisplayAddress}, ${unitTitle}`}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span data-testid="text-unit-address">
                        {unit.borough}{unit.zipCode ? `, ${unit.zipCode}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge data-testid="badge-unit-type">
                      {unitTypeLabel}
                    </Badge>
                    {opportunityData?.opportunityScore !== null && opportunityData?.opportunityScore !== undefined && (
                      <Badge 
                        variant="secondary"
                        className={opportunityData.opportunityScore >= 70 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" 
                          : opportunityData.opportunityScore >= 50
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                          : ""}
                        data-testid="badge-header-score"
                      >
                        Score: {opportunityData.opportunityScore}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Unit BBL</p>
                    <p className="font-mono text-sm truncate" data-testid="text-unit-bbl">
                      {unit.unitBbl}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-xs text-muted-foreground">Building BBL</p>
                    <p className="font-mono text-sm truncate" data-testid="text-base-bbl">
                      {unit.baseBbl}
                    </p>
                  </div>
                  {lastSale && (
                    <>
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">Last Sale</p>
                        <p className="font-semibold text-green-600" data-testid="text-header-last-sale">
                          <PriceGate value={lastSale.salePrice} authenticated={isAuthenticated} />
                        </p>
                      </div>
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">Sale Date</p>
                        <p className="text-sm" data-testid="text-header-sale-date">
                          {format(new Date(lastSale.saleDate), "MMM yyyy")}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList data-testid="tabs-unit">
                <TabsTrigger value="overview" data-testid="tab-overview">
                  <BarChart3 className="h-4 w-4 mr-1.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="sales" data-testid="tab-sales">
                  <History className="h-4 w-4 mr-1.5" />
                  Sales
                </TabsTrigger>
                <TabsTrigger value="ai" data-testid="tab-ai">
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  AI Analysis
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <PageNarrative kind="unit" refId={unit.unitBbl} />
                <div className="grid md:grid-cols-2 gap-4">
                  <OpportunityScoreCard 
                    score={opportunityData?.opportunityScore ?? null}
                    breakdown={opportunityData?.scoreBreakdown ?? null}
                    opportunityData={opportunityData}
                  />
                  <MarketComparisonCard data={opportunityData} isAuthenticated={isAuthenticated} />
                </div>
                
                {opportunityData?.buildingAvgPricePerYear && opportunityData.buildingAvgPricePerYear.length > 0 && (() => {
                  const years = opportunityData.buildingAvgPricePerYear.slice(0, 6);
                  const summary = opportunityData.buildingTrendSummary;
                  const maxMedian = Math.max(...years.map(y => y.medianPrice));
                  const minMedian = Math.min(...years.map(y => y.medianPrice));
                  const totalSales = years.reduce((s, y) => s + y.saleCount, 0);
                  const formatCompact = (n: number) =>
                    n >= 1_000_000
                      ? `$${(n / 1_000_000).toFixed(2)}M`
                      : n >= 1_000
                      ? `$${Math.round(n / 1_000)}K`
                      : `$${n}`;
                  const TrendIcon =
                    summary?.direction === "up"
                      ? TrendingUp
                      : summary?.direction === "down"
                      ? TrendingDown
                      : Minus;
                  const trendColor =
                    summary?.direction === "up"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : summary?.direction === "down"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground";
                  return (
                    <Card data-testid="card-price-history">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <TrendingUp className="h-4 w-4" />
                              Building Price Trends
                            </CardTitle>
                            <CardDescription>
                              Median sale price per year · {totalSales} sale{totalSales === 1 ? "" : "s"} across {years.length} year{years.length === 1 ? "" : "s"}
                            </CardDescription>
                          </div>
                          {summary && (summary.lastYearPct !== null || summary.threeYearPct !== null) && (
                            <div
                              className={`flex items-center gap-1.5 text-sm font-semibold ${trendColor}`}
                              data-testid="text-trend-summary"
                            >
                              <TrendIcon className="h-4 w-4" />
                              <span>
                                {summary.lastYearPct !== null
                                  ? `${summary.lastYearPct > 0 ? "+" : ""}${summary.lastYearPct}% YoY`
                                  : ""}
                                {summary.lastYearPct !== null && summary.threeYearPct !== null ? " · " : ""}
                                {summary.threeYearPct !== null
                                  ? `${summary.threeYearPct > 0 ? "+" : ""}${summary.threeYearPct}% 3yr`
                                  : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1.5">
                          {years.map((item) => {
                            const range = maxMedian - minMedian || 1;
                            const widthPct = Math.round(((item.medianPrice - minMedian) / range) * 80) + 20;
                            const yoyColor =
                              item.yoyPct === null
                                ? "text-muted-foreground bg-muted"
                                : item.yoyPct > 0
                                ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950"
                                : item.yoyPct < 0
                                ? "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950"
                                : "text-muted-foreground bg-muted";
                            return (
                              <div
                                key={item.year}
                                className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 p-2 rounded bg-muted/30"
                                data-testid={`row-price-year-${item.year}`}
                              >
                                <span className="text-sm font-medium tabular-nums">{item.year}</span>
                                <div className="relative h-6">
                                  <div
                                    className="absolute inset-y-0 left-0 rounded bg-primary/15 dark:bg-primary/25"
                                    style={{ width: `${widthPct}%` }}
                                  />
                                  <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                      {item.saleCount} sale{item.saleCount === 1 ? "" : "s"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                      {formatCompact(item.minPrice)}–{formatCompact(item.maxPrice)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold tabular-nums">
                                    {formatCompact(item.medianPrice)}
                                  </span>
                                  {item.yoyPct !== null && (
                                    <Badge
                                      variant="secondary"
                                      className={`text-[10px] px-1.5 py-0 h-5 font-medium ${yoyColor}`}
                                      data-testid={`badge-yoy-${item.year}`}
                                    >
                                      {item.yoyPct > 0 ? "+" : ""}
                                      {item.yoyPct}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                <NearbySchools
                  latitude={(unit as any).latitude}
                  longitude={(unit as any).longitude}
                />

                <PageFaq
                  items={buildUnitFaq({
                    displayAddress: unit.unitDisplayAddress || `${unit.buildingDisplayAddress}, ${unitTitle}`,
                    buildingAddress: unit.buildingDisplayAddress,
                    borough: unit.borough,
                    zipCode: unit.zipCode,
                    lastSalePrice: lastSale?.salePrice ?? opportunityData?.lastSalePrice ?? null,
                    lastSaleDate: lastSale?.saleDate ?? opportunityData?.lastSaleDate ?? null,
                    buildingMedianPrice: opportunityData?.buildingMedianPrice ?? null,
                    buildingSalesCount: opportunityData?.buildingSales?.length ?? null,
                    beds: (unit as any).beds ?? null,
                    baths: (unit as any).baths ?? null,
                    sqft: (unit as any).sqft ?? null,
                  })}
                />
              </TabsContent>

              <TabsContent value="sales">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Unit Sales History
                    </CardTitle>
                    <CardDescription>
                      {salesData?.count || 0} recorded transaction{(salesData?.count || 0) !== 1 ? "s" : ""} for this unit
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!salesData?.sales?.length ? (
                      <p className="text-center text-muted-foreground py-8">
                        No recorded sales for this unit
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {salesData.sales.map((sale) => (
                          <div 
                            key={sale.id}
                            className="flex items-center justify-between p-3 rounded-md border"
                            data-testid={`row-sale-${sale.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="font-medium">
                                  <PriceGate value={sale.salePrice} authenticated={isAuthenticated} />
                                </p>
                                {sale.rawAptNumber && (
                                  <p className="text-xs text-muted-foreground">
                                    Apt: {sale.rawAptNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(sale.saleDate), "MMM d, yyyy")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai">
                {hasPro ? (
                  <AIInsightsSection unitBbl={unit.unitBbl} />
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2" data-testid="text-ai-locked-title">AI Analysis is a Pro Feature</h3>
                      <p className="text-sm text-muted-foreground max-w-md mb-6" data-testid="text-ai-locked-description">
                        Upgrade to Pro for AI-powered investment analysis, market insights, and personalized recommendations for every property.
                      </p>
                      <Button onClick={() => navigate("/pricing")} data-testid="button-upgrade-ai">
                        <Crown className="mr-2 h-4 w-4" />
                        Upgrade to Pro
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <BuildingContext baseBbl={unit.baseBbl} currentUnitBbl={unit.unitBbl} />

            {lastSale && (
              <Card data-testid="card-last-sale">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Last Sale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-last-sale-price">
                    <PriceGate value={lastSale.salePrice} authenticated={isAuthenticated} />
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-last-sale-date">
                    {format(new Date(lastSale.saleDate), "MMMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            )}

            {unit.zipCode && (
              <Card data-testid="card-neighborhood-link">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Neighborhood</p>
                  <p className="font-medium">ZIP {unit.zipCode}</p>
                  {unit.borough && (
                    <p className="text-xs text-muted-foreground">{unit.borough}</p>
                  )}
                  <Link href={`/neighborhood/${unit.zipCode}?geoType=zip`}>
                    <button
                      className="mt-3 w-full flex items-center justify-between gap-2 text-sm font-medium text-foreground border rounded-md px-3 py-2 hover-elevate"
                      data-testid="button-neighborhood-report"
                    >
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        Neighborhood Report
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {isAuthenticated ? (
              <>
                <SimilarUnitsCard
                  baseBbl={unit.baseBbl}
                  currentBbl={unit.unitBbl}
                  isAuthenticated={isAuthenticated}
                />
                <RecentNeighborhoodSalesCard
                  zipCode={unit.zipCode}
                  borough={unit.borough}
                  isAuthenticated={isAuthenticated}
                />
              </>
            ) : (
              <>
                <LoginGateCard
                  title="Similar units in this building"
                  description="Sign up free to see comparable units, or unlock full data with Premium."
                  authenticated={false}
                  testId="card-gate-similar-units"
                />
                <LoginGateCard
                  title="Recent sales in this neighborhood"
                  description="Create a free account to compare recent sales nearby, or upgrade to Premium for unlimited access."
                  authenticated={false}
                  testId="card-gate-recent-sales"
                />
              </>
            )}
          </div>
        </div>
      </div>
      <AnonLimitDialog open={anonView.limitReached} authenticated={isAuthenticated} />
    </AppLayout>
  );
}

function RecentNeighborhoodSalesCard({
  zipCode,
  borough,
  isAuthenticated,
}: {
  zipCode: string | null;
  borough: string | null;
  isAuthenticated: boolean;
}) {
  type RecentSale = {
    id: string;
    salePrice: number;
    saleDate: string;
    property?: { address?: string | null; slug?: string | null; id?: string };
  };
  const { data: sales = [] } = useQuery<RecentSale[]>({
    queryKey: ["/api/market/recent-sales", "zip", zipCode],
    queryFn: async () => {
      if (!zipCode) return [];
      const res = await fetch(
        `/api/market/recent-sales?geoType=zip&geoId=${encodeURIComponent(zipCode)}&limit=8`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!zipCode,
  });

  if (!sales.length) return null;

  return (
    <Card data-testid="card-recent-neighborhood-sales">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Recent Sales Nearby
        </CardTitle>
        <CardDescription className="text-xs">
          {borough || `ZIP ${zipCode}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {sales.slice(0, 6).map((s) => {
          const addr = s.property?.address || "Recent sale";
          const href = s.property?.slug
            ? `/property/${s.property.slug}`
            : s.property?.id
            ? `/property/${s.property.id}`
            : null;
          const inner = (
            <div
              className="flex items-center justify-between gap-2 p-2.5 rounded-md hover-elevate cursor-pointer"
              data-testid={`row-recent-sale-${s.id}`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{addr}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(s.saleDate), "MMM yyyy")}
                </p>
              </div>
              <div className="text-sm font-semibold shrink-0">
                <PriceGate value={s.salePrice} authenticated={isAuthenticated} />
              </div>
            </div>
          );
          return href ? (
            <Link key={s.id} href={href}>{inner}</Link>
          ) : (
            <div key={s.id}>{inner}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
