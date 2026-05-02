import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  History,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Activity,
  Home,
  Car,
  Package,
  Store,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { BuildingJsonLd, BreadcrumbsJsonLd } from "@/components/JsonLd";
import { StreetViewImage } from "@/components/StreetViewImage";
import { PropertyMap } from "@/components/PropertyMap";
import { AppLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyBreadcrumbs } from "@/components/BuildingContext";
import { BuildingUnitsSection } from "@/components/BuildingUnitsSection";
import { BuildingSalesHistory } from "@/components/BuildingSalesHistory";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import type { Property } from "@shared/schema";

interface Building {
  baseBbl: string;
  displayAddress: string;
  borough: string | null;
  zipCode: string | null;
  unitCount: number;
  residentialUnitCount: number;
  latitude: number | null;
  longitude: number | null;
}

interface BuildingInsights {
  salesStats: {
    totalSales: number;
    avgPrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    lastSaleDate: string | null;
    lastSalePrice: number | null;
  };
  yearlyTrend: Array<{
    year: number;
    count: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
  }>;
  unitMix: {
    residential: number;
    parking: number;
    storage: number;
    commercial: number;
    other: number;
  };
  areaContext: {
    geoType: "zip" | null;
    geoId: string | null;
    medianPrice: number | null;
    vsAreaPct: number | null;
  };
}

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

const unitMixConfig: Array<{
  key: keyof BuildingInsights["unitMix"];
  label: string;
  Icon: typeof Home;
  color: string;
}> = [
  { key: "residential", label: "Residential", Icon: Home, color: "bg-blue-500" },
  { key: "parking", label: "Parking", Icon: Car, color: "bg-amber-500" },
  { key: "storage", label: "Storage", Icon: Package, color: "bg-violet-500" },
  { key: "commercial", label: "Commercial", Icon: Store, color: "bg-emerald-500" },
  { key: "other", label: "Other", Icon: Building2, color: "bg-gray-500" },
];

export default function BuildingDetail() {
  const { baseBbl: rawBaseBbl } = useParams<{ baseBbl: string }>();
  const baseBbl = rawBaseBbl?.match(/(\d{10})$/)?.[1] || rawBaseBbl;

  const { data: building, isLoading, error } = useQuery<Building>({
    queryKey: ["/api/buildings", baseBbl, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${baseBbl}/details`);
      if (!res.ok) throw new Error("Failed to fetch building");
      return res.json();
    },
    enabled: !!baseBbl,
  });

  const { data: insights } = useQuery<BuildingInsights>({
    queryKey: ["/api/buildings", baseBbl, "insights"],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${baseBbl}/insights`);
      if (!res.ok) throw new Error("Failed to fetch insights");
      return res.json();
    },
    enabled: !!baseBbl,
  });

  const nearbyZip = building?.zipCode || "";
  const { data: areaProperties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties/area", { geoType: "zip", geoId: nearbyZip, limit: 200 }],
    queryFn: async () => {
      const res = await fetch(
        `/api/properties/area?geoType=zip&geoId=${encodeURIComponent(nearbyZip)}&limit=200`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!nearbyZip,
  });

  const nearbyProperties = (() => {
    if (!building?.latitude || !building?.longitude) return [];
    const lat0 = building.latitude;
    const lng0 = building.longitude;
    const withDist = areaProperties
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const dLat = ((p.latitude as number) - lat0) * 111;
        const dLng =
          ((p.longitude as number) - lng0) *
          111 *
          Math.cos((lat0 * Math.PI) / 180);
        const km = Math.sqrt(dLat * dLat + dLng * dLng);
        return { p, km };
      })
      .filter((x) => x.km <= 1.5)
      .sort((a, b) => a.km - b.km)
      .slice(0, 50)
      .map((x) => x.p);
    return withDist;
  })();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <LoadingState type="skeleton-details" />
        </div>
      </AppLayout>
    );
  }

  if (error || !building) {
    return (
      <AppLayout>
        <div className="container max-w-6xl mx-auto px-4 py-6">
          <EmptyState
            icon={<Building2 className="h-12 w-12" />}
            title="Building not found"
            description="We couldn't find this building in our database."
          />
        </div>
      </AppLayout>
    );
  }

  const buildingUrl = `https://realtorsdashboard.com/building/${building.baseBbl}`;
  const buildingDesc = `View ${building.displayAddress}, a condo building with ${building.residentialUnitCount} residential units in ${building.borough || "NYC"}${building.zipCode ? `, ZIP ${building.zipCode}` : ""}. Browse units, sales history, and building details.`;

  const stats = insights?.salesStats;
  const trend = insights?.yearlyTrend || [];
  const trendMaxMedian = Math.max(1, ...trend.map((t) => t.medianPrice));
  const lastTwo = trend.slice(-2);
  const yoyDelta =
    lastTwo.length === 2 && lastTwo[0].medianPrice > 0
      ? ((lastTwo[1].medianPrice - lastTwo[0].medianPrice) / lastTwo[0].medianPrice) * 100
      : null;
  const TrendIcon =
    yoyDelta === null ? Minus : yoyDelta > 0.5 ? TrendingUp : yoyDelta < -0.5 ? TrendingDown : Minus;

  const mixTotal = insights
    ? Object.values(insights.unitMix).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <AppLayout>
      <SEO
        title={`${building.displayAddress} - Condo Building | Realtors Dashboard`}
        description={buildingDesc}
        canonicalUrl={buildingUrl}
      />
      <BuildingJsonLd
        name={building.displayAddress}
        description={buildingDesc}
        streetAddress={building.displayAddress}
        addressLocality={building.borough || undefined}
        addressRegion="NY"
        postalCode={building.zipCode || undefined}
        latitude={building.latitude}
        longitude={building.longitude}
        numberOfUnits={building.residentialUnitCount}
        url={buildingUrl}
      />
      <BreadcrumbsJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: building.borough || "NYC", url: `/browse/ny` },
          { name: building.displayAddress, url: `/building/${building.baseBbl}` },
        ]}
      />

      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        <PropertyBreadcrumbs
          borough={building.borough}
          buildingAddress={building.displayAddress}
          buildingBbl={building.baseBbl}
        />

        {(building.latitude && building.longitude) && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 aspect-[16/9] overflow-hidden rounded-lg border" data-testid="hero-streetview-building">
              <StreetViewImage
                lat={building.latitude}
                lng={building.longitude}
                address={building.displayAddress}
                width={1200}
                height={500}
                loading="eager"
                rounded={false}
                alt={`Street view of ${building.displayAddress}`}
              />
            </div>
            <div className="aspect-[16/9] md:aspect-auto overflow-hidden rounded-lg border" data-testid="map-building-location">
              <PropertyMap
                properties={nearbyProperties}
                subjectProperty={{
                  id: building.baseBbl,
                  address: building.displayAddress,
                  city: building.borough || "",
                  state: "NY",
                  zipCode: building.zipCode || "",
                  propertyType: "Condo Building",
                  beds: null,
                  baths: null,
                  sqft: null,
                  latitude: building.latitude,
                  longitude: building.longitude,
                } as Property}
                center={{ lat: building.latitude, lng: building.longitude }}
                zoom={15}
                height="100%"
              />
            </div>
          </div>
        )}

        <Card data-testid="card-building-header">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-xl" data-testid="text-building-title">
                    {building.displayAddress}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span data-testid="text-building-location">
                    {building.borough}{building.zipCode ? `, ${building.zipCode}` : ""}
                  </span>
                </div>
              </div>
              <Badge data-testid="badge-building-type">
                Condo Building
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" data-testid="stat-residential-units">
                  {building.residentialUnitCount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Residential Units</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" data-testid="stat-total-units">
                  {building.unitCount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Total Units</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" data-testid="stat-other-units">
                  {(building.unitCount - building.residentialUnitCount).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Parking/Storage</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/50">
                <p className="text-sm font-mono text-muted-foreground" data-testid="stat-bbl">
                  BBL: {building.baseBbl}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList data-testid="tabs-building">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="h-4 w-4 mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="units" data-testid="tab-units">
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Units
            </TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales">
              <History className="h-4 w-4 mr-1.5" />
              Sales History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-stat-total-sales">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs">Total Sales</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {stats?.totalSales.toLocaleString() || 0}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-median-price">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs">Median Sale</span>
                  </div>
                  <p className="text-2xl font-bold">{formatPrice(stats?.medianPrice ?? null)}</p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-yoy">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendIcon className="h-4 w-4" />
                    <span className="text-xs">YoY Median</span>
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      yoyDelta === null
                        ? "text-muted-foreground"
                        : yoyDelta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : yoyDelta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "",
                    )}
                  >
                    {yoyDelta === null
                      ? "—"
                      : `${yoyDelta > 0 ? "+" : ""}${yoyDelta.toFixed(1)}%`}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-last-sale">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <History className="h-4 w-4" />
                    <span className="text-xs">Last Sale</span>
                  </div>
                  <p className="text-2xl font-bold">{formatPrice(stats?.lastSalePrice ?? null)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(stats?.lastSaleDate ?? null)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card data-testid="card-price-range">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Sale Price Range
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Lowest</p>
                      <p className="font-semibold">{formatPrice(stats?.minPrice ?? null)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="font-semibold">{formatPrice(stats?.avgPrice ?? null)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Highest</p>
                      <p className="font-semibold">{formatPrice(stats?.maxPrice ?? null)}</p>
                    </div>
                  </div>
                  {insights?.areaContext.medianPrice && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">
                        vs. ZIP {insights.areaContext.geoId} median{" "}
                        {formatPrice(insights.areaContext.medianPrice)}
                      </p>
                      {insights.areaContext.vsAreaPct !== null && (
                        <p
                          className={cn(
                            "text-sm font-semibold flex items-center gap-1",
                            insights.areaContext.vsAreaPct > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : insights.areaContext.vsAreaPct < 0
                                ? "text-red-600 dark:text-red-400"
                                : "",
                          )}
                          data-testid="text-vs-area"
                        >
                          {insights.areaContext.vsAreaPct > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {insights.areaContext.vsAreaPct > 0 ? "+" : ""}
                          {insights.areaContext.vsAreaPct.toFixed(1)}% vs. area
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-unit-mix">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                    Unit Mix
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {mixTotal === 0 && (
                    <p className="text-sm text-muted-foreground">No unit breakdown available.</p>
                  )}
                  {unitMixConfig.map(({ key, label, Icon, color }) => {
                    const count = insights?.unitMix[key] ?? 0;
                    if (count === 0) return null;
                    const pct = mixTotal > 0 ? (count / mixTotal) * 100 : 0;
                    return (
                      <div key={key} className="space-y-1" data-testid={`row-mix-${key}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {label}
                          </span>
                          <span className="font-medium tabular-nums">
                            {count.toLocaleString()}{" "}
                            <span className="text-muted-foreground text-xs">
                              ({pct.toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", color)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-yearly-trend">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Yearly Sales Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trend.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No yearly trend data available yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {trend.map((row) => {
                      const widthPct = (row.medianPrice / trendMaxMedian) * 100;
                      return (
                        <div
                          key={row.year}
                          className="grid grid-cols-12 items-center gap-3 text-sm"
                          data-testid={`row-trend-${row.year}`}
                        >
                          <span className="col-span-1 font-mono text-muted-foreground">
                            {row.year}
                          </span>
                          <div className="col-span-7 h-6 rounded bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary/70 flex items-center justify-end pr-2 text-xs text-primary-foreground font-medium"
                              style={{ width: `${Math.max(8, widthPct)}%` }}
                            >
                              {formatPrice(row.medianPrice)}
                            </div>
                          </div>
                          <span className="col-span-2 text-xs text-muted-foreground tabular-nums">
                            {row.count} {row.count === 1 ? "sale" : "sales"}
                          </span>
                          <span className="col-span-2 text-xs text-muted-foreground tabular-nums text-right">
                            {formatPrice(row.minPrice)} – {formatPrice(row.maxPrice)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="units">
            <BuildingUnitsSection baseBbl={baseBbl!} building={building} />
          </TabsContent>

          <TabsContent value="sales">
            <BuildingSalesHistory bbl={baseBbl!} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
