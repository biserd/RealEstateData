import { useEffect } from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layouts";
import { LoadingState } from "@/components/LoadingState";

export default function PropertyResolver() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<{ type: "unit" | "building" | "property"; redirectTo: string }>({
    queryKey: ["/api/property/resolve", id],
    queryFn: async () => {
      const res = await fetch(`/api/property/resolve/${id}`, { credentials: "include" });
      const result = await res.json();
      // Return redirect info even on 404 to handle gracefully
      return result;
    },
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (data?.redirectTo && !data.redirectTo.includes("not-found")) {
      navigate(data.redirectTo, { replace: true });
    }
  }, [data, navigate]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container max-w-5xl py-6">
          <LoadingState type="skeleton-details" />
        </div>
      </AppLayout>
    );
  }

  // Handle not found - redirect to 404 page
  if (error || !data?.redirectTo || data.redirectTo.includes("not-found")) {
    return <Redirect to="/not-found" />;
  }

  // Still loading/redirecting
  return (
    <AppLayout>
      <div className="container max-w-5xl py-6">
        <LoadingState type="skeleton-details" />
      </div>
    </AppLayout>
  );
}
