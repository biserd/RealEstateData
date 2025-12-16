import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Home,
  MapPin,
  ArrowRight,
  Crown,
  Sparkles,
  Download,
  FileSpreadsheet,
  FileJson,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppLayout } from "@/components/layouts";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import type { Property, Watchlist } from "@shared/schema";

interface WatchlistWithProperties extends Watchlist {
  properties?: Property[];
}

interface PortfolioStats {
  totalProperties: number;
  totalEstimatedValue: number;
  averageOpportunityScore: number;
  highScoreCount: number;
  propertiesByState: Record<string, number>;
  propertiesByType: Record<string, number>;
  scoreDistribution: { low: number; medium: number; high: number };
}

function calculatePortfolioStats(watchlists: WatchlistWithProperties[]): PortfolioStats {
  const allProperties: Property[] = watchlists.flatMap(w => w.properties || []);
  const uniqueProperties = Array.from(
    new Map(allProperties.map(p => [p.id, p])).values()
  );

  const totalProperties = uniqueProperties.length;
  const totalEstimatedValue = uniqueProperties.reduce((sum, p) => {
    const price = p.estimatedValue || p.lastSalePrice || 0;
    return sum + Number(price);
  }, 0);

  const scoresWithValues = uniqueProperties.filter(p => p.opportunityScore !== null);
  const averageOpportunityScore = scoresWithValues.length > 0
    ? Math.round(scoresWithValues.reduce((sum, p) => sum + (p.opportunityScore || 0), 0) / scoresWithValues.length)
    : 0;

  const highScoreCount = uniqueProperties.filter(p => (p.opportunityScore || 0) >= 80).length;

  const propertiesByState: Record<string, number> = {};
  const propertiesByType: Record<string, number> = {};

  uniqueProperties.forEach(p => {
    const state = p.state || "Unknown";
    propertiesByState[state] = (propertiesByState[state] || 0) + 1;
    
    const type = p.propertyType || "Unknown";
    propertiesByType[type] = (propertiesByType[type] || 0) + 1;
  });

  const scoreDistribution = {
    low: uniqueProperties.filter(p => (p.opportunityScore || 0) < 40).length,
    medium: uniqueProperties.filter(p => (p.opportunityScore || 0) >= 40 && (p.opportunityScore || 0) < 80).length,
    high: uniqueProperties.filter(p => (p.opportunityScore || 0) >= 80).length,
  };

  return {
    totalProperties,
    totalEstimatedValue,
    averageOpportunityScore,
    highScoreCount,
    propertiesByState,
    propertiesByType,
    scoreDistribution,
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

function PremiumGate() {
  return (
    <AppLayout>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 rounded-full bg-primary/10 p-4">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Premium Feature</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          The Portfolio Dashboard provides aggregated insights across all your saved properties. 
          Upgrade to Premium to unlock this powerful multi-property analysis tool.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/pricing">
            <Button data-testid="button-portfolio-upgrade">
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Premium
            </Button>
          </Link>
          <Link href="/watchlists">
            <Button variant="outline" data-testid="button-portfolio-watchlists">
              View Watchlists
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

export default function Portfolio() {
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const { data: watchlists, isLoading } = useQuery<WatchlistWithProperties[]>({
    queryKey: ["/api/watchlists"],
    enabled: isPremium,
  });

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      const response = await fetch(`/api/export/bulk/portfolio?format=${format}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Portfolio exported successfully" });
    } catch (error) {
      toast({ title: "Failed to export portfolio", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (subscriptionLoading) {
    return (
      <AppLayout>
        <LoadingState type="spinner" />
      </AppLayout>
    );
  }

  if (!isPremium) {
    return <PremiumGate />;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <LoadingState type="skeleton-cards" count={4} />
        </div>
      </AppLayout>
    );
  }

  const stats = watchlists ? calculatePortfolioStats(watchlists) : null;

  if (!stats || stats.totalProperties === 0) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="mb-8">
            <Badge variant="default" className="mb-2">
              <Sparkles className="mr-1 h-3 w-3" />
              Premium
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Portfolio Dashboard</h1>
            <p className="text-muted-foreground">
              Analyze and track your saved properties in one place
            </p>
          </div>
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No properties in portfolio"
            description="Save properties to your watchlists to see aggregate statistics and insights."
            action={{
              label: "Browse Properties",
              onClick: () => window.location.href = "/investment-opportunities",
            }}
          />
        </div>
      </AppLayout>
    );
  }

  const maxStateCount = Math.max(...Object.values(stats.propertiesByState));

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="default" className="mb-2">
              <Sparkles className="mr-1 h-3 w-3" />
              Premium
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl" data-testid="text-portfolio-title">
              Portfolio Dashboard
            </h1>
            <p className="text-muted-foreground">
              Aggregate insights across {stats.totalProperties} saved properties
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting} data-testid="button-export-portfolio">
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? "Exporting..." : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")} data-testid="menu-export-csv">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")} data-testid="menu-export-json">
                  <FileJson className="mr-2 h-4 w-4" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/watchlists">
              <Button variant="outline" data-testid="button-manage-watchlists">
                Manage Watchlists
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-properties">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-properties">
                {stats.totalProperties}
              </div>
              <p className="text-xs text-muted-foreground">
                Across {watchlists?.length || 0} watchlists
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-value">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-value">
                {formatCurrency(stats.totalEstimatedValue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Combined estimated value
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-score">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Opportunity Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-score">
                {stats.averageOpportunityScore}/100
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.highScoreCount} high-opportunity properties
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-high-score">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Score (80+)</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-high-score-count">
                {stats.highScoreCount}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.totalProperties > 0 ? Math.round((stats.highScoreCount / stats.totalProperties) * 100) : 0}% of portfolio
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-score-distribution">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Score Distribution
              </CardTitle>
              <CardDescription>
                Breakdown of opportunity scores across your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    High (80+)
                  </span>
                  <span className="font-medium">{stats.scoreDistribution.high}</span>
                </div>
                <Progress 
                  value={stats.totalProperties > 0 ? (stats.scoreDistribution.high / stats.totalProperties) * 100 : 0} 
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-500" />
                    Medium (40-79)
                  </span>
                  <span className="font-medium">{stats.scoreDistribution.medium}</span>
                </div>
                <Progress 
                  value={stats.totalProperties > 0 ? (stats.scoreDistribution.medium / stats.totalProperties) * 100 : 0} 
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500" />
                    Low (&lt;40)
                  </span>
                  <span className="font-medium">{stats.scoreDistribution.low}</span>
                </div>
                <Progress 
                  value={stats.totalProperties > 0 ? (stats.scoreDistribution.low / stats.totalProperties) * 100 : 0} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-geographic-distribution">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Geographic Distribution
              </CardTitle>
              <CardDescription>
                Properties by state
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(stats.propertiesByState)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([state, count]) => (
                  <div key={state} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{state}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <Progress 
                      value={(count / maxStateCount) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              {Object.keys(stats.propertiesByState).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No location data available
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2" data-testid="card-property-types">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Property Types
              </CardTitle>
              <CardDescription>
                Distribution of property types in your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.propertiesByType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="px-3 py-1">
                      {type}: {count}
                    </Badge>
                  ))}
                {Object.keys(stats.propertiesByType).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No property type data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
