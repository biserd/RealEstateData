import { useQuery } from "@tanstack/react-query";
import { 
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  User,
  ArrowRight,
  Loader2,
  Lock,
  Search,
  Phone,
  Bookmark,
  FileText,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

interface CitedClaim {
  claim: string;
  evidence: string[];
}

interface WhatNowAction {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  type: "action" | "research" | "contact";
  link?: string;
}

interface PropertyInsights {
  investmentSummary: string;
  headlineInsights: string[];
  riskAssessment: {
    level: "Low" | "Medium" | "High";
    factors: CitedClaim[];
  };
  valueDrivers: CitedClaim[];
  concerns: CitedClaim[];
  neighborhoodTrends: string;
  neighborhoodEvidence: string[];
  buyerProfile: string;
  whatNow: WhatNowAction[];
  generatedAt: string;
  isPreview?: boolean;
}

interface PropertyAIInsightsProps {
  propertyId: string;
  onUpgrade?: () => void;
}

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case "research":
      return <Search className="h-4 w-4" />;
    case "contact":
      return <Phone className="h-4 w-4" />;
    default:
      return <ArrowRight className="h-4 w-4" />;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    high: { 
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      label: "High Priority"
    },
    medium: { 
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      label: "Medium"
    },
    low: { 
      className: "bg-muted text-muted-foreground",
      label: "Low"
    },
  };
  
  const config = variants[priority] || variants.medium;
  
  return (
    <Badge variant="secondary" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function RiskLevelIndicator({ level }: { level: string }) {
  const configs: Record<string, { className: string; icon: typeof CheckCircle2 }> = {
    Low: { className: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
    Medium: { className: "text-yellow-600 dark:text-yellow-400", icon: AlertTriangle },
    High: { className: "text-red-600 dark:text-red-400", icon: XCircle },
  };
  
  const config = configs[level] || configs.Medium;
  const Icon = config.icon;
  
  return (
    <div className={`flex items-center gap-2 ${config.className}`}>
      <Icon className="h-5 w-5" />
      <span className="font-semibold">{level} Risk</span>
    </div>
  );
}

function EvidenceBadges({ evidence }: { evidence: string[] }) {
  if (!evidence || evidence.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {evidence.map((item, i) => (
        <Badge 
          key={i} 
          variant="outline" 
          className="text-xs font-normal bg-muted/30 border-muted-foreground/20"
        >
          <Info className="h-3 w-3 mr-1 opacity-50" />
          {item}
        </Badge>
      ))}
    </div>
  );
}

function CitedClaimItem({ 
  claim, 
  icon, 
  iconColor 
}: { 
  claim: CitedClaim; 
  icon: string;
  iconColor: string;
}) {
  return (
    <li className="space-y-1">
      <div className="flex items-start gap-2">
        <span className={iconColor}>{icon}</span>
        <span>{claim.claim}</span>
      </div>
      <EvidenceBadges evidence={claim.evidence} />
    </li>
  );
}

function BlurredSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

export function PropertyAIInsights({ propertyId, onUpgrade }: PropertyAIInsightsProps) {
  const { user } = useAuth();
  const isPro = user?.subscriptionTier === "pro" || user?.subscriptionTier === "premium";

  const { data: insights, isLoading, error } = useQuery<PropertyInsights>({
    queryKey: ["/api/ai/insights", propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/insights/${propertyId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch insights");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <CardTitle className="text-lg">Generating AI Insights...</CardTitle>
          </div>
          <CardDescription>Analyzing property data and market signals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Unable to Generate Insights</h3>
          <p className="text-sm text-muted-foreground">
            We couldn't generate AI insights for this property. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPreview = insights.isPreview;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Property Insights</CardTitle>
            {isPreview && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Preview
              </Badge>
            )}
          </div>
          <CardDescription>
            Generated {new Date(insights.generatedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm leading-relaxed">{insights.investmentSummary}</p>
          </div>

          {insights.headlineInsights && insights.headlineInsights.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                Key Takeaways
              </div>
              <ul className="space-y-2">
                {insights.headlineInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : isPreview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                Quick Analysis
              </div>
              <p className="text-sm text-muted-foreground">
                Risk Level: <span className="font-medium">{insights.riskAssessment.level}</span>
              </p>
            </div>
          )}

          {isPreview ? (
            <>
              <BlurredSection label="Upgrade to Pro to see full risk analysis">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Target className="h-4 w-4 text-primary" />
                      Risk Assessment
                    </div>
                    <RiskLevelIndicator level={insights.riskAssessment.level} />
                    <ul className="text-sm space-y-2 pl-4">
                      <li className="list-disc">Sample risk factor 1</li>
                      <li className="list-disc">Sample risk factor 2</li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-4 w-4 text-primary" />
                      Best Suited For
                    </div>
                    <p className="text-sm text-muted-foreground">First-time investor profile...</p>
                  </div>
                </div>
              </BlurredSection>

              <BlurredSection label="Upgrade to Pro to see value drivers & concerns">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Value Drivers
                    </div>
                    <ul className="text-sm space-y-2">
                      <li>+ Good transit access</li>
                      <li>+ Market appreciation</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
                      <AlertTriangle className="h-4 w-4" />
                      Concerns
                    </div>
                    <ul className="text-sm space-y-2">
                      <li>- Building issues</li>
                      <li>- Flood risk</li>
                    </ul>
                  </div>
                </div>
              </BlurredSection>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
                <h4 className="font-medium mb-2">Unlock Full AI Analysis</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Get detailed risk factors, value drivers, neighborhood trends, and personalized action plan.
                </p>
                <Button onClick={onUpgrade} data-testid="button-upgrade-insights">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4 text-primary" />
                    Risk Assessment
                  </div>
                  <RiskLevelIndicator level={insights.riskAssessment.level} />
                  {insights.riskAssessment.factors.length > 0 && (
                    <ul className="text-sm text-muted-foreground space-y-2 pl-4">
                      {insights.riskAssessment.factors.map((factor, i) => (
                        <li key={i} className="space-y-1">
                          <span className="list-disc list-outside">{factor.claim}</span>
                          <EvidenceBadges evidence={factor.evidence} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-primary" />
                    Best Suited For
                  </div>
                  <p className="text-sm text-muted-foreground">{insights.buyerProfile}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {insights.valueDrivers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Value Drivers
                    </div>
                    <ul className="text-sm space-y-2">
                      {insights.valueDrivers.map((driver, i) => (
                        <CitedClaimItem 
                          key={i} 
                          claim={driver} 
                          icon="+" 
                          iconColor="text-emerald-500" 
                        />
                      ))}
                    </ul>
                  </div>
                )}

                {insights.concerns.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="h-4 w-4" />
                      Concerns
                    </div>
                    <ul className="text-sm space-y-2">
                      {insights.concerns.map((concern, i) => (
                        <CitedClaimItem 
                          key={i} 
                          claim={concern} 
                          icon="-" 
                          iconColor="text-orange-500" 
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Neighborhood Trends
                </div>
                <p className="text-sm text-muted-foreground">{insights.neighborhoodTrends}</p>
                {insights.neighborhoodEvidence && insights.neighborhoodEvidence.length > 0 && (
                  <div className="mt-2">
                    <EvidenceBadges evidence={insights.neighborhoodEvidence} />
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isPreview && insights.whatNow && insights.whatNow.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              What Now?
            </CardTitle>
            <CardDescription>Recommended next steps for this property</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.whatNow.map((action, i) => (
                <div 
                  key={i} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`action-item-${i}`}
                >
                  <div className="mt-0.5 p-2 rounded-md bg-primary/10 text-primary">
                    <ActionIcon type={action.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm">{action.title}</span>
                      <PriorityBadge priority={action.priority} />
                    </div>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  {action.type === "action" && (
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
              <Button variant="outline" size="sm" data-testid="button-add-watchlist">
                <Bookmark className="mr-2 h-4 w-4" />
                Add to Watchlist
              </Button>
              <Button variant="outline" size="sm" data-testid="button-get-comps">
                <Search className="mr-2 h-4 w-4" />
                View Comps
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPreview && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="py-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">Action Plan</span>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Pro subscribers get a personalized action plan with prioritized next steps.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
