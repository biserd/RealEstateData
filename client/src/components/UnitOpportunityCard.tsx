import { Link } from "wouter";
import { Home, MapPin, DollarSign, Target, Calendar, Building2, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import { getUnitUrl } from "@/lib/unitSlug";

export function EntityTypeBadge({ type }: { type: "unit" | "building" }) {
  return (
    <Badge 
      variant="outline" 
      className={type === "unit" 
        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" 
        : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
      }
      data-testid={`badge-entity-${type}`}
    >
      {type === "unit" ? <Home className="h-3 w-3 mr-1" /> : <Building2 className="h-3 w-3 mr-1" />}
      {type === "unit" ? "UNIT" : "BUILDING"}
    </Badge>
  );
}

export function PriceTypeBadge({ hasRealSale }: { hasRealSale: boolean }) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="cursor-help inline-block">
          <Badge 
            variant="outline" 
            className={hasRealSale 
              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" 
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
            }
            data-testid={`badge-price-type-${hasRealSale ? "verified" : "estimated"}`}
          >
            {hasRealSale ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                VERIFIED
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                ESTIMATED
              </>
            )}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        <div className="space-y-1">
          <p className="font-medium">{hasRealSale ? "Verified Sale Price" : "Estimated Value"}</p>
          <p className="text-xs text-muted-foreground">
            {hasRealSale 
              ? "Based on a recorded transaction from public records."
              : "Estimated = sqft × neighborhood $/sqft (not a recorded sale)"}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface UnitOpportunity {
  unitBbl: string;
  baseBbl: string;
  unitDesignation: string | null;
  unitDisplayAddress: string | null;
  buildingDisplayAddress: string | null;
  borough: string | null;
  zipCode: string | null;
  lastSalePrice: number;
  lastSaleDate: string;
  opportunityScore: number;
}

interface UnitOpportunityCardProps {
  unit: UnitOpportunity;
  viewMode?: "grid" | "list";
}

export function UnitOpportunityCard({ unit, viewMode = "grid" }: UnitOpportunityCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
    if (score >= 50) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
    return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Strong";
    if (score >= 50) return "Moderate";
    return "Limited";
  };

  const unitTitle = unit.unitDesignation 
    ? `Unit ${unit.unitDesignation}` 
    : `Unit ${unit.unitBbl.slice(-4)}`;

  if (viewMode === "list") {
    return (
      <Link href={getUnitUrl(unit)}>
        <Card className="hover-elevate cursor-pointer" data-testid={`card-unit-opportunity-${unit.unitBbl}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <EntityTypeBadge type="unit" />
                    <PriceTypeBadge hasRealSale={true} />
                  </div>
                  <h3 className="font-semibold" data-testid="text-unit-title">{unitTitle}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span data-testid="text-unit-address">
                      {unit.buildingDisplayAddress || unit.unitDisplayAddress}
                    </span>
                    {unit.borough && (
                      <span className="ml-1">({unit.borough})</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Last Sale</p>
                  <p className="font-semibold text-green-600" data-testid="text-last-sale">
                    ${unit.lastSalePrice.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-sm" data-testid="text-sale-date">
                    {format(new Date(unit.lastSaleDate), "MMM yyyy")}
                  </p>
                </div>
                <Badge 
                  variant="secondary" 
                  className={getScoreColor(unit.opportunityScore)}
                  data-testid="badge-score"
                >
                  <Target className="h-3 w-3 mr-1" />
                  {unit.opportunityScore}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={getUnitUrl(unit)}>
      <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-unit-opportunity-${unit.unitBbl}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <EntityTypeBadge type="unit" />
              <PriceTypeBadge hasRealSale={true} />
            </div>
            <Badge 
              variant="secondary" 
              className={getScoreColor(unit.opportunityScore)}
              data-testid="badge-score"
            >
              <Target className="h-3 w-3 mr-1" />
              {unit.opportunityScore} - {getScoreLabel(unit.opportunityScore)}
            </Badge>
          </div>
          <CardTitle className="text-base mt-2" data-testid="text-unit-title">
            {unitTitle}
          </CardTitle>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate" data-testid="text-unit-address">
              {unit.buildingDisplayAddress || unit.unitDisplayAddress}
            </span>
          </div>
          {unit.borough && (
            <p className="text-xs text-muted-foreground" data-testid="text-location">
              {unit.borough}{unit.zipCode ? `, ${unit.zipCode}` : ""}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 rounded bg-muted/50">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" />
                Last Sale
              </div>
              <p className="font-semibold text-green-600 text-sm" data-testid="text-last-sale">
                ${unit.lastSalePrice.toLocaleString()}
              </p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Sale Date
              </div>
              <p className="text-sm font-medium" data-testid="text-sale-date">
                {format(new Date(unit.lastSaleDate), "MMM yyyy")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
