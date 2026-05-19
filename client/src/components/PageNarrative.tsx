import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PremiumCheckoutButton } from "@/components/UnitGating";

interface PageNarrativeProps {
  kind: "unit" | "property";
  refId: string;
}

interface NarrativeResponse {
  narrative: string;
  generatedAt: string;
}

const PLACEHOLDER_PARAGRAPHS = [
  "This property sits in a well-tracked submarket with active recent sales, building permits, and price signals that our analysts roll into a unique narrative for every page. The full write-up covers how the unit compares to its building, ZIP medians, and the broader neighborhood trend so you can decide quickly whether it is worth a closer look.",
  "Paragraph two breaks down value versus comparable benchmarks, recent comparable sales, and any opportunity-score factors driving our internal rating. Premium members see the complete grounded analysis on every unit and property page across the platform.",
];

export function PageNarrative({ kind, refId }: PageNarrativeProps) {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, isError } = useQuery<NarrativeResponse>({
    queryKey: ["/api/seo/narrative", kind, refId],
    enabled: !!refId,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // Logged-in users with no narrative yet: show loading then let it generate.
  // Anon users with no narrative: show blurred placeholder + Premium CTA.
  const showLockedPlaceholder = !isLoading && !data && !isAuthenticated;
  const showSkeleton = isLoading && !showLockedPlaceholder;

  if (isError && isAuthenticated) return null;

  return (
    <Card data-testid={`card-narrative-${kind}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Property analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {showSkeleton ? (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </>
        ) : showLockedPlaceholder ? (
          <div className="relative">
            <div
              className="space-y-3 blur-[5px] select-none pointer-events-none"
              aria-hidden
            >
              {PLACEHOLDER_PARAGRAPHS.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">AI property analysis</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Unlock a unique, data-grounded summary for every property.
                </p>
              </div>
              <PremiumCheckoutButton
                authenticated={false}
                size="sm"
                label="Unlock with Premium"
                testId="button-premium-narrative"
              />
            </div>
          </div>
        ) : data ? (
          data.narrative.split(/\n\n+/).map((para, i) => (
            <p key={i} data-testid={`text-narrative-paragraph-${i}`}>
              {para.trim()}
            </p>
          ))
        ) : null}
      </CardContent>
    </Card>
  );
}
