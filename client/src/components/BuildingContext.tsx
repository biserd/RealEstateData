import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Home, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

interface CondoUnit {
  unitBbl: string;
  baseBbl: string;
  unitDesignation: string | null;
  unitTypeHint: string | null;
  buildingDisplayAddress: string | null;
  unitDisplayAddress: string | null;
  borough: string | null;
  zipCode: string | null;
}

interface BuildingContextProps {
  baseBbl: string;
  currentUnitBbl?: string;
}

export function BuildingContext({ baseBbl, currentUnitBbl }: BuildingContextProps) {
  const { data: building, isLoading: buildingLoading } = useQuery<Building>({
    queryKey: ["/api/buildings", baseBbl, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${baseBbl}/details`);
      if (!res.ok) throw new Error("Failed to fetch building");
      return res.json();
    },
    enabled: !!baseBbl,
  });

  const { data: unitsData, isLoading: unitsLoading } = useQuery<{
    units: Array<{
      unitBbl: string;
      unitDesignation: string | null;
      unitTypeHint: string | null;
      unitDisplayAddress: string | null;
    }>;
    count: number;
  }>({
    queryKey: ["/api/buildings", baseBbl, "units"],
    queryFn: async () => {
      const res = await fetch(`/api/buildings/${baseBbl}/units?limit=10`);
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    enabled: !!baseBbl,
  });

  if (buildingLoading) {
    return (
      <Card data-testid="card-building-context-loading">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!building) {
    return null;
  }

  const otherUnits = unitsData?.units.filter(u => u.unitBbl !== currentUnitBbl) || [];

  return (
    <Card data-testid="card-building-context">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Parent Building
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-condo-building">
            Condo Building
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium" data-testid="text-building-address">
                {building.displayAddress}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-building-location">
                {building.borough}{building.zipCode ? `, ${building.zipCode}` : ""}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-unit-count">
                {building.residentialUnitCount.toLocaleString()} residential units
              </span>
            </div>
            {building.unitCount !== building.residentialUnitCount && (
              <span className="text-muted-foreground" data-testid="text-total-units">
                ({building.unitCount.toLocaleString()} total)
              </span>
            )}
          </div>
        </div>

        {otherUnits.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">More units in this building</p>
            <div className="flex flex-wrap gap-1.5">
              {otherUnits.slice(0, 8).map((unit) => (
                <Link 
                  key={unit.unitBbl} 
                  href={`/unit/${unit.unitBbl}`}
                >
                  <Badge 
                    variant="outline" 
                    className="cursor-pointer hover-elevate"
                    data-testid={`badge-unit-${unit.unitBbl}`}
                  >
                    {unit.unitDesignation || unit.unitBbl}
                  </Badge>
                </Link>
              ))}
              {(unitsData?.count || 0) > 8 && (
                <Badge variant="secondary" className="text-muted-foreground">
                  +{(unitsData?.count || 0) - 8} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="pt-1">
          <Link href={`/building/${baseBbl}`}>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-view-building">
              View Building Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function PropertyBreadcrumbs({ 
  borough, 
  buildingAddress,
  buildingBbl,
  unitDesignation 
}: { 
  borough?: string | null;
  buildingAddress?: string | null;
  buildingBbl?: string | null;
  unitDesignation?: string | null;
}) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap" data-testid="nav-breadcrumbs">
      <Link href="/screener" className="hover:text-foreground transition-colors">
        NYC
      </Link>
      {borough && (
        <>
          <ChevronRight className="h-3 w-3" />
          <Link 
            href={`/screener?borough=${encodeURIComponent(borough)}`} 
            className="hover:text-foreground transition-colors"
          >
            {borough}
          </Link>
        </>
      )}
      {buildingAddress && buildingBbl && (
        <>
          <ChevronRight className="h-3 w-3" />
          <Link 
            href={`/building/${buildingBbl}`}
            className="hover:text-foreground transition-colors"
          >
            {buildingAddress}
          </Link>
        </>
      )}
      {unitDesignation && (
        <>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Unit {unitDesignation}</span>
        </>
      )}
    </nav>
  );
}
