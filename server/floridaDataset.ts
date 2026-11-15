import { floridaCounties, floridaSource, floridaUses, floridaZip, type FloridaMarketProfile } from "../shared/floridaSales";
import { getFloridaInsights } from "./floridaInsights";
import { SITEMAP_ORIGIN } from "./sitemapSnapshot";
import { DatasetError } from "./datasetError";

export type ActiveFloridaRelease = { id: string; source_updated_at: string; start_month: string; published_at: string };
export type FloridaCoverageRow = { county_code: number; records: number; latest_month: string };
export type FloridaSaleRow = { parcel_id: string; address: string; city: string; zip: string; property_use: keyof typeof floridaUses; sale_month: string; price: number };

export const floridaCountyBySlug = new Map(floridaCounties.map(county => [county.slug, county]));

export function activeFloridaRelease(db: D1Database) {
  return db.prepare("SELECT id, source_updated_at, start_month, published_at FROM florida_releases WHERE published_at IS NOT NULL")
    .first<ActiveFloridaRelease>();
}

export async function floridaCoverage(db: D1Database, release: string) {
  const rows = await db.prepare("SELECT county_code, records, latest_month FROM florida_coverage WHERE release_id = ?")
    .bind(release).all<FloridaCoverageRow>();
  if (!floridaCounties.every(county => rows.results.some(row => row.county_code === county.code))) {
    throw new DatasetError(503, "Incomplete Florida county coverage.");
  }
  return new Map(rows.results.map(row => [row.county_code, row]));
}

function countyFor(slug: string) {
  const county = floridaCountyBySlug.get(slug);
  if (!county) throw new DatasetError(404, "No published Florida county matches this slug.");
  return county;
}

async function requireRelease(db: D1Database | undefined) {
  if (!db) throw new DatasetError(503, "The Florida publication is temporarily unavailable.");
  const release = await activeFloridaRelease(db);
  if (!release) throw new DatasetError(503, "The Florida publication is temporarily unavailable.");
  return { db, release };
}

function provenance(release: ActiveFloridaRelease) {
  return {
    id: "florida-recorded-sales", releaseId: release.id, publishedAt: release.published_at,
    sourceUpdatedAt: release.source_updated_at, firstSaleMonth: release.start_month,
    datePrecision: "month", currency: "USD", sourceName: "Florida Department of Revenue",
    sourceUrl: floridaSource,
  };
}

export async function floridaCountyInventory(database: D1Database | undefined) {
  const { db, release } = await requireRelease(database);
  const coverage = await floridaCoverage(db, release.id);
  const counties = floridaCounties.map(county => {
    const area = coverage.get(county.code)!;
    return { ...county, records: area.records, latestSaleMonth: area.latest_month, url: SITEMAP_ORIGIN + "/florida/" + county.slug };
  });
  return { dataset: provenance(release), totalRecords: counties.reduce((total, item) => total + item.records, 0),
    counties, propertyTypes: floridaUses };
}

function priceStats(profile: { records: number; median: number; p25: number; p75: number }) {
  const eligible = profile.records >= 10;
  return { records: profile.records, medianPriceUsd: eligible ? profile.median : null,
    p25PriceUsd: eligible ? profile.p25 : null, p75PriceUsd: eligible ? profile.p75 : null };
}

function marketProfile(profile: FloridaMarketProfile) {
  return { ...priceStats(profile), zipCount: profile.zipCount,
    propertyTypes: profile.propertyTypes.map(row => ({ type: row.key, ...priceStats(row) })),
    recentMonths: profile.recentMonths.map(row => ({ month: row.key, ...priceStats(row) })),
  };
}

export async function floridaSaleProfile(database: D1Database | undefined, countySlug?: string) {
  const county = countySlug ? countyFor(countySlug) : undefined;
  const { db, release } = await requireRelease(database);
  const coverage = await floridaCoverage(db, release.id);
  const snapshot = getFloridaInsights(release.id, coverage);
  if (!snapshot) throw new DatasetError(503, "Florida price profiles do not yet match the active sales release.");
  const details = county && snapshot.counties[county.code];
  return { dataset: provenance(release), county: county ?? null,
    url: SITEMAP_ORIGIN + (county ? "/florida/" + county.slug : "/florida"),
    profile: {
      ...marketProfile(details || snapshot.statewide),
      ...(details && {
        topZips: details.topZips.map(row => ({ zip: row.key, ...priceStats(row) })),
        topCities: details.topCities.map(row => ({ city: row.key, ...priceStats(row) })),
        neighboringCounties: floridaCounties.filter(area => details.neighbors.includes(area.code)),
      }),
    },
  };
}

type SaleFilters = {
  county: string; zip?: string; city?: string; q?: string; type?: string; from?: string; to?: string;
  cursor?: string; limit: number;
};
type PageCursor = [string, number, string, string, string];

function parseCursor(cursor: string): PageCursor {
  try {
    const data = JSON.parse(cursor);
    if (Array.isArray(data) && data.length === 5 && typeof data[0] === "string" && Number.isInteger(data[1]) &&
        typeof data[2] === "string" && /^[0-9]{4}-[0-9]{2}$/.test(data[2]) &&
        typeof data[3] === "string" && data[3].length <= 80 && typeof data[4] === "string") return data as PageCursor;
  } catch { /* Return a validation error for invalid cursors. */ }
  throw new DatasetError(400, "Use the next cursor returned with your previous results.");
}

async function filterFingerprint(filters: SaleFilters) {
  const { zip, city, q, type, from, to } = filters;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([zip, city, q, type, from, to])));
  return [...new Uint8Array(bytes).slice(0, 12)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function floridaRecordedSales(database: D1Database | undefined, filters: SaleFilters) {
  const { zip, city, q, type, from, to, cursor, limit } = filters;
  if (zip && !floridaZip.test(zip)) throw new DatasetError(400, "Use a Florida ZIP code.");
  if (from && to && from > to) throw new DatasetError(400, "The first sale month must be before or equal to the last.");
  const county = countyFor(filters.county);
  const { db, release } = await requireRelease(database);
  const fingerprint = await filterFingerprint(filters);
  const where = ["release_id = ?", "county_code = ?"];
  const args: (number | string)[] = [release.id, county.code];
  if (zip) { where.push("zip = ?"); args.push(zip); }
  if (city) { where.push("upper(city) = upper(?)"); args.push(city); }
  if (q) { where.push("instr(lower(address || ' ' || city), lower(?)) > 0"); args.push(q); }
  if (type) { where.push("property_use = ?"); args.push(type); }
  if (from) { where.push("sale_month >= ?"); args.push(from); }
  if (to) { where.push("sale_month <= ?"); args.push(to); }
  if (cursor) {
    const [id, code, month, parcel, hash] = parseCursor(cursor);
    if (id !== release.id) throw new DatasetError(409, "The Florida release changed. Restart the search without a cursor.");
    if (code !== county.code || hash !== fingerprint) throw new DatasetError(400, "Use the same county and filters as the previous page.");
    where.push("(sale_month < ? OR (sale_month = ? AND parcel_id > ?))");
    args.push(month, month, parcel);
  }
  const { results } = await db.prepare("SELECT parcel_id, address, city, zip, property_use, sale_month, price FROM florida_sales WHERE " +
    where.join(" AND ") + " ORDER BY sale_month DESC, parcel_id ASC LIMIT ?").bind(...args, limit + 1).all<FloridaSaleRow>();
  const page = results.slice(0, limit);
  const last = page.at(-1);
  return {
    dataset: provenance(release), county, url: SITEMAP_ORIGIN + "/florida/" + county.slug,
    records: page.map(row => ({ parcelId: row.parcel_id, address: row.address, city: row.city, state: "FL", zip: row.zip,
      propertyUse: row.property_use, propertyType: floridaUses[row.property_use], saleMonth: row.sale_month, salePriceUsd: row.price })),
    pagination: { limit, count: page.length,
      nextCursor: last && results.length > limit ? JSON.stringify([release.id, county.code, last.sale_month, last.parcel_id, fingerprint]) : null },
  };
}
