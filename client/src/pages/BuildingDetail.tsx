import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, TrendingUp, History } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyBreadcrumbs } from "@/components/BuildingContext";
import { BuildingUnitsSection } from "@/components/BuildingUnitsSection";
import { BuildingSalesHistory } from "@/components/BuildingSalesHistory";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";

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

export default function BuildingDetail() {
  const { baseBbl } = useParams<{ baseBbl: string }>();

  const { data: building, isLoading, error } = useQuery<Building>({
    queryKey: ["/api/buildings", baseBbl, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${baseBbl}/details`);
      if (!res.ok) throw new Error("Failed to fetch building");
      return res.json();
    },
    enabled: !!baseBbl,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container max-w-5xl py-6">
          <LoadingState type="skeleton-details" />
        </div>
      </AppLayout>
    );
  }

  if (error || !building) {
    return (
      <AppLayout>
        <div className="container max-w-5xl py-6">
          <EmptyState
            icon={<Building2 className="h-12 w-12" />}
            title="Building not found"
            description="We couldn't find this building in our database."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SEO
        title={`${building.displayAddress} - Condo Building | Realtors Dashboard`}
        description={`View details for ${building.displayAddress}, a condo building with ${building.residentialUnitCount} residential units in ${building.borough || "NYC"}.`}
      />
      
      <div className="container max-w-5xl py-6 space-y-6">
        <PropertyBreadcrumbs
          borough={building.borough}
          buildingAddress={building.displayAddress}
          buildingBbl={building.baseBbl}
        />

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

        <Tabs defaultValue="units" className="space-y-4">
          <TabsList data-testid="tabs-building">
            <TabsTrigger value="units" data-testid="tab-units">
              <Building2 className="h-4 w-4 mr-1.5" />
              Units
            </TabsTrigger>
            <TabsTrigger value="sales" data-testid="tab-sales">
              <History className="h-4 w-4 mr-1.5" />
              Sales History
            </TabsTrigger>
          </TabsList>

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
