import { useParams } from "wouter";
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
  XCircle
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyBreadcrumbs, BuildingContext } from "@/components/BuildingContext";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ScoreDriversList, type ScoreDriver } from "@/components/ScoreDriversList";

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
  buildingAvgPricePerYear: Array<{ year: number; avgPrice: number }>;
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

function MarketComparisonCard({ data }: { data: OpportunityData | undefined }) {
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
              ${data.lastSalePrice.toLocaleString()}
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

export default function UnitDetail() {
  const { unitBbl: idOrSlug } = useParams<{ unitBbl: string }>();

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
      />
      
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PropertyBreadcrumbs
          borough={unit.borough}
          buildingAddress={unit.buildingDisplayAddress}
          buildingBbl={unit.baseBbl}
          unitDesignation={unit.unitDesignation}
        />

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
                          ${lastSale.salePrice.toLocaleString()}
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
                <div className="grid md:grid-cols-2 gap-4">
                  <OpportunityScoreCard 
                    score={opportunityData?.opportunityScore ?? null}
                    breakdown={opportunityData?.scoreBreakdown ?? null}
                    opportunityData={opportunityData}
                  />
                  <MarketComparisonCard data={opportunityData} />
                </div>
                
                {opportunityData?.buildingAvgPricePerYear && opportunityData.buildingAvgPricePerYear.length > 0 && (
                  <Card data-testid="card-price-history">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Building Price Trends
                      </CardTitle>
                      <CardDescription>
                        Average sale prices in this building by year
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {opportunityData.buildingAvgPricePerYear.slice(0, 5).map((item) => (
                          <div 
                            key={item.year}
                            className="flex items-center justify-between p-2 rounded bg-muted/30"
                            data-testid={`row-price-year-${item.year}`}
                          >
                            <span className="text-sm font-medium">{item.year}</span>
                            <span className="text-sm">
                              ${item.avgPrice.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                                  ${sale.salePrice.toLocaleString()}
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
                <AIInsightsSection unitBbl={unit.unitBbl} />
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
                    ${lastSale.salePrice.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-last-sale-date">
                    {format(new Date(lastSale.saleDate), "MMMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
