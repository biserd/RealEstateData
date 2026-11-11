import { rename, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../server/db";
import { publicPropertyPageSql, publicUnitPageSql } from "../server/publicPageEligibility";
import { getStaticSitemapEntries, propertySlug } from "../server/seoMetaTags";
import { publishedHomepageSnapshot } from "../server/publishedHomepageSnapshot";
import { SITEMAP_ORIGIN, type SitemapRecord, type SitemapSnapshot } from "../server/sitemapSnapshot";

const target = "server/publishedSitemapSnapshot.json";

async function query<T>(statement: SQL): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    try { return (await db.execute(statement)).rows as T[]; }
    catch (error) {
      if (attempt >= 4 || !/overload|temporar|timeout|503|reset|internal error/i.test(String(error))) throw error;
      await delay(10_000 * (attempt + 1));
    }
  }
}

const release = async () => (await query<{ id: string; published_at: string }>(sql`
  SELECT id, published_at FROM current_published_dataset ORDER BY published_at DESC LIMIT 1
`))[0];

// Walk bounded ranges of raw IDs. Applying eligibility inside a fixed raw range
// keeps even sparse parts of the dataset from turning into a full table scan.
async function* eligibleRows(unit: boolean) {
  const table = unit ? sql.raw("condo_units") : sql.raw("properties");
  const key = unit ? sql.raw("unit_bbl") : sql.raw("id");
  const saleKey = unit ? sql.raw("unit_bbl") : sql.raw("property_id");
  const priceFloor = unit ? 100000 : 50000;
  const label = unit ? sql.raw("e.unit_display_address") : sql.raw("e.address");
  const fields = unit ? sql.raw("e.slug, e.borough AS city") : sql.raw("NULL AS slug, e.city");
  const state = unit ? sql`'NY'` : sql.raw("e.state");
  const eligibility = unit ? publicUnitPageSql("e") : publicPropertyPageSql("e");
  let cursor = "";
  for (;;) {
    const bounds = await query<{ end_id: string }>(sql`
      SELECT MAX(id) AS end_id FROM (
        SELECT ${key} AS id FROM ${table} WHERE ${key} > ${cursor} ORDER BY ${key} LIMIT 12000
      )
    `);
    const end = bounds[0]?.end_id;
    if (!end) return;
    const rows = await query<{
      id: string; label: string; city: string; state: string; zip_code: string; slug: string | null;
      updated: string | null; sale_price: number; sale_date: string;
    }>(sql`
      WITH eligible AS MATERIALIZED (
        SELECT e.${key} AS id, ${label} AS label, ${fields}, ${state} AS state, e.zip_code,
          e.updated_at, (
            SELECT s.id FROM sales s
            WHERE s.${saleKey} = e.${key}
              AND s.sale_price BETWEEN ${priceFloor} AND 100000000
              AND (s.source_id IS NOT NULL OR s.match_method IS NOT NULL OR s.raw_block IS NOT NULL OR s.raw_lot IS NOT NULL)
              AND NOT EXISTS (
                SELECT 1 FROM data_quality_quarantine q WHERE q.source_table = 'sales'
                  AND q.source_id = s.id AND q.review_status IN ('pending', 'rejected')
              )
            ORDER BY s.sale_date DESC, s.id DESC LIMIT 1
          ) AS sale_id
        FROM ${table} e WHERE e.${key} > ${cursor} AND e.${key} <= ${end} AND ${eligibility}
      )
      SELECT e.id, e.label, e.city, e.state, e.zip_code, e.slug,
        MAX(COALESCE(e.updated_at, ''), COALESCE(s.created_at, '')) AS updated,
        s.sale_price, s.sale_date
      FROM eligible e JOIN sales s ON s.id = e.sale_id ORDER BY e.id
    `);
    yield* rows;
    cursor = end;
  }
}

const date = (value: string | null, fallback: string) => {
  const candidate = value?.slice(0, 10);
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : fallback;
};

const version = await release();
if (!version || version.id !== publishedHomepageSnapshot.datasetVersionId) {
  throw new Error("Update the verified homepage snapshot to the active D1 publication before capturing sitemaps.");
}
const publishedAt = new Date(version.published_at).toISOString();
const publishedDate = publishedAt.slice(0, 10);
const snapshot: SitemapSnapshot = {
  datasetVersionId: version.id, publishedAt, properties: [], units: [], browse: [], neighborhoods: [],
};
const stateCities = new Map<string, Map<string, string>>();
const zipCodes = new Map<string, string>();

for (const unit of [false, true]) {
  const records = unit ? snapshot.units : snapshot.properties;
  for await (const row of eligibleRows(unit)) {
    const slug = unit ? (row.slug || row.id) : propertySlug({ id: row.id, address: row.label, city: row.city, zip_code: row.zip_code });
    if (!/^[a-z0-9-]+$/i.test(slug) || !row.label?.trim() || !row.sale_price || !row.sale_date) {
      throw new Error(`Invalid published entity ${row.id}`);
    }
    const label = [row.label, row.city, row.state, row.zip_code].filter(Boolean).join(", ");
    records.push([`/${unit ? "unit" : "properties"}/${slug}`, date(row.updated, publishedDate), label,
      row.sale_price, date(row.sale_date, publishedDate)]);
    if (!unit) {
      if (!stateCities.has(row.state)) stateCities.set(row.state, new Map());
      const cities = stateCities.get(row.state)!;
      if (!cities.has(row.city.toLowerCase())) cities.set(row.city.toLowerCase(), row.city);
      if (!zipCodes.has(row.zip_code)) zipCodes.set(row.zip_code, `${row.city}, ${row.state}`);
    }
  }
  console.log(`Captured ${records.length} ${unit ? "units" : "properties"} from ${version.id}.`);
}
const stateNames: Record<string, string> = { NY: "New York", NJ: "New Jersey", CT: "Connecticut" };
for (const [state, cities] of [...stateCities].sort()) {
  const path = `/browse/${state.toLowerCase()}`;
  snapshot.browse.push([path, publishedDate, stateNames[state] ?? state]);
  for (const city of [...cities.values()].sort()) {
    snapshot.browse.push([`${path}/${encodeURIComponent(city)}`, publishedDate, `${city}, ${state}`]);
  }
}
for (const [zip, label] of [...zipCodes].sort()) {
  snapshot.neighborhoods.push([`/neighborhood/${zip}?geoType=zip`, publishedDate, `ZIP ${zip} Market Report — ${label}`]);
}
const latest = await release();
if (latest?.id !== version.id) throw new Error("The active D1 publication changed during capture. Run the capture again.");
if (!snapshot.units.length || !snapshot.properties.length || !snapshot.browse.length || !snapshot.neighborhoods.length) {
  throw new Error("One or more published sitemap sections are empty.");
}
if (snapshot.units.length !== publishedHomepageSnapshot.saleBackedUnits ||
    snapshot.properties.length !== publishedHomepageSnapshot.publicProperties) {
  throw new Error("Captured entity counts differ from the verified publication totals.");
}
const paths = new Set(getStaticSitemapEntries().map((entry) => entry.path));
for (const [path] of [...snapshot.properties, ...snapshot.units, ...snapshot.browse, ...snapshot.neighborhoods]) {
  const url = new URL(path, SITEMAP_ORIGIN);
  if (url.origin !== SITEMAP_ORIGIN || url.pathname + url.search !== path || paths.has(path)) {
    throw new Error(`Duplicate or noncanonical sitemap URL ${path}`);
  }
  paths.add(path);
}
// Replace the published file only once the entire snapshot has passed validation.
const serialized = JSON.stringify(snapshot, null, 0).replace(/\],\["\//g, '],\n["/');
await writeFile(target + ".tmp", serialized + "\n", "utf8");
await rename(target + ".tmp", target);
console.log(JSON.stringify({ version: version.id, properties: snapshot.properties.length, units: snapshot.units.length,
  browse: snapshot.browse.length, neighborhoods: snapshot.neighborhoods.length, urls: paths.size }));
