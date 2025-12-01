import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MarketStatsCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  percentile?: number;
  icon?: React.ReactNode;
  className?: string;
}

export function MarketStatsCard({
  label,
  value,
  unit,
  trend,
  trendLabel,
  percentile,
  icon,
  className,
}: MarketStatsCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="h-3 w-3" />;
    return trend > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return "text-muted-foreground";
    return trend > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  };

  return (
    <Card className={cn("hover-elevate", className)}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-2 md:gap-4">
          <div className="space-y-0.5 md:space-y-1 min-w-0">
            <p className="text-xs md:text-sm font-medium uppercase tracking-wide text-muted-foreground truncate">
              {label}
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl md:text-3xl font-bold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </span>
              {unit && <span className="text-xs md:text-sm text-muted-foreground">{unit}</span>}
            </div>
            {trend !== undefined && (
              <div className={cn("flex items-center gap-1 text-xs md:text-sm", getTrendColor())}>
                {getTrendIcon()}
                <span className="font-medium">
                  {Math.abs(trend).toFixed(1)}%
                </span>
                {trendLabel && (
                  <span className="text-muted-foreground hidden sm:inline">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              {icon}
            </div>
          )}
        </div>
        {percentile !== undefined && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Market Position</span>
              <span className="font-medium">P{percentile}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${percentile}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
