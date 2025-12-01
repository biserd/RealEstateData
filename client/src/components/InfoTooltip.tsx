import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string | React.ReactNode;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function InfoTooltip({
  content,
  className,
  iconClassName,
  side = "top",
  align = "center",
}: InfoTooltipProps) {
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors",
            className
          )}
          data-testid="info-tooltip-trigger"
        >
          <Info className={cn("h-3.5 w-3.5", iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className="max-w-[280px] text-sm leading-relaxed"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export const METRIC_EXPLANATIONS = {
  opportunityScore: (
    <div className="space-y-1.5">
      <p className="font-medium">Opportunity Score (0-100)</p>
      <p>
        A proprietary score measuring investment potential. Higher scores indicate 
        properties that may be underpriced relative to market comparables.
      </p>
      <p className="text-muted-foreground text-xs">
        75+: Strong opportunity • 50-74: Moderate • Below 50: Fair market value
      </p>
    </div>
  ),
  
  confidenceLevel: (
    <div className="space-y-1.5">
      <p className="font-medium">Confidence Level</p>
      <p>
        Indicates how reliable our estimate is based on available data quality 
        and comparable property matches.
      </p>
      <p className="text-muted-foreground text-xs">
        High: 5+ quality comps • Medium: 3-4 comps • Low: Limited data
      </p>
    </div>
  ),
  
  estimatedValue: (
    <div className="space-y-1.5">
      <p className="font-medium">Estimated Value</p>
      <p>
        Our calculated market value based on recent comparable sales, property 
        characteristics, and local market trends.
      </p>
    </div>
  ),
  
  pricePerSqft: (
    <div className="space-y-1.5">
      <p className="font-medium">Price per Square Foot</p>
      <p>
        Property price divided by total living area. Useful for comparing 
        properties of different sizes within the same market.
      </p>
    </div>
  ),
  
  marketPercentile: (
    <div className="space-y-1.5">
      <p className="font-medium">Market Percentile</p>
      <p>
        Shows where this property falls within the local price distribution.
      </p>
      <p className="text-muted-foreground text-xs">
        P25: Budget tier • P50: Median • P75: Premium tier
      </p>
    </div>
  ),
  
  trendScore: (
    <div className="space-y-1.5">
      <p className="font-medium">Trend Score (0-100)</p>
      <p>
        Composite score measuring neighborhood momentum based on price appreciation, 
        transaction volume, and market acceleration.
      </p>
    </div>
  ),
  
  aiGrounding: (
    <div className="space-y-1.5">
      <p className="font-medium">AI Analysis</p>
      <p>
        All insights are grounded in real property data, comparable sales, and market 
        statistics. Look for citations to specific data points.
      </p>
      <p className="text-muted-foreground text-xs">
        We never fabricate information—all claims are data-backed.
      </p>
    </div>
  ),
  
  comps: (
    <div className="space-y-1.5">
      <p className="font-medium">Comparable Properties</p>
      <p>
        Similar properties used to estimate value. Matched by location, size, 
        age, and property type with adjustments for differences.
      </p>
    </div>
  ),
};
