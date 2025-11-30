import { Info, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CoverageLevel } from "@shared/schema";

interface CoverageBadgeProps {
  level: CoverageLevel;
  showTooltip?: boolean;
  className?: string;
}

const coverageConfig: Record<CoverageLevel, {
  label: string;
  description: string;
  color: string;
  icon: typeof CheckCircle2;
}> = {
  MarketOnly: {
    label: "Market Only",
    description: "Basic market statistics available. Limited property-level data.",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: Info,
  },
  PropertyFacts: {
    label: "Property Facts",
    description: "Property details available including beds, baths, sqft.",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: Info,
  },
  SalesHistory: {
    label: "Sales History",
    description: "Historical sales data available for this area.",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    icon: AlertTriangle,
  },
  Listings: {
    label: "Listings",
    description: "Active listings data available including list prices.",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  Comps: {
    label: "Full Comps",
    description: "Complete comparable sales analysis available.",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    icon: CheckCircle2,
  },
  AltSignals: {
    label: "Deep Coverage",
    description: "Full coverage including permits, violations, and alternative data.",
    color: "bg-primary/10 text-primary",
    icon: Shield,
  },
};

export function CoverageBadge({ level, showTooltip = true, className }: CoverageBadgeProps) {
  const config = coverageConfig[level];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-transparent",
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <p className="max-w-xs">{config.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
