import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Filter, Grid, List, SortDesc, Download, TrendingUp, X, Map, Crown, Lock, Home, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppLayout } from "@/components/layouts";
import { FilterPanel } from "@/components/FilterPanel";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyMap } from "@/components/PropertyMap";
import { UnitOpportunityCard } from "@/components/UnitOpportunityCard";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { UpgradeModal, ProBadge, PremiumBadge } from "@/components/UpgradePrompt";
import { SaveSearchDialog } from "@/components/SaveSearchDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import type { Property, ScreenerFilters } from "@shared/schema";

const defaultFilters: ScreenerFilters = {};

interface ScoreDriver {
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
}

interface UnitOpportunity {
  unitBbl: string;
  baseBbl: string;
  unitDesignation: string | null;
  unitDisplayAddress: string | null;
  buildingDisplayAddress: string | null;
  borough: string | null;
  zipCode: string | null;
  lastSalePrice: number;
  lastSaleDate: string;
  opportunityScore: number;
  scoreDrivers?: ScoreDriver[];
  buildingMedianPrice?: number | null;
  buildingSalesCount?: number;
}

function getBuildingScoreDrivers(property: Property): ScoreDriver[] {
  const drivers: ScoreDriver[] = [];
  
  if (property.opportunityScore && property.opportunityScore >= 75) {
    drivers.push({
      label: "High opportunity score",
      value: `${property.opportunityScore}/100`,
      impact: "positive",
    });
  }
  
  if (property.pricePerSqft && property.pricePerSqft < 300) {
    drivers.push({
      label: "Attractive price per sqft",
      value: `$${property.pricePerSqft}/sqft`,
      impact: "positive",
    });
  }
  
  if (property.confidenceLevel === "High") {
    drivers.push({
      label: "High confidence estimate",
      value: "Strong data coverage",
      impact: "positive",
    });
  } else if (property.confidenceLevel === "Medium") {
    drivers.push({
      label: "Moderate confidence",
      value: "Good data coverage",
      impact: "neutral",
    });
  }
  
  return drivers;
}

export default function OpportunityScreener() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { isPro, isPremium, isFree } = useSubscription();
  const searchString = useSearch();
  
  const [urlInitialized, setUrlInitialized] = useState(false);
  const [filters, setFilters] = useState<ScreenerFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState("score");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [upgradeDescription, setUpgradeDescription] = useState("");
  const [entityType, setEntityType] = useState<"properties" | "units">("units");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const zipCodes = params.get("zipCodes");
    const state = params.get("state");
    const cities = params.get("cities");
    if (zipCodes || state || cities) {
      const urlFilters: ScreenerFilters = {};
      if (zipCodes) urlFilters.zipCodes = zipCodes.split(",");
      if (state && ["NY", "NJ", "CT"].includes(state)) urlFilters.state = state as "NY" | "NJ" | "CT";
      if (cities) urlFilters.cities = cities.split(",");
      setFilters(urlFilters);
      setEntityType("properties");
    }
    setUrlInitialized(true);
  }, []);

  interface ScreenerResponse {
    properties: Property[];
    limited: boolean;
    visibleCount: number;
    hiddenCount: number;
    message?: string;
  }

  const { data: screenerData, isLoading } = useQuery<ScreenerResponse>({
    queryKey: [
      "/api/properties/screener", 
      filters.state || "", 
      filters.zipCodes?.join(",") || "",
      filters.cities?.join(",") || "",
      filters.propertyTypes?.join(",") || "",
      filters.priceMin?.toString() || "",
      filters.priceMax?.toString() || "",
      filters.opportunityScoreMin?.toString() || "",
      filters.bedsBands?.join(",") || "",
      filters.bathsBands?.join(",") || "",
      filters.yearBuiltBands?.join(",") || "",
      sortBy
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.state) params.append("state", filters.state);
      if (filters.zipCodes?.length) params.append("zipCodes", filters.zipCodes.join(","));
      if (filters.cities?.length) params.append("cities", filters.cities.join(","));
      if (filters.propertyTypes?.length) {
        params.append("propertyTypes", filters.propertyTypes.join(","));
      }
      if (filters.priceMin) params.append("priceMin", filters.priceMin.toString());
      if (filters.priceMax) params.append("priceMax", filters.priceMax.toString());
      if (filters.opportunityScoreMin) params.append("opportunityScoreMin", filters.opportunityScoreMin.toString());
      if (filters.bedsBands?.length) {
        params.append("bedsBands", filters.bedsBands.join(","));
      }
      if (filters.bathsBands?.length) {
        params.append("bathsBands", filters.bathsBands.join(","));
      }
      if (filters.yearBuiltBands?.length) {
        params.append("yearBuiltBands", filters.yearBuiltBands.join(","));
      }
      
      const res = await fetch(`/api/properties/screener?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
    enabled: urlInitialized,
  });

  const properties = screenerData?.properties;
  const isLimited = screenerData?.limited;
  const visibleCount = screenerData?.visibleCount ?? 3;
  const hiddenCount = screenerData?.hiddenCount ?? 0;

  const { data: unitsData, isLoading: unitsLoading } = useQuery<{
    units: UnitOpportunity[];
    count: number;
  }>({
    queryKey: [
      "/api/units/top-opportunities",
      filters.priceMin?.toString() || "",
      filters.priceMax?.toString() || "",
      filters.opportunityScoreMin?.toString() || "",
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (filters.priceMin) params.append("priceMin", filters.priceMin.toString());
      if (filters.priceMax) params.append("priceMax", filters.priceMax.toString());
      if (filters.opportunityScoreMin) params.append("opportunityScoreMin", filters.opportunityScoreMin.toString());
      
      const res = await fetch(`/api/units/top-opportunities?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    enabled: entityType === "units",
  });

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const handleExportResults = async () => {
    if (!isAuthenticated) {
      setUpgradeFeature("Export Results");
      setUpgradeDescription("Create a free account to export screener results and access more features.");
      setShowUpgradeModal(true);
      return;
    }
    if (isFree) {
      setUpgradeFeature("CSV Export");
      setUpgradeDescription("Export screener results to CSV. Upgrade to Pro for unlimited exports.");
      setShowUpgradeModal(true);
      return;
    }
    
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (filters.state) params.append("state", filters.state);
      if (filters.zipCodes?.length) params.append("zipCodes", filters.zipCodes.join(","));
      if (filters.cities?.length) params.append("cities", filters.cities.join(","));
      if (filters.propertyTypes?.length) params.append("propertyTypes", filters.propertyTypes.join(","));
      if (filters.priceMin) params.append("priceMin", filters.priceMin.toString());
      if (filters.priceMax) params.append("priceMax", filters.priceMax.toString());
      if (filters.opportunityScoreMin) params.append("opportunityScoreMin", filters.opportunityScoreMin.toString());
      
      const response = await fetch(`/api/export/opportunities?${params.toString()}`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "opportunities-export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: `${properties?.length || 0} properties exported to CSV.`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export results. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  return (
    <AppLayout showSearch={false}>
      <div className="flex h-[calc(100vh-4rem)]">
        <aside className="hidden w-80 flex-shrink-0 border-r lg:block">
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onReset={handleResetFilters}
            entityType={entityType}
          />
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 border-b bg-background px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">Opportunity Screener</h1>
                <Tabs value={entityType} onValueChange={(v) => setEntityType(v as "properties" | "units")}>
                  <TabsList data-testid="tabs-entity-type">
                    <TabsTrigger value="units" data-testid="tab-units">
                      <Home className="h-4 w-4 mr-1.5" />
                      Units (Verified Sales)
                    </TabsTrigger>
                    <TabsTrigger value="properties" data-testid="tab-properties">
                      <Building2 className="h-4 w-4 mr-1.5" />
                      Buildings (Estimated)
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-sm text-muted-foreground">
                  {entityType === "properties" ? (
                    <>
                      {properties?.length || 0} properties found
                      {isLimited && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          (showing {visibleCount} of {properties?.length || 0})
                        </span>
                      )}
                    </>
                  ) : (
                    <>{unitsData?.count || 0} unit opportunities found</>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="lg:hidden" data-testid="button-mobile-filters">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 p-0">
                    <SheetHeader className="p-4 border-b">
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <FilterPanel
                      filters={filters}
                      onChange={setFilters}
                      onReset={handleResetFilters}
                      entityType={entityType}
                    />
                  </SheetContent>
                </Sheet>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]" data-testid="select-sort">
                    <SortDesc className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Opportunity Score</SelectItem>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="sqft">Price per Sqft</SelectItem>
                    <SelectItem value="date">Recently Added</SelectItem>
                  </SelectContent>
                </Select>

                <div className="hidden items-center rounded-lg border p-1 md:flex">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("grid")}
                    data-testid="button-grid-view"
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("list")}
                    data-testid="button-list-view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "map" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewMode("map")}
                    data-testid="button-map-view"
                  >
                    <Map className="h-4 w-4" />
                  </Button>
                </div>

                <Button 
                  variant="outline" 
                  onClick={handleExportResults}
                  disabled={isExporting}
                  data-testid="button-export-results"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export"}
                </Button>

                {isAuthenticated && (
                  <SaveSearchDialog 
                    filters={filters} 
                    matchCount={properties?.length}
                  />
                )}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {filters.state && (
                  <Badge variant="secondary" className="gap-1">
                    State: {filters.state}
                    <button
                      onClick={() => setFilters({ ...filters, state: undefined })}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.zipCodes?.map((zip) => (
                  <Badge key={zip} variant="secondary" className="gap-1">
                    ZIP: {zip}
                    <button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          zipCodes: filters.zipCodes?.filter((z) => z !== zip),
                        })
                      }
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {filters.cities?.map((city) => (
                  <Badge key={city} variant="secondary" className="gap-1">
                    City: {city}
                    <button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          cities: filters.cities?.filter((c) => c !== city),
                        })
                      }
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {filters.propertyTypes?.map((type) => (
                  <Badge key={type} variant="secondary" className="gap-1">
                    {type}
                    <button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          propertyTypes: filters.propertyTypes?.filter((t) => t !== type),
                        })
                      }
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {filters.bedsBands?.map((band) => (
                  <Badge key={band} variant="secondary" className="gap-1">
                    {band} beds
                    <button
                      onClick={() =>
                        setFilters({
                          ...filters,
                          bedsBands: filters.bedsBands?.filter((b) => b !== band),
                        })
                      }
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(filters.priceMin || filters.priceMax) && (
                  <Badge variant="secondary" className="gap-1">
                    ${((filters.priceMin || 0) / 1000).toFixed(0)}K - ${((filters.priceMax || 5000000) / 1000).toFixed(0)}K
                    <button
                      onClick={() =>
                        setFilters({ ...filters, priceMin: undefined, priceMax: undefined })
                      }
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.opportunityScoreMin && (
                  <Badge variant="secondary" className="gap-1">
                    Score: {filters.opportunityScoreMin}+
                    <button
                      onClick={() =>
                        setFilters({ ...filters, opportunityScoreMin: undefined })
                      }
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-6 text-xs"
                  data-testid="button-clear-all-filters"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          <div className="p-4 md:p-6">
            {entityType === "units" ? (
              unitsLoading ? (
                <LoadingState type="skeleton-cards" count={6} />
              ) : unitsData?.units && unitsData.units.length > 0 ? (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3"
                      : "space-y-4"
                  }
                >
                  {unitsData.units.map((unit) => (
                    <UnitOpportunityCard 
                      key={unit.unitBbl} 
                      unit={unit} 
                      viewMode={viewMode === "map" ? "grid" : viewMode}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Home className="h-8 w-8" />}
                  title="No unit opportunities found"
                  description="We're analyzing condo units for investment opportunities. Check back soon for new opportunities."
                />
              )
            ) : isLoading ? (
              <LoadingState type="skeleton-cards" count={6} />
            ) : properties && properties.length > 0 ? (
              viewMode === "map" ? (
                <div className="flex h-[calc(100vh-16rem)] flex-col gap-4 lg:flex-row">
                  <div className="flex-1 min-h-[400px]">
                    <PropertyMap
                      properties={properties}
                      height="100%"
                      showClustering
                      onPropertySelect={(property) => setSelectedPropertyId(property.id)}
                      selectedPropertyId={selectedPropertyId}
                    />
                  </div>
                  <div className="w-full overflow-auto lg:w-80">
                    <div className="space-y-3">
                      {properties.slice(0, 10).map((property) => (
                        <div
                          key={property.id}
                          className={`cursor-pointer transition-all ${
                            selectedPropertyId === property.id
                              ? "ring-2 ring-primary rounded-lg"
                              : ""
                          }`}
                          onClick={() => setSelectedPropertyId(property.id)}
                        >
                          <PropertyCard property={property} scoreDrivers={getBuildingScoreDrivers(property)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className={
                      viewMode === "grid"
                        ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3"
                        : "space-y-4"
                    }
                  >
                    {properties.slice(0, visibleCount).map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                    {isLimited && !isPro && !isPremium && properties.slice(visibleCount).map((property, index) => (
                      <div 
                        key={property.id} 
                        className="relative overflow-hidden rounded-lg"
                        data-testid={`card-property-blurred-${index}`}
                        aria-hidden="true"
                      >
                        <div className="blur-sm pointer-events-none select-none" tabIndex={-1}>
                          <PropertyCard property={property} scoreDrivers={getBuildingScoreDrivers(property)} />
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm">
                          <Lock className="h-8 w-8 text-muted-foreground mb-2" />
                          <span className="text-sm font-medium text-muted-foreground">Locked</span>
                        </div>
                      </div>
                    ))}
                    {!isLimited && properties.slice(visibleCount).map((property) => (
                      <PropertyCard key={property.id} property={property} />
                    ))}
                  </div>
                  {isLimited && hiddenCount > 0 && !isPro && !isPremium && (
                    <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
                      <Lock className="mx-auto h-10 w-10 text-primary mb-3" />
                      <h3 className="text-lg font-semibold">
                        Unlock {hiddenCount} more undervalued properties in this area with Pro
                      </h3>
                      <p className="mt-2 text-muted-foreground">
                        You're seeing the top 3 results. Upgrade to access all {properties.length} properties and unlock advanced filters.
                      </p>
                      <Button
                        className="mt-4"
                        onClick={() => {
                          setUpgradeFeature("Full Screener Access");
                          setUpgradeDescription(`See all ${properties.length} properties that match your criteria.`);
                          setShowUpgradeModal(true);
                        }}
                        data-testid="button-upgrade-screener"
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        Unlock Unlimited Deals
                      </Button>
                    </div>
                  )}
                </>
              )
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-8 w-8" />}
                title="No properties found"
                description="Try adjusting your filters to see more results. We're continuously adding new properties to our database."
                action={{
                  label: "Reset Filters",
                  onClick: handleResetFilters,
                }}
              />
            )}
          </div>
        </main>
      </div>
      
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature={upgradeFeature}
        description={upgradeDescription}
      />
    </AppLayout>
  );
}
