import snapshotData from "./publishedSitemapSnapshot.json";
import { getStaticSitemapEntries, type PageMeta } from "./seoMetaTags";
import { escapeSitemapXml, SITEMAP_ORIGIN, SITEMAP_PAGE_SIZE, type SitemapRecord, type SitemapSnapshot } from "./sitemapSnapshot";

export const publishedSitemap = snapshotData as SitemapSnapshot;
const namespace = "http://www.sitemaps.org/schemas/sitemap/0.9";
const publishedDate = publishedSitemap.publishedAt.slice(0, 10);
type Entry = { path: string; lastmod: string };
const sections = new Map<string, Entry[]>();
sections.set("/sitemap-static.xml", getStaticSitemapEntries());
const entriesByPath = new Map<string, SitemapRecord>();

function addSection(path: string, records: SitemapRecord[]) {
  if (!records.length) return;
  sections.set(path, records.map(([path, lastmod]) => ({ path, lastmod })));
  for (const record of records) entriesByPath.set(record[0], record);
}

for (const [kind, records] of [["properties", publishedSitemap.properties], ["units", publishedSitemap.units]] as const) {
  for (let offset = 0; offset < records.length; offset += SITEMAP_PAGE_SIZE) {
    addSection(`/sitemap-${kind}-${offset / SITEMAP_PAGE_SIZE + 1}.xml`, records.slice(offset, offset + SITEMAP_PAGE_SIZE));
  }
}
addSection("/sitemap-browse.xml", publishedSitemap.browse);
addSection("/sitemap-neighborhoods.xml", publishedSitemap.neighborhoods);

function xml(root: "sitemapindex" | "urlset", item: "sitemap" | "url", entries: Entry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="${namespace}">\n` +
    entries.map(({ path, lastmod }) =>
      `  <${item}><loc>${escapeSitemapXml(SITEMAP_ORIGIN + path)}</loc><lastmod>${lastmod}</lastmod></${item}>`
    ).join("\n") + `\n</${root}>\n`;
}

export function isSitemapPath(path: string) {
  return /^\/sitemap(?:-[^/]+)?\.xml$/.test(path);
}

const index = xml("sitemapindex", "sitemap", [...sections].map(([path, entries]) => ({
  path, lastmod: entries.reduce((latest, entry) => entry.lastmod > latest ? entry.lastmod : latest, publishedDate),
})));
const sectionXml = new Map<string, string>();

export function getSitemapXml(path: string): string | undefined {
  if (path === "/sitemap.xml") return index;
  const cached = sectionXml.get(path);
  if (cached) return cached;
  const section = sections.get(path);
  if (!section) return;
  const content = xml("urlset", "url", section);
  sectionXml.set(path, content);
  return content;
}

export function getPublishedPageFallback(pathname: string, search: string): PageMeta | undefined {
  const neighborhood = pathname.startsWith("/neighborhood/");
  if (neighborhood && new URLSearchParams(search).get("geoType") !== "zip") return;
  const record = entriesByPath.get(pathname + (neighborhood ? "?geoType=zip" : ""));
  if (!record) return;
  const [path, , label, salePrice, saleDate] = record;
  const sale = salePrice && saleDate
    ? `A verified sale was recorded for ${new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", maximumFractionDigits: 0,
      }).format(salePrice)} on ${saleDate}.`
    : "Explore published NYC property records and recorded sales for this area.";
  return {
    title: `${label} | Realtors Dashboard`,
    h1: label,
    description: `${label}. ${sale}`.slice(0, 158),
    canonicalPath: path,
    ogType: "website",
    bodyHtml: `<p>${escapeSitemapXml(sale)}</p><p>NYC public records, published ${publishedDate}. ` +
      `<a href="/methodology/data-coverage">Data coverage and sources</a></p>`,
  };
}
