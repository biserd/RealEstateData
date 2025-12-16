import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, ArrowRight, Download, Heart, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";

interface PropertyStickyCTAProps {
  propertyAddress: string;
  propertyPrice: string;
  opportunityScore: number | null;
  onSaveProperty: () => void;
  onExportReport: () => void;
  isSaving?: boolean;
}

export function PropertyStickyCTA({
  propertyAddress,
  propertyPrice,
  opportunityScore,
  onSaveProperty,
  onExportReport,
  isSaving = false,
}: PropertyStickyCTAProps) {
  const { isAuthenticated } = useAuth();
  const { isPro, isPremium, isFree } = useSubscription();

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-muted-foreground";
  };

  return (
    <>
      <div className="hidden xl:block fixed right-4 top-24 z-40 w-64" data-testid="card-sticky-cta-desktop">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-sticky-price">{propertyPrice}</p>
              {opportunityScore !== null && (
                <p className={`text-sm font-medium ${getScoreColor(opportunityScore)}`}>
                  Score: {opportunityScore}/100
                </p>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="space-y-3">
                <Link href="/register">
                  <Button className="w-full" data-testid="button-sticky-start-free">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <p className="text-xs text-center text-muted-foreground">
                  Create a free account to save properties and get AI analysis.
                </p>
              </div>
            ) : isFree ? (
              <div className="space-y-3">
                <Link href="/pricing">
                  <Button className="w-full" data-testid="button-sticky-upgrade">
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  data-testid="button-sticky-save"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Save Property
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Unlock AI analysis, Deal Memo, and PDF exports.
                </p>
              </div>
            ) : isPro && !isPremium ? (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  data-testid="button-sticky-save"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Save Property
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onExportReport}
                  data-testid="button-sticky-export"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
                <Link href="/pricing">
                  <Button variant="ghost" size="sm" className="w-full text-xs" data-testid="button-sticky-premium-upsell">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Get alerts with Premium
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <Badge variant="default" className="w-full justify-center py-1">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Premium
                </Badge>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  data-testid="button-sticky-save"
                >
                  <Heart className="mr-2 h-4 w-4" />
                  Save Property
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onExportReport}
                  data-testid="button-sticky-export"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 xl:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3" data-testid="bar-sticky-cta-mobile">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{propertyPrice}</p>
            {opportunityScore !== null && (
              <p className={`text-xs ${getScoreColor(opportunityScore)}`}>
                Score: {opportunityScore}/100
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!isAuthenticated ? (
              <Link href="/register">
                <Button size="sm" data-testid="button-mobile-start-free">
                  Start Free
                </Button>
              </Link>
            ) : isFree ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  data-testid="button-mobile-save"
                >
                  <Heart className="h-4 w-4" />
                </Button>
                <Link href="/pricing">
                  <Button size="sm" data-testid="button-mobile-upgrade">
                    <Crown className="mr-1 h-3 w-3" />
                    Pro
                  </Button>
                </Link>
              </>
            ) : isPro && !isPremium ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  data-testid="button-mobile-save"
                >
                  <Heart className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onExportReport}
                  data-testid="button-mobile-export"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Badge variant="default" className="flex items-center">
                  <Sparkles className="h-3 w-3" />
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSaveProperty}
                  disabled={isSaving}
                  data-testid="button-mobile-save"
                >
                  <Heart className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onExportReport}
                  data-testid="button-mobile-export"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
