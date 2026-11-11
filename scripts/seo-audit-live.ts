import { GUIDES } from "../shared/guides";
import { METHODOLOGY, SITE } from "./seo-editorial";
import { setTimeout as delay } from "node:timers/promises";

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((match) => match[1].trim());
const safeUrl = (url: string) => {
  try { return new URL(url).origin === SITE; } catch { return false; }
};
const decode = (value: string) => value.replace(/&(?:amp|lt|gt|quot|apos|#(?:39|x27));/gi, (entity) => ({
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&#x27;": "'",
})[entity.toLowerCase()] ?? entity);
const tagValue = (html: string, name: string) =>
  decode((html.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\/${name}>`, "i"))?.[1] ?? "").replace(/<[^>]+>/g, "").trim());
const attribute = (tag: string, name: string) =>
  decode(tag.match(new RegExp(`(?:^|\\s)${name}=(["'])(.*?)\\1`, "i"))?.[2] ?? "");

async function get(url: string, accept: string) {
  const request = () => fetch(url, {
    redirect: "manual",
    headers: { Accept: accept, "User-Agent": "RealtorsDashboard-SEOMonitor/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  const response = await request().catch(() => undefined);
  if (response && response.status < 500) return response;
  await response?.body?.cancel();
  await delay(2000);
  return request();
}

export async function pageSeo(url: string) {
  const response = await get(url, "text/html");
  const html = response.ok ? await response.text() : "";
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const meta = html.match(/<meta\b[^>]*>/gi) ?? [];
  const canonical = links.filter((tag) => attribute(tag, "rel") === "canonical").map((tag) => attribute(tag, "href"));
  const robots = meta.filter((tag) => /^(robots|googlebot)$/i.test(attribute(tag, "name")))
    .map((tag) => attribute(tag, "content")).concat(response.headers.get("x-robots-tag") ?? "").join(",");
  return {
    status: response.status, html, canonical, noindex: /\bnoindex\b/i.test(robots),
    title: tagValue(html, "title"), h1: tagValue(html, "h1"),
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    headings: [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => decode(match[1].replace(/<[^>]+>/g, "").trim())),
    description: attribute(meta.find((tag) => attribute(tag, "name") === "description") ?? "", "content"),
  };
}

export async function readSitemaps() {
  const index = await get(SITE + "/sitemap.xml", "application/xml").catch(() => {
    throw new Error("Sitemap index connection failed after retry");
  });
  if (!index.ok) throw new Error(`Sitemap index returned HTTP ${index.status}${index.headers.get("cf-mitigated") === "challenge" ? " (Cloudflare challenge)" : ""}`);
  const children = index.ok ? locs(await index.text()) : [];
  if (!children.length || children.length > 50 || children.some((url) => !safeUrl(url) || !new URL(url).pathname.endsWith(".xml"))) {
    throw new Error("Sitemap index did not contain valid child XML URLs");
  }
  const urls = new Set<string>();
  const issues: string[] = [];
  for (const child of children) {
    const response = await get(child, "application/xml").catch(() => undefined);
    const xml = response?.ok ? await response.text() : "";
    if (!/<urlset\b/i.test(xml)) {
      issues.push(`${new URL(child).pathname}: ${response ? `HTTP ${response.status} or invalid XML` : "connection failed"}`);
      continue;
    }
    for (const loc of locs(xml)) {
      const url = decode(loc);
      if (!safeUrl(url)) issues.push("Sitemap contains an off-site URL");
      else if (urls.has(url)) issues.push(`Duplicate sitemap URL ${new URL(url).pathname}`);
      else urls.add(url);
    }
  }
  return { urls, issues, count: children.length };
}

export function googlebotAllows(robots: string, path: string) {
  const groups: { agents: string[]; rules: { allow: boolean; pattern: string }[] }[] = [];
  let group = { agents: [] as string[], rules: [] as { allow: boolean; pattern: string }[] };
  for (const line of robots.split(/\r?\n/)) {
    const match = line.replace(/#.*$/, "").match(/^\s*(user-agent|disallow|allow):\s*(.*?)\s*$/i);
    if (!match) continue;
    const [, directive, value] = match;
    if (directive.toLowerCase() === "user-agent") {
      if (!group.agents.length || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length) {
      group.rules.push({ allow: directive.toLowerCase() === "allow", pattern: value });
    }
  }
  const specific = groups.filter((item) => item.agents.includes("googlebot"));
  const applicable = specific.length ? specific : groups.filter((item) => item.agents.includes("*"));
  const matches = applicable.flatMap((item) => item.rules).filter(({ pattern }) => {
    if (!pattern) return false;
    const anchored = pattern.endsWith("$");
    const expression = (anchored ? pattern.slice(0, -1) : pattern).split("*")
      .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")).join(".*");
    return new RegExp("^" + expression + (anchored ? "$" : "")).test(path);
  });
  matches.sort((a, b) => b.pattern.length - a.pattern.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

export async function auditSite(date: string) {
  const issues: string[] = [];
  const sitemap = await readSitemaps().catch((error: Error) => ({
    urls: new Set<string>(), issues: [error.message], count: 0,
  }));
  issues.push(...sitemap.issues);
  const robots = await get(SITE + "/robots.txt", "text/plain").catch(() => undefined);
  const rules = robots?.ok ? await robots.text() : "";
  if (!rules.includes("Sitemap: " + SITE + "/sitemap.xml")) {
    issues.push("robots.txt is unavailable or lacks the production sitemap declaration");
  }
  const all = [...sitemap.urls];
  const entity = all.filter((url) => /\/(?:unit|properties)\//.test(url));
  const sampleOffset = Math.floor(Date.parse(date) / 86_400_000) * 97;
  const sampled = Array.from({ length: Math.min(entity.length, 8) },
    (_, i) => entity[(sampleOffset + Math.floor(i * entity.length / 8)) % entity.length]);
  const editorial = all.filter((url) => /^\/(?:guides|tools|comparisons)(?:\/|$)/.test(new URL(url).pathname));
  const expected = new Map(GUIDES.map((guide) => [SITE + "/guides/" + guide.slug, guide]));
  const targets = [...new Set([SITE + "/", METHODOLOGY.url, SITE + "/guides", SITE + "/comparisons", ...editorial, ...expected.keys(), ...sampled])];
  const repair: string[] = [];
  const usableEditorial = new Set<string>();
  for (const url of targets) {
    const path = new URL(url).pathname;
    if (!googlebotAllows(rules, path)) {
      issues.push(`${path}: robots.txt disallows Googlebot`);
      continue;
    }
    try {
      const page = await pageSeo(url);
      const problems = [
        page.status !== 200 && `HTTP ${page.status}`,
        page.status === 200 && (page.canonical.length !== 1 || page.canonical[0] !== url) && "canonical mismatch",
        page.status === 200 && page.noindex && "noindex",
        page.status === 200 && page.h1Count !== 1 && `${page.h1Count} H1 elements`,
        page.status === 200 && !page.title && "missing title",
        page.status === 200 && !page.description && "missing description",
      ].filter(Boolean);
      if (problems.length) issues.push(`${path}: ${problems.join(", ")}`);
      if (!problems.length && sitemap.urls.has(url)) usableEditorial.add(url);
      const guide = expected.get(url);
      if (!guide) continue;
      const missing = !sitemap.urls.has(url) && !sitemap.issues.length;
      if (missing) issues.push(`${path} is missing from the sitemap`);
      const matchesRepo = page.h1 === guide.title && page.title === guide.metaTitle &&
        (!guide.editorialSources?.length || (page.headings.includes("Additional references") &&
          guide.sections.every((section) => page.headings.includes(section.heading))));
      if (page.status === 200 && !matchesRepo) issues.push(`${path} differs from the committed guide`);
      if ((!problems.length && (!matchesRepo || missing))
        || (page.status === 404 && missing && guide.category === "Comparisons")) repair.push(path);
    } catch {
      issues.push(`${path}: production request failed`);
    }
  }
  return { issues, repair, usableEditorial, sitemapCount: sitemap.count, inventory: all.length, checked: targets.length, sampled: sampled.length };
}
