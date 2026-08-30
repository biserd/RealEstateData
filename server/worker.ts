import { env as cloudflareEnv } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { UsageQuota, configureQuotaNamespace } from "./quota";

export { UsageQuota };

const bindings = cloudflareEnv as Env;
configureQuotaNamespace(bindings.USAGE_QUOTA);
const databaseConfigured = Boolean(process.env.DATABASE_URL);

// Allow the static shell and health check to run before the database secret is
// supplied. API routes clearly return 503 until DATABASE_URL is configured.
if (!databaseConfigured) {
  process.env.DATABASE_URL =
    "postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured";
}
const [{ createApp }, { configureCloudflareEmail }, seo] = await Promise.all([
  import("./app"),
  import("./emailService"),
  import("./seoMetaTags"),
]);

configureCloudflareEmail(bindings.EMAIL);

const { httpServer } = await createApp({ runtime: "cloudflare" });
const workerPort = 8787;
httpServer.listen(workerPort);
const expressHandler = httpServerHandler({ port: workerPort });
const PUBLIC_CACHE_REVISION = "2026-08-30-entity-integrity-v1";

function isBackendPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname === "/robots.txt" || pathname.startsWith("/sitemap");
}

const AI_CRAWLER_PATTERN = /(?:GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|CCBot|Google-Extended|PerplexityBot|Bytespider|Amazonbot)/i;

function isBlockedApiCrawler(request: Request, pathname: string): boolean {
  if (!pathname.startsWith("/api/") || !AI_CRAWLER_PATTERN.test(request.headers.get("user-agent") || "")) {
    return false;
  }

  // Let a public page load its own JSON in AI-assisted browsers. Direct bot API
  // traffic has no same-origin browser context and remains blocked; all allowed
  // requests still pass through the Cloudflare rate limiters below.
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const sameOriginBrowserRequest = request.headers.get("sec-fetch-site") === "same-origin"
    || origin === requestOrigin
    || Boolean(referer && (referer === requestOrigin || referer.startsWith(`${requestOrigin}/`)));
  return !sameOriginBrowserRequest;
}

function publicCacheTtl(pathname: string): number | null {
  if (pathname === "/api/market/up-and-coming" || pathname === "/api/market/trending-zips") return 900;
  if (pathname === "/api/stats/platform") return 600;
  if (pathname.startsWith("/api/market/") || pathname.startsWith("/api/browse/")) return 300;
  if (pathname.startsWith("/api/seo/narrative/")) return 3600;
  if (pathname === "/robots.txt" || pathname.startsWith("/sitemap")) return 3600;
  return null;
}

async function hashRateKey(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function enforceBurstLimit(request: Request, env: Env, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/api/") || pathname === "/api/health") return null;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  let limiter = env.PUBLIC_RATE_LIMIT;
  let key = ip;

  if (pathname.startsWith("/api/search/")) limiter = env.SEARCH_RATE_LIMIT;
  else if (pathname.startsWith("/api/ai/") || pathname.startsWith("/api/units/") && pathname.endsWith("/insights")) limiter = env.AI_RATE_LIMIT;
  else if (pathname.startsWith("/api/auth/") && request.method !== "GET") limiter = env.AUTH_RATE_LIMIT;
  else if (pathname.startsWith("/api/external/")) {
    limiter = env.EXTERNAL_API_RATE_LIMIT;
    key = await hashRateKey(request.headers.get("x-api-key") || ip);
  }

  const outcome = await limiter.limit({ key });
  if (outcome.success) return null;
  return Response.json(
    { message: "Too many requests. Please wait and try again.", code: "burst_rate_limited" },
    { status: 429, headers: { "cache-control": "no-store", "retry-after": "60" } },
  );
}

function cacheKeyFor(request: Request): Request {
  const url = new URL(request.url);
  url.hash = "";
  const sorted = new URLSearchParams(Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b)));
  sorted.set("__rd_cache_revision", PUBLIC_CACHE_REVISION);
  url.search = sorted.toString();
  return new Request(url.toString(), { method: "GET" });
}

async function fetchBackendWithCache(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  pathname: string,
): Promise<Response> {
  const ttl = request.method === "GET" ? publicCacheTtl(pathname) : null;
  const cache = (caches as unknown as { default: Cache }).default;
  const key = ttl ? cacheKeyFor(request) : null;

  if (key) {
    const cached = await cache.match(key);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("x-rd-cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  const nodeRequest = request as Request<unknown, IncomingRequestCfProperties>;
  const response = await expressHandler.fetch!(nodeRequest, env, ctx);
  if (!key || !ttl || !response.ok || response.headers.has("set-cookie")) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  headers.set("x-rd-cache", "MISS");
  const cacheable = new Response(response.body, { status: response.status, headers });
  ctx.waitUntil(cache.put(key, cacheable.clone()));
  return cacheable;
}

function isDocumentRequest(request: Request): boolean {
  return request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");
}

async function serveDocument(request: Request): Promise<Response> {
  const assetResponse = await bindings.ASSETS.fetch(request);
  if (!assetResponse.ok || !databaseConfigured) return assetResponse;

  try {
    const html = await assetResponse.clone().text();
    const url = new URL(request.url);
    const entityPage = seo.isDatabaseBackedPagePath(url.pathname);
    const metadata = entityPage
      ? await seo.getDatabaseBackedMetaForUrl(`${url.pathname}${url.search}`)
      : await seo.getMetaForUrl(`${url.pathname}${url.search}`);
    const headers = new Headers(assetResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    if (!metadata && entityPage) {
      headers.set("cache-control", "no-store");
      headers.set("x-robots-tag", "noindex, nofollow, noarchive");
      return new Response(html, { status: 404, headers });
    }
    if (!metadata) return assetResponse;

    if (entityPage && metadata.canonicalPath !== url.pathname) {
      const canonicalUrl = new URL(metadata.canonicalPath, url.origin);
      return Response.redirect(canonicalUrl.toString(), 301);
    }

    headers.set("cache-control", "public, max-age=60, stale-while-revalidate=300");
    return new Response(seo.injectMetaTags(html, metadata, url.origin), {
      status: assetResponse.status,
      headers,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", source: "seo", message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }));
    return assetResponse;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, runtime: "cloudflare-workers", databaseConfigured, emailConfigured: Boolean(bindings.EMAIL) });
    }

    if (isBackendPath(url.pathname)) {
      if (isBlockedApiCrawler(request, url.pathname)) {
        return Response.json(
          { message: "Automated crawler access to API routes is not permitted." },
          { status: 403, headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } },
        );
      }
      const rateLimited = await enforceBurstLimit(request, env, url.pathname);
      if (rateLimited) return rateLimited;
      if (!databaseConfigured) {
        return Response.json(
          { message: "Database is not configured yet" },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
      if (!expressHandler.fetch) {
        return Response.json({ message: "Express adapter is unavailable" }, { status: 500 });
      }
      return fetchBackendWithCache(request, env, ctx, url.pathname);
    }

    if (isDocumentRequest(request)) return serveDocument(request);
    return bindings.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
