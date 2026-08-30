import { env as cloudflareEnv } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { UsageQuota, configureQuotaNamespace } from "./quota";
import { handleDataPipelineQueue, type DataPipelineBindings, type PipelineQueueMessage } from "./dataPipelineWorkflow";

export { UsageQuota };
export { DataRefreshWorkflow } from "./dataPipelineWorkflow";

const bindings = cloudflareEnv as Env;
configureQuotaNamespace(bindings.USAGE_QUOTA);
const databaseConfigured = Boolean(process.env.DATABASE_URL);

// Allow the static shell and health check to run before the database secret is
// supplied. API routes clearly return 503 until DATABASE_URL is configured.
if (!databaseConfigured) {
  process.env.DATABASE_URL =
    "postgresql://unconfigured:unconfigured@127.0.0.1:5432/unconfigured";
}
const [{ createApp }, { configureCloudflareEmail }, { configureWorkersAI, isWorkersAIConfigured }, seo] = await Promise.all([
  import("./app"),
  import("./emailService"),
  import("./aiClient"),
  import("./seoMetaTags"),
]);

configureCloudflareEmail(bindings.EMAIL);
configureWorkersAI(bindings.AI);

const { httpServer } = await createApp({ runtime: "cloudflare" });
const workerPort = 8787;
httpServer.listen(workerPort);
const expressHandler = httpServerHandler({ port: workerPort });
const PUBLIC_CACHE_REVISION = "2026-08-30-versioned-market-v4";

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
  if (pathname === "/api/stats/platform") return 600;
  if (pathname === "/api/units/top-opportunities") return 300;
  if (pathname === "/api/products") return 600;
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

function lastKnownGoodKey(request: Request): Request {
  const key = new URL(cacheKeyFor(request).url);
  key.searchParams.set("__rd_snapshot", "last-known-good");
  return new Request(key.toString(), { method: "GET" });
}

function clientApiHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  // Keep dynamic JSON out of browser caches. Edge reuse is handled explicitly
  // through Cache API entries below and is unaffected by this client policy.
  headers.set("cache-control", "private, no-store, max-age=0, must-revalidate");
  return headers;
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
  const snapshotKey = key && pathname.startsWith("/api/market/") ? lastKnownGoodKey(request) : null;

  if (key) {
    const cached = await cache.match(key);
    if (cached) {
      const headers = clientApiHeaders(cached.headers);
      headers.set("x-rd-cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  const nodeRequest = request as Request<unknown, IncomingRequestCfProperties>;
  let response: Response;
  try {
    response = await expressHandler.fetch!(nodeRequest, env, ctx);
  } catch (error) {
    if (snapshotKey) {
      const snapshot = await cache.match(snapshotKey);
      if (snapshot) {
        const headers = clientApiHeaders(snapshot.headers);
        headers.set("x-rd-cache", "STALE-SNAPSHOT");
        headers.set("x-rd-match-mode", "stale_snapshot");
        headers.set("warning", '110 - "Serving last known good published snapshot"');
        console.error(JSON.stringify({ level: "error", event: "backend_snapshot_fallback", pathname, message: error instanceof Error ? error.message : String(error) }));
        if (new URL(request.url).searchParams.get("envelope") === "1" && (headers.get("content-type") || "").includes("application/json")) {
          const payload = await snapshot.clone().json() as Record<string, unknown>;
          payload.matchMode = "stale_snapshot";
          payload.fallbackReason = "The current data service is unavailable. This is the last known good published snapshot.";
          payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []), "Serving a stale snapshot while the current data path recovers."];
          return Response.json(payload, { status: 200, headers });
        }
        return new Response(snapshot.body, { status: 200, headers });
      }
    }
    throw error;
  }
  if ((!response.ok || response.status >= 500) && snapshotKey) {
    const snapshot = await cache.match(snapshotKey);
    if (snapshot) {
      const headers = clientApiHeaders(snapshot.headers);
      headers.set("x-rd-cache", "STALE-SNAPSHOT");
      headers.set("x-rd-match-mode", "stale_snapshot");
      headers.set("warning", '110 - "Serving last known good published snapshot"');
      if (new URL(request.url).searchParams.get("envelope") === "1" && (headers.get("content-type") || "").includes("application/json")) {
        const payload = await snapshot.clone().json() as Record<string, unknown>;
        const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
        payload.matchMode = "stale_snapshot";
        payload.fallbackReason = "The current data service is unavailable. This is the last known good published snapshot.";
        payload.warnings = [...warnings, "Serving a stale snapshot while the current data path recovers."];
        return Response.json(payload, { status: 200, headers });
      }
      return new Response(snapshot.body, { status: 200, headers });
    }
  }
  if (!key || !ttl || !response.ok || response.headers.has("set-cookie")) return response;

  const headers = new Headers(response.headers);
  // Browser clients must revalidate after a manual dataset publication. The
  // Worker cache still absorbs repeated requests at the edge for `ttl` seconds.
  headers.set("cache-control", `public, max-age=0, must-revalidate, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`);
  headers.set("x-rd-cache", "MISS");
  const cacheable = new Response(response.body, { status: response.status, headers });
  ctx.waitUntil(cache.put(key, cacheable.clone()));
  if (snapshotKey) {
    const snapshotHeaders = new Headers(cacheable.headers);
    snapshotHeaders.set("cache-control", "public, max-age=604800");
    ctx.waitUntil(cache.put(snapshotKey, new Response(cacheable.clone().body, { status: cacheable.status, headers: snapshotHeaders })));
  }
  return new Response(cacheable.body, {
    status: cacheable.status,
    headers: clientApiHeaders(cacheable.headers),
  });
}

function isDocumentRequest(request: Request): boolean {
  return request.method === "GET" && (request.headers.get("accept") || "").includes("text/html");
}

function protectDocumentResponse(response: Response, cacheControl: string): Response {
  const headers = new Headers(response.headers);
  // The public zone previously injected Cloudflare JavaScript Detections into
  // HTML documents. Some legitimate browsers then received bot challenges for
  // the page's same-origin JSON requests, while the direct workers.dev hostname
  // remained healthy. `no-transform` keeps edge services from rewriting the
  // application shell; API, asset, DDoS, and Worker rate-limit behavior is
  // unchanged.
  headers.set("cache-control", `${cacheControl}, no-transform`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveDocument(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const normalized = new URL(request.url);
    normalized.pathname = normalized.pathname.replace(/\/+$/, "");
    return Response.redirect(normalized.toString(), 301);
  }

  const assetResponse = await bindings.ASSETS.fetch(request);
  if (!assetResponse.ok || !databaseConfigured) {
    return protectDocumentResponse(assetResponse, "public, max-age=0, must-revalidate");
  }

  try {
    const html = await assetResponse.clone().text();
    const entityPage = seo.isDatabaseBackedPagePath(url.pathname);
    const metadata = entityPage
      ? await seo.getDatabaseBackedMetaForUrl(`${url.pathname}${url.search}`)
      : await seo.getMetaForUrl(`${url.pathname}${url.search}`);
    const headers = new Headers(assetResponse.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    if (!metadata) {
      headers.set("cache-control", "no-store, no-transform");
      headers.set("x-robots-tag", "noindex, follow, noarchive");
      headers.set("vary", "Accept");
      return new Response(html, { status: 404, headers });
    }

    const canonicalPathname = metadata.canonicalPath.split("?")[0];
    if (canonicalPathname !== url.pathname) {
      const canonicalUrl = new URL(metadata.canonicalPath, url.origin);
      return Response.redirect(canonicalUrl.toString(), 301);
    }

    headers.set("cache-control", "public, max-age=60, stale-while-revalidate=300, no-transform");
    headers.set("vary", "Accept");
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    if (metadata.robots) headers.set("x-robots-tag", metadata.robots);
    return new Response(seo.injectMetaTags(html, metadata, url.origin), {
      status: assetResponse.status,
      headers,
    });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", source: "seo", message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }));
    return protectDocumentResponse(assetResponse, "public, max-age=0, must-revalidate");
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        runtime: "cloudflare-workers",
        databaseConfigured,
        emailConfigured: Boolean(bindings.EMAIL),
        aiConfigured: isWorkersAIConfigured(),
      });
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
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await handleDataPipelineQueue(batch as MessageBatch<PipelineQueueMessage>, env as unknown as DataPipelineBindings);
  },
} satisfies ExportedHandler<Env>;
