import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface ScoreDriver {
  label: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
}

interface ScoreDriversListProps {
  drivers: ScoreDriver[];
  mode?: "compact" | "expanded";
  maxItems?: number;
  showHeader?: boolean;
}

export function ScoreDriversList({ 
  drivers, 
  mode = "compact", 
  maxItems,
  showHeader = false 
}: ScoreDriversListProps) {
  if (!drivers || drivers.length === 0) return null;
  
  const displayDrivers = maxItems ? drivers.slice(0, maxItems) : drivers;

  const getImpactIcon = (impact: ScoreDriver["impact"]) => {
    const iconClass = mode === "compact" ? "h-3 w-3 shrink-0" : "h-4 w-4 shrink-0 mt-0.5";
    switch (impact) {
      case "positive":
        return <TrendingUp className={`${iconClass} text-emerald-600`} />;
      case "negative":
        return <TrendingDown className={`${iconClass} text-red-500`} />;
      default:
        return <Minus className={`${iconClass} text-muted-foreground`} />;
    }
  };

  const getTextClass = (impact: ScoreDriver["impact"]) => {
    switch (impact) {
      case "positive":
        return "text-emerald-700 dark:text-emerald-400";
      case "negative":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  if (mode === "compact") {
    return (
      <div className="space-y-1">
        {showHeader && (
          <p className="text-xs font-medium text-muted-foreground mb-2">Why this opportunity:</p>
        )}
        {displayDrivers.map((driver, idx) => (
          <div key={idx} className="flex items-center gap-1 text-xs">
            {getImpactIcon(driver.impact)}
            <span className={getTextClass(driver.impact)}>
              <span className="font-medium">{driver.label}:</span> {driver.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {displayDrivers.map((driver, idx) => (
        <div 
          key={idx} 
          className={`flex items-start gap-2 text-sm rounded-md p-2 ${
            driver.impact === "positive" 
              ? "bg-emerald-50/50 dark:bg-emerald-950/30" 
              : driver.impact === "negative"
                ? "bg-red-50/50 dark:bg-red-950/30"
                : "bg-muted/50"
          }`}
        >
          {getImpactIcon(driver.impact)}
          <span className={getTextClass(driver.impact)}>
            <span className="font-medium">{driver.label}:</span> {driver.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function generateBuildingScoreDrivers(property: {
  opportunityScore?: number | null;
  pricePerSqft?: number | null;
  confidenceLevel?: string | null;
  estimatedValue?: number | null;
  lastSalePrice?: number | null;
}): ScoreDriver[] {
  const drivers: ScoreDriver[] = [];

  if (property.opportunityScore && property.opportunityScore >= 70) {
    drivers.push({
      label: "High opportunity score",
      value: `${property.opportunityScore}/100`,
      impact: "positive",
    });
  } else if (property.opportunityScore && property.opportunityScore >= 50) {
    drivers.push({
      label: "Moderate opportunity score",
      value: `${property.opportunityScore}/100`,
      impact: "neutral",
    });
  }

  if (property.pricePerSqft && property.pricePerSqft < 200) {
    drivers.push({
      label: "Attractive price per sqft",
      value: `$${property.pricePerSqft}/sqft`,
      impact: "positive",
    });
  } else if (property.pricePerSqft && property.pricePerSqft < 400) {
    drivers.push({
      label: "Competitive price per sqft",
      value: `$${property.pricePerSqft}/sqft`,
      impact: "neutral",
    });
  }

  if (property.confidenceLevel === "High") {
    drivers.push({
      label: "Data confidence",
      value: "High",
      impact: "positive",
    });
  } else if (property.confidenceLevel === "Medium") {
    drivers.push({
      label: "Data confidence",
      value: "Medium",
      impact: "neutral",
    });
  }

  if (property.estimatedValue && property.lastSalePrice) {
    const pctDiff = ((property.estimatedValue - property.lastSalePrice) / property.lastSalePrice) * 100;
    if (pctDiff > 10) {
      drivers.push({
        label: "Value appreciation potential",
        value: `+${pctDiff.toFixed(0)}% since last sale`,
        impact: "positive",
      });
    }
  }

  return drivers;
}

export function generateUnitScoreDrivers(unit: {
  opportunityScore?: number | null;
  lastSalePrice?: number | null;
  pricePerSqft?: number | null;
}, buildingData?: {
  medianPrice?: number | null;
  salesCount?: number | null;
  lastSaleDate?: Date | string | null;
}): ScoreDriver[] {
  const drivers: ScoreDriver[] = [];

  if (buildingData?.medianPrice && unit.lastSalePrice) {
    const vsMedian = ((buildingData.medianPrice - unit.lastSalePrice) / buildingData.medianPrice) * 100;
    if (vsMedian > 5) {
      drivers.push({
        label: "Below building median",
        value: `${vsMedian.toFixed(0)}% below`,
        impact: "positive",
      });
    } else if (vsMedian < -5) {
      drivers.push({
        label: "Above building median",
        value: `${Math.abs(vsMedian).toFixed(0)}% above`,
        impact: "negative",
      });
    }
  }

  if (buildingData?.salesCount) {
    if (buildingData.salesCount >= 8) {
      drivers.push({
        label: "High liquidity",
        value: `${buildingData.salesCount} sales in building`,
        impact: "positive",
      });
    } else if (buildingData.salesCount >= 4) {
      drivers.push({
        label: "Moderate liquidity",
        value: `${buildingData.salesCount} sales in building`,
        impact: "neutral",
      });
    } else {
      drivers.push({
        label: "Low liquidity",
        value: `${buildingData.salesCount} sales in building`,
        impact: "negative",
      });
    }
  }

  if (buildingData?.lastSaleDate) {
    const saleDate = new Date(buildingData.lastSaleDate);
    const daysSinceSale = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceSale < 180) {
      drivers.push({
        label: "Recent transaction",
        value: `${daysSinceSale} days ago`,
        impact: "positive",
      });
    } else if (daysSinceSale < 365) {
      drivers.push({
        label: "Transaction recency",
        value: `${Math.floor(daysSinceSale / 30)} months ago`,
        impact: "neutral",
      });
    }
  }

  if (unit.opportunityScore && unit.opportunityScore >= 70) {
    drivers.push({
      label: "Strong opportunity",
      value: `${unit.opportunityScore}/100 score`,
      impact: "positive",
    });
  }

  return drivers;
}
