import { Crown, Lock, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SubscriptionTier } from "@/hooks/useSubscription";

interface UpgradePromptProps {
  feature: string;
  description?: string;
  compact?: boolean;
  requiredTier?: SubscriptionTier;
}

export function UpgradePrompt({ feature, description, compact = false, requiredTier = "pro" }: UpgradePromptProps) {
  const isPremiumOnly = requiredTier === "premium";
  const Icon = isPremiumOnly ? Sparkles : Crown;
  const tierLabel = isPremiumOnly ? "Premium" : "Pro";
  const iconColor = isPremiumOnly ? "text-purple-500" : "text-primary";
  const bgColor = isPremiumOnly ? "bg-purple-500/10" : "bg-primary/10";

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">
          {feature} requires {tierLabel}
        </span>
        <Link href="/pricing">
          <Button size="sm" variant="default" className={isPremiumOnly ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" : ""} data-testid="button-upgrade-compact">
            <Icon className="h-3 w-3 mr-1" />
            Upgrade
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className={`mx-auto mb-2 h-12 w-12 rounded-full ${bgColor} flex items-center justify-center`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <CardTitle className="text-lg">Unlock {feature}</CardTitle>
        <CardDescription>
          {description || `Upgrade to ${tierLabel} to access ${feature.toLowerCase()} and more powerful features.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/pricing">
          <Button className={isPremiumOnly ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" : ""} data-testid="button-upgrade-full">
            <Icon className="h-4 w-4 mr-2" />
            Upgrade to {tierLabel}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  description?: string;
  requiredTier?: SubscriptionTier;
}

export function UpgradeModal({ open, onOpenChange, feature, description, requiredTier = "pro" }: UpgradeModalProps) {
  const isPremiumOnly = requiredTier === "premium";
  const Icon = isPremiumOnly ? Sparkles : Crown;
  const tierLabel = isPremiumOnly ? "Premium" : "Pro";
  const iconColor = isPremiumOnly ? "text-purple-500" : "text-primary";
  const bgColor = isPremiumOnly ? "bg-purple-500/10" : "bg-primary/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className={`mx-auto mb-4 h-16 w-16 rounded-full ${bgColor} flex items-center justify-center`}>
            <Icon className={`h-8 w-8 ${iconColor}`} />
          </div>
          <DialogTitle className="text-xl">Unlock {feature}</DialogTitle>
          <DialogDescription className="pt-2">
            {description || `${feature} is a ${tierLabel} feature. Upgrade your subscription to unlock this and many more powerful features.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Link href="/pricing">
            <Button className={`w-full ${isPremiumOnly ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" : ""}`} data-testid="button-upgrade-modal">
              <Icon className="h-4 w-4 mr-2" />
              View Plans
            </Button>
          </Link>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-upgrade-modal">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BlurredContentProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
  requiredTier?: SubscriptionTier;
  showPreview?: boolean;
}

export function BlurredContent({ children, feature, description, requiredTier = "pro", showPreview = true }: BlurredContentProps) {
  const isPremiumOnly = requiredTier === "premium";
  const Icon = isPremiumOnly ? Sparkles : Crown;
  const tierLabel = isPremiumOnly ? "Premium" : "Pro";
  const iconColor = isPremiumOnly ? "text-purple-500" : "text-primary";

  return (
    <div className="relative">
      <div className={`${showPreview ? "blur-sm pointer-events-none select-none" : "hidden"}`}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
        <div className="text-center p-6 max-w-sm">
          <div className="mb-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2 flex items-center justify-center gap-2">
            <Icon className={`h-4 w-4 ${iconColor}`} />
            {tierLabel} Feature
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {description || `Unlock ${feature.toLowerCase()} with a ${tierLabel} subscription.`}
          </p>
          <Link href="/pricing">
            <Button size="sm" className={isPremiumOnly ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" : ""} data-testid="button-upgrade-blurred">
              Upgrade to {tierLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className }: ProBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-primary ${className || ""}`}>
      <Crown className="h-3 w-3" />
      PRO
    </span>
  );
}

interface PremiumBadgeProps {
  className?: string;
}

export function PremiumBadge({ className }: PremiumBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-purple-500 ${className || ""}`}>
      <Sparkles className="h-3 w-3" />
      PREMIUM
    </span>
  );
}

interface TierBadgeProps {
  tier: SubscriptionTier;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  if (tier === "premium") {
    return <PremiumBadge className={className} />;
  }
  if (tier === "pro") {
    return <ProBadge className={className} />;
  }
  return null;
}
