import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/layouts";
import { PropertyCard } from "@/components/PropertyCard";
import { LoadingState } from "@/components/LoadingState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, ChevronRight, Home, TrendingUp, ChevronLeft } from "lucide-react";
import type { Property } from "@shared/schema";

const STATE_NAMES: Record<string, string> = {
  NY: "New York",
  NJ: "New Jersey",
  CT: "Connecticut",
};

function formatPrice(price: number | null) {
  if (!price) return "N/A";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

export default function CityBrowse() {
  const params = useParams<{ state: string; city: string }>();
  const stateCode = (params.state || "").toUpperCase();
  const city = decodeURIComponent(params.city || "");
  const stateName = STATE_NAMES[stateCode] || stateCode;
  const [page, setPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalProperties: number;
    zips: { zipCode: string; count: number; medianPrice: number }[];
    medianPrice: number;
    propertyTypes: { type: string; count: number }[];
  }>({
    queryKey: ["/api/browse/state", stateCode, "city", city],
  });

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery<{
    properties: Property[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: [`/api/browse/state/${stateCode}/city/${encodeURIComponent(city)}/properties?page=${page}`],
  });

  if (statsLoading) {
    return (
      <AppLayout>
        <SEO title={`${city}, ${stateName} Real Estate - Realtors Dashboard`} description={`Browse properties in ${city}, ${stateName}.`} canonicalUrl={`/browse/${stateCode.toLowerCase()}/${encodeURIComponent(city)}`} />
        <div className="container mx-auto px-4 py-8">
          <LoadingState />
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <SEO
        title={`${city}, ${stateName} Real Estate - ${stats?.totalProperties?.toLocaleString() || ""} Properties | Realtors Dashboard`}
        description={`Browse ${stats?.totalProperties?.toLocaleString() || ""} properties in ${city}, ${stateName}. Median price: ${formatPrice(stats?.medianPrice || 0)}. View ZIP codes, property types, and investment opportunities.`}
        canonicalUrl={`/browse/${stateCode.toLowerCase()}/${encodeURIComponent(city)}`}
      />
      <AppLayout>
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6 flex-wrap" data-testid="breadcrumb-city">
            <Link href="/" className="hover:text-foreground">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/browse/${stateCode.toLowerCase()}`} className="hover:text-foreground">
              {stateName}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{city}</span>
          </nav>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-city-title">{city}, {stateName} Real Estate</h1>
            <p className="text-muted-foreground">
              Browse {stats?.totalProperties?.toLocaleString() || 0} properties across {stats?.zips?.length || 0} ZIP codes
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Properties</p>
                    <p className="text-2xl font-bold" data-testid="text-total-properties">{stats?.totalProperties?.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Median Price</p>
                    <p className="text-2xl font-bold" data-testid="text-median-price">{formatPrice(stats?.medianPrice || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 p-2">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ZIP Codes</p>
                    <p className="text-2xl font-bold" data-testid="text-zip-count">{stats?.zips?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {stats?.propertyTypes && stats.propertyTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {stats.propertyTypes.map(pt => (
                <Badge key={pt.type} variant="secondary" data-testid={`badge-type-${pt.type}`}>
                  {pt.type} ({pt.count.toLocaleString()})
                </Badge>
              ))}
            </div>
          )}

          {stats?.zips && stats.zips.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">ZIP Codes in {city}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {stats.zips.map(z => (
                  <Card key={z.zipCode} className="hover-elevate" data-testid={`card-zip-${z.zipCode}`}>
                    <CardContent className="py-4">
                      <p className="font-medium">{z.zipCode}</p>
                      <p className="text-sm text-muted-foreground">
                        {z.count.toLocaleString()} properties
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Median {formatPrice(z.medianPrice)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-xl font-semibold mb-4">
            Properties in {city}
            {propertiesData && (
              <span className="text-muted-foreground text-base font-normal ml-2">
                ({propertiesData.total.toLocaleString()} total)
              </span>
            )}
          </h2>

          {propertiesLoading ? (
            <LoadingState />
          ) : propertiesData && propertiesData.properties.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {propertiesData.properties.map(property => (
                  <PropertyCard key={property.id} property={property} showOpportunityScore />
                ))}
              </div>

              {propertiesData.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mb-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {page} of {propertiesData.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= propertiesData.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground py-8 text-center">No properties found in {city}.</p>
          )}
        </div>
      </AppLayout>
    </>
  );
}
