import { createSign } from "node:crypto";
import { SITE } from "./seo-editorial";

const PROPERTY = "sc-domain:" + new URL(SITE).hostname;
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_ANALYTICS = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`;

export const day = (offset = 0, from = Date.now()) =>
  new Date(from + offset * 86_400_000).toISOString().slice(0, 10);

async function json<T>(url: string, source: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function searchConsoleToken(secret: string) {
  const { client_email, private_key } = JSON.parse(secret);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: TOKEN_URL, iat: now, exp: now + 600,
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = encode({ alg: "RS256", typ: "JWT" }) + "." + encode(payload);
  const signature = createSign("RSA-SHA256").update(claims).sign(private_key, "base64url");
  const result = await json<{ access_token: string }>(TOKEN_URL, "Google OAuth", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: claims + "." + signature,
    }),
  });
  if (!result.access_token) throw new Error("Google OAuth returned no access token");
  return result.access_token;
}

export interface SearchRow {
  keys: string[];
  impressions: number;
  ctr: number;
  position: number;
}

export async function searchAnalytics(
  token: string, startDate: string, endDate: string, dimensions: string[], page?: string,
) {
  const result = await json<{ rows?: SearchRow[] }>(SEARCH_ANALYTICS, "Search Console", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate, endDate, dimensions, rowLimit: 5000, dataState: "final",
      dimensionFilterGroups: page ? [{ filters: [{ dimension: "page", operator: "equals", expression: page }] }] : undefined,
    }),
  });
  return result.rows ?? [];
}

export interface OrganicResult {
  title: string;
  link: string;
  snippet: string;
}

export async function googleResults(key: string, query: string) {
  const result = await json<{ organic?: OrganicResult[] }>("https://google.serper.dev/search", "Google results provider", {
    method: "POST", headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 5 }),
  });
  return (result.organic ?? []).slice(0, 3);
}

export async function googlePageOutline(key: string, url: string) {
  if (!url.startsWith("https://")) throw new Error("Search result URL is not HTTPS");
  const result = await json<{ text?: string; markdown?: string }>("https://scrape.serper.dev", "Search result page retrieval", {
    method: "POST", headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ url, includeMarkdown: true }),
  });
  return (result.markdown || result.text || "").slice(0, 7_000);
}

interface ResponseBody {
  output: { type: string; content?: { type: string; text?: string; annotations?: { type: string; url: string }[] }[] }[];
}

export async function modelResponse(key: string, instructions: string, input: unknown, search = false) {
  const body = await json<ResponseBody>("https://api.openai.com/v1/responses", "OpenAI Responses", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5-mini", instructions, input: typeof input === "string" ? input : JSON.stringify(input),
      store: false, max_output_tokens: 4500,
      tools: search ? [{ type: "web_search" }] : undefined,
      tool_choice: search ? { type: "web_search" } : undefined,
      text: search ? undefined : { format: { type: "json_object" } },
    }),
  });
  const content = body.output.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text");
  const text = content.map((item) => item.text).join("\n");
  if (!text || (search && !body.output.some((item) => item.type === "web_search_call"))) {
    throw new Error("OpenAI Responses did not return a usable answer");
  }
  return {
    text,
    urls: content.flatMap((item) => item.annotations ?? []).filter((annotation) => annotation.type === "url_citation")
      .map((annotation) => annotation.url),
  };
}
