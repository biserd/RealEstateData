import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, MapPin, DollarSign, Calendar, History, Building2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { AppLayout } from "@/components/layouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyBreadcrumbs, BuildingContext } from "@/components/BuildingContext";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";

interface CondoUnit {
  unitBbl: string;
  baseBbl: string;
  unitDesignation: string | null;
  unitTypeHint: string | null;
  buildingDisplayAddress: string | null;
  unitDisplayAddress: string | null;
  borough: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface UnitSale {
  id: string;
  salePrice: number;
  saleDate: string;
  rawAddress: string | null;
  rawAptNumber: string | null;
}

const unitTypeLabels: Record<string, string> = {
  residential: "Residential Unit",
  parking: "Parking Space",
  storage: "Storage Unit",
  commercial: "Commercial Unit",
};

export default function UnitDetail() {
  const { unitBbl } = useParams<{ unitBbl: string }>();

  const { data: unit, isLoading, error } = useQuery<CondoUnit>({
    queryKey: ["/api/condo-units", unitBbl],
    queryFn: async () => {
      const res = await fetch(`/api/condo-units/${unitBbl}`);
      if (!res.ok) throw new Error("Failed to fetch unit");
      return res.json();
    },
    enabled: !!unitBbl,
  });

  const { data: salesData } = useQuery<{ sales: UnitSale[]; count: number }>({
    queryKey: ["/api/units", unitBbl, "sales"],
    queryFn: async () => {
      const res = await fetch(`/api/units/${unitBbl}/sales`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
    enabled: !!unitBbl,
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

  if (error || !unit) {
    return (
      <AppLayout>
        <div className="container max-w-5xl py-6">
          <EmptyState
            icon={<Home className="h-12 w-12" />}
            title="Unit not found"
            description="We couldn't find this condo unit in our database."
          />
        </div>
      </AppLayout>
    );
  }

  const lastSale = salesData?.sales?.[0];
  const unitTypeLabel = unitTypeLabels[unit.unitTypeHint || "residential"] || "Unit";

  return (
    <AppLayout>
      <SEO
        title={`${unit.unitDisplayAddress || unit.unitBbl} - ${unitTypeLabel} | Realtors Dashboard`}
        description={`View details for ${unit.unitDisplayAddress || unit.unitBbl}, a condo unit in ${unit.buildingDisplayAddress || "NYC"}.`}
      />
      
      <div className="container max-w-5xl py-6 space-y-6">
        <PropertyBreadcrumbs
          borough={unit.borough}
          buildingAddress={unit.buildingDisplayAddress}
          buildingBbl={unit.baseBbl}
          unitDesignation={unit.unitDesignation}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card data-testid="card-unit-header">
              <CardHeader>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-xl" data-testid="text-unit-title">
                        {unit.unitDesignation 
                          ? `Unit ${unit.unitDesignation}`
                          : `Unit ${unit.unitBbl.slice(-4)}`}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span data-testid="text-unit-address">
                        {unit.unitDisplayAddress || unit.buildingDisplayAddress}
                      </span>
                    </div>
                    {unit.borough && (
                      <p className="text-sm text-muted-foreground" data-testid="text-unit-location">
                        {unit.borough}{unit.zipCode ? `, ${unit.zipCode}` : ""}
                      </p>
                    )}
                  </div>
                  <Badge data-testid="badge-unit-type">
                    {unitTypeLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Unit BBL</p>
                    <p className="font-mono text-sm" data-testid="text-unit-bbl">
                      {unit.unitBbl}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">Building BBL</p>
                    <p className="font-mono text-sm" data-testid="text-base-bbl">
                      {unit.baseBbl}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="sales" className="space-y-4">
              <TabsList data-testid="tabs-unit">
                <TabsTrigger value="sales" data-testid="tab-sales">
                  <History className="h-4 w-4 mr-1.5" />
                  Sales History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sales">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Sales History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!salesData?.sales?.length ? (
                      <p className="text-center text-muted-foreground py-8">
                        No recorded sales for this unit
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {salesData.sales.map((sale) => (
                          <div 
                            key={sale.id}
                            className="flex items-center justify-between p-3 rounded-md border"
                            data-testid={`row-sale-${sale.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <div>
                                <p className="font-medium">
                                  ${sale.salePrice.toLocaleString()}
                                </p>
                                {sale.rawAptNumber && (
                                  <p className="text-xs text-muted-foreground">
                                    Apt: {sale.rawAptNumber}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {format(new Date(sale.saleDate), "MMM d, yyyy")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <BuildingContext baseBbl={unit.baseBbl} currentUnitBbl={unit.unitBbl} />

            {lastSale && (
              <Card data-testid="card-last-sale">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Last Sale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-last-sale-price">
                    ${lastSale.salePrice.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-last-sale-date">
                    {format(new Date(lastSale.saleDate), "MMMM d, yyyy")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
