import { Crown, Lock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UpgradePromptProps {
  feature: string;
  description?: string;
  compact?: boolean;
}

export function UpgradePrompt({ feature, description, compact = false }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">
          {feature} requires Pro
        </span>
        <Link href="/pricing">
          <Button size="sm" variant="default" data-testid="button-upgrade-compact">
            <Crown className="h-3 w-3 mr-1" />
            Upgrade
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">Unlock {feature}</CardTitle>
        <CardDescription>
          {description || `Upgrade to Pro to access ${feature.toLowerCase()} and more powerful features.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Link href="/pricing">
          <Button data-testid="button-upgrade-full">
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Pro
          </Button>
        </Link>
      </CardContent>
    </Card>
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
