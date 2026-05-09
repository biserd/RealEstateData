import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

interface PageNarrativeProps {
  kind: "unit" | "property";
  refId: string;
}

interface NarrativeResponse {
  narrative: string;
  generatedAt: string;
}

export function PageNarrative({ kind, refId }: PageNarrativeProps) {
  const { data, isLoading, isError } = useQuery<NarrativeResponse>({
    queryKey: ["/api/seo/narrative", kind, refId],
    enabled: !!refId,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  if (isError) return null;

  return (
    <Card data-testid={`card-narrative-${kind}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Property analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {isLoading || !data ? (
          <>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </>
        ) : (
          data.narrative.split(/\n\n+/).map((para, i) => (
            <p key={i} data-testid={`text-narrative-paragraph-${i}`}>
              {para.trim()}
            </p>
          ))
        )}
      </CardContent>
    </Card>
  );
}
