import { cn } from "@/lib/utils";

interface PriceDistributionProps {
  p25: number;
  p50: number;
  p75: number;
  currentValue?: number;
  label?: string;
  unit?: string;
}

export function PriceDistribution({
  p25,
  p50,
  p75,
  currentValue,
  label = "Price Distribution",
  unit = "$",
}: PriceDistributionProps) {
  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `${unit}${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${unit}${(value / 1000).toFixed(0)}K`;
    }
    return `${unit}${value}`;
  };

  const getPosition = (value: number) => {
    const min = p25 * 0.7;
    const max = p75 * 1.3;
    const range = max - min;
    return Math.max(0, Math.min(100, ((value - min) / range) * 100));
  };

  const p25Position = getPosition(p25);
  const p50Position = getPosition(p50);
  const p75Position = getPosition(p75);
  const currentPosition = currentValue ? getPosition(currentValue) : null;

  const getValueAssessment = () => {
    if (!currentValue) return null;
    if (currentValue < p25) return { label: "Below Market", color: "text-emerald-600 dark:text-emerald-400" };
    if (currentValue < p50) return { label: "Below Median", color: "text-emerald-600 dark:text-emerald-400" };
    if (currentValue < p75) return { label: "Above Median", color: "text-amber-600 dark:text-amber-400" };
    return { label: "Above Market", color: "text-red-600 dark:text-red-400" };
  };

  const assessment = getValueAssessment();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {assessment && (
          <span className={cn("text-sm font-medium", assessment.color)}>
            {assessment.label}
          </span>
        )}
      </div>

      <div className="relative h-12">
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-red-200 dark:from-emerald-900/50 dark:via-amber-900/50 dark:to-red-900/50" />

        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p25Position}%` }}
        >
          <div className="flex flex-col items-center">
            <div className="h-6 w-0.5 bg-muted-foreground/40" />
            <span className="mt-1 text-xs text-muted-foreground">P25</span>
            <span className="text-xs font-medium">{formatValue(p25)}</span>
          </div>
        </div>

        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p50Position}%` }}
        >
          <div className="flex flex-col items-center">
            <div className="h-8 w-0.5 bg-foreground" />
            <span className="mt-1 text-xs font-medium text-foreground">Median</span>
            <span className="text-xs font-bold">{formatValue(p50)}</span>
          </div>
        </div>

        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p75Position}%` }}
        >
          <div className="flex flex-col items-center">
            <div className="h-6 w-0.5 bg-muted-foreground/40" />
            <span className="mt-1 text-xs text-muted-foreground">P75</span>
            <span className="text-xs font-medium">{formatValue(p75)}</span>
          </div>
        </div>

        {currentPosition !== null && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            style={{ left: `${currentPosition}%` }}
          >
            <div className="flex flex-col items-center">
              <div className="h-4 w-4 rounded-full border-2 border-primary bg-background shadow-lg" />
              <span className="mt-1 whitespace-nowrap text-xs font-bold text-primary">
                {formatValue(currentValue!)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
