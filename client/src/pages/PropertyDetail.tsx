import { useState, useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { extractPropertyIdFromSlug, formatPropertyAddress, formatFullAddress } from "@/lib/propertySlug";
import { SEO } from "@/components/SEO";
import { PropertyJsonLd } from "@/components/PropertyJsonLd";
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Download, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Calendar, 
  DollarSign,
  Home,
  TrendingUp,
  AlertCircle,
  FileText,
  Bot,
  Calculator,
  LogIn,
  Crown,
  Lock,
  Eye,
  History
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppLayout } from "@/components/layouts";
import { OpportunityScore } from "@/components/OpportunityScore";
import { PriceDistribution } from "@/components/PriceDistribution";
import { CompsTable } from "@/components/CompsTable";
import { AIChat } from "@/components/AIChat";
import { CoverageBadge } from "@/components/CoverageBadge";
import { PropertyMap } from "@/components/PropertyMap";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { DealMemo } from "@/components/DealMemo";
import { ScenarioSimulator } from "@/components/ScenarioSimulator";
import { UpgradeModal, BlurredContent, ProBadge } from "@/components/UpgradePrompt";
import { PropertyStickyCTA } from "@/components/PropertyStickyCTA";
import { NycDeepInsights } from "@/components/NycDeepInsights";
import { PropertyAIInsights } from "@/components/PropertyAIInsights";
import { BuildingSalesHistory } from "@/components/BuildingSalesHistory";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import type { Property, OpportunityScoreBreakdown, Comp, MarketAggregate, AIResponse } from "@shared/schema";

interface PropertyWithDetails extends Property {
  scoreBreakdown?: OpportunityScoreBreakdown;
  marketStats?: MarketAggregate;
}

interface CompWithProperty extends Comp {
  property: Property;
}

export default function PropertyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isPro, isFree, isLoading: subLoading } = useSubscription();
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");
  
  const id = useMemo(() => {
    if (!slug) return undefined;
    return extractPropertyIdFromSlug(slug);
  }, [slug]);

  const { data: property, isLoading } = useQuery<PropertyWithDetails>({
    queryKey: ["/api/properties", id],
    enabled: !!id,
  });

  const [compsLimitReached, setCompsLimitReached] = useState(false);
  
  interface ViewStatus {
    unlocked: boolean;
    remaining: number;
    limit: number;
    canUnlock?: boolean;
  }
  
  const { data: viewStatus, isLoading: viewStatusLoading, refetch: refetchViewStatus } = useQuery<ViewStatus>({
    queryKey: ["/api/properties", id, "view-status"],
    enabled: !!id,
    queryFn: async () => {
      const res = await fetch(`/api/properties/${id}/view-status`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to check view status");
      return res.json();
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/properties/${id}/unlock`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 429) {
        const data = await res.json();
        throw new Error(data.message || "Daily limit reached");
      }
      if (!res.ok) throw new Error("Failed to unlock property");
      return res.json();
    },
    onSuccess: () => {
      refetchViewStatus();
      queryClient.invalidateQueries({ queryKey: ["/api/properties", id, "comps"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to unlock",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isPropertyUnlocked = isPro || viewStatus?.unlocked || false;
  const canUnlockProperty = viewStatus?.canUnlock || false;
  const remainingUnlocks = viewStatus?.remaining ?? 3;
  
  const { data: comps } = useQuery<CompWithProperty[]>({
    queryKey: ["/api/properties", id, "comps"],
    enabled: !!id && isPropertyUnlocked,
    queryFn: async () => {
      const res = await fetch(`/api/properties/${id}/comps`, {
        credentials: "include",
      });
      if (res.status === 429) {
        setCompsLimitReached(true);
        return [];
      }
      if (!res.ok) throw new Error("Failed to fetch comps");
      return res.json();
    },
  });

  const handleExportReport = async () => {
    if (!id) return;
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    if (isFree && !subLoading) {
      setUpgradeFeature("PDF Reports");
      setShowUpgradeModal(true);
      return;
    }
    setIsExportingReport(true);
    try {
      const response = await fetch(`/api/export/property-dossier/${id}?format=json`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `property-dossier-${id}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Report downloaded",
        description: "Property dossier has been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export property report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingReport(false);
    }
  };

  const handleExportCsv = async () => {
    if (!id) return;
    if (!isAuthenticated) {
      setShowLoginDialog(true);
      return;
    }
    if (isFree && !subLoading) {
      setUpgradeFeature("CSV Exports");
      setShowUpgradeModal(true);
      return;
    }
    setIsExportingCsv(true);
    try {
      const response = await fetch(`/api/export/property-dossier/${id}?format=csv`, {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `property-dossier-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "CSV exported",
        description: "Property data and comps exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export CSV. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/watchlists/properties`, { propertyId: id });
    },
    onSuccess: () => {
      toast({ title: "Property saved to watchlist" });
      queryClient.invalidateQueries({ queryKey: ["/api/watchlists"] });
    },
    onError: () => {
      toast({ title: "Failed to save property", variant: "destructive" });
    },
  });

  const handleSendAIMessage = async (message: string): Promise<AIResponse> => {
    const response = await apiRequest("POST", `/api/ai/chat`, {
      propertyId: id,
      question: message,
    });
    return await response.json() as AIResponse;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <LoadingState type="skeleton-details" />
        </div>
      </AppLayout>
    );
  }

  if (!property) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <EmptyState
            icon={<Home className="h-8 w-8" />}
            title="Property not found"
            description="The property you're looking for doesn't exist or has been removed."
            action={{
              label: "Back to Screener",
              onClick: () => window.history.back(),
            }}
          />
        </div>
      </AppLayout>
    );
  }

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const getConfidenceBadgeVariant = (level: string | null) => {
    switch (level) {
      case "High":
        return "default";
      case "Medium":
        return "secondary";
      case "Low":
        return "outline";
      default:
        return "outline";
    }
  };

  const mockScoreBreakdown: OpportunityScoreBreakdown = property.scoreBreakdown || {
    overall: property.opportunityScore || 0,
    mispricing: 78,
    confidence: 85,
    liquidity: 72,
    risk: 68,
    valueAdd: 65,
    explanations: [
      "Priced 12% below segment median for 3BR SFH in this ZIP",
      "Strong comp coverage with 8 recent sales within 0.5 miles",
      "Recent permit activity suggests value-add potential",
    ],
    evidence: [
      { type: "comp", id: "c1", description: "123 Main St sold for $485K (similar sqft)" },
      { type: "comp", id: "c2", description: "456 Oak Ave sold for $510K (similar age)" },
      { type: "market", id: "m1", description: "ZIP 11201 median: $525K" },
    ],
  };

  const fullAddress = formatFullAddress(property);
  const seoTitle = property.address 
    ? `${fullAddress} - Property Details`
    : "Property Details";
  const seoDescription = property.address
    ? `View details for ${fullAddress}. ${property.beds || 0} beds, ${property.baths || 0} baths, ${property.sqft?.toLocaleString() || 'N/A'} sqft. ${property.lastSalePrice ? `Last sold for ${formatPrice(property.lastSalePrice)}.` : ''} Opportunity score: ${property.opportunityScore || 'N/A'}/100.`
    : "View detailed property information including pricing, comparable sales, market analysis, and opportunity scoring.";

  return (
    <>
      <SEO 
        title={seoTitle}
        description={seoDescription}
      />
      <PropertyJsonLd property={property} compsCount={comps?.length} />
      <AppLayout showSearch={false}>
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="mb-6">
            <Link href="/investment-opportunities">
              <Button variant="ghost" className="gap-2" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
                Back to Screener
              </Button>
            </Link>
          </div>

        <div className="mb-8 grid gap-8 lg:grid-cols-2">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
            {property.imageUrl ? (
              <img
                src={property.imageUrl}
                alt={formatPropertyAddress(property)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Home className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute left-4 top-4 flex gap-2">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur">
                {property.propertyType}
              </Badge>
              <CoverageBadge level="Comps" />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h1 className="text-xl font-bold md:text-2xl lg:text-3xl break-words min-w-0" data-testid="text-property-address">
                  {formatPropertyAddress(property)}
                </h1>
                <div className="flex gap-2 flex-shrink-0">
                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      data-testid="button-save-property"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          data-testid="button-save-property"
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Heart className="h-5 w-5" />
                            Save to Watchlist
                          </DialogTitle>
                          <DialogDescription>
                            Sign in to save properties to your watchlist
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <LogIn className="h-8 w-8 text-primary" />
                          </div>
                          <h3 className="mb-2 text-lg font-semibold">Sign In Required</h3>
                          <p className="mb-6 text-sm text-muted-foreground max-w-xs">
                            Create a free account to save properties, set up alerts, and track your favorite opportunities.
                          </p>
                          <a href="/api/login" className="w-full">
                            <Button className="w-full" data-testid="button-login-save">
                              <LogIn className="mr-2 h-4 w-4" />
                              Sign In to Continue
                            </Button>
                          </a>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="outline" size="icon" data-testid="button-share">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {property.city}, {property.state} {property.zipCode}
              </p>
            </div>

            <div className="flex flex-wrap items-baseline gap-4">
              <div>
                <p className="text-4xl font-bold" data-testid="text-property-price">
                  {formatPrice(property.estimatedValue || property.lastSalePrice)}
                </p>
                {property.pricePerSqft && (
                  <p className="text-muted-foreground">
                    ${property.pricePerSqft.toFixed(0)}/sqft
                  </p>
                )}
              </div>
              {property.confidenceLevel && (
                <Badge variant={getConfidenceBadgeVariant(property.confidenceLevel)}>
                  {property.confidenceLevel} Confidence
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              {property.beds !== null && (
                <div className="flex items-center gap-2">
                  <Bed className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{property.beds}</span> beds
                </div>
              )}
              {property.baths !== null && (
                <div className="flex items-center gap-2">
                  <Bath className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{property.baths}</span> baths
                </div>
              )}
              {property.sqft && (
                <div className="flex items-center gap-2">
                  <Square className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{property.sqft.toLocaleString()}</span> sqft
                </div>
              )}
              {property.yearBuilt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  Built <span className="font-medium">{property.yearBuilt}</span>
                </div>
              )}
            </div>

            {property.lastSaleDate && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">Last Sale</p>
                <p className="font-medium">
                  {formatPrice(property.lastSalePrice)} on {formatDate(property.lastSaleDate)}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button className="flex-1 min-w-[140px]" data-testid="button-contact-agent">
                Contact Agent
              </Button>
              <DealMemo propertyId={id!} />
              <Button 
                variant="outline" 
                onClick={handleExportReport}
                disabled={isExportingReport}
                data-testid="button-download-report"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{isExportingReport ? "Exporting..." : "Report"}</span>
                <span className="sm:hidden">{isExportingReport ? "..." : "PDF"}</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opportunity Score</p>
                <p className="text-2xl font-bold">{property.opportunityScore || "N/A"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">vs Median</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">-12%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comps Found</p>
                <p className="text-2xl font-bold">{comps?.length || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Level</p>
                <p className="text-2xl font-bold">Low</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pricing" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-auto min-w-full whitespace-nowrap md:min-w-0">
              <TabsTrigger value="pricing" className="flex-shrink-0" data-testid="tab-pricing">Pricing</TabsTrigger>
              <TabsTrigger value="comps" className="flex-shrink-0" data-testid="tab-comps">Comps</TabsTrigger>
              <TabsTrigger value="investment" className="flex-shrink-0" data-testid="tab-investment">
                <Calculator className="h-4 w-4 mr-1 hidden sm:inline" />
                Investment
              </TabsTrigger>
              <TabsTrigger value="signals" className="flex-shrink-0" data-testid="tab-signals">Signals</TabsTrigger>
              <TabsTrigger value="sales" className="flex-shrink-0" data-testid="tab-sales">
                <History className="h-4 w-4 mr-1 hidden sm:inline" />
                Sales
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-shrink-0" data-testid="tab-ai">AI</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pricing" className="space-y-6">
            {isPropertyUnlocked ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Opportunity Score Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <OpportunityScore
                        score={property.opportunityScore || 0}
                        breakdown={mockScoreBreakdown}
                        size="lg"
                        showBreakdown
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Market Position</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <PriceDistribution
                        p25={480000}
                        p50={550000}
                        p75={650000}
                        currentValue={property.estimatedValue || property.lastSalePrice || undefined}
                        label="Price Distribution (3BR SFH)"
                      />
                      <Separator />
                      <PriceDistribution
                        p25={350}
                        p50={425}
                        p75={520}
                        currentValue={property.pricePerSqft || undefined}
                        label="$/sqft Distribution"
                        unit="$"
                      />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Expected Value Range</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border p-4 text-center">
                        <p className="text-sm text-muted-foreground">Low Estimate</p>
                        <p className="text-2xl font-bold">$465,000</p>
                        <p className="text-xs text-muted-foreground">10th percentile</p>
                      </div>
                      <div className="rounded-lg border border-primary bg-primary/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">Expected Value</p>
                        <p className="text-2xl font-bold text-primary">$525,000</p>
                        <p className="text-xs text-muted-foreground">Model estimate</p>
                      </div>
                      <div className="rounded-lg border p-4 text-center">
                        <p className="text-sm text-muted-foreground">High Estimate</p>
                        <p className="text-2xl font-bold">$585,000</p>
                        <p className="text-xs text-muted-foreground">90th percentile</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="relative">
                <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Opportunity Score Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48 bg-muted rounded animate-pulse" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Market Position</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48 bg-muted rounded animate-pulse" />
                      </CardContent>
                    </Card>
                  </div>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                  <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Unlock Full Property Insights</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                    {canUnlockProperty 
                      ? `You have ${remainingUnlocks} free unlock${remainingUnlocks !== 1 ? 's' : ''} remaining today.` 
                      : "You've used all 3 free unlocks today. Upgrade to Pro for unlimited access."}
                  </p>
                  {canUnlockProperty ? (
                    <Button
                      onClick={() => unlockMutation.mutate()}
                      disabled={unlockMutation.isPending}
                      data-testid="button-unlock-property"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {unlockMutation.isPending ? "Unlocking..." : "Unlock This Property"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setUpgradeFeature("Full Property Insights");
                        setShowUpgradeModal(true);
                      }}
                      data-testid="button-upgrade-property"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comps" className="space-y-6">
            {isPropertyUnlocked ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Property Location & Comps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PropertyMap
                      properties={comps?.map((c) => c.property) || []}
                      subjectProperty={property}
                      height="350px"
                      showClustering={false}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      Comparable Sales
                      {isFree && <ProBadge />}
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleExportCsv}
                      disabled={isExportingCsv}
                      data-testid="button-export-comps"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isExportingCsv ? "Exporting..." : "Export CSV"}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {isPro ? (
                      <CompsTable comps={comps || []} subjectProperty={property} />
                    ) : (
                      <BlurredContent
                        feature="Full Comps"
                        description="Unlock detailed comparable sales data with Pro. See all comps, prices, and similarity scores."
                      >
                        <CompsTable comps={(comps || []).slice(0, 3)} subjectProperty={property} />
                      </BlurredContent>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="relative">
                <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
                  <Card>
                    <CardHeader>
                      <CardTitle>Property Location & Comps</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                  <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Unlock Comps & Market Data</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                    {canUnlockProperty 
                      ? `You have ${remainingUnlocks} free unlock${remainingUnlocks !== 1 ? 's' : ''} remaining today.` 
                      : "You've used all 3 free unlocks today. Upgrade to Pro for unlimited access."}
                  </p>
                  {canUnlockProperty ? (
                    <Button
                      onClick={() => unlockMutation.mutate()}
                      disabled={unlockMutation.isPending}
                      data-testid="button-unlock-comps"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {unlockMutation.isPending ? "Unlocking..." : "Unlock This Property"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setUpgradeFeature("Full Property Insights");
                        setShowUpgradeModal(true);
                      }}
                      data-testid="button-upgrade-comps"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="investment" className="space-y-6">
            {isPropertyUnlocked ? (
              <ScenarioSimulator
                propertyId={id!}
                estimatedValue={property.estimatedValue || property.lastSalePrice}
                estimatedRent={property.sqft ? Math.round(property.sqft * 1.8) : undefined}
              />
            ) : (
              <div className="relative">
                <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
                  <Card>
                    <CardHeader>
                      <CardTitle>Investment Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 bg-muted rounded animate-pulse" />
                    </CardContent>
                  </Card>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                  <Lock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Unlock Investment Analysis</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                    {canUnlockProperty 
                      ? `You have ${remainingUnlocks} free unlock${remainingUnlocks !== 1 ? 's' : ''} remaining today.` 
                      : "You've used all 3 free unlocks today. Upgrade to Pro for unlimited access."}
                  </p>
                  {canUnlockProperty ? (
                    <Button
                      onClick={() => unlockMutation.mutate()}
                      disabled={unlockMutation.isPending}
                      data-testid="button-unlock-investment"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {unlockMutation.isPending ? "Unlocking..." : "Unlock This Property"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        setUpgradeFeature("Full Property Insights");
                        setShowUpgradeModal(true);
                      }}
                      data-testid="button-upgrade-investment"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="signals">
            <NycDeepInsights 
              propertyId={id!} 
              city={property.city} 
              state={property.state} 
            />
          </TabsContent>

          <TabsContent value="sales">
            <BuildingSalesHistory 
              bbl={property.bbl}
              isCondoUnit={property.propertyType?.toLowerCase().includes("condo")}
            />
          </TabsContent>

          <TabsContent value="ai">
            <div className="space-y-6">
              <PropertyAIInsights 
                propertyId={id!}
                onUpgrade={() => {
                  setUpgradeFeature("AI Property Insights");
                  setShowUpgradeModal(true);
                }}
              />
              
              <Card className="h-[500px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Ask Questions About This Property
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[calc(100%-60px)]">
                  {isAuthenticated && isPro ? (
                    <AIChat
                      propertyId={id}
                      contextLabel={`${formatPropertyAddress(property)}, ${property.city}`}
                      onSendMessage={handleSendAIMessage}
                    />
                  ) : isAuthenticated && isFree ? (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                      <div className="mb-4 rounded-full bg-primary/10 p-4">
                        <Crown className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold flex items-center gap-2">
                        AI Chat Assistant
                        <ProBadge />
                      </h3>
                      <p className="mb-4 max-w-md text-sm text-muted-foreground">
                        Ask follow-up questions about this property and get AI-powered answers based on real data.
                      </p>
                      <Link href="/pricing">
                        <Button size="sm" data-testid="button-upgrade-ai">
                          <Crown className="mr-2 h-4 w-4" />
                          Upgrade to Pro
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                      <div className="mb-4 rounded-full bg-primary/10 p-4">
                        <Bot className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="mb-2 text-lg font-semibold">AI Chat Assistant</h3>
                      <p className="mb-4 max-w-md text-sm text-muted-foreground">
                        Ask questions about this property and get AI-powered answers.
                      </p>
                      <a href="/api/login">
                        <Button size="sm" data-testid="button-login-ai">
                          <LogIn className="mr-2 h-4 w-4" />
                          Sign In to Use AI
                        </Button>
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature={upgradeFeature}
        description={`${upgradeFeature} is a Pro feature. Upgrade to unlock unlimited exports and more.`}
      />
      
      <PropertyStickyCTA
        propertyAddress={formatPropertyAddress(property)}
        propertyPrice={formatPrice(property.lastSalePrice)}
        opportunityScore={property.opportunityScore}
        onSaveProperty={() => saveMutation.mutate()}
        onExportReport={handleExportReport}
        isSaving={saveMutation.isPending}
      />
      </AppLayout>
    </>
  );
}
