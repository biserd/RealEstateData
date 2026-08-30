import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      payload = text;
    }
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message || res.statusText)
      : text || res.statusText;
    throw new ApiError(res.status, message, payload);
  }
}

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  return error.status === 408
    || error.status === 425
    || error.status === 429
    || error.status >= 500;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Omit<Response, "json"> & { json(): Promise<any> }> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res as Omit<Response, "json"> & { json(): Promise<any> };
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T = any>(options: {
  on401: "returnNull";
}): QueryFunction<T | null>;
export function getQueryFn<T = any>(options: {
  on401: "throw";
}): QueryFunction<T>;
export function getQueryFn<T = any>({ on401: unauthorizedBehavior }: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T | null> {
  return async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json() as T;
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 60 * 1000,
      retry: shouldRetryQuery,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
    },
    mutations: {
      retry: false,
    },
  },
});
