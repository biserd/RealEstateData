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
  UtensilsCrossed
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  colorClass 
}: { 
  score: number | null | undefined; 
  label: string;
  colorClass?: string;
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
  
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${getColor()}`}>{score}</div>
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

export function NycDeepInsights({ propertyId, city, state }: NycDeepInsightsProps) {
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
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          NYC Deep Coverage
        </Badge>
        <span className="text-sm text-muted-foreground">
          Alternative data signals from NYC Open Data
        </span>
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Construction className="h-5 w-5 text-primary" />
              Construction Activity
            </CardTitle>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {signals.healthRiskLevel === "low" || signals.healthRiskLevel === "minimal" ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-orange-600" />
              )}
              Building Compliance
            </CardTitle>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Train className="h-5 w-5 text-primary" />
              Transit Accessibility
            </CardTitle>
            <CardDescription>Subway access and accessibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signals.nearestSubwayStation ? (
              <>
                <div>
                  <div className="font-medium">{signals.nearestSubwayStation}</div>
                  <div className="text-sm text-muted-foreground">
                    {signals.nearestSubwayMeters 
                      ? `${signals.nearestSubwayMeters}m away (~${Math.round(signals.nearestSubwayMeters / 80)} min walk)`
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="h-5 w-5 text-blue-500" />
              Flood Risk
            </CardTitle>
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
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-5 w-5 text-primary" />
              Neighborhood Amenities
            </CardTitle>
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
          Data sources: {signals.signalDataSources.join(", ")}
        </div>
      )}
    </div>
  );
}
