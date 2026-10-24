const SITE_ORIGIN = "https://realtorsdashboard.com";
const CATALOG_PATH = "/.well-known/api-catalog";
const SPEC_PATH = "/openapi.json";

export const API_CATALOG_LINK = `<${CATALOG_PATH}>; rel="api-catalog"; type="application/linkset+json"`;
export const API_SPEC_LINK = `<${SPEC_PATH}>; rel="service-desc"; type="application/json"`;
export const ARD_LINK = `</.well-known/ard.json>; rel="ard"; type="application/json"`;
export const AI_CATALOG_LINK = `</.well-known/ai-catalog.json>; rel="ai-catalog"; type="application/json"`;

/** RFC 9727 catalog: only the existing, documented partner API is advertised. */
export function apiCatalog(): { linkset: Array<Record<string, unknown>> } {
  return {
    linkset: [
      {
        anchor: `${SITE_ORIGIN}${CATALOG_PATH}`,
        item: [
          { href: `${SITE_ORIGIN}/api/external/properties` },
          { href: `${SITE_ORIGIN}/api/external/market-stats` },
          { href: `${SITE_ORIGIN}/api/external/up-and-coming` },
        ],
      },
      {
        anchor: `${SITE_ORIGIN}/api/external/properties`,
        "service-desc": [{ href: `${SITE_ORIGIN}${SPEC_PATH}`, type: "application/json" }],
        "service-doc": [{ href: `${SITE_ORIGIN}/developers`, type: "text/html" }],
      },
    ],
  };
}

export function appendApiDiscoveryLinks(headers: Headers, includeSpec = false): void {
  headers.append("link", API_CATALOG_LINK);
  headers.append("link", ARD_LINK);
  headers.append("link", AI_CATALOG_LINK);
  if (includeSpec) headers.append("link", API_SPEC_LINK);
}

export function apiCatalogResponse(request: Request): Response {
  const url = new URL(request.url);
  if (url.hostname === "www.realtorsdashboard.com") {
    return Response.redirect(`${SITE_ORIGIN}${CATALOG_PATH}`, 301);
  }
  const headers = new Headers({
    "content-type": 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    "cache-control": "public, max-age=300, must-revalidate",
    "x-content-type-options": "nosniff",
  });
  appendApiDiscoveryLinks(headers, true);
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  return new Response(JSON.stringify(apiCatalog()), { status: 200, headers });
}
