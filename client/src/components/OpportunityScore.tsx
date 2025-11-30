import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OpportunityScoreBreakdown } from "@shared/schema";

interface OpportunityScoreProps {
  score: number;
  breakdown?: OpportunityScoreBreakdown;
  size?: "sm" | "md" | "lg";
  showBreakdown?: boolean;
}

export function OpportunityScore({
  score,
  breakdown,
  size = "md",
  showBreakdown = false,
}: OpportunityScoreProps) {
  const getScoreColor = (value: number) => {
    if (value >= 75) return "text-emerald-600 dark:text-emerald-400";
    if (value >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = (value: number) => {
    if (value >= 75) return "stroke-emerald-500";
    if (value >= 50) return "stroke-amber-500";
    return "stroke-red-500";
  };

  const sizeClasses = {
    sm: { wrapper: "h-16 w-16", text: "text-lg", label: "text-[8px]" },
    md: { wrapper: "h-24 w-24", text: "text-2xl", label: "text-[10px]" },
    lg: { wrapper: "h-32 w-32", text: "text-4xl", label: "text-xs" },
  };

  const circumference = 2 * Math.PI * 45;
  const progress = ((100 - score) / 100) * circumference;

  const breakdownItems = breakdown
    ? [
        { label: "Mispricing", value: breakdown.mispricing, weight: "40%" },
        { label: "Confidence", value: breakdown.confidence, weight: "15%" },
        { label: "Liquidity", value: breakdown.liquidity, weight: "15%" },
        { label: "Risk", value: breakdown.risk, weight: "15%" },
        { label: "Value-Add", value: breakdown.valueAdd, weight: "15%" },
      ]
    : [];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={cn("relative", sizeClasses[size].wrapper)}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            className={cn("transition-all duration-500", getProgressColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold tabular-nums", sizeClasses[size].text, getScoreColor(score))}>
            {score}
          </span>
          <span className={cn("uppercase text-muted-foreground", sizeClasses[size].label)}>
            Score
          </span>
        </div>
      </div>

      {showBreakdown && breakdown && (
        <div className="w-full space-y-3">
          {breakdownItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.label}
                  <span className="ml-1 text-xs opacity-60">({item.weight})</span>
                </span>
                <span className={cn("font-medium tabular-nums", getScoreColor(item.value))}>
                  {item.value}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    item.value >= 75
                      ? "bg-emerald-500"
                      : item.value >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                  )}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}

          {breakdown.explanations.length > 0 && (
            <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Key Factors
              </p>
              <ul className="space-y-1">
                {breakdown.explanations.slice(0, 3).map((explanation, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    {explanation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
