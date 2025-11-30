import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Grid, List, SortDesc, Download, TrendingUp, X } from "lucide-react";
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
import { Header } from "@/components/Header";
import { FilterPanel } from "@/components/FilterPanel";
import { PropertyCard } from "@/components/PropertyCard";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import type { Property, ScreenerFilters } from "@shared/schema";

const defaultFilters: ScreenerFilters = {};

export default function OpportunityScreener() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ScreenerFilters>(defaultFilters);
  const [sortBy, setSortBy] = useState("score");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties/screener", filters, sortBy],
  });

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const handleExportResults = async () => {
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
    <div className="min-h-screen bg-background">
      <Header />

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
    </div>
  );
}
