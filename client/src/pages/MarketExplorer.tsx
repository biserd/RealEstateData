import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Search, MapPin, TrendingUp, TrendingDown, DollarSign, Home, Activity, Download, Building2, ArrowRight, Globe, Hash, Navigation, Layers, AlertCircle, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layouts";
import { MarketStatsCard } from "@/components/MarketStatsCard";
import { SegmentSelector } from "@/components/SegmentSelector";
import { CoverageBadge } from "@/components/CoverageBadge";
import { LoadingState } from "@/components/LoadingState";
import { SearchLimitUpgradeCard } from "@/components/SearchLimitUpgradeCard";
import { useToast } from "@/hooks/use-toast";
import { propertyTypes, bedsBands, yearBuiltBands } from "@shared/schema";
import type { MarketAggregate, Property, Sale } from "@shared/schema";
import type { DataEnvelope } from "@shared/dataEnvelope";
import { format } from "date-fns";
import { generatePropertySlug } from "@/lib/propertySlug";
import { Link } from "wouter";

const popularLocations = [
  { type: "state", id: "NY", name: "New York", state: "NY" },
  { type: "state", id: "NJ", name: "New Jersey", state: "NJ" },
  { type: "state", id: "CT", name: "Connecticut", state: "CT" },
  { type: "neighborhood", id: "cd-108", name: "Upper East Side, Manhattan", state: "NY" },
  { type: "neighborhood", id: "cd-301", name: "Williamsburg, Brooklyn", state: "NY" },
  { type: "neighborhood", id: "cd-401", name: "Astoria, Queens", state: "NY" },
  { type: "city", id: "hoboken", name: "Hoboken", state: "NJ" },
  { type: "city", id: "newark", name: "Newark", state: "NJ" },
  { type: "city", id: "stamford", name: "Stamford", state: "CT" },
  { type: "zip", id: "10001", name: "10001", state: "NY" },
  { type: "zip", id: "07030", name: "07030", state: "NJ" },
  { type: "zip", id: "06901", name: "06901", state: "CT" },
];

const geoTypeIcons: Record<string, typeof MapPin> = {
  state: Globe,
  city: Building2,
  zip: Hash,
  neighborhood: Navigation,
};

function formatPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getGeoTypeLabel(type: string): string {
  switch (type) {
    case "state": return "State";
    case "city": return "City";
    case "zip": return "ZIP Code";
    case "neighborhood": return "Neighborhood";
    default: return type;
  }
}

function getStateFull(code: string): string {
  switch (code) {
    case "NY": return "New York";
    case "NJ": return "New Jersey";
    case "CT": return "Connecticut";
    default: return code;
  }
}

export default function MarketExplorer() {
  const { toast } = useToast();
  const searchString = useSearch();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGeo, setSelectedGeo] = useState<{ type: string; id: string; name: string; state?: string } | null>(null);
  const [autoSelectFromUrl, setAutoSelectFromUrl] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const q = params.get("q");
    if (q) {
      setSearchQuery(q);
      setAutoSelectFromUrl(true);
    }
  }, []);

  const [propertyType, setPropertyType] = useState<string>("all");
  const [bedsBand, setBedsBand] = useState<string>("all");
  const [yearBuiltBand, setYearBuiltBand] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  const { data: marketOverviewResponse, isLoading: loadingOverview, isError: overviewError, refetch: refetchOverview } = useQuery<DataEnvelope<MarketAggregate>>({
    queryKey: ["/api/market/overview"],
    queryFn: async () => {
      const response = await fetch("/api/market/overview?envelope=1", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Market overview is temporarily unavailable");
      return await response.json() as DataEnvelope<MarketAggregate>;
    },
    staleTime: 5 * 60 * 1000,
  });
  const marketOverview = marketOverviewResponse?.records;

  const { data: marketDataResponse, isLoading, isError: marketError, refetch: refetchMarket } = useQuery<DataEnvelope<MarketAggregate>>({
    queryKey: ["/api/market/aggregates", selectedGeo?.type, selectedGeo?.id, propertyType, bedsBand, yearBuiltBand],
    queryFn: async () => {
      if (!selectedGeo) throw new Error("A geography must be selected");
      const params = new URLSearchParams({
        geoType: selectedGeo.type,
        geoId: selectedGeo.id,
        envelope: "1",
      });
      if (propertyType !== "all") params.append("propertyType", propertyType);
      if (bedsBand !== "all") params.append("bedsBand", bedsBand);
      if (yearBuiltBand !== "all") params.append("yearBuiltBand", yearBuiltBand);

      const res = await fetch(`/api/market/aggregates?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch market data");
      return await res.json() as DataEnvelope<MarketAggregate>;
    },
    enabled: !!selectedGeo,
  });
  const marketData = marketDataResponse?.records;

  const { data: areaProperties, isError: propertiesError, refetch: refetchProperties } = useQuery<Property[]>({
    queryKey: ["/api/properties/area", selectedGeo?.type, selectedGeo?.id],
    queryFn: async () => {
      if (!selectedGeo) return [];
      const params = new URLSearchParams({
        geoType: selectedGeo.type,
        geoId: selectedGeo.id,
        limit: "50",
      });

      const res = await fetch(`/api/properties/area?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch published properties for this area");
      return await res.json() as Property[];
    },
    enabled: !!selectedGeo,
  });

  const [searchLimitReached, setSearchLimitReached] = useState(false);

  const { data: searchResults, isLoading: searching } = useQuery<Array<{ type: string; id: string; name: string; state: string }>>({
    queryKey: ["/api/search/geo", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search/geo?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 429) {
        setSearchLimitReached(true);
        return [];
      }
      if (!res.ok) throw new Error("Search failed");
      setSearchLimitReached(false);
      return await res.json() as Array<{ type: string; id: string; name: string; state: string }>;
    },
    enabled: searchQuery.length >= 2,
  });

  useEffect(() => {
    if (autoSelectFromUrl && searchResults && searchResults.length > 0 && !selectedGeo) {
      setSelectedGeo(searchResults[0]);
      setAutoSelectFromUrl(false);
    }
  }, [autoSelectFromUrl, searchResults, selectedGeo]);

  const { data: recentSalesResponse, isLoading: loadingSales, isError: salesError, refetch: refetchSales } = useQuery<DataEnvelope<Sale & { property: Property }>>({
    queryKey: ["/api/market/recent-sales", selectedGeo?.type, selectedGeo?.id],
    queryFn: async () => {
      if (!selectedGeo) throw new Error("A geography must be selected");
      const params = new URLSearchParams({
        geoType: selectedGeo.type,
        geoId: selectedGeo.id,
        limit: "20",
        envelope: "1",
      });

      const res = await fetch(`/api/market/recent-sales?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch recent recorded sales");
      return await res.json() as DataEnvelope<Sale & { property: Property }>;
    },
    enabled: !!selectedGeo,
  });
  const recentSales = recentSalesResponse?.records;

  const groupedResults = useMemo(() => {
    if (!searchResults || searchResults.length === 0) return null;
    const groups: Record<string, Array<{ type: string; id: string; name: string; state: string }>> = {};
    for (const r of searchResults) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }
    const order = ["state", "neighborhood", "city", "zip"];
    return order
      .filter((t) => groups[t])
      .map((t) => ({ type: t, items: groups[t] }));
  }, [searchResults]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleSelectGeo = (geo: { type: string; id: string; name: string; state?: string }) => {
    setSelectedGeo(geo);
    setSearchQuery("");
    setSearchFocused(false);
  };

  const handleExportReport = async () => {
    if (!selectedGeo) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        geoType: selectedGeo.type,
        geoId: selectedGeo.id,
        format: "csv",
      });
      if (propertyType !== "all") params.append("propertyType", propertyType);
      if (bedsBand !== "all") params.append("bedsBand", bedsBand);
      if (yearBuiltBand !== "all") params.append("yearBuiltBand", yearBuiltBand);

      const response = await fetch(`/api/export/market-report?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `market-report-${selectedGeo.id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Report exported",
        description: `Market report for ${selectedGeo.name} downloaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export market report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const currentMarket = marketData?.[0];

  const propertyTypeOptions = [
    { value: "all", label: "All Types" },
    ...propertyTypes.map((t) => ({ value: t, label: t })),
  ];

  const bedsOptions = [
    { value: "all", label: "Any Beds" },
    ...bedsBands.map((b) => ({ value: b, label: `${b} Beds` })),
  ];

  const yearOptions = [
    { value: "all", label: "Any Year" },
    ...yearBuiltBands.map((y) => ({ value: y, label: y })),
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-page-title">Market Explorer</h1>
          <p className="text-muted-foreground">
            Analyze pricing and trends across New York, New Jersey, and Connecticut
          </p>
          <div className="mt-4 max-w-3xl rounded-md border bg-muted/30 p-4" data-testid="market-analyst-proof">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Market context before you make the call</h2>
            <p className="text-sm text-muted-foreground">
              Compare locations, pricing trends, and neighborhood signals so you can understand whether a property is attractive because of the deal itself, the market around it, or both.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by state, city, ZIP code, or neighborhood..."
              className="h-12 pl-12 text-lg"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              data-testid="input-market-search"
            />

            {searchFocused && searchQuery.length >= 2 && groupedResults && groupedResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border bg-popover shadow-lg max-h-80 overflow-y-auto">
                {groupedResults.map((group) => (
                  <div key={group.type}>
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50">
                      {getGeoTypeLabel(group.type)}s
                    </div>
                    {group.items.map((result) => {
                      const Icon = geoTypeIcons[result.type] || MapPin;
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover-elevate"
                          onClick={() => handleSelectGeo(result)}
                          data-testid={`search-result-${result.type}-${result.id}`}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{result.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getStateFull(result.state)}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {getGeoTypeLabel(result.type)}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {searchFocused && searchQuery.length >= 2 && searching && !searchLimitReached && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border bg-popover shadow-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              </div>
            )}

            {searchFocused && searchQuery.length >= 2 && searchLimitReached && (
              <div
                className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border bg-popover shadow-lg overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
              >
                <SearchLimitUpgradeCard
                  variant="compact"
                  onDismiss={() => setSearchFocused(false)}
                />
              </div>
            )}

            {searchFocused && searchQuery.length >= 2 && !searching && !searchLimitReached && searchResults && searchResults.length === 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border bg-popover shadow-lg p-4">
                <p className="text-sm text-muted-foreground">No results found. Try a different search term.</p>
              </div>
            )}
          </div>

          {searchLimitReached && (
            <div className="mt-4">
              <SearchLimitUpgradeCard variant="full" />
            </div>
          )}
        </div>

        {selectedGeo ? (
          <>
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedGeo(null);
                  setSearchQuery("");
                }}
                data-testid="button-back-overview"
              >
                <ArrowRight className="mr-1 h-3 w-3 rotate-180" />
                Back to overview
              </Button>
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold" data-testid="text-selected-geo">
                    {selectedGeo.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{getGeoTypeLabel(selectedGeo.type)}</Badge>
                    {selectedGeo.state && (
                      <Badge variant="secondary">{getStateFull(selectedGeo.state)}</Badge>
                    )}
                    <CoverageBadge level="Comps" />
                    {selectedGeo.state === "NY" &&
                      ["Manhattan", "Brooklyn", "Bronx", "Queens", "Staten Island"].some(
                        (borough) => selectedGeo.name.includes(borough) || selectedGeo.id.startsWith("10") || selectedGeo.id.startsWith("11")
                      ) && <CoverageBadge level="AltSignals" />}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportReport}
                  disabled={isExporting}
                  data-testid="button-export-report"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export Report"}
                </Button>
                <p className="max-w-xs text-right text-xs text-muted-foreground" data-testid="text-export-proof">
                  <span className="font-semibold text-foreground">Turn market research into client-ready context.</span>{" "}
                  Use market intelligence to support pricing conversations, investment memos, neighborhood comparisons, and buyer education.
                </p>
              </div>
            </div>

            {marketDataResponse && (
              <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm" data-testid="market-data-provenance">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Published market data</p>
                  <p className="text-xs text-muted-foreground">
                    Dataset {marketDataResponse.freshness.datasetVersion} · source through {marketDataResponse.freshness.sourceDate ? format(new Date(marketDataResponse.freshness.sourceDate), "MMM d, yyyy") : "not reported"} · {marketDataResponse.recordCount} published row{marketDataResponse.recordCount === 1 ? "" : "s"}
                  </p>
                </div>
                {marketDataResponse.matchMode !== "exact" && (
                  <p className="mt-2 text-amber-700 dark:text-amber-300">
                    {marketDataResponse.fallbackReason || "A broader verified geography is shown because the exact market did not meet publication rules."}
                  </p>
                )}
                {marketDataResponse.warnings.map((warning) => <p key={warning} className="mt-1 text-muted-foreground">{warning}</p>)}
              </div>
            )}

            <div className="mb-6 flex flex-wrap gap-4">
              <SegmentSelector
                label="Property Type"
                options={propertyTypeOptions}
                value={propertyType}
                onChange={(v) => setPropertyType(v as string)}
              />
              <SegmentSelector
                label="Bedrooms"
                options={bedsOptions}
                value={bedsBand}
                onChange={(v) => setBedsBand(v as string)}
              />
              <SegmentSelector
                label="Year Built"
                options={yearOptions}
                value={yearBuiltBand}
                onChange={(v) => setYearBuiltBand(v as string)}
              />
            </div>

            {isLoading ? (
              <LoadingState type="skeleton-details" />
            ) : (
              <>
                {currentMarket && (
                  <>
                    <div className="mb-8 grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
                      <MarketStatsCard
                        label="Median Price"
                        value={formatPrice(currentMarket.medianPrice || 0)}
                        trend={currentMarket.trend3m || 0}
                        trendLabel="3mo"
                        icon={<DollarSign className="h-5 w-5" />}
                      />
                      <MarketStatsCard
                        label="Median $/sqft"
                        value={`$${currentMarket.medianPricePerSqft?.toFixed(0) || "N/A"}`}
                        trend={currentMarket.trend3m || 0}
                        trendLabel="3mo"
                        icon={<Home className="h-5 w-5" />}
                      />
                      <MarketStatsCard
                        label="Transaction Volume"
                        value={currentMarket.transactionCount || 0}
                        trendLabel="last 12mo"
                        icon={<Activity className="h-5 w-5" />}
                      />
                      <MarketStatsCard
                        label="Turnover Rate"
                        value={`${((currentMarket.turnoverRate || 0) * 100).toFixed(1)}%`}
                        icon={<TrendingUp className="h-5 w-5" />}
                      />
                    </div>

                    <Card className="mb-8">
                      <CardHeader>
                        <CardTitle>Recorded-sale price range</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="table-market-price-range">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="py-2 pr-4 font-medium">Measure</th>
                                <th className="py-2 px-4 text-right font-medium">25th percentile</th>
                                <th className="py-2 px-4 text-right font-medium">Median</th>
                                <th className="py-2 pl-4 text-right font-medium">75th percentile</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b">
                                <td className="py-3 pr-4">Sale price</td>
                                <td className="py-3 px-4 text-right tabular-nums">{formatPrice(currentMarket.p25Price || 0)}</td>
                                <td className="py-3 px-4 text-right font-semibold tabular-nums">{formatPrice(currentMarket.medianPrice || 0)}</td>
                                <td className="py-3 pl-4 text-right tabular-nums">{formatPrice(currentMarket.p75Price || 0)}</td>
                              </tr>
                              <tr>
                                <td className="py-3 pr-4">Price per square foot</td>
                                <td className="py-3 px-4 text-right tabular-nums">{currentMarket.p25PricePerSqft ? `$${currentMarket.p25PricePerSqft.toLocaleString()}` : "Insufficient sample"}</td>
                                <td className="py-3 px-4 text-right font-semibold tabular-nums">{currentMarket.medianPricePerSqft ? `$${currentMarket.medianPricePerSqft.toLocaleString()}` : "Insufficient sample"}</td>
                                <td className="py-3 pl-4 text-right tabular-nums">{currentMarket.p75PricePerSqft ? `$${currentMarket.p75PricePerSqft.toLocaleString()}` : "Insufficient sample"}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Based on {currentMarket.transactionCount || 0} verified recorded transactions. Values are not live listing prices.
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}

                {!currentMarket && areaProperties && areaProperties.length > 0 && (
                  <div className="mb-8 grid gap-4 md:grid-cols-4">
                    <MarketStatsCard
                      label="Properties Found"
                      value={areaProperties.length}
                      icon={<Home className="h-5 w-5" />}
                    />
                    <MarketStatsCard
                      label="Avg. Opportunity Score"
                      value={Math.round(areaProperties.reduce((sum, p) => sum + (p.opportunityScore || 0), 0) / areaProperties.length)}
                      icon={<Activity className="h-5 w-5" />}
                    />
                    <MarketStatsCard
                      label="Avg. Price"
                      value={formatPrice(areaProperties.reduce((sum, p) => sum + (p.estimatedValue || 0), 0) / areaProperties.length)}
                      icon={<DollarSign className="h-5 w-5" />}
                    />
                    <MarketStatsCard
                      label="Coverage"
                      value="Property Data"
                      icon={<MapPin className="h-5 w-5" />}
                    />
                  </div>
                )}

                {(marketError || propertiesError) && (
                  <Card className="mb-6 border-destructive/50">
                    <CardContent className="flex gap-3 p-4">
                      <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                      <div className="space-y-3">
                        <p className="font-medium">Some market data could not be loaded</p>
                        <p className="text-sm text-muted-foreground">The page is showing the verified information that remains available. Retry or choose a broader geography for the full dataset.</p>
                        <Button variant="outline" size="sm" onClick={() => { void Promise.all([refetchMarket(), refetchProperties()]); }}>Retry market data</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Tabs defaultValue="properties" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="properties" data-testid="tab-properties">Published Properties</TabsTrigger>
                    {currentMarket && (
                      <>
                        <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
                        <TabsTrigger value="recent" data-testid="tab-recent">Recent Sales</TabsTrigger>
                        <TabsTrigger value="segments" data-testid="tab-segments">Segment Breakdown</TabsTrigger>
                      </>
                    )}
                  </TabsList>

                  <TabsContent value="properties">
                    <Card>
                      <CardHeader>
                        <CardTitle>Published properties in this market</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {areaProperties && areaProperties.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm" data-testid="table-area-properties">
                              <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                  <th className="py-2 pr-4 font-medium">Property</th>
                                  <th className="py-2 px-4 font-medium">Type</th>
                                  <th className="py-2 px-4 text-right font-medium">Recorded / estimated value</th>
                                  <th className="py-2 px-4 text-right font-medium">Size</th>
                                  <th className="py-2 pl-4 text-right font-medium">Opportunity score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {areaProperties.slice(0, 25).map((property) => (
                                  <tr key={property.id} className="border-b last:border-0">
                                    <td className="py-3 pr-4">
                                      <Link href={`/properties/${generatePropertySlug(property)}`} className="font-medium hover:text-primary">
                                        {property.address}
                                      </Link>
                                      <p className="text-xs text-muted-foreground">{property.city}, {property.state} {property.zipCode}</p>
                                    </td>
                                    <td className="py-3 px-4">{property.propertyType || "Not classified"}</td>
                                    <td className="py-3 px-4 text-right tabular-nums">{formatPrice(property.estimatedValue || property.lastSalePrice || 0)}</td>
                                    <td className="py-3 px-4 text-right tabular-nums">{property.sqft ? `${property.sqft.toLocaleString()} sqft` : "Not reported"}</td>
                                    <td className="py-3 pl-4 text-right font-semibold tabular-nums">{property.opportunityScore ?? "Not scored"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="flex gap-3 rounded-md border bg-muted/30 p-4">
                            <Database className="mt-0.5 h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">No exact property records are published for this geography</p>
                              <p className="text-sm text-muted-foreground">Use the market statistics and recorded sales above, or choose the state to see verified broader coverage.</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {currentMarket && (
                    <>
                      <TabsContent value="trends">
                        <Card>
                          <CardContent className="p-6">
                            <div className="grid gap-6 md:grid-cols-3">
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">3-Month Trend</p>
                                <div className="flex items-center gap-2">
                                  {(currentMarket.trend3m || 0) >= 0 ? (
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <TrendingDown className="h-5 w-5 text-red-500" />
                                  )}
                                  <span className="text-2xl font-bold">{currentMarket.trend3m?.toFixed(1) || 0}%</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">6-Month Trend</p>
                                <div className="flex items-center gap-2">
                                  {(currentMarket.trend6m || 0) >= 0 ? (
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <TrendingDown className="h-5 w-5 text-red-500" />
                                  )}
                                  <span className="text-2xl font-bold">{currentMarket.trend6m?.toFixed(1) || 0}%</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">12-Month Trend</p>
                                <div className="flex items-center gap-2">
                                  {(currentMarket.trend12m || 0) >= 0 ? (
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <TrendingDown className="h-5 w-5 text-red-500" />
                                  )}
                                  <span className="text-2xl font-bold">{currentMarket.trend12m?.toFixed(1) || 0}%</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="recent">
                        <Card>
                          <CardContent className="p-6">
                            {loadingSales ? (
                              <div className="flex items-center justify-center py-8">
                                <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : salesError ? (
                              <div className="flex gap-3 rounded-md border border-destructive/40 p-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                                <div className="space-y-3">
                                  <p className="font-medium">Recent sales are temporarily unavailable</p>
                                  <p className="text-sm text-muted-foreground">This is a data-load error, not a zero-sales result.</p>
                                  <Button variant="outline" size="sm" onClick={() => { void refetchSales(); }}>Retry recent sales</Button>
                                </div>
                              </div>
                            ) : recentSales && recentSales.length > 0 ? (
                              <div className="space-y-4">
                                <div className="grid gap-4">
                                  {recentSales.map((sale) => (
                                    <div
                                      key={sale.id}
                                      className="flex items-center justify-between rounded-lg border p-4 hover-elevate"
                                    >
                                      <div className="flex-1">
                                        <Link href={`/properties/${generatePropertySlug(sale.property)}`}>
                                          <p className="font-medium hover:text-primary" data-testid={`text-sale-address-${sale.id}`}>
                                            {sale.property.address}
                                          </p>
                                        </Link>
                                        <p className="text-sm text-muted-foreground">
                                          {sale.property.city}, {sale.property.state} {sale.property.zipCode}
                                        </p>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                          {sale.property.propertyType && (
                                            <Badge variant="outline" className="text-xs">
                                              {sale.property.propertyType}
                                            </Badge>
                                          )}
                                          {sale.property.beds && <span>{sale.property.beds} bed</span>}
                                          {sale.property.baths && <span>{sale.property.baths} bath</span>}
                                          {sale.property.sqft && <span>{sale.property.sqft.toLocaleString()} sqft</span>}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold text-primary" data-testid={`text-sale-price-${sale.id}`}>
                                          ${sale.salePrice.toLocaleString()}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          {format(new Date(sale.saleDate), "MMM d, yyyy")}
                                        </p>
                                        {sale.property.sqft && (
                                          <p className="text-xs text-muted-foreground">
                                            ${Math.round(sale.salePrice / sale.property.sqft).toLocaleString()}/sqft
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 text-center">
                                <DollarSign className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                                <p className="text-muted-foreground">No recent sales found for this area</p>
                                <p className="text-sm text-muted-foreground/70">
                                  Sales data is available for properties with recorded transactions
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="segments">
                        <Card>
                          <CardContent className="p-6">
                            {areaProperties && areaProperties.length > 0 ? (
                              <div className="grid gap-6 md:grid-cols-3">
                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                                    Property Type
                                  </h4>
                                  <div className="space-y-2">
                                    {Object.entries(
                                      areaProperties.reduce((acc, p) => {
                                        const type = p.propertyType || "Other";
                                        acc[type] = (acc[type] || 0) + 1;
                                        return acc;
                                      }, {} as Record<string, number>)
                                    )
                                      .sort((a, b) => b[1] - a[1])
                                      .slice(0, 5)
                                      .map(([type, count]) => (
                                        <div key={type} className="flex items-center justify-between">
                                          <span className="text-sm">{type}</span>
                                          <span className="text-sm text-muted-foreground tabular-nums">{count} ({Math.round((count / areaProperties.length) * 100)}%)</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Bedrooms</h4>
                                  <div className="space-y-2">
                                    {Object.entries(
                                      areaProperties.reduce((acc, p) => {
                                        const beds = p.beds ? `${p.beds} Bed` : "Unknown";
                                        acc[beds] = (acc[beds] || 0) + 1;
                                        return acc;
                                      }, {} as Record<string, number>)
                                    )
                                      .sort((a, b) => {
                                        const aNum = parseInt(a[0]) || 999;
                                        const bNum = parseInt(b[0]) || 999;
                                        return aNum - bNum;
                                      })
                                      .slice(0, 6)
                                      .map(([beds, count]) => (
                                        <div key={beds} className="flex items-center justify-between">
                                          <span className="text-sm">{beds}</span>
                                          <span className="text-sm text-muted-foreground tabular-nums">{count} ({Math.round((count / areaProperties.length) * 100)}%)</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Year Built</h4>
                                  <div className="space-y-2">
                                    {Object.entries(
                                      areaProperties.reduce((acc, p) => {
                                        let era = "Unknown";
                                        if (p.yearBuilt) {
                                          if (p.yearBuilt < 1950) era = "Pre-1950";
                                          else if (p.yearBuilt < 1980) era = "1950-1979";
                                          else if (p.yearBuilt < 2000) era = "1980-1999";
                                          else if (p.yearBuilt < 2010) era = "2000-2009";
                                          else era = "2010+";
                                        }
                                        acc[era] = (acc[era] || 0) + 1;
                                        return acc;
                                      }, {} as Record<string, number>)
                                    )
                                      .sort((a, b) => {
                                        const order = ["Pre-1950", "1950-1979", "1980-1999", "2000-2009", "2010+", "Unknown"];
                                        return order.indexOf(a[0]) - order.indexOf(b[0]);
                                      })
                                      .map(([era, count]) => (
                                        <div key={era} className="flex items-center justify-between">
                                          <span className="text-sm">{era}</span>
                                          <span className="text-sm text-muted-foreground tabular-nums">{count} ({Math.round((count / areaProperties.length) * 100)}%)</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 text-center">
                                <Home className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                                <p className="text-muted-foreground">No property data available for segment analysis</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </>
                  )}
                </Tabs>

                {!currentMarket && (!areaProperties || areaProperties.length === 0) && !marketError && !propertiesError && (
                  <Card className="border-amber-500/40">
                    <CardContent className="flex gap-3 p-5">
                      <Database className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-medium">Exact coverage is not currently published for {selectedGeo.name}</p>
                        <p className="text-sm text-muted-foreground">Choose {selectedGeo.state ? getStateFull(selectedGeo.state) : "a state"} for broader verified properties and recorded market statistics. No records are being fabricated for this location.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Quick Access Chips */}
            <div className="mb-8">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Popular locations</p>
              <div className="flex flex-wrap gap-2">
                {popularLocations.map((loc) => {
                  const Icon = geoTypeIcons[loc.type] || MapPin;
                  return (
                    <Button
                      key={`${loc.type}-${loc.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectGeo(loc)}
                      data-testid={`chip-${loc.type}-${loc.id}`}
                    >
                      <Icon className="mr-1.5 h-3.5 w-3.5" />
                      {loc.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* State-level Market Overview Cards */}
            {loadingOverview ? (
              <LoadingState type="skeleton-details" />
            ) : overviewError ? (
              <Card className="border-destructive/50">
                <CardContent className="flex gap-3 p-5">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div className="space-y-3">
                    <h2 className="font-semibold">Market overview could not be loaded</h2>
                    <p className="text-sm text-muted-foreground">This is a service error, not an empty market. Search for a location or reload the page to retry.</p>
                    <Button variant="outline" size="sm" onClick={() => { void refetchOverview(); }}>Retry overview</Button>
                  </div>
                </CardContent>
              </Card>
            ) : marketOverview && marketOverview.length > 0 ? (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-1" data-testid="text-market-overview-heading">Tri-State Market Overview</h2>
                  <p className="text-sm text-muted-foreground">Click a state to explore its market data in detail</p>
                </div>

                <div className="mb-8 grid gap-4 md:grid-cols-3">
                  {marketOverview.map((state) => (
                    <Card
                      key={state.geoId}
                      className="hover-elevate cursor-pointer"
                      onClick={() => handleSelectGeo({ type: "state", id: state.geoId, name: state.geoName || getStateFull(state.state), state: state.state })}
                      data-testid={`card-state-${state.geoId}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Globe className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{state.geoName || getStateFull(state.state)}</h3>
                              <p className="text-xs text-muted-foreground">{(state.transactionCount || 0).toLocaleString()} recorded transactions</p>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Median Price</p>
                            <p className="text-lg font-bold tabular-nums">{formatPrice(state.medianPrice || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Median $/sqft</p>
                            <p className="text-lg font-bold tabular-nums">${state.medianPricePerSqft || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">3mo Trend</p>
                            <div className="flex items-center gap-1">
                              {(state.trend3m || 0) >= 0 ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span className={`text-sm font-semibold ${(state.trend3m || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                {((state.trend3m || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Turnover</p>
                            <p className="text-sm font-semibold tabular-nums">{((state.turnoverRate || 0) * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Quick Compare Table */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Quick Compare
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-state-compare">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Metric</th>
                            {marketOverview.map((s) => (
                              <th key={s.geoId} className="text-right py-3 px-4 font-medium text-muted-foreground">
                                {s.geoName || getStateFull(s.state)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="py-3 pr-4 text-muted-foreground">Median Price</td>
                            {marketOverview.map((s) => (
                              <td key={s.geoId} className="text-right py-3 px-4 font-semibold tabular-nums">
                                {formatPrice(s.medianPrice || 0)}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 pr-4 text-muted-foreground">Median $/sqft</td>
                            {marketOverview.map((s) => (
                              <td key={s.geoId} className="text-right py-3 px-4 font-semibold tabular-nums">
                                ${s.medianPricePerSqft || 0}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 pr-4 text-muted-foreground">Recorded transactions</td>
                            {marketOverview.map((s) => (
                              <td key={s.geoId} className="text-right py-3 px-4 font-semibold tabular-nums">
                                {(s.transactionCount || 0).toLocaleString()}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 pr-4 text-muted-foreground">Price Range (25th-75th)</td>
                            {marketOverview.map((s) => (
                              <td key={s.geoId} className="text-right py-3 px-4 tabular-nums">
                                {formatPrice(s.p25Price || 0)} - {formatPrice(s.p75Price || 0)}
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b">
                            <td className="py-3 pr-4 text-muted-foreground">3-Month Trend</td>
                            {marketOverview.map((s) => (
                              <td key={s.geoId} className="text-right py-3 px-4">
                                <span className={`font-semibold ${(s.trend3m || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {(s.trend3m || 0) >= 0 ? "+" : ""}{((s.trend3m || 0) * 100).toFixed(1)}%
                                </span>
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="py-3 pr-4 text-muted-foreground">12-Month Trend</td>
                            {marketOverview.map((s) => (
                              <td key={s.geoId} className="text-right py-3 px-4">
                                <span className={`font-semibold ${(s.trend12m || 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                  {(s.trend12m || 0) >= 0 ? "+" : ""}{((s.trend12m || 0) * 100).toFixed(1)}%
                                </span>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="py-16">
                <CardContent className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">Search for a Location</h3>
                  <p className="mx-auto max-w-md text-muted-foreground">
                    Enter a ZIP code, city, or neighborhood to see market pricing data, trends, and analytics.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
