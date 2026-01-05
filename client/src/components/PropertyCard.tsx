import { Link } from "wouter";
import { Bed, Bath, Square, Calendar, MapPin, Heart, Target } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getPropertyUrl, formatFullAddress } from "@/lib/propertySlug";
import type { Property, ConfidenceLevel } from "@shared/schema";
import { EntityTypeBadge, PriceTypeBadge } from "./UnitOpportunityCard";
import { ScoreDriversList, type ScoreDriver } from "@/components/ScoreDriversList";

interface PropertyCardProps {
  property: Property;
  showOpportunityScore?: boolean;
  onSave?: (propertyId: string) => void;
  isSaved?: boolean;
  scoreDrivers?: ScoreDriver[];
}

export function PropertyCard({
  property,
  showOpportunityScore = true,
  onSave,
  isSaved = false,
  scoreDrivers,
}: PropertyCardProps) {
  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getConfidenceBadgeVariant = (level: ConfidenceLevel | string | null) => {
    switch (level) {
      case "High":
        return "default";
      case "Medium":
        return "secondary";
      case "Low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 75) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 75) return "bg-emerald-100 dark:bg-emerald-900/30";
    if (score >= 50) return "bg-amber-100 dark:bg-amber-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  const getScoreLabel = (score: number | null) => {
    if (!score) return "";
    if (score >= 75) return "Strong";
    if (score >= 50) return "Moderate";
    return "Limited";
  };

  const isStrongOpportunity = property.opportunityScore && property.opportunityScore >= 70;
  
  return (
    <Card 
      className={`group hover-elevate h-full ${isStrongOpportunity ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20" : ""}`} 
      data-testid={`card-property-${property.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0",
                isSaved && "text-red-500"
              )}
              onClick={(e) => {
                e.preventDefault();
                onSave?.(property.id);
              }}
              data-testid={`button-save-property-${property.id}`}
            >
              <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
            </Button>
            <EntityTypeBadge type="building" />
          </div>
          {showOpportunityScore && property.opportunityScore && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className={cn(
                    "cursor-help",
                    getScoreBg(property.opportunityScore)
                  )}
                  data-testid={`badge-score-${property.id}`}
                >
                  <Target className="h-3 w-3 mr-1" />
                  <span className={cn("font-bold", getScoreColor(property.opportunityScore))}>
                    {property.opportunityScore}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    - {getScoreLabel(property.opportunityScore)}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[240px]">
                <div className="space-y-1">
                  <p className="font-medium">Value Gap (Estimated)</p>
                  <p className="text-xs text-muted-foreground">
                    {property.opportunityScore >= 75
                      ? "Estimated value appears below market—based on modeled data, not verified sales."
                      : property.opportunityScore >= 50
                      ? "Fair estimated value—some potential upside based on modeled comparisons."
                      : "Estimated market value—priced in line with modeled comparable properties."}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Note: Based on estimated values, not recorded transactions.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Link href={getPropertyUrl(property)}>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">
                {property.lastSalePrice ? "Sale Price" : "Estimated Value"}
              </p>
              <p className="text-xl font-bold" data-testid={`text-price-${property.id}`}>
                {formatPrice(property.lastSalePrice || property.estimatedValue)}
              </p>
              {property.pricePerSqft && (
                <p className="text-xs text-muted-foreground">
                  ${property.pricePerSqft.toFixed(0)}/sqft
                </p>
              )}
            </div>

            <div className="flex items-start gap-1 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="line-clamp-2" data-testid={`text-address-${property.id}`}>
                {formatFullAddress(property)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {property.beds !== null && (
                <span className="flex items-center gap-1">
                  <Bed className="h-4 w-4" />
                  {property.beds} bed
                </span>
              )}
              {property.baths !== null && (
                <span className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  {property.baths} bath
                </span>
              )}
              {property.sqft && (
                <span className="flex items-center gap-1">
                  <Square className="h-4 w-4" />
                  {property.sqft.toLocaleString()} sqft
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PriceTypeBadge hasRealSale={!!property.lastSalePrice} />
              <Badge variant="outline" className="text-xs">
                {property.propertyType}
              </Badge>
              {property.yearBuilt && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="mr-1 h-3 w-3" />
                  {property.yearBuilt}
                </Badge>
              )}
              {property.confidenceLevel && (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span 
                      className="cursor-help inline-block" 
                      data-testid={`tooltip-confidence-${property.id}`}
                    >
                      <Badge 
                        variant={getConfidenceBadgeVariant(property.confidenceLevel)} 
                        className="text-xs"
                      >
                        {property.confidenceLevel} Confidence
                      </Badge>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <div className="space-y-1">
                      <p className="font-medium">Data Confidence</p>
                      <p className="text-xs text-muted-foreground">
                        {property.confidenceLevel === "High"
                          ? "Based on 5+ quality comparable sales in the area."
                          : property.confidenceLevel === "Medium"
                          ? "Based on 3-4 comparable sales with good matching."
                          : "Limited comparable data—estimate may be less precise."}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {scoreDrivers && scoreDrivers.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <ScoreDriversList drivers={scoreDrivers} mode="compact" maxItems={2} showHeader />
              </div>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
