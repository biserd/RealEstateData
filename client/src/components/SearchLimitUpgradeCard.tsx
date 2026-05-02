import { Sparkles, Search, Check, ArrowRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SearchLimitUpgradeCardProps {
  /** "compact" fits inside a search dropdown, "full" is a stand-alone card. */
  variant?: "compact" | "full";
  /** Daily limit shown to user. Defaults to 5. */
  limit?: number;
  className?: string;
  onDismiss?: () => void;
}

export function SearchLimitUpgradeCard({
  variant = "compact",
  limit = 5,
  className,
  onDismiss,
}: SearchLimitUpgradeCardProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const goPricing = () => {
    onDismiss?.();
    navigate("/pricing");
  };

  const goSignup = () => {
    onDismiss?.();
    navigate("/login");
  };

  if (variant === "compact") {
    return (
      <div
        className={cn("p-4", className)}
        data-testid="search-limit-upgrade-compact"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              You've used all {limit} free searches today
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAuthenticated
                ? "Upgrade to Pro for unlimited search and full property insights."
                : "Sign up free to keep searching, or upgrade to Pro for unlimited access."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={goPricing}
            data-testid="button-search-upgrade-pro"
            className="gap-1"
          >
            <Crown className="h-3.5 w-3.5" />
            Upgrade to Pro
          </Button>
          {!isAuthenticated && (
            <Button
              size="sm"
              variant="outline"
              onClick={goSignup}
              data-testid="button-search-signup"
            >
              Sign up free
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Full variant — used as a stand-alone card
  return (
    <Card className={cn("border-primary/30 bg-primary/[0.03]", className)} data-testid="search-limit-upgrade-full">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/15 text-primary shrink-0">
            <Search className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                You've reached today's free search limit
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                {limit}/{limit} used
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isAuthenticated
                ? "Pro unlocks unlimited searches across NY, NJ, and CT plus full property insights and exports."
                : "Create a free account to keep searching, or jump straight to Pro for unlimited access."}
            </p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {[
                "Unlimited daily searches",
                "Full property insights",
                "AI market analysis",
                "PDF exports & comps",
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={goPricing}
                data-testid="button-search-upgrade-pro-full"
                className="gap-1"
              >
                <Crown className="h-4 w-4" />
                See Pro plans
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="outline"
                  onClick={goSignup}
                  data-testid="button-search-signup-full"
                >
                  Sign up free
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Daily limit resets in 24 hours.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
