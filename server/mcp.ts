import {
  AuthorizationError, CimdFetchError, insufficientScope, OAuthAuthorizationServer, OAuthResourceServer,
  type ConsentDescription,
} from "@cloudflare/workers-oauth-provider";
import { isJsonContentType, readRequestBody } from "@modelcontextprotocol/server";
import manifest from "../server.json";
import { createRealtorsMcp } from "./mcpTools";
import { storage } from "./storage";

const canonicalOrigin = new URL(manifest.remotes[0].url).origin;
const scope = "mcp:read";
const authorizePath = "/mcp/authorize";
const tokenPath = "/mcp/oauth/token";
const registrationPath = "/mcp/oauth/register";
const authorizationMetadata = "/.well-known/oauth-authorization-server";
const resourceMetadata = "/.well-known/oauth-protected-resource/mcp";
const oauthPaths = new Set([authorizePath, tokenPath, registrationPath, authorizationMetadata, resourceMetadata]);
const maxBodyBytes = 16 * 1024;
const publicHandler = createRealtorsMcp();

export function isMcpPath(pathname: string) {
  return pathname === "/mcp" || pathname === "/server.json" || oauthPaths.has(pathname);
}

function isToolCall(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "method" in value && value.method === "tools/call");
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function consentPage(details: ConsentDescription, handle: string, email: string) {
  const client = escape(details.clientName);
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to Realtors Dashboard</title>
<main>
<h1>Connect ${client} to Realtors Dashboard?</h1>
<p>Signed in as ${escape(email)}.</p>
<p>${details.clientDomain ? `Client domain: <strong>${escape(details.clientDomain)}</strong>.` : "This client supplied its own name."}
The connection returns to <strong>${escape(details.redirectHost)}</strong>.</p>
${details.redirectIsLoopback ? "<p>This sends access to an app on your computer. Continue only if you started the connection there.</p>" : ""}
<p>Allow this client to read published NYC market data using your account’s search allowance.</p>
<form method="post" action="${authorizePath}">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <button name="decision" value="approve">Allow access</button>
  <button name="decision" value="deny">Decline</button>
</form>
</main></html>`;
}

function privateResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(response.body, { status: response.status, headers });
}

function makeOAuth(issuer: string) {
  const resource = `${issuer}/mcp`;
  const authorization = new OAuthAuthorizationServer<Env>({
    issuer,
    resources: [resource],
    defaultResource: resource,
    authorizeEndpoint: authorizePath,
    tokenEndpoint: tokenPath,
    clientRegistrationEndpoint: registrationPath,
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: [scope],
  });
  const protectedResource = new OAuthResourceServer<Env>({
    resourceMetadata: {
      resource,
      resource_name: manifest.title,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
    },
    requiredScopes: [scope],
    validateToken: (env) => (audience, token) => authorization.validateToken(audience, token, env),
    handler: {
      async fetch(request, _env, ctx) {
        if (!ctx.auth.scope.includes(scope)) return insufficientScope(ctx.auth, [scope]);
        const user = ctx.auth.userId && await storage.getUser(ctx.auth.userId);
        if (!user || (user.status && user.status !== "active")) {
          return Response.json({ error: "access_denied" }, { status: 403 });
        }
        const tier = user.subscriptionStatus === "active" &&
          (user.subscriptionTier === "pro" || user.subscriptionTier === "premium")
          ? user.subscriptionTier : "free";
        return createRealtorsMcp({ id: user.id, tier }).fetch(request);
      },
    },
  });
  return { authorization, protectedResource };
}

const productionOAuth = makeOAuth(canonicalOrigin);

async function authorize(
  request: Request, url: URL, env: Env, authorization: OAuthAuthorizationServer<Env>,
  sessionLookup: (request: Request) => Promise<Response>,
) {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  }
  if (request.method === "POST" && request.headers.get("origin") !== url.origin) {
    return new Response("Invalid consent origin.", { status: 403 });
  }
  const oauth = authorization.getOAuthApi(env);
  try {
    const authRequest = request.method === "GET" ? await oauth.parseAuthRequest(request) : null;
    if (authRequest && (!authRequest.codeChallenge || authRequest.codeChallengeMethod !== "S256")) {
      return new Response("This connection requires S256 PKCE.", { status: 400 });
    }

    const session = await sessionLookup(request);
    if (session.status === 401 || session.status === 404) {
      if (request.method === "POST") return new Response("Session expired. Reopen the connection from your MCP client.", { status: 401 });
      const login = new URL("/login", url.origin);
      login.searchParams.set("returnTo", url.pathname + url.search);
      return Response.redirect(login.href, 302);
    }
    if (!session.ok) return new Response("Sign-in is temporarily unavailable.", { status: 503 });
    const accountId = session.headers.get("X-RD-Account-Id");
    const account = accountId && await storage.getUser(accountId);
    if (!account || (account.status && account.status !== "active")) {
      return new Response("An active Realtors Dashboard account is required.", { status: 403 });
    }

    if (authRequest) {
      if (authRequest.scope.some((requested) => requested !== scope)) {
        return new Response("This connection requests an unsupported scope.", { status: 400 });
      }
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      consent.headers.set("Content-Type", "text/html; charset=utf-8");
      consent.headers.set("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      return new Response(consentPage(details, consent.handle, account.email), { headers: consent.headers });
    }

    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      return new Response(null, { status: 415 });
    }
    const body = await readRequestBody(request, maxBodyBytes);
    if (body.tooLarge) return new Response(null, { status: 413 });
    const form = new URLSearchParams(body.text);
    const handle = form.get("handle") || "";
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 303, headers: denied.headers });
    }
    const approved = await oauth.approveConsent(request, handle, { scope: [scope] });
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request, userId: account.id, scope: [scope], metadata: {}, props: {},
    });
    approved.headers.set("Location", redirectTo);
    return new Response(null, { status: 303, headers: approved.headers });
  } catch (error) {
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
      return new Response("This connection could not be verified. Start again from your MCP client.", { status: 400 });
    }
    console.error("Realtors Dashboard MCP authorization failed", error instanceof Error ? error.name : "UnknownError");
    return new Response("Authorization is temporarily unavailable.", { status: 503 });
  }
}

export async function handleMcpRequest(
  request: Request, env: Env, ctx: ExecutionContext, sessionLookup: (request: Request) => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname === "/server.json") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    return new Response(request.method === "HEAD" ? null : JSON.stringify(manifest), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
    });
  }

  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!loopback && url.origin !== canonicalOrigin) {
    return privateResponse(new Response("Use https://realtorsdashboard.com/mcp.", { status: 404 }));
  }
  const { authorization, protectedResource } = loopback ? makeOAuth(url.origin) : productionOAuth;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const isOAuthWrite = pathname === authorizePath || pathname === registrationPath || pathname === tokenPath;
  const limiter = isOAuthWrite ? env.AUTH_RATE_LIMIT : env.EXTERNAL_API_RATE_LIMIT;
  if (!(await limiter.limit({ key: `mcp:${ip}` })).success) {
    return privateResponse(Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": isOAuthWrite ? "60" : "10" } }));
  }
  if (pathname === authorizePath) return privateResponse(await authorize(request, url, env, authorization, sessionLookup));
  if (pathname === resourceMetadata) return privateResponse(await protectedResource.fetch(request, env, ctx));
  if (pathname !== "/mcp") return privateResponse(await authorization.fetch(request, env, ctx));

  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return privateResponse(new Response("Invalid origin.", { status: 403 }));
  if (request.method !== "POST" || !isJsonContentType(request.headers.get("Content-Type"))) {
    return privateResponse(await publicHandler.fetch(request));
  }

  const body = await readRequestBody(request, maxBodyBytes);
  if (body.tooLarge) return privateResponse(new Response(null, { status: 413 }));
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body.text);
  } catch {
    return privateResponse(Response.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }, { status: 400 }));
  }
  if (isToolCall(parsedBody) || (Array.isArray(parsedBody) && parsedBody.some(isToolCall))) {
    const authenticatedRequest = new Request(request.url, { method: request.method, headers: request.headers, body: body.text });
    return privateResponse(await protectedResource.fetch(authenticatedRequest, env, ctx));
  }
  return privateResponse(await publicHandler.fetch(request, { parsedBody }));
}
