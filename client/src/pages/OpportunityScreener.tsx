import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Filter, Grid, List, SortDesc, Download, TrendingUp, X, Map, Crown, Bell, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { UpgradeModal, ProBadge, PremiumBadge } from "@/components/UpgradePrompt";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import type { Property, ScreenerFilters } from "@shared/schema";

const defaultFilters: ScreenerFilters = {};

export default function OpportunityScreener() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const { isPro, isPremium, isFree } = useSubscription();
  const [filters, setFilters] = useState<ScreenerFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState("score");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  const [upgradeDescription, setUpgradeDescription] = useState("");

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: [
      "/api/properties/screener", 
      filters.state || "", 
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
          />
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 border-b bg-background px-4 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">Opportunity Screener</h1>
                <p className="text-sm text-muted-foreground">
                  {properties?.length || 0} properties found
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
            {isLoading ? (
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
                          <PropertyCard property={property} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3"
                      : "space-y-4"
                  }
                >
                  {properties.map((property) => (
                    <PropertyCard key={property.id} property={property} />
                  ))}
                </div>
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
