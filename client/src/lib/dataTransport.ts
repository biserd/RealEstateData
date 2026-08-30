const API_PREFIX = "/api/";
const DATA_PREFIX = "/_data/";

function requestMethod(init?: RequestInit): string {
  return (init?.method || "GET").toUpperCase();
}

function rewriteSameOriginGet(input: RequestInfo | URL, init?: RequestInit): RequestInfo | URL {
  if (requestMethod(init) !== "GET") return input;

  if (typeof input === "string" && input.startsWith(API_PREFIX)) {
    return `${DATA_PREFIX}${input.slice(API_PREFIX.length)}`;
  }

  if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith(API_PREFIX)) {
    const rewritten = new URL(input);
    rewritten.pathname = `${DATA_PREFIX}${input.pathname.slice(API_PREFIX.length)}`;
    return rewritten;
  }

  return input;
}

/**
 * Keep browser data reads on a neutral same-origin route. Cloudflare maps the
 * route back to `/api/*` before the existing crawler, rate-limit, cache, auth,
 * and Express handlers run. Writes remain on their explicit `/api/*` routes.
 */
export function installDataTransport(): void {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    nativeFetch(rewriteSameOriginGet(input, init), init);
}

