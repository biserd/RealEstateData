import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, Building2, Search, Car, Package, Store, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getUnitUrl } from "@/lib/unitSlug";

interface Building {
  baseBbl: string;
  displayAddress: string;
  borough: string | null;
  zipCode: string | null;
  unitCount: number;
  residentialUnitCount: number;
}

interface BuildingUnit {
  unitBbl: string;
  unitDesignation: string | null;
  unitTypeHint: string | null;
  unitDisplayAddress: string | null;
}

interface BuildingUnitsSectionProps {
  baseBbl: string;
  building?: Building;
}

const unitTypeIcons: Record<string, typeof Home> = {
  residential: Home,
  parking: Car,
  storage: Package,
  commercial: Store,
};

const unitTypeLabels: Record<string, string> = {
  residential: "Residential",
  parking: "Parking",
  storage: "Storage",
  commercial: "Commercial",
};

export function BuildingUnitsSection({ baseBbl, building }: BuildingUnitsSectionProps) {
  const [includeAll, setIncludeAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data: unitsData, isLoading } = useQuery<{
    units: BuildingUnit[];
    count: number;
    filtered: boolean;
  }>({
    queryKey: ["/api/buildings", baseBbl, "units", includeAll, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        includeAll: includeAll.toString(),
      });
      const res = await fetch(`/api/buildings/${baseBbl}/units?${params}`);
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    },
    enabled: !!baseBbl,
  });

  const filteredUnits = unitsData?.units.filter(unit => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      unit.unitDesignation?.toLowerCase().includes(query) ||
      unit.unitDisplayAddress?.toLowerCase().includes(query) ||
      unit.unitBbl.includes(query)
    );
  }) || [];

  const totalUnits = building ? (includeAll ? building.unitCount : building.residentialUnitCount) : 0;
  const hasMore = (unitsData?.count || 0) === limit;
  const hasPrev = offset > 0;

  return (
    <Card data-testid="card-building-units">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Units in Building
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-units-summary">
            {building?.residentialUnitCount.toLocaleString() || 0} residential
            {building && building.unitCount !== building.residentialUnitCount && (
              <span className="text-muted-foreground ml-1">
                / {building.unitCount.toLocaleString()} total
              </span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-unit-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="include-all"
              checked={includeAll}
              onCheckedChange={(checked) => {
                setIncludeAll(checked);
                setOffset(0);
              }}
              data-testid="switch-include-all"
            />
            <Label htmlFor="include-all" className="text-sm cursor-pointer">
              Include parking/storage
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredUnits.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery ? "No units match your search" : "No units found"}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredUnits.map((unit) => {
              const IconComponent = unitTypeIcons[unit.unitTypeHint || "residential"] || Home;
              
              return (
                <Link key={unit.unitBbl} href={getUnitUrl(unit, building ? { displayAddress: building.displayAddress, borough: building.borough || undefined } : undefined)}>
                  <div 
                    className="flex items-center justify-between gap-2 p-3 rounded-md hover-elevate cursor-pointer border"
                    data-testid={`row-unit-${unit.unitBbl}`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">
                          {unit.unitDesignation || `Unit ${unit.unitBbl.slice(-4)}`}
                        </p>
                        {unit.unitTypeHint && unit.unitTypeHint !== "residential" && (
                          <p className="text-xs text-muted-foreground">
                            {unitTypeLabels[unit.unitTypeHint] || unit.unitTypeHint}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {(hasPrev || hasMore) && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={!hasPrev}
              data-testid="button-prev-units"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Showing {offset + 1}-{offset + filteredUnits.length}
              {building && ` of ~${totalUnits.toLocaleString()}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={!hasMore}
              data-testid="button-next-units"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
