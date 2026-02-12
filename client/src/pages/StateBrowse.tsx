import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/layouts";
import { PropertyCard } from "@/components/PropertyCard";
import { LoadingState } from "@/components/LoadingState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, ChevronRight, Home, ArrowLeft, TrendingUp } from "lucide-react";
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

export default function StateBrowse() {
  const params = useParams<{ state: string }>();
  const stateCode = (params.state || "").toUpperCase();
  const stateName = STATE_NAMES[stateCode] || stateCode;

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalProperties: number;
    cities: { city: string; count: number; medianPrice: number }[];
    medianPrice: number;
    propertyTypes: { type: string; count: number }[];
  }>({ queryKey: ["/api/browse/state", stateCode] });

  const { data: propertiesData, isLoading: propertiesLoading } = useQuery<{
    properties: Property[];
    total: number;
    page: number;
    totalPages: number;
  }>({ queryKey: ["/api/browse/state", stateCode, "properties"] });

  if (statsLoading) {
    return (
      <AppLayout>
        <SEO title={`${stateName} Real Estate - Realtors Dashboard`} description={`Browse properties in ${stateName}.`} canonicalUrl={`/browse/${stateCode.toLowerCase()}`} />
        <div className="container mx-auto px-4 py-8">
          <LoadingState />
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <SEO
        title={`${stateName} Real Estate - ${stats?.totalProperties?.toLocaleString() || ""} Properties | Realtors Dashboard`}
        description={`Browse ${stats?.totalProperties?.toLocaleString() || ""} properties in ${stateName}. Median price: ${formatPrice(stats?.medianPrice || 0)}. Explore cities, neighborhoods, and find investment opportunities.`}
        canonicalUrl={`/browse/${stateCode.toLowerCase()}`}
      />
      <AppLayout>
        <div className="container mx-auto px-4 py-6">
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-6 flex-wrap" data-testid="breadcrumb-state">
            <Link href="/" className="hover:text-foreground">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{stateName}</span>
          </nav>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-state-title">{stateName} Real Estate</h1>
            <p className="text-muted-foreground">
              Browse {stats?.totalProperties?.toLocaleString() || 0} properties across {stats?.cities?.length || 0} cities
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
                    <p className="text-sm text-muted-foreground">Cities</p>
                    <p className="text-2xl font-bold" data-testid="text-city-count">{stats?.cities?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {stats?.propertyTypes && stats.propertyTypes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {stats.propertyTypes.map(pt => (
                <Badge key={pt.type} variant="secondary" data-testid={`badge-type-${pt.type}`}>
                  {pt.type} ({pt.count.toLocaleString()})
                </Badge>
              ))}
            </div>
          )}

          <h2 className="text-xl font-semibold mb-4">Cities in {stateName}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {stats?.cities?.map(c => (
              <Link
                key={c.city}
                href={`/browse/${stateCode.toLowerCase()}/${encodeURIComponent(c.city)}`}
              >
                <Card className="hover-elevate cursor-pointer" data-testid={`card-city-${c.city}`}>
                  <CardContent className="py-4 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{c.city}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.count.toLocaleString()} properties &middot; Median {formatPrice(c.medianPrice)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {propertiesData && propertiesData.properties.length > 0 && (
            <>
              <h2 className="text-xl font-semibold mb-4">Top Opportunities in {stateName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {propertiesData.properties.slice(0, 6).map(property => (
                  <PropertyCard key={property.id} property={property} showOpportunityScore />
                ))}
              </div>
              <div className="text-center">
                <Link href="/investment-opportunities">
                  <Button variant="outline" data-testid="button-view-all-opportunities">
                    View All Investment Opportunities
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </AppLayout>
    </>
  );
}
