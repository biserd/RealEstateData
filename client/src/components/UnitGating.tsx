import { useState } from "react";
import { Link } from "wouter";
import { Lock, Sparkles, Crown, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { startPremiumCheckout } from "@/lib/premiumCheckout";

interface PremiumCtaProps {
  authenticated: boolean;
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  testId?: string;
}

/** Button that starts a Stripe checkout for the Premium plan. */
export function PremiumCheckoutButton({
  authenticated,
  label = "Get Premium",
  className,
  size = "default",
  testId = "button-premium-checkout",
}: PremiumCtaProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    setLoading(true);
    try {
      await startPremiumCheckout({ authenticated });
    } catch (e) {
      setLoading(false);
      toast({
        title: "Checkout error",
        description: "We couldn't start checkout. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      size={size}
      className={`bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white ${className || ""}`}
      data-testid={testId}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );
}

interface PriceGateProps {
  /** The exact numeric value (e.g., a sale price). */
  value: number | null | undefined;
  /** True if the viewer is authenticated. */
  authenticated: boolean;
  /** Class names for the wrapping span. */
  className?: string;
  /** test id forwarded to the rendered span. */
  testId?: string;
}

/** Format a number as $1.2M / $850K. */
function formatCompactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

/**
 * Renders an exact USD price for authenticated users; for anonymous viewers
 * shows a coarse range (±15%) plus a small Sign-up link.
 */
export function PriceGate({ value, authenticated, className, testId }: PriceGateProps) {
  if (value == null) return null;
  if (authenticated) {
    return (
      <span className={className} data-testid={testId}>
        ${value.toLocaleString()}
      </span>
    );
  }
  const low = Math.round((value * 0.85) / 1000) * 1000;
  const high = Math.round((value * 1.15) / 1000) * 1000;
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className || ""}`} data-testid={testId}>
      <span className="blur-[3px] select-none" aria-hidden>
        ${value.toLocaleString()}
      </span>
      <span className="sr-only">
        Estimated range {formatCompactUsd(low)} to {formatCompactUsd(high)}
      </span>
    </span>
  );
}

interface LoginGateCardProps {
  title: string;
  description: string;
  authenticated: boolean;
  testId?: string;
}

/** Replacement card shown to anonymous users in place of a login-gated section. */
export function LoginGateCard({ title, description, authenticated, testId }: LoginGateCardProps) {
  return (
    <Card data-testid={testId} className="border-dashed">
      <CardContent className="flex flex-col items-center text-center p-6 gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <PremiumCheckoutButton
            authenticated={authenticated}
            size="sm"
            label="Unlock with Premium"
            testId="button-premium-gate"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface AnonLimitDialogProps {
  open: boolean;
  authenticated: boolean;
}

/**
 * Hard paywall modal shown when an anonymous visitor has viewed more than
 * the free unit-page limit. Cannot be dismissed without action.
 */
export function AnonLimitDialog({ open, authenticated }: AnonLimitDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Crown className="h-8 w-8 text-purple-500" />
          </div>
          <DialogTitle className="text-xl">You've reached the free preview limit</DialogTitle>
          <DialogDescription className="pt-2">
            Create a free account to keep browsing unit pages, or upgrade to Premium for unlimited
            access, exact sale prices, comparable sales, and AI-powered analysis.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <PremiumCheckoutButton
            authenticated={authenticated}
            label="Continue with Premium"
            testId="button-anon-limit-premium"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
