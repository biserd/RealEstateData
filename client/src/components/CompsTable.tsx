import { Link } from "wouter";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPropertyUrl, formatPropertyAddress } from "@/lib/propertySlug";
import type { Property, Comp } from "@shared/schema";

interface CompWithProperty extends Comp {
  property: Property;
}

interface CompsTableProps {
  comps: CompWithProperty[];
  subjectProperty?: Property;
}

export function CompsTable({ comps, subjectProperty }: CompsTableProps) {
  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  const getSimilarityColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const formatAdjustment = (value: number | null) => {
    if (!value || value === 0) return "-";
    const sign = value > 0 ? "+" : "";
    return `${sign}${formatPrice(value)}`;
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Address</TableHead>
            <TableHead className="text-right">Sale Price</TableHead>
            <TableHead className="text-right">$/sqft</TableHead>
            <TableHead className="text-right">Beds/Baths</TableHead>
            <TableHead className="text-right">Sqft</TableHead>
            <TableHead className="text-right">Sale Date</TableHead>
            <TableHead className="text-right">Similarity</TableHead>
            <TableHead className="text-right">Adjustments</TableHead>
            <TableHead className="text-right">Adj. Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comps.map((comp) => (
            <TableRow key={comp.id} className="hover-elevate">
              <TableCell>
                <div className="space-y-1">
                  <Link 
                    href={getPropertyUrl(comp.property)}
                    className="flex items-center gap-1 font-medium hover:underline"
                  >
                    {formatPropertyAddress(comp.property)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {comp.property.city}, {comp.property.state} {comp.property.zipCode}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatPrice(comp.property.lastSalePrice)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {comp.property.pricePerSqft
                  ? `$${comp.property.pricePerSqft.toFixed(0)}`
                  : "N/A"}
              </TableCell>
              <TableCell className="text-right">
                {comp.property.beds}/{comp.property.baths}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {comp.property.sqft?.toLocaleString() || "N/A"}
              </TableCell>
              <TableCell className="text-right">
                {formatDate(comp.property.lastSaleDate)}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono",
                    getSimilarityColor(comp.similarityScore)
                  )}
                >
                  {comp.similarityScore?.toFixed(0)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="space-y-0.5 text-xs">
                  {comp.sqftAdjustment !== null && comp.sqftAdjustment !== 0 && (
                    <div className="text-muted-foreground">
                      Sqft: {formatAdjustment(comp.sqftAdjustment)}
                    </div>
                  )}
                  {comp.ageAdjustment !== null && comp.ageAdjustment !== 0 && (
                    <div className="text-muted-foreground">
                      Age: {formatAdjustment(comp.ageAdjustment)}
                    </div>
                  )}
                  {comp.bedsAdjustment !== null && comp.bedsAdjustment !== 0 && (
                    <div className="text-muted-foreground">
                      Beds: {formatAdjustment(comp.bedsAdjustment)}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatPrice(comp.adjustedPrice)}
              </TableCell>
            </TableRow>
          ))}
          {comps.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No comparable properties found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
