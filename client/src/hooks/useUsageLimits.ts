import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

interface UsageLimits {
  searches: { used: number; limit: number; remaining: number };
  unlocks: { used: number; limit: number; remaining: number };
  pdfs: { used: number; limit: number; remaining: number };
}

export function useUsageLimits() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<UsageLimits>({
    queryKey: ["/api/usage-limits"],
    enabled: isAuthenticated,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  const hasSearchesRemaining = data ? data.searches.remaining > 0 || data.searches.limit === Infinity : true;
  const hasUnlocksRemaining = data ? data.unlocks.remaining > 0 || data.unlocks.limit === Infinity : true;
  const hasPdfsRemaining = data ? data.pdfs.remaining > 0 || data.pdfs.limit === Infinity : true;

  return {
    limits: data,
    isLoading,
    error,
    refetch,
    hasSearchesRemaining,
    hasUnlocksRemaining,
    hasPdfsRemaining,
    searchesRemaining: data?.searches.remaining ?? 5,
    unlocksRemaining: data?.unlocks.remaining ?? 3,
    pdfsRemaining: data?.pdfs.remaining ?? 1,
    isUnlimited: data?.searches.limit === Infinity,
  };
}
