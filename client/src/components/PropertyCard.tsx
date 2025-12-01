import { Link } from "wouter";
import { Bed, Bath, Square, Calendar, MapPin, Heart, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getPropertyUrl } from "@/lib/propertySlug";
import type { Property, ConfidenceLevel } from "@shared/schema";

interface PropertyCardProps {
  property: Property;
  showOpportunityScore?: boolean;
  onSave?: (propertyId: string) => void;
  isSaved?: boolean;
}

export function PropertyCard({
  property,
  showOpportunityScore = true,
  onSave,
  isSaved = false,
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

  return (
    <Card className="group overflow-hidden hover-elevate" data-testid={`card-property-${property.id}`}>
      <div className="relative">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          {property.imageUrl ? (
            <img
              src={property.imageUrl}
              alt={property.address}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Square className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
        </div>
        
        {showOpportunityScore && property.opportunityScore && (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "absolute right-3 top-3 flex h-12 w-12 flex-col items-center justify-center rounded-lg shadow-lg cursor-help",
                  getScoreBg(property.opportunityScore)
                )}
                data-testid={`tooltip-score-${property.id}`}
              >
                <span className={cn("text-lg font-bold", getScoreColor(property.opportunityScore))}>
                  {property.opportunityScore}
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">Score</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[240px]">
              <div className="space-y-1">
                <p className="font-medium">Opportunity Score</p>
                <p className="text-xs text-muted-foreground">
                  {property.opportunityScore >= 75
                    ? "Strong investment potential—property appears underpriced vs. market."
                    : property.opportunityScore >= 50
                    ? "Moderate opportunity—fairly priced with some upside potential."
                    : "Fair market value—priced in line with comparable properties."}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "absolute left-3 top-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm",
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
      </div>

      <CardContent className="p-4">
        <Link href={getPropertyUrl(property)}>
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-bold" data-testid={`text-price-${property.id}`}>
                {formatPrice(property.estimatedValue || property.lastSalePrice)}
              </p>
              {property.pricePerSqft && (
                <p className="text-sm text-muted-foreground">
                  ${property.pricePerSqft.toFixed(0)}/sqft
                </p>
              )}
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

            <div className="flex items-start gap-1 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="line-clamp-2" data-testid={`text-address-${property.id}`}>
                {property.address}, {property.city}, {property.state} {property.zipCode}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
