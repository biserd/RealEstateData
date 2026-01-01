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
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

interface WhatNowAction {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  type: "action" | "research" | "contact";
  link?: string;
}

interface PropertyInsights {
  investmentSummary: string;
  riskAssessment: {
    level: "Low" | "Medium" | "High";
    factors: string[];
  };
  valueDrivers: string[];
  concerns: string[];
  neighborhoodTrends: string;
  buyerProfile: string;
  whatNow: WhatNowAction[];
  generatedAt: string;
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
        if (res.status === 401 || res.status === 403) {
          throw new Error("Pro subscription required");
        }
        throw new Error("Failed to fetch insights");
      }
      return res.json();
    },
    enabled: isPro,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!isPro) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-8 text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-primary" />
          <h3 className="mb-2 text-lg font-semibold">AI Property Insights</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Get personalized investment analysis, risk assessment, and actionable next steps powered by AI.
          </p>
          <Button onClick={onUpgrade} data-testid="button-upgrade-insights">
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">AI Property Insights</CardTitle>
          </div>
          <CardDescription>
            Generated {new Date(insights.generatedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm leading-relaxed">{insights.investmentSummary}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                Risk Assessment
              </div>
              <RiskLevelIndicator level={insights.riskAssessment.level} />
              {insights.riskAssessment.factors.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  {insights.riskAssessment.factors.map((factor, i) => (
                    <li key={i} className="list-disc list-outside">{factor}</li>
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
                <ul className="text-sm space-y-1">
                  {insights.valueDrivers.map((driver, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500">+</span>
                      <span>{driver}</span>
                    </li>
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
                <ul className="text-sm space-y-1">
                  {insights.concerns.map((concern, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-500">-</span>
                      <span>{concern}</span>
                    </li>
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
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
