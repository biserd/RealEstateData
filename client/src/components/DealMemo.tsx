import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Download, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface DealMemoData {
  propertyOverview: {
    address: string;
    propertyType: string;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    yearBuilt: number | null;
    estimatedValue: number | null;
  };
  executiveSummary: string;
  pricingAnalysis: {
    estimatedValue: number | null;
    pricePerSqft: number | null;
    marketMedian: number | null;
    marketP25: number | null;
    marketP75: number | null;
    percentilePosition: string;
    valueAssessment: string;
  };
  opportunityAssessment: {
    score: number | null;
    confidence: string;
    keyStrengths: string[];
    keyRisks: string[];
    recommendation: string;
  };
  comparablesSummary: {
    totalComps: number;
    avgSalePrice: number | null;
    avgPricePerSqft: number | null;
    topComps: { address: string; price: number; similarity: number }[];
  };
  marketContext: {
    areaName: string;
    trend3m: number | null;
    trend12m: number | null;
    transactionVolume: number | null;
    marketOutlook: string;
  };
  investmentConsiderations: string[];
  generatedAt: string;
}

interface DealMemoProps {
  propertyId: string;
}

export function DealMemo({ propertyId }: DealMemoProps) {
  const [memo, setMemo] = useState<DealMemoData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const generateMemo = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/ai/deal-memo/${propertyId}`);
      const data = await response.json();
      return data as DealMemoData;
    },
    onSuccess: (data) => {
      setMemo(data);
      toast({
        title: "Deal memo generated",
        description: "Your investment analysis is ready to view.",
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Unable to generate deal memo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatTrend = (trend: number | null) => {
    if (trend === null) return "N/A";
    const sign = trend >= 0 ? "+" : "";
    return `${sign}${trend.toFixed(1)}%`;
  };

  const handleDownload = () => {
    if (!memo) return;
    const content = JSON.stringify(memo, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deal-memo-${propertyId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated && !authLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsOpen(true)}
            data-testid="button-generate-memo"
          >
            <FileText className="h-4 w-4" />
            Generate Deal Memo
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Deal Memo
            </DialogTitle>
            <DialogDescription>
              Sign in to generate AI-powered investment analysis
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">Sign In Required</h3>
            <p className="mb-6 text-sm text-muted-foreground max-w-xs">
              Create a free account to generate professional deal memos with AI-powered analysis, pricing insights, and investment recommendations.
            </p>
            <a href="/api/login" className="w-full">
              <Button className="w-full" data-testid="button-login-deal-memo">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Continue
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setIsOpen(true);
            if (!memo) {
              generateMemo.mutate();
            }
          }}
          data-testid="button-generate-memo"
        >
          <FileText className="h-4 w-4" />
          Generate Deal Memo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Investment Deal Memo
          </DialogTitle>
          <DialogDescription className="sr-only">
            AI-generated investment analysis for this property
          </DialogDescription>
        </DialogHeader>

        {generateMemo.isPending ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generating your deal memo...</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds</p>
          </div>
        ) : memo && memo.propertyOverview ? (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{memo.propertyOverview.address || "Property"}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {memo.propertyOverview.propertyType || "N/A"} | {memo.propertyOverview.beds ?? "?"}BR/{memo.propertyOverview.baths ?? "?"}BA | {memo.propertyOverview.sqft?.toLocaleString() || "N/A"} sqft
                      </p>
                    </div>
                    <Badge variant="secondary">
                      Score: {memo.opportunityAssessment?.score || "N/A"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{memo.executiveSummary || "No summary available."}</p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Pricing Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Estimated Value</p>
                        <p className="font-semibold">{formatPrice(memo.pricingAnalysis?.estimatedValue ?? null)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Price/Sqft</p>
                        <p className="font-semibold">{memo.pricingAnalysis?.pricePerSqft ? `$${memo.pricingAnalysis.pricePerSqft.toFixed(0)}` : "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Market Median</p>
                        <p className="font-semibold">{formatPrice(memo.pricingAnalysis?.marketMedian ?? null)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Position</p>
                        <p className="font-semibold">{memo.pricingAnalysis?.percentilePosition || "N/A"}</p>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-sm text-muted-foreground">{memo.pricingAnalysis?.valueAssessment || "N/A"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Market Context</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Area</p>
                        <p className="font-semibold">{memo.marketContext?.areaName || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Transactions</p>
                        <p className="font-semibold">{memo.marketContext?.transactionVolume || "N/A"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-muted-foreground">3-Mo Trend</p>
                          <p className={cn(
                            "font-semibold flex items-center gap-1",
                            memo.marketContext?.trend3m && memo.marketContext.trend3m >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {memo.marketContext?.trend3m && memo.marketContext.trend3m >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatTrend(memo.marketContext?.trend3m ?? null)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-muted-foreground">12-Mo Trend</p>
                          <p className={cn(
                            "font-semibold flex items-center gap-1",
                            memo.marketContext?.trend12m && memo.marketContext.trend12m >= 0 ? "text-emerald-600" : "text-red-600"
                          )}>
                            {memo.marketContext?.trend12m && memo.marketContext.trend12m >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatTrend(memo.marketContext?.trend12m ?? null)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-sm text-muted-foreground">{memo.marketContext?.marketOutlook || "N/A"}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      Key Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(memo.opportunityAssessment?.keyStrengths || []).map((strength, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-emerald-600 mt-1">+</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Key Risks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(memo.opportunityAssessment?.keyRisks || []).map((risk, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-amber-600 mt-1">-</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {memo.comparablesSummary?.topComps && memo.comparablesSummary.topComps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Comparable Sales ({memo.comparablesSummary?.totalComps || 0} total)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {memo.comparablesSummary.topComps.map((comp, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                          <span>{comp.address}</span>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold">{formatPrice(comp.price)}</span>
                            <Badge variant="outline">{comp.similarity?.toFixed(0) || 0}% match</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    {memo.comparablesSummary?.avgSalePrice && (
                      <div className="mt-4 pt-2 border-t flex justify-between text-sm">
                        <span className="text-muted-foreground">Average Sale Price</span>
                        <span className="font-semibold">{formatPrice(memo.comparablesSummary.avgSalePrice)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recommendation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{memo.opportunityAssessment?.recommendation || "No recommendation available."}</p>
                </CardContent>
              </Card>

              {memo.investmentConsiderations && memo.investmentConsiderations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Investment Considerations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {memo.investmentConsiderations.map((consideration, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">{i + 1}.</span>
                          {consideration}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Generated: {memo.generatedAt ? new Date(memo.generatedAt).toLocaleString() : "Just now"}
                </p>
                <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download-memo">
                  <Download className="h-4 w-4 mr-2" />
                  Download JSON
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : generateMemo.isError ? (
          <div className="flex flex-col items-center justify-center py-16">
            <XCircle className="h-8 w-8 text-destructive mb-4" />
            <p className="text-muted-foreground">Failed to generate memo</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => generateMemo.mutate()}
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="h-8 w-8 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Click Generate Deal Memo to start</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
