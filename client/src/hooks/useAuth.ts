import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  // Anonymous homepage HTML is streamed at build time. Starting the auth
  // request during hydration can update its Suspense boundary before React has
  // attached to it, forcing a full client re-render (React #421).
  const [mayFetch, setMayFetch] = useState(() =>
    typeof document !== "undefined" && !document.getElementById("root")?.hasAttribute("data-ssr-home"),
  );
  useEffect(() => setMayFetch(true), []);
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn<User | null>({ on401: "returnNull" }),
    enabled: mayFetch,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  return {
    user,
    isLoading: !mayFetch || isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
