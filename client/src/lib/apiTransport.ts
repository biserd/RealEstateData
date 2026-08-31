const WORKER_DATA_ORIGIN = "https://realtors-dashboard.biser-d.workers.dev";

const PUBLIC_DATA_PATHS = [
  "/api/health",
  "/api/stats/platform",
  "/api/opportunities/top",
  "/api/units/top-opportunities",
  "/api/units/resolve/",
  "/api/market/",
  "/api/neighborhood/",
  "/api/properties/area",
  "/api/properties/screener",
  "/api/search/geo",
  "/api/search/unified",
  "/api/buildings/",
  "/api/browse/",
  "/api/seo/",
  "/api/property/resolve/",
  "/api/calculator/property/",
  "/api/products",
] as const;

function isPublicDataPath(pathname: string): boolean {
  if (PUBLIC_DATA_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return true;
  }

  return /^\/api\/units\/[^/]+\/(?:sales|opportunity)$/.test(pathname);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") return new URL(input, window.location.href);
    if (input instanceof URL) return new URL(input.toString());
    return new URL(input.url, window.location.href);
  } catch {
    return null;
  }
}

function shouldUseWorkerFallback(url: URL | null, method: string): url is URL {
  if (!url || method !== "GET") return false;
  if (window.location.hostname !== "realtorsdashboard.com" && window.location.hostname !== "www.realtorsdashboard.com") {
    return false;
  }
  return url.origin === window.location.origin && isPublicDataPath(url.pathname);
}

function fallbackInit(input: RequestInfo | URL, init?: RequestInit): RequestInit {
  const source = typeof Request !== "undefined" && input instanceof Request ? input : null;
  return {
    method: "GET",
    headers: init?.headers ?? source?.headers,
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    redirect: init?.redirect ?? source?.redirect,
    referrerPolicy: init?.referrerPolicy ?? source?.referrerPolicy,
    signal: init?.signal ?? source?.signal,
  };
}

export function installPublicDataFetchFallback(): void {
  if (typeof window === "undefined") return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    if (!shouldUseWorkerFallback(url, method)) return nativeFetch(input, init);

    const fallbackUrl = `${WORKER_DATA_ORIGIN}${url.pathname}${url.search}`;
    const fetchFallback = () => nativeFetch(fallbackUrl, fallbackInit(input, init));

    let response: Response;
    try {
      response = await nativeFetch(input, init);
    } catch {
      return fetchFallback();
    }

    if (response.status >= 500 || (response.status === 403 && !(response.headers.get("content-type") || "").includes("application/json"))) {
      return fetchFallback();
    }

    if (response.ok && (response.headers.get("content-type") || "").includes("application/json")) {
      const originalJson = response.json.bind(response);
      Object.defineProperty(response, "json", {
        configurable: true,
        value: async () => {
          try {
            return await originalJson();
          } catch {
            const fallbackResponse = await fetchFallback();
            if (!fallbackResponse.ok) throw new Error(`Fallback data request failed with ${fallbackResponse.status}`);
            return fallbackResponse.json();
          }
        },
      });
    }

    return response;
  };
}
