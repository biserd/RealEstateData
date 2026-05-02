import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch, useLocation } from "wouter";
import { Shield, HardHat, Train, Trees, Droplets, Building2, MapPin, ArrowRight, Lock, DollarSign, Home, Activity, TrendingUp, TrendingDown, BarChart3, Minus } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend, Area } from "recharts";
import { AppLayout } from "@/components/layouts";
import { SEO } from "@/components/SEO";
import { PlaceJsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PropertyMap } from "@/components/PropertyMap";
import type { Property } from "@shared/schema";
import { MarketStatsCard } from "@/components/MarketStatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";

interface NeighborhoodReport {
  geoId: string;
  geoType: string;
  geoName: string;
  state: string;
  grade: string;
  gradeScore: number;
  market: {
    medianPrice: number | null;
    medianPricePerSqft: number | null;
    p25Price: number | null;
    p75Price: number | null;
    transactionCount: number | null;
    trend3m: number | null;
    trend6m: number | null;
    trend12m: number | null;
    turnoverRate: number | null;
  } | null;
  propertyCount: number;
  avgPrice: number | null;
  avgSqft: number | null;
  typeDistribution: Record<string, number>;
  bedDistribution: Record<string, number>;
  indicators: {
    development: {
      totalPermits12m: number;
      newConstruction: number;
      majorAlterations: number;
      avgPermitsPerProperty: string;
      level: string;
    };
    safety: {
      totalViolations12m?: number;
      hazardousViolations?: number;
      avgViolationsPerProperty?: string;
      totalComplaints311?: number;
      noiseComplaints?: string;
      level: string;
      locked?: boolean;
    };
    transit: {
      avgScore?: number;
      level: string;
      locked?: boolean;
    };
    amenities: {
      avgScore?: number;
      level: string;
      locked?: boolean;
    };
    floodRisk: {
      avgRisk: number;
      level: string;
    };
    buildingHealth: {
      avgScore: number;
      level: string;
    };
  };
  isPro: boolean;
}

const gradeColors: Record<string, string> = {
  "A": "bg-emerald-500 text-white",
  "B+": "bg-green-500 text-white",
  "B": "bg-lime-500 text-white",
  "C+": "bg-amber-500 text-white",
  "C": "bg-yellow-500 text-black",
  "D": "bg-orange-500 text-white",
  "F": "bg-red-500 text-white",
};

function getLevelBadgeVariant(level: string): string {
  switch (level) {
    case "Excellent":
    case "Good":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "Moderate":
    case "Fair":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "Concerning":
    case "High":
    case "Poor":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "Low":
    case "Limited":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const indicatorIcons: Record<string, typeof Shield> = {
  development: HardHat,
  safety: Shield,
  transit: Train,
  amenities: Trees,
  floodRisk: Droplets,
  buildingHealth: Building2,
};

const indicatorLabels: Record<string, string> = {
  development: "Development Activity",
  safety: "Safety & Violations",
  transit: "Transit Access",
  amenities: "Amenities",
  floodRisk: "Flood Risk",
  buildingHealth: "Building Health",
};

export default function NeighborhoodReport() {
  const { geoId } = useParams<{ geoId: string }>();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const geoType = params.get("geoType") || "zip";
  const [, navigate] = useLocation();

  const { data: priceTrends } = useQuery<{
    geoId: string;
    geoType: string;
    years: Array<{
      year: number;
      saleCount: number;
      medianPrice: number | null;
      avgPrice: number | null;
      p25Price: number | null;
      p75Price: number | null;
      minPrice: number | null;
      maxPrice: number | null;
      medianPpsf: number | null;
      yoyPct: number | null;
    }>;
    summary: {
      totalSales: number;
      allTimeMedian: number | null;
      latestYear: number | null;
      latestYearMedian: number | null;
      latestYearCount: number | null;
      latestYoyPct: number | null;
      fiveYearChangePct: number | null;
      firstYear: number | null;
    } | null;
  }>({
    queryKey: ["/api/neighborhood", geoId, "price-trends", geoType],
    queryFn: async () => {
      if (!geoId) return { geoId: "", geoType, years: [], summary: null };
      const res = await fetch(`/api/neighborhood/${encodeURIComponent(geoId)}/price-trends?geoType=${encodeURIComponent(geoType)}`);
      if (!res.ok) return { geoId, geoType, years: [], summary: null };
      return res.json();
    },
    enabled: !!geoId && geoType === "zip",
  });

  const { data: areaProperties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties/area", { geoType, geoId, limit: 100 }],
    queryFn: async () => {
      if (!geoId) return [];
      const res = await fetch(`/api/properties/area?geoType=${encodeURIComponent(geoType)}&geoId=${encodeURIComponent(geoId)}&limit=100`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!geoId,
  });

  const { data, isLoading, error } = useQuery<NeighborhoodReport>({
    queryKey: ["/api/neighborhood", geoId, "report", geoType],
    queryFn: async () => {
      const res = await fetch(`/api/neighborhood/${encodeURIComponent(geoId!)}/report?geoType=${encodeURIComponent(geoType)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: !!geoId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <LoadingState type="skeleton-details" />
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <p className="text-muted-foreground" data-testid="text-error">Failed to load neighborhood report.</p>
          <Link href="/market-intelligence">
            <Button variant="outline" className="mt-4" data-testid="button-back-market">
              <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
              Back to Market Explorer
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const totalTypeCount = Object.values(data.typeDistribution).reduce((s, v) => s + v, 0);
  const totalBedCount = Object.values(data.bedDistribution).reduce((s, v) => s + v, 0);

  const sortedTypes = Object.entries(data.typeDistribution).sort((a, b) => b[1] - a[1]);
  const sortedBeds = Object.entries(data.bedDistribution).sort((a, b) => {
    const numA = parseInt(a[0]) || 99;
    const numB = parseInt(b[0]) || 99;
    return numA - numB;
  });

  const seoTitle = `${data.geoName} ${data.geoType === "zip" ? "ZIP Code" : "Neighborhood"} Report - Grade ${data.grade} | Realtors Dashboard`;
  const seoDesc = `${data.geoName} neighborhood report card. Grade ${data.grade} (${data.gradeScore}/100) based on ${data.propertyCount} properties.${data.market?.medianPrice ? ` Median price ${formatPrice(data.market.medianPrice)}.` : ""} Development, safety, transit, amenities, flood risk, and building health indicators.`;
  const canonicalPath = `/neighborhood/${encodeURIComponent(data.geoId)}?geoType=${encodeURIComponent(data.geoType)}`;

  return (
    <AppLayout>
      <SEO title={seoTitle} description={seoDesc} canonicalUrl={`https://realtorsdashboard.com${canonicalPath}`} />
      <PlaceJsonLd
        name={data.geoName}
        description={seoDesc}
        addressRegion={data.state || undefined}
        postalCode={data.geoType === "zip" ? data.geoId : undefined}
        url={`https://realtorsdashboard.com${canonicalPath}`}
      />
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <Breadcrumbs
          className="mb-4"
          items={[
            { name: "Market Intelligence", url: "/market-intelligence" },
            { name: data.geoName, url: canonicalPath },
          ]}
        />

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-lg text-2xl font-bold ${gradeColors[data.grade] || "bg-muted"}`} data-testid="badge-grade">
              {data.grade}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-neighborhood-name">
                {data.geoName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" data-testid="badge-grade-score">{data.gradeScore}/100</Badge>
                {data.state && <Badge variant="secondary" data-testid="badge-state">{data.state}</Badge>}
                <Badge variant="outline">
                  <MapPin className="mr-1 h-3 w-3" />
                  {data.geoType === "zip" ? "ZIP Code" : "Neighborhood"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {data.market && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            <MarketStatsCard
              label="Median Price"
              value={formatPrice(data.market.medianPrice || 0)}
              trend={data.market.trend3m || undefined}
              trendLabel="3mo"
              icon={<DollarSign className="h-5 w-5" />}
            />
            <MarketStatsCard
              label="Median $/sqft"
              value={`$${data.market.medianPricePerSqft?.toFixed(0) || "N/A"}`}
              icon={<Home className="h-5 w-5" />}
            />
            <MarketStatsCard
              label="Property Count"
              value={data.propertyCount}
              icon={<Building2 className="h-5 w-5" />}
            />
            <MarketStatsCard
              label="3mo Trend"
              value={`${(data.market.trend3m || 0) >= 0 ? "+" : ""}${(data.market.trend3m || 0).toFixed(1)}%`}
              icon={data.market.trend3m && data.market.trend3m >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            />
          </div>
        )}

        {!data.market && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
            <MarketStatsCard
              label="Property Count"
              value={data.propertyCount}
              icon={<Building2 className="h-5 w-5" />}
            />
            <MarketStatsCard
              label="Avg Price"
              value={data.avgPrice ? formatPrice(data.avgPrice) : "N/A"}
              icon={<DollarSign className="h-5 w-5" />}
            />
            <MarketStatsCard
              label="Avg Sqft"
              value={data.avgSqft ? data.avgSqft.toLocaleString() : "N/A"}
              icon={<Home className="h-5 w-5" />}
            />
            <MarketStatsCard
              label="Grade Score"
              value={`${data.gradeScore}/100`}
              icon={<Activity className="h-5 w-5" />}
            />
          </div>
        )}

        {priceTrends && priceTrends.years.length > 0 && (() => {
          const yearsWithMedian = priceTrends.years.filter((y) => y.medianPrice);
          if (yearsWithMedian.length === 0) return null;
          const summary = priceTrends.summary;
          const TrendIcon = summary?.fiveYearChangePct === null || summary?.fiveYearChangePct === undefined
            ? Minus
            : summary.fiveYearChangePct > 1
              ? TrendingUp
              : summary.fiveYearChangePct < -1
                ? TrendingDown
                : Minus;
          const trendColor = summary?.fiveYearChangePct === null || summary?.fiveYearChangePct === undefined
            ? "text-muted-foreground"
            : summary.fiveYearChangePct > 1
              ? "text-emerald-600"
              : summary.fiveYearChangePct < -1
                ? "text-red-600"
                : "text-muted-foreground";
          return (
            <Card className="mb-8" data-testid="card-price-trends">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Price Trends Over Time</CardTitle>
                  </div>
                  {summary && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" data-testid="badge-trend-total-sales">
                        {summary.totalSales.toLocaleString()} sales since {summary.firstYear}
                      </Badge>
                      {summary.allTimeMedian && (
                        <Badge variant="outline" data-testid="badge-trend-alltime-median">
                          All-time median {formatPrice(summary.allTimeMedian)}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Yearly median sale price and transaction volume for ZIP {priceTrends.geoId}, sourced from verified deed records.
                </p>
              </CardHeader>
              <CardContent>
                {summary && (
                  <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-md border p-3" data-testid="stat-trend-latest">
                      <p className="text-xs text-muted-foreground">{summary.latestYear} Median</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {summary.latestYearMedian ? formatPrice(summary.latestYearMedian) : "N/A"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {summary.latestYearCount?.toLocaleString() || 0} sales
                      </p>
                    </div>
                    <div className="rounded-md border p-3" data-testid="stat-trend-yoy">
                      <p className="text-xs text-muted-foreground">YoY Change</p>
                      <p className={`text-lg font-semibold tabular-nums ${
                        summary.latestYoyPct === null || summary.latestYoyPct === undefined
                          ? "text-muted-foreground"
                          : summary.latestYoyPct >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {summary.latestYoyPct === null || summary.latestYoyPct === undefined
                          ? "—"
                          : `${summary.latestYoyPct >= 0 ? "+" : ""}${summary.latestYoyPct.toFixed(1)}%`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">vs prior year</p>
                    </div>
                    <div className="rounded-md border p-3" data-testid="stat-trend-5yr">
                      <p className="text-xs text-muted-foreground">5-Year Change</p>
                      <p className={`text-lg font-semibold tabular-nums flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon className="h-4 w-4" />
                        {summary.fiveYearChangePct === null || summary.fiveYearChangePct === undefined
                          ? "—"
                          : `${summary.fiveYearChangePct >= 0 ? "+" : ""}${summary.fiveYearChangePct.toFixed(1)}%`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">since {summary.latestYear ? summary.latestYear - 5 : ""}</p>
                    </div>
                    <div className="rounded-md border p-3" data-testid="stat-trend-volume">
                      <p className="text-xs text-muted-foreground">Total Sales</p>
                      <p className="text-lg font-semibold tabular-nums">{summary.totalSales.toLocaleString()}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{summary.firstYear}–{summary.latestYear}</p>
                    </div>
                  </div>
                )}

                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={yearsWithMedian} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis
                        yAxisId="price"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => formatPrice(v)}
                      />
                      <YAxis
                        yAxisId="count"
                        orientation="right"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        allowDecimals={false}
                      />
                      <RTooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          fontSize: "12px",
                        }}
                        formatter={(v: number, name: string) => {
                          if (name === "Sales") return [v.toLocaleString(), name];
                          return [formatPrice(v), name];
                        }}
                        labelFormatter={(y) => `Year ${y}`}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar yAxisId="count" dataKey="saleCount" fill="hsl(var(--muted-foreground) / 0.25)" name="Sales" />
                      <Line yAxisId="price" type="monotone" dataKey="p25Price" stroke="hsl(217 91% 60% / 0.4)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="25th %ile" />
                      <Line yAxisId="price" type="monotone" dataKey="p75Price" stroke="hsl(217 91% 60% / 0.4)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="75th %ile" />
                      <Line yAxisId="price" type="monotone" dataKey="medianPrice" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 3 }} name="Median Price" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3 font-medium">Year</th>
                        <th className="text-right py-2 px-3 font-medium">Sales</th>
                        <th className="text-right py-2 px-3 font-medium">Median</th>
                        <th className="text-right py-2 px-3 font-medium">$/sqft</th>
                        <th className="text-right py-2 px-3 font-medium">Range</th>
                        <th className="text-right py-2 pl-3 font-medium">YoY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...yearsWithMedian].reverse().map((y) => (
                        <tr key={y.year} className="border-b last:border-0" data-testid={`row-trend-${y.year}`}>
                          <td className="py-2 pr-3 font-medium tabular-nums">{y.year}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{y.saleCount.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">{y.medianPrice ? formatPrice(y.medianPrice) : "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{y.medianPpsf ? `$${Math.round(y.medianPpsf).toLocaleString()}` : "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                            {y.p25Price && y.p75Price ? `${formatPrice(y.p25Price)}–${formatPrice(y.p75Price)}` : "—"}
                          </td>
                          <td className={`py-2 pl-3 text-right tabular-nums font-medium ${
                            y.yoyPct === null ? "text-muted-foreground" : y.yoyPct >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {y.yoyPct === null ? "—" : `${y.yoyPct >= 0 ? "+" : ""}${y.yoyPct.toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {(() => {
          const mapped = areaProperties.filter((p) => p.latitude && p.longitude);
          if (mapped.length === 0) return null;
          return (
            <Card className="mb-8" data-testid="card-neighborhood-map">
              <CardHeader>
                <CardTitle className="text-base">Area Map</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Showing {mapped.length} {mapped.length === 1 ? "property" : "properties"} in {data.geoName}. Click a marker to see details.
                </p>
              </CardHeader>
              <CardContent>
                <PropertyMap properties={mapped} height="500px" zoom={13} />
              </CardContent>
            </Card>
          );
        })()}

        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold" data-testid="text-indicators-heading">Neighborhood Indicators</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(["development", "safety", "transit", "amenities", "floodRisk", "buildingHealth"] as const).map((key) => {
              const indicator = data.indicators[key];
              const Icon = indicatorIcons[key];
              const label = indicatorLabels[key];
              const isLocked = "locked" in indicator && indicator.locked;

              return (
                <Card key={key} className="hover-elevate" data-testid={`card-indicator-${key}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getLevelBadgeVariant(indicator.level)}`} data-testid={`badge-level-${key}`}>
                      {indicator.level}
                    </span>
                  </CardHeader>
                  <CardContent>
                    {isLocked ? (
                      <div className="relative">
                        <div className="blur-sm select-none pointer-events-none">
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p>Detail metrics unavailable</p>
                            <p>Upgrade to see full data</p>
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/pricing")}
                            data-testid={`button-unlock-${key}`}
                          >
                            <Lock className="mr-1 h-3 w-3" />
                            Pro
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        {key === "development" && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Permits (12m)</span>
                              <span className="font-medium" data-testid="stat-permits-12m">{(indicator as any).totalPermits12m}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">New Construction</span>
                              <span className="font-medium">{(indicator as any).newConstruction}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Major Alterations</span>
                              <span className="font-medium">{(indicator as any).majorAlterations}</span>
                            </div>
                          </>
                        )}
                        {key === "safety" && !isLocked && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Violations (12m)</span>
                              <span className="font-medium">{(indicator as any).totalViolations12m}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Hazardous</span>
                              <span className="font-medium">{(indicator as any).hazardousViolations}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">311 Complaints</span>
                              <span className="font-medium">{(indicator as any).totalComplaints311}</span>
                            </div>
                          </>
                        )}
                        {key === "transit" && !isLocked && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Score</span>
                            <span className="font-medium">{(indicator as any).avgScore}</span>
                          </div>
                        )}
                        {key === "amenities" && !isLocked && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Score</span>
                            <span className="font-medium">{(indicator as any).avgScore}</span>
                          </div>
                        )}
                        {key === "floodRisk" && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Risk Score</span>
                            <span className="font-medium">{(indicator as any).avgRisk?.toFixed(2)}</span>
                          </div>
                        )}
                        {key === "buildingHealth" && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg Score</span>
                            <span className="font-medium">{(indicator as any).avgScore}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <Card data-testid="card-type-distribution">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Property Type Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedTypes.length > 0 ? (
                <div className="space-y-3">
                  {sortedTypes.map(([type, count]) => {
                    const pct = totalTypeCount > 0 ? (count / totalTypeCount) * 100 : 0;
                    return (
                      <div key={type}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{type}</span>
                          <span className="font-medium">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-bed-distribution">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Bedroom Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedBeds.length > 0 ? (
                <div className="space-y-3">
                  {sortedBeds.map(([bed, count]) => {
                    const pct = totalBedCount > 0 ? (count / totalBedCount) * 100 : 0;
                    return (
                      <div key={bed}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{bed}</span>
                          <span className="font-medium">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8" data-testid="card-actions">
          <CardContent className="flex flex-wrap gap-3 p-4">
            {data.geoType === "zip" && (
              <Link href={`/investment-opportunities?zipCodes=${encodeURIComponent(data.geoId)}`}>
                <Button data-testid="button-view-properties">
                  View Properties
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href={`/market-intelligence?q=${encodeURIComponent(data.geoId)}`}>
              <Button variant="outline" data-testid="button-market-data">
                Market Data
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
