import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { getPublishedFreshness } from "./dataEnvelope";
import { publicPropertyPageSql, publicRecordedSaleSql, publicUnitPageSql } from "./publicPageEligibility";
import { publishedMarketAggregates } from "./storage";
import { SITEMAP_ORIGIN } from "./sitemapSnapshot";
import { DatasetError } from "./datasetError";

const properties = sql`p.state = 'NY' AND ${publicPropertyPageSql("p")}`;
const units = publicUnitPageSql("u");

export async function nycDataset() {
  const freshness = await getPublishedFreshness();
  if (freshness.datasetVersion === "legacy-curated") throw new DatasetError(503, "The NYC publication is temporarily unavailable.");
  return {
    id: "nyc-recorded-sales", ...freshness, datePrecision: "day", currency: "USD",
    sourceName: "NYC Department of Finance and NYC Open Data",
    sourceUrl: "https://www.nyc.gov/site/finance/property/property-rolling-sales-data.page",
    url: SITEMAP_ORIGIN + "/browse/ny",
  };
}

function propertyRecord(row: Record<string, unknown>) {
  return {
    id: row.id, kind: "property", bbl: row.bbl, address: row.address, unit: row.unit, city: row.city,
    state: "NY", zip: row.zip, propertyType: row.property_type, beds: row.beds, baths: row.baths,
    squareFeet: row.sqft, yearBuilt: row.year_built, estimatedValueUsd: row.estimated_value,
    opportunityScore: row.opportunity_score, confidence: row.confidence_level,
    url: SITEMAP_ORIGIN + "/property/" + encodeURIComponent(String(row.id)),
  };
}

function unitRecord(row: Record<string, unknown>) {
  return {
    id: row.unit_bbl, kind: "unit", bbl: row.unit_bbl, buildingBbl: row.base_bbl, address: row.address, unit: row.unit,
    city: row.city, state: "NY", zip: row.zip, propertyType: "Condo", beds: row.beds, baths: row.baths, squareFeet: row.sqft,
    url: row.slug ? SITEMAP_ORIGIN + "/unit/" + encodeURIComponent(String(row.slug)) : null,
  };
}

const propertyColumns = sql`p.id, p.bbl_normalized AS bbl, p.address, p.unit, p.city, p.zip_code AS zip, p.property_type,
  p.beds, p.baths, p.sqft, p.year_built, p.estimated_value, p.opportunity_score, p.confidence_level`;
const unitColumns = sql`u.unit_bbl, u.base_bbl, u.unit_display_address AS address, u.unit_designation AS unit, u.borough AS city,
  u.zip_code AS zip, u.beds, u.baths, u.sqft, u.slug`;

function page(rows: unknown[], limit: number, offset: number) {
  return { limit, offset, count: Math.min(rows.length, limit), nextOffset: rows.length > limit ? offset + limit : null };
}

export async function searchNycProperties(input: { kind?: string; zip?: string; q?: string; limit: number; offset: number }) {
  const { kind = "property", zip, q, limit, offset } = input;
  const unit = kind === "unit";
  const zipColumn = unit ? sql`u.zip_code` : sql`p.zip_code`;
  const addressColumn = unit ? sql`u.unit_display_address` : sql`p.address`;
  const search = q ? sql`AND instr(lower(${addressColumn}), lower(${q})) > 0` : sql``;
  const location = zip ? sql`AND ${zipColumn} = ${zip}` : sql``;
  const { rows } = await db.execute(unit
    ? sql`SELECT ${unitColumns} FROM condo_units u WHERE ${units} ${location} ${search} ORDER BY u.unit_bbl LIMIT ${limit + 1} OFFSET ${offset}`
    : sql`SELECT ${propertyColumns} FROM properties p WHERE ${properties} ${location} ${search} ORDER BY p.id LIMIT ${limit + 1} OFFSET ${offset}`);
  return { dataset: await nycDataset(), records: rows.slice(0, limit).map(row => unit ? unitRecord(row) : propertyRecord(row)), pagination: page(rows, limit, offset) };
}

async function exactNycProperty(id: string) {
  const { rows } = await db.execute(sql`SELECT ${propertyColumns} FROM properties p WHERE p.id = ${id} AND ${properties} LIMIT 1`);
  if (rows.length) return propertyRecord(rows[0]);
  const selector = /^[1-5]\d{9}$/.test(id) ? sql`u.unit_bbl = ${id}` : sql`u.slug = ${id}`;
  const match = await db.execute(sql`SELECT ${unitColumns} FROM condo_units u WHERE ${selector} AND ${units} LIMIT 1`);
  if (match.rows.length) return unitRecord(match.rows[0]);
  throw new DatasetError(404, "No eligible published NYC property or condo unit matches this ID.");
}

export async function nycProperty(id: string) {
  return { property: await exactNycProperty(id), dataset: await nycDataset() };
}

const salePropertyColumns = sql`s.id AS sale_id, p.id AS property_id, NULL AS unit_bbl, p.address, p.city,
  p.zip_code AS zip, s.sale_price, s.sale_date, s.arms_length`;
const saleUnitColumns = sql`s.id AS sale_id, NULL AS property_id, u.unit_bbl, u.unit_display_address AS address, u.borough AS city,
  u.zip_code AS zip, s.sale_price, s.sale_date, s.arms_length`;

export async function nycRecordedSales(input: { zip?: string; propertyId?: string; unitBbl?: string; baseBbl?: string; limit: number; offset: number }) {
  const { zip, propertyId, unitBbl, baseBbl, limit, offset } = input;
  if ([zip, propertyId, unitBbl, baseBbl].filter(Boolean).length !== 1) {
    throw new DatasetError(400, "Provide exactly one of zip, propertyId, unitBbl, or baseBbl.");
  }
  function propertySales(selector: SQL) {
    return sql`SELECT ${salePropertyColumns} FROM sales s
      JOIN properties p ON p.id = s.property_id
      WHERE (s.unit_bbl IS NULL OR s.unit_bbl = '') AND ${selector} AND ${properties} AND ${publicRecordedSaleSql("s", 50_000)}`;
  }
  function unitSales(selector: SQL) {
    return sql`SELECT ${saleUnitColumns} FROM sales s
      JOIN condo_units u ON u.unit_bbl = s.unit_bbl
      WHERE ${selector} AND ${units} AND ${publicRecordedSaleSql("s", 100_000)}`;
  }
  let statement: SQL;
  if (zip) statement = sql`${propertySales(sql`p.zip_code = ${zip}`)} UNION ALL ${unitSales(sql`u.zip_code = ${zip}`)}`;
  else if (baseBbl) statement = sql`${propertySales(sql`p.bbl_normalized = ${baseBbl}`)} UNION ALL ${unitSales(sql`u.base_bbl = ${baseBbl}`)}`;
  else if (unitBbl) statement = unitSales(sql`u.unit_bbl = ${unitBbl}`);
  else statement = propertySales(sql`p.id = ${propertyId}`);
  const { rows } = await db.execute(sql`SELECT * FROM (${statement}) ORDER BY sale_date DESC, sale_id ASC LIMIT ${limit + 1} OFFSET ${offset}`);
  return { dataset: await nycDataset(), records: rows.slice(0, limit).map(row => ({
    id: row.sale_id, propertyId: row.property_id, unitBbl: row.unit_bbl, address: row.address, city: row.city, state: "NY",
    zip: row.zip, salePriceUsd: row.sale_price, saleDate: String(row.sale_date).slice(0, 10),
    armsLength: row.arms_length == null ? null : Boolean(row.arms_length),
  })), pagination: page(rows, limit, offset) };
}

export async function nycPublishedComps(id: string, limit: number, offset: number) {
  const subject = await exactNycProperty(id);
  const { rows } = await db.execute(sql`
    SELECT member.id, sale.property_id, sale.unit_bbl, sale.sale_price, sale.sale_date, member.weight,
      member.adjustment, comp.created_at, comp.dataset_version_id,
      CASE WHEN COALESCE(sale.unit_bbl, '') <> '' THEN u.unit_display_address ELSE p.address END AS address,
      CASE WHEN COALESCE(sale.unit_bbl, '') <> '' THEN u.zip_code ELSE p.zip_code END AS zip
    FROM comparable_sets_v2 comp
    JOIN current_published_dataset version ON version.id = comp.dataset_version_id
    JOIN comparable_members_v2 member ON member.comparable_set_id = comp.id
    JOIN sales sale ON sale.id = member.sale_id
    LEFT JOIN properties p ON p.id = sale.property_id
    LEFT JOIN condo_units u ON u.unit_bbl = sale.unit_bbl
    WHERE comp.subject_type = ${subject.kind} AND comp.subject_id = ${String(subject.id)}
      AND ((COALESCE(sale.unit_bbl, '') = '' AND ${properties} AND ${publicRecordedSaleSql("sale", 50_000)})
        OR (COALESCE(sale.unit_bbl, '') <> '' AND ${units} AND ${publicRecordedSaleSql("sale", 100_000)}))
    ORDER BY member.weight DESC, sale.sale_date DESC, member.id ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);
  return { dataset: await nycDataset(), subject, records: rows.slice(0, limit).map(row => ({
    id: row.id, propertyId: row.unit_bbl ? null : row.property_id, unitBbl: row.unit_bbl, address: row.address, zip: row.zip,
    salePriceUsd: row.sale_price, saleDate: String(row.sale_date).slice(0, 10),
    weight: row.weight, adjustmentFraction: row.adjustment,
    adjustedPriceUsd: Math.round(Number(row.sale_price) * (1 + Number(row.adjustment ?? 0))),
    computedAt: row.created_at, datasetVersion: row.dataset_version_id,
  })), pagination: page(rows, limit, offset) };
}

export async function nycMarket(geoType: string, geoId: string) {
  if ((geoType === "state" && geoId !== "NY") || (geoType === "zip" && !/^\d{5}$/.test(geoId))) {
    throw new DatasetError(400, "Use NY for state or an exact five-digit ZIP for ZIP geography.");
  }
  const result = await publishedMarketAggregates(geoType, geoId);
  if (result === null) throw new DatasetError(503, "The NYC market publication is temporarily unavailable.");
  return { dataset: await nycDataset(), geography: { type: geoType, id: geoId },
    ...(geoType === "state" && { methodology: "Summary of published ZIP benchmarks; price medians are medians of ZIP estimates." }),
    records: result.filter(row => row.state === "NY") };
}
