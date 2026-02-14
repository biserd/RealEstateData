import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Search, MapPin, TrendingUp, TrendingDown, DollarSign, Home, Activity, Download, Map, Building2, ArrowRight, Globe, Hash, Navigation, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layouts";
import { MarketStatsCard } from "@/components/MarketStatsCard";
import { SegmentSelector } from "@/components/SegmentSelector";
import { PriceDistribution } from "@/components/PriceDistribution";
import { CoverageBadge } from "@/components/CoverageBadge";
import { PropertyMap } from "@/components/PropertyMap";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { propertyTypes, bedsBands, yearBuiltBands } from "@shared/schema";
import type { MarketAggregate, Property, Sale } from "@shared/schema";
import { format } from "date-fns";
import { generatePropertySlug } from "@/lib/propertySlug";
import { Link } from "wouter";

const popularLocations = [
  { type: "state", id: "NY", name: "New York", state: "NY" },
  { type: "state", id: "NJ", name: "New Jersey", state: "NJ" },
  { type: "state", id: "CT", name: "Connecticut", state: "CT" },
  { type: "neighborhood", id: "CD 108", name: "Upper East Side, Manhattan", state: "NY" },
  { type: "neighborhood", id: "CD 301", name: "Williamsburg, Brooklyn", state: "NY" },
  { type: "neighborhood", id: "CD 401", name: "Astoria, Queens", state: "NY" },
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

  const { data: marketOverview, isLoading: loadingOverview } = useQuery<MarketAggregate[]>({
    queryKey: ["/api/market/overview"],
  });

  const { data: marketData, isLoading } = useQuery<MarketAggregate[]>({
    queryKey: ["/api/market/aggregates", selectedGeo?.type, selectedGeo?.id, propertyType, bedsBand, yearBuiltBand],
    queryFn: async () => {
      if (!selectedGeo) return [];
      const params = new URLSearchParams({
        geoType: selectedGeo.type,
        geoId: selectedGeo.id,
      });
      if (propertyType !== "all") params.append("propertyType", propertyType);
      if (bedsBand !== "all") params.append("bedsBand", bedsBand);
      if (yearBuiltBand !== "all") params.append("yearBuiltBand", yearBuiltBand);

      const res = await fetch(`/api/market/aggregates?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch market data");
      return res.json();
    },
    enabled: !!selectedGeo,
  });

  const { data: areaProperties } = useQuery<Property[]>({
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
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedGeo,
  });

  const [searchLimitReached, setSearchLimitReached] = useState(false);

  const { data: searchResults, isLoading: searching } = useQuery<Array<{ type: string; id: string; name: string; state: string }>>({
    queryKey: ["/api/search/geo", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search/geo?q=${encodeURIComponent(searchQuery)}`, {
        credentials: "include",
      });
      if (res.status === 429) {
        setSearchLimitReached(true);
        toast({
          title: "Daily search limit reached",
          description: "You've reached your limit of 5 searches per day. Upgrade to Pro for unlimited searches.",
          variant: "destructive",
        });
        return [];
      }
      if (!res.ok) throw new Error("Search failed");
      setSearchLimitReached(false);
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  useEffect(() => {
    if (autoSelectFromUrl && searchResults && searchResults.length > 0 && !selectedGeo) {
      setSelectedGeo(searchResults[0]);
      setAutoSelectFromUrl(false);
    }
  }, [autoSelectFromUrl, searchResults, selectedGeo]);

  const { data: recentSales, isLoading: loadingSales } = useQuery<(Sale & { property: Property })[]>({
    queryKey: ["/api/market/recent-sales", selectedGeo?.type, selectedGeo?.id],
    queryFn: async () => {
      if (!selectedGeo) return [];
      const params = new URLSearchParams({
        geoType: selectedGeo.type,
        geoId: selectedGeo.id,
        limit: "20",
      });

      const res = await fetch(`/api/market/recent-sales?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedGeo,
  });

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

            {searchFocused && searchQuery.length >= 2 && searching && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border bg-popover shadow-lg p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              </div>
            )}

            {searchFocused && searchQuery.length >= 2 && !searching && searchResults && searchResults.length === 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg border bg-popover shadow-lg p-4">
                <p className="text-sm text-muted-foreground">No results found. Try a different search term.</p>
              </div>
            )}
          </div>
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
              <Button
                variant="outline"
                onClick={handleExportReport}
                disabled={isExporting}
                data-testid="button-export-report"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export Report"}
              </Button>
            </div>

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
                        <CardTitle>Price Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PriceDistribution
                          p25={currentMarket.p25Price || 400000}
                          p50={currentMarket.medianPrice || 550000}
                          p75={currentMarket.p75Price || 725000}
                        />
                        <div className="mt-6">
                          <p className="mb-2 text-sm font-medium text-muted-foreground">
                            Price per Sqft Distribution
                          </p>
                          <PriceDistribution
                            p25={currentMarket.p25PricePerSqft || 300}
                            p50={currentMarket.medianPricePerSqft || 425}
                            p75={currentMarket.p75PricePerSqft || 575}
                            unit="$"
                            label="$/sqft Distribution"
                          />
                        </div>
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

                <Tabs defaultValue="map" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="map" data-testid="tab-map">
                      <Map className="mr-2 h-4 w-4" />
                      Area Map
                    </TabsTrigger>
                    {currentMarket && (
                      <>
                        <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
                        <TabsTrigger value="recent" data-testid="tab-recent">Recent Sales</TabsTrigger>
                        <TabsTrigger value="segments" data-testid="tab-segments">Segment Breakdown</TabsTrigger>
                      </>
                    )}
                  </TabsList>

                  <TabsContent value="map">
                    <Card>
                      <CardContent className="p-4">
                        {areaProperties && areaProperties.length > 0 ? (
                          <PropertyMap properties={areaProperties} height="400px" showClustering />
                        ) : (
                          <div className="flex h-[400px] items-center justify-center">
                            <div className="text-center">
                              <Map className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                              <p className="text-muted-foreground">No properties with coordinates available in this area</p>
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
                                          <div className="flex items-center gap-2">
                                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                              <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${(count / areaProperties.length) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                                          </div>
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
                                          <div className="flex items-center gap-2">
                                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                              <div
                                                className="h-full bg-emerald-500 rounded-full"
                                                style={{ width: `${(count / areaProperties.length) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                                          </div>
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
                                          <div className="flex items-center gap-2">
                                            <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                              <div
                                                className="h-full bg-amber-500 rounded-full"
                                                style={{ width: `${(count / areaProperties.length) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-sm text-muted-foreground w-8 text-right">{count}</span>
                                          </div>
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

                {!currentMarket && (!areaProperties || areaProperties.length === 0) && (
                  <EmptyState
                    icon={<MapPin className="h-8 w-8" />}
                    title="No data available"
                    description="We don't have any data for this area yet. Try a different location."
                  />
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
                              <p className="text-xs text-muted-foreground">{(state.transactionCount || 0).toLocaleString()} properties</p>
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
                            <td className="py-3 pr-4 text-muted-foreground">Properties</td>
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
