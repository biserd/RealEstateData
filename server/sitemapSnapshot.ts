export type SitemapRecord = [
  path: string,
  lastmod: string,
  label: string,
  salePrice?: number,
  saleDate?: string,
];

export interface SitemapSnapshot {
  datasetVersionId: string;
  publishedAt: string;
  properties: SitemapRecord[];
  units: SitemapRecord[];
  browse: SitemapRecord[];
  neighborhoods: SitemapRecord[];
}

export const SITEMAP_ORIGIN = "https://realtorsdashboard.com";
export const SITEMAP_PAGE_SIZE = 40000;

export function escapeSitemapXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
