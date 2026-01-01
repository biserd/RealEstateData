import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Building2, 
  AlertTriangle, 
  Train, 
  Droplets, 
  MapPin, 
  Construction,
  ShieldCheck,
  ShieldAlert,
  Activity,
  TreePine,
  Store,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { PropertySignalSummary } from "@shared/schema";

interface SignalResponse {
  hasDeepCoverage: boolean;
  signalsAvailable?: boolean;
  message?: string;
  signals?: PropertySignalSummary;
  property?: { id: string; bbl?: string; city?: string; state?: string };
}

interface NycDeepInsightsProps {
  propertyId: string;
  city: string;
  state: string;
}

function ScoreIndicator({ 
  score, 
  label, 
  colorClass,
  showTrend,
  trend
}: { 
  score: number | null | undefined; 
  label: string;
  colorClass?: string;
  showTrend?: boolean;
  trend?: "improving" | "stable" | "worsening";
}) {
  if (score === null || score === undefined) {
    return (
      <div className="text-center">
        <div className="text-2xl font-bold text-muted-foreground">--</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    );
  }
  
  const getColor = () => {
    if (colorClass) return colorClass;
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    if (score >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getTrendIcon = () => {
    if (!showTrend || !trend) return null;
    if (trend === "improving") return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    if (trend === "worsening") return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };
  
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <span className={`text-2xl font-bold ${getColor()}`}>{score}</span>
        {getTrendIcon()}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RiskBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    low: { variant: "secondary", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    minimal: { variant: "secondary", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    medium: { variant: "secondary", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
    moderate: { variant: "secondary", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
    high: { variant: "secondary", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
    severe: { variant: "destructive" },
    critical: { variant: "destructive" },
  };
  
  const config = variants[level.toLowerCase()] || { variant: "outline" as const };
  
  return (
    <Badge variant={config.variant} className={config.className}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </Badge>
  );
}

function DataSourceBadge({ type }: { type: "building" | "area" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-xs gap-1">
          <Info className="h-3 w-3" />
          {type === "building" ? "Building-linked" : "Area (0.25mi)"}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {type === "building" 
          ? "This data is directly linked to this building via BBL (tax lot ID)."
          : "This data is aggregated from a 0.25 mile radius around the property."}
      </TooltipContent>
    </Tooltip>
  );
}

function ConfidenceBadge({ 
  confidence, 
  completeness 
}: { 
  confidence: string | null | undefined;
  completeness: number | null | undefined;
}) {
  if (!confidence) return null;
  
  const variants: Record<string, { className: string; label: string }> = {
    high: { 
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
      label: "High Confidence"
    },
    medium: { 
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      label: "Medium Confidence"
    },
    low: { 
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      label: "Low Confidence"
    },
  };
  
  const config = variants[confidence.toLowerCase()] || variants.medium;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className={`text-xs ${config.className}`}>
          {config.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-1">Data Quality: {completeness || 0}% complete</p>
        <p className="text-xs">
          {confidence === "high" 
            ? "All major data sources available including BBL-linked building records."
            : confidence === "medium"
            ? "Most data sources available. Some building-specific data may be limited."
            : "Limited data available. Results should be verified independently."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function WhyThisScore({ 
  title, 
  bullets,
  isOpen,
  onToggle
}: { 
  title: string;
  bullets: string[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (bullets.length === 0) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          data-testid={`button-why-${title.toLowerCase().replace(/\s/g, '-')}`}
        >
          <span>Why this score?</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="text-xs text-muted-foreground space-y-1 mt-2 pl-4">
          {bullets.map((bullet, i) => (
            <li key={i} className="list-disc list-outside">{bullet}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function getTransitScoreExplanation(signals: PropertySignalSummary): string[] {
  const bullets: string[] = [];
  
  if (signals.nearestSubwayMeters && signals.nearestSubwayStation) {
    const miles = (signals.nearestSubwayMeters / 1609).toFixed(2);
    const walkMin = Math.round(signals.nearestSubwayMeters / 80);
    bullets.push(`${miles} mi (${walkMin} min walk) to ${signals.nearestSubwayStation} station`);
  }
  
  if (signals.nearestSubwayLines && signals.nearestSubwayLines.length > 0) {
    bullets.push(`Access to ${signals.nearestSubwayLines.length} subway line${signals.nearestSubwayLines.length > 1 ? 's' : ''}: ${signals.nearestSubwayLines.join(', ')}`);
  }
  
  if (signals.transitScore !== null && signals.transitScore !== undefined) {
    if (signals.transitScore >= 90) {
      bullets.push("Excellent transit access (top 10% for NYC)");
    } else if (signals.transitScore >= 70) {
      bullets.push("Good transit access (above average for NYC)");
    } else if (signals.transitScore >= 50) {
      bullets.push("Moderate transit access");
    } else {
      bullets.push("Limited transit options in immediate area");
    }
  }
  
  if (signals.hasAccessibleTransit) {
    bullets.push("Nearest station is wheelchair accessible");
  }
  
  return bullets;
}

function getBuildingHealthExplanation(signals: PropertySignalSummary): string[] {
  const bullets: string[] = [];
  
  // HPD Violations
  if (signals.openHpdViolations && signals.openHpdViolations > 0) {
    let violationText = `${signals.openHpdViolations} open HPD violation${signals.openHpdViolations > 1 ? 's' : ''}`;
    if (signals.hazardousViolations && signals.hazardousViolations > 0) {
      violationText += ` (${signals.hazardousViolations} Class C/hazardous)`;
    }
    bullets.push(violationText);
  } else {
    bullets.push("No open HPD violations");
  }
  
  // DOB Complaints
  if (signals.dobComplaints12m && signals.dobComplaints12m > 0) {
    bullets.push(`${signals.dobComplaints12m} DOB complaint${signals.dobComplaints12m > 1 ? 's' : ''} in last 12 months`);
  }
  
  // 311 Complaints
  if (signals.complaints311_12m && signals.complaints311_12m > 0) {
    let text = `${signals.complaints311_12m} 311 complaint${signals.complaints311_12m > 1 ? 's' : ''} in last 12 months`;
    if (signals.noiseComplaints12m && signals.noiseComplaints12m > 0) {
      text += ` (${signals.noiseComplaints12m} noise-related)`;
    }
    bullets.push(text);
  }
  
  // Score interpretation
  if (signals.buildingHealthScore !== null && signals.buildingHealthScore !== undefined) {
    if (signals.buildingHealthScore >= 90) {
      bullets.push("Excellent building condition with minimal issues");
    } else if (signals.buildingHealthScore >= 70) {
      bullets.push("Good condition with some minor issues to monitor");
    } else if (signals.buildingHealthScore >= 50) {
      bullets.push("Moderate concerns - recommend inspection before purchase");
    } else {
      bullets.push("Significant issues flagged - thorough due diligence recommended");
    }
  }
  
  return bullets;
}

function getFloodRiskExplanation(signals: PropertySignalSummary): string[] {
  const bullets: string[] = [];
  
  if (signals.floodZone) {
    const zoneDescriptions: Record<string, string> = {
      "X": "Zone X: Minimal flood risk (0.2% annual chance or less)",
      "X-SHADED": "Zone X-SHADED: Moderate risk (0.2% to 1% annual chance)",
      "AE": "Zone AE: High risk (1% annual chance floodplain)",
      "VE": "Zone VE: Severe risk (coastal flood zone with wave action)",
      "AO": "Zone AO: High risk (shallow flooding 1-3 ft)",
      "A": "Zone A: High risk (no base flood elevations determined)"
    };
    
    bullets.push(zoneDescriptions[signals.floodZone] || `FEMA Zone ${signals.floodZone}`);
  }
  
  if (signals.isFloodHighRisk) {
    bullets.push("Flood insurance required if mortgaged");
    bullets.push("May affect resale value and insurance costs");
  } else if (signals.isFloodModerateRisk) {
    bullets.push("Flood insurance recommended but not required");
    bullets.push("Consider future climate projections");
  } else {
    bullets.push("Flood insurance optional but available");
    bullets.push("Low historical flood risk");
  }
  
  return bullets;
}

function getConstructionExplanation(signals: PropertySignalSummary): string[] {
  const bullets: string[] = [];
  
  if (signals.permitCount12m && signals.permitCount12m > 0) {
    bullets.push(`${signals.permitCount12m} permit${signals.permitCount12m > 1 ? 's' : ''} filed in last 12 months`);
  } else {
    bullets.push("No new permits in last 12 months");
  }
  
  if (signals.activePermits && signals.activePermits > 0) {
    bullets.push(`${signals.activePermits} active permit${signals.activePermits > 1 ? 's' : ''} (work in progress)`);
  }
  
  if (signals.majorAlteration) {
    bullets.push("Major alteration (ALT1/ALT2) indicates significant renovation");
  }
  
  if (signals.newConstruction) {
    bullets.push("New building construction project");
  }
  
  if (signals.estimatedPermitValue && signals.estimatedPermitValue > 0) {
    const formattedValue = signals.estimatedPermitValue >= 1000000 
      ? `$${(signals.estimatedPermitValue / 1000000).toFixed(1)}M`
      : `$${(signals.estimatedPermitValue / 1000).toFixed(0)}K`;
    bullets.push(`Estimated work value: ${formattedValue}`);
  }
  
  if (!signals.permitCount24m || signals.permitCount24m === 0) {
    bullets.push("No major work in 24 months - stable building");
  }
  
  return bullets;
}

export function NycDeepInsights({ propertyId, city, state }: NycDeepInsightsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const nycBoroughs = ["Manhattan", "Brooklyn", "Bronx", "Queens", "Staten Island"];
  const isNYC = state === "NY" && nycBoroughs.includes(city);

  const { data, isLoading, error } = useQuery<SignalResponse>({
    queryKey: ["/api/properties", propertyId, "signals"],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/signals`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch signals");
      return res.json();
    },
    enabled: isNYC,
  });

  if (!isNYC) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">NYC Deep Coverage</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Alternative data signals (permits, violations, transit, flood risk) are currently 
            available for NYC properties only. We're expanding coverage to more areas soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Unable to Load Signals</h3>
          <p className="text-sm text-muted-foreground">
            We couldn't load the alternative data signals for this property.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data.signalsAvailable || !data.signals) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="mx-auto mb-4 h-12 w-12 text-primary" />
          <div className="mb-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">NYC Deep Coverage</Badge>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Data Processing</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {data.message || "Alternative data signals are being processed for this property. Check back soon for building permits, violations, transit scores, and flood risk data."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const signals = data.signals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            NYC Deep Coverage
          </Badge>
          <ConfidenceBadge 
            confidence={signals.signalConfidence} 
            completeness={signals.dataCompleteness} 
          />
          <span className="text-sm text-muted-foreground">
            Alternative data signals from NYC Open Data
          </span>
        </div>
        <div className="flex gap-2">
          <DataSourceBadge type="building" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <ScoreIndicator 
              score={signals.buildingHealthScore} 
              label="Building Health" 
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ScoreIndicator 
              score={signals.transitScore} 
              label="Transit Score" 
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ScoreIndicator 
              score={signals.amenityScore} 
              label="Amenity Score" 
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <RiskBadge level={signals.floodRiskLevel} />
            <div className="text-xs text-muted-foreground mt-2">Flood Risk</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Construction className="h-5 w-5 text-primary" />
                Construction Activity
              </CardTitle>
              <DataSourceBadge type="building" />
            </div>
            <CardDescription>Building permits and renovation activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold">{signals.permitCount12m || 0}</div>
                <div className="text-xs text-muted-foreground">Permits (12m)</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{signals.activePermits || 0}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {signals.estimatedPermitValue 
                    ? `$${(signals.estimatedPermitValue / 1000).toFixed(0)}K`
                    : "--"}
                </div>
                <div className="text-xs text-muted-foreground">Est. Value</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {signals.majorAlteration && (
                <Badge variant="outline" className="text-xs">Major Alteration</Badge>
              )}
              {signals.newConstruction && (
                <Badge variant="outline" className="text-xs">New Construction</Badge>
              )}
              {!signals.majorAlteration && !signals.newConstruction && signals.permitCount24m === 0 && (
                <span className="text-xs text-muted-foreground">No major work in 24 months</span>
              )}
            </div>
            <WhyThisScore 
              title="construction"
              bullets={getConstructionExplanation(signals)}
              isOpen={openSections["construction"] || false}
              onToggle={() => toggleSection("construction")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                {signals.healthRiskLevel === "low" || signals.healthRiskLevel === "minimal" ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-orange-600" />
                )}
                Building Compliance
              </CardTitle>
              <DataSourceBadge type="building" />
            </div>
            <CardDescription>HPD & DOB violations and complaints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold ${(signals.openHpdViolations || 0) > 0 ? "text-orange-600" : ""}`}>
                    {signals.openHpdViolations || 0}
                  </span>
                  {signals.hazardousViolations && signals.hazardousViolations > 0 && (
                    <span className="text-xs text-red-600">({signals.hazardousViolations} haz.)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Open HPD Violations</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${(signals.openHpdComplaints || 0) > 0 ? "text-yellow-600" : ""}`}>
                  {signals.openHpdComplaints || 0}
                </div>
                <div className="text-xs text-muted-foreground">Open Complaints</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <div className="text-lg font-semibold">{signals.totalHpdViolations12m || 0}</div>
                <div className="text-xs text-muted-foreground">Violations (12m)</div>
              </div>
              <div>
                <div className="text-lg font-semibold">{signals.dobComplaints12m || 0}</div>
                <div className="text-xs text-muted-foreground">DOB Complaints (12m)</div>
              </div>
            </div>
            {signals.healthRiskLevel && (
              <div className="pt-2">
                <RiskBadge level={signals.healthRiskLevel} />
              </div>
            )}
            <WhyThisScore 
              title="health"
              bullets={getBuildingHealthExplanation(signals)}
              isOpen={openSections["health"] || false}
              onToggle={() => toggleSection("health")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Train className="h-5 w-5 text-primary" />
                Transit Accessibility
              </CardTitle>
              <DataSourceBadge type="area" />
            </div>
            <CardDescription>Subway access and accessibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signals.nearestSubwayStation ? (
              <>
                <div>
                  <div className="font-medium">{signals.nearestSubwayStation}</div>
                  <div className="text-sm text-muted-foreground">
                    {signals.nearestSubwayMeters 
                      ? `${(signals.nearestSubwayMeters / 1609).toFixed(2)} mi away (~${Math.round(signals.nearestSubwayMeters / 80)} min walk)`
                      : "Distance unknown"}
                  </div>
                </div>
                {signals.nearestSubwayLines && signals.nearestSubwayLines.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {signals.nearestSubwayLines.map((line) => (
                      <Badge key={line} variant="outline" className="text-xs font-mono">
                        {line}
                      </Badge>
                    ))}
                  </div>
                )}
                {signals.hasAccessibleTransit && (
                  <Badge variant="secondary" className="text-xs">
                    Wheelchair Accessible
                  </Badge>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Transit data not yet available for this property.
              </p>
            )}
            {signals.transitScore !== null && signals.transitScore !== undefined && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Transit Score</span>
                  <span className="font-medium">{signals.transitScore}/100</span>
                </div>
                <Progress value={signals.transitScore} className="h-2" />
              </div>
            )}
            <WhyThisScore 
              title="transit"
              bullets={getTransitScoreExplanation(signals)}
              isOpen={openSections["transit"] || false}
              onToggle={() => toggleSection("transit")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Droplets className="h-5 w-5 text-blue-500" />
                Flood Risk
              </CardTitle>
              <DataSourceBadge type="building" />
            </div>
            <CardDescription>FEMA flood zone classification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {signals.floodZone ? (
                <>
                  <div className="text-2xl font-bold font-mono">{signals.floodZone}</div>
                  <RiskBadge level={signals.floodRiskLevel} />
                </>
              ) : (
                <span className="text-muted-foreground">Zone data unavailable</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {signals.isFloodHighRisk && (
                <p className="text-orange-600 dark:text-orange-400">
                  This property is in a high-risk flood zone. Flood insurance may be required.
                </p>
              )}
              {signals.isFloodModerateRisk && (
                <p className="text-yellow-600 dark:text-yellow-400">
                  This property is in a moderate-risk flood zone. Consider flood insurance.
                </p>
              )}
              {!signals.isFloodHighRisk && !signals.isFloodModerateRisk && signals.floodZone && (
                <p className="text-emerald-600 dark:text-emerald-400">
                  This property has minimal flood risk based on FEMA mapping.
                </p>
              )}
            </div>
            <WhyThisScore 
              title="flood"
              bullets={getFloodRiskExplanation(signals)}
              isOpen={openSections["flood"] || false}
              onToggle={() => toggleSection("flood")}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-5 w-5 text-primary" />
                Neighborhood Amenities
              </CardTitle>
              <DataSourceBadge type="area" />
            </div>
            <CardDescription>Walkability and nearby services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{signals.amenities400m || 0}</div>
                <div className="text-xs text-muted-foreground">Within 5 min</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{signals.amenities800m || 0}</div>
                <div className="text-xs text-muted-foreground">Within 10 min</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <UtensilsCrossed className="h-4 w-4 mb-1 text-muted-foreground" />
                <div className="text-lg font-bold">{signals.restaurants400m || 0}</div>
                <div className="text-xs text-muted-foreground">Restaurants</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <TreePine className="h-4 w-4 mb-1 text-muted-foreground" />
                <div className="text-lg font-bold">{signals.parks400m || 0}</div>
                <div className="text-xs text-muted-foreground">Parks</div>
              </div>
              <div className="text-center flex flex-col items-center">
                <Store className="h-4 w-4 mb-1 text-muted-foreground" />
                <div className="text-lg font-bold">{signals.groceries800m || 0}</div>
                <div className="text-xs text-muted-foreground">Groceries</div>
              </div>
            </div>
            {signals.amenityScore !== null && signals.amenityScore !== undefined && (
              <div className="pt-4 mt-4 border-t">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Amenity Score</span>
                  <span className="font-medium">{signals.amenityScore}/100</span>
                </div>
                <Progress value={signals.amenityScore} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {signals.signalDataSources && signals.signalDataSources.length > 0 && (
        <div className="text-xs text-muted-foreground text-center pt-4">
          Data sources: {signals.signalDataSources.map(s => s.toUpperCase()).join(" + ")} | 
          Last updated: {signals.updatedAt ? new Date(signals.updatedAt).toLocaleDateString() : "Recently"}
        </div>
      )}
    </div>
  );
}
