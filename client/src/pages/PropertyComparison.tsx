import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Search, X, Plus, ArrowUpDown, Share2, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layouts";
import { UpgradeModal } from "@/components/UpgradePrompt";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { generatePropertySlug } from "@/lib/propertySlug";
import type { Property } from "@shared/schema";

function formatPrice(value: number | null | undefined): string {
  if (!value) return "N/A";
  return "$" + value.toLocaleString();
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return value.toLocaleString();
}

function ScoreDisplay({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">N/A</span>;
  let colorClass = "text-red-500";
  if (score >= 75) colorClass = "text-emerald-500";
  else if (score >= 50) colorClass = "text-amber-500";
  return <span className={`font-semibold ${colorClass}`}>{score}/100</span>;
}

export default function PropertyComparison() {
  const { isAuthenticated } = useAuth();
  const { isPro, isFree, isLoading: subLoading } = useSubscription();
  const searchString = useSearch();

  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedGeo, setSelectedGeo] = useState<{ type: string; id: string; name: string; state: string } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [initialIdsLoaded, setInitialIdsLoaded] = useState(false);

  const maxProperties = isFree ? 2 : 4;

  const { data: geoResults, isLoading: geoLoading } = useQuery<Array<{ type: string; id: string; name: string; state: string }>>({
    queryKey: ["/api/search/geo", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search/geo?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchQuery.length >= 2 && !selectedGeo,
  });

  const { data: areaProperties, isLoading: areaLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties/area", selectedGeo?.type, selectedGeo?.id],
    queryFn: async () => {
      if (!selectedGeo) return [];
      const params = new URLSearchParams({ geoType: selectedGeo.type, geoId: selectedGeo.id, limit: "20" });
      const res = await fetch(`/api/properties/area?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedGeo,
  });

  useEffect(() => {
    if (initialIdsLoaded) return;
    const params = new URLSearchParams(searchString);
    const idsParam = params.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        Promise.all(
          ids.map(async (id) => {
            try {
              const res = await fetch(`/api/properties/${id}`, { credentials: "include" });
              if (!res.ok) return null;
              return res.json() as Promise<Property>;
            } catch {
              return null;
            }
          })
        ).then((results) => {
          const valid = results.filter((p): p is Property => p !== null);
          setSelectedProperties(valid);
          setInitialIdsLoaded(true);
        });
      } else {
        setInitialIdsLoaded(true);
      }
    } else {
      setInitialIdsLoaded(true);
    }
  }, [searchString]);

  const updateUrl = useCallback((properties: Property[]) => {
    const ids = properties.map((p) => p.id).join(",");
    const url = ids ? `${window.location.pathname}?ids=${ids}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);

  const addProperty = (property: Property) => {
    if (selectedProperties.find((p) => p.id === property.id)) return;
    if (selectedProperties.length >= maxProperties) {
      if (isFree) {
        setShowUpgradeModal(true);
      }
      return;
    }
    const updated = [...selectedProperties, property];
    setSelectedProperties(updated);
    updateUrl(updated);
    setSelectedGeo(null);
    setSearchQuery("");
  };

  const removeProperty = (id: string) => {
    const updated = selectedProperties.filter((p) => p.id !== id);
    setSelectedProperties(updated);
    updateUrl(updated);
  };

  const handleSelectGeo = (geo: { type: string; id: string; name: string; state: string }) => {
    setSelectedGeo(geo);
    setSearchQuery("");
    setSearchFocused(false);
  };

  const availableProperties = (areaProperties || []).filter(
    (p) => !selectedProperties.find((sp) => sp.id === p.id)
  );

  const metrics: { label: string; key: string; render: (p: Property) => JSX.Element }[] = [
    {
      label: "Address",
      key: "address",
      render: (p) => (
        <Link href={`/properties/${generatePropertySlug(p)}`} data-testid={`link-property-${p.id}`}>
          <span className="text-primary underline-offset-2 hover:underline">{p.address}</span>
        </Link>
      ),
    },
    {
      label: "City / State / ZIP",
      key: "location",
      render: (p) => <span>{p.city}, {p.state} {p.zipCode}</span>,
    },
    {
      label: "Property Type",
      key: "propertyType",
      render: (p) => <span>{p.propertyType || "N/A"}</span>,
    },
    {
      label: "Price",
      key: "price",
      render: (p) => <span className="font-semibold">{formatPrice(p.estimatedValue || p.lastSalePrice)}</span>,
    },
    {
      label: "Price / sqft",
      key: "pricePerSqft",
      render: (p) => <span>{p.pricePerSqft ? `$${formatNumber(p.pricePerSqft)}` : "N/A"}</span>,
    },
    {
      label: "Beds",
      key: "beds",
      render: (p) => <span>{formatNumber(p.beds)}</span>,
    },
    {
      label: "Baths",
      key: "baths",
      render: (p) => <span>{formatNumber(p.baths)}</span>,
    },
    {
      label: "Sqft",
      key: "sqft",
      render: (p) => <span>{formatNumber(p.sqft)}</span>,
    },
    {
      label: "Year Built",
      key: "yearBuilt",
      render: (p) => <span>{p.yearBuilt || "N/A"}</span>,
    },
    {
      label: "Opportunity Score",
      key: "opportunityScore",
      render: (p) => <ScoreDisplay score={p.opportunityScore} />,
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-page-title">
            Compare Properties
          </h1>
          <p className="text-muted-foreground">
            Side-by-side comparison of up to {maxProperties} properties
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <CardTitle className="text-lg">Add Properties</CardTitle>
            <Badge variant="outline" data-testid="badge-property-count">
              {selectedProperties.length} / {maxProperties}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by address, city, or ZIP..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedGeo) setSelectedGeo(null);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                data-testid="input-property-search"
              />

              {searchFocused && searchQuery.length >= 2 && !selectedGeo && geoResults && geoResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border bg-popover shadow-lg max-h-60 overflow-y-auto">
                  {geoResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover-elevate"
                      onClick={() => handleSelectGeo(result)}
                      data-testid={`geo-result-${result.type}-${result.id}`}
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{result.name}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">{result.state}</Badge>
                    </button>
                  ))}
                </div>
              )}

              {searchFocused && searchQuery.length >= 2 && !selectedGeo && geoLoading && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border bg-popover shadow-lg p-4">
                  <p className="text-sm text-muted-foreground">Searching...</p>
                </div>
              )}
            </div>

            {selectedGeo && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <p className="text-sm text-muted-foreground">
                    Properties in <span className="font-medium text-foreground">{selectedGeo.name}</span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedGeo(null); setSearchQuery(""); }} data-testid="button-clear-geo">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                {areaLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading properties...</p>
                ) : availableProperties.length > 0 ? (
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {availableProperties.map((property) => (
                      <button
                        key={property.id}
                        className="flex items-center justify-between gap-4 rounded-lg border p-3 text-left hover-elevate"
                        onClick={() => addProperty(property)}
                        data-testid={`button-add-property-${property.id}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{property.address}</p>
                          <p className="text-sm text-muted-foreground truncate">{property.city}, {property.state} {property.zipCode}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No properties found in this area</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedProperties.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Comparison
              </CardTitle>
              {selectedProperties.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                  }}
                  data-testid="button-share-comparison"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]" data-testid="table-comparison">
                  <thead>
                    <tr className="border-b">
                      <th className="sticky left-0 z-[1] bg-card px-4 py-3 text-left text-sm font-medium text-muted-foreground w-36">
                        Metric
                      </th>
                      {selectedProperties.map((property) => (
                        <th key={property.id} className="px-4 py-3 text-left" data-testid={`column-header-${property.id}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate max-w-[180px]">{property.address}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeProperty(property.id)}
                              data-testid={`button-remove-property-${property.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric, idx) => (
                      <tr key={metric.key} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                        <td className="sticky left-0 z-[1] bg-inherit px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">
                          {metric.label}
                        </td>
                        {selectedProperties.map((property) => (
                          <td key={property.id} className="px-4 py-3 text-sm" data-testid={`cell-${metric.key}-${property.id}`}>
                            {metric.render(property)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ArrowUpDown className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold" data-testid="text-empty-state">No Properties Selected</h3>
              <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
                Use the search above to find and add properties for side-by-side comparison.
              </p>
            </CardContent>
          </Card>
        )}

        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          feature="Compare More Properties"
          description="Free users can compare up to 2 properties. Upgrade to Pro to compare up to 4 properties side by side."
          requiredTier="pro"
        />
      </div>
    </AppLayout>
  );
}
