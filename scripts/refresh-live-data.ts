import { eq, gte, sql } from "drizzle-orm";
import { db } from "../server/db";
import { condoUnits, properties, sales, type InsertCondoUnit, type InsertSale } from "../shared/schema";
import {
  buildNycBbl,
  buildUnitSlug,
  classifyUnitType,
  normalizeBoroughCode,
  normalizeUnitDesignation,
  parseMoney,
  saleFingerprint,
} from "./lib/real-estate-normalization";

const NYC_OPEN_DATA = "https://data.cityofnewyork.us/resource";
const ROLLING_SALES_DATASET = "usep-8jbt";
const CONDO_UNITS_DATASET = "eguu-7ie3";
const PAGE_SIZE = 20_000;

const apply = process.argv.includes("--apply");
const includeReference = process.argv.includes("--include-reference");
const recompute = process.argv.includes("--recompute");
const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const lookbackDays = Math.max(31, Number(daysArg?.split("=")[1] || 400));

type SocrataRecord = Record<string, string | undefined>;

function sourceHeaders(): HeadersInit {
  const token = process.env.SOCRATA_APP_TOKEN;
  return token ? { "X-App-Token": token } : {};
}

async function fetchSocrata(dataset: string, query: URLSearchParams): Promise<SocrataRecord[]> {
  const all: SocrataRecord[] = [];
  let offset = 0;
  while (true) {
    const pageQuery = new URLSearchParams(query);
    pageQuery.set("$limit", String(PAGE_SIZE));
    pageQuery.set("$offset", String(offset));
    const response = await fetch(`${NYC_OPEN_DATA}/${dataset}.json?${pageQuery}`, { headers: sourceHeaders() });
    if (!response.ok) throw new Error(`NYC Open Data ${dataset} returned HTTP ${response.status}`);
    const rows = await response.json() as SocrataRecord[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

function boroughName(code: string | null): string | null {
  return ({ "1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island" } as Record<string, string>)[code || ""] ?? null;
}

async function syncCondoReference(): Promise<{ fetched: number; valid: number; written: number }> {
  const records = await fetchSocrata(CONDO_UNITS_DATASET, new URLSearchParams({ "$order": "unit_bbl" }));
  const valid = records.filter((record) => /^\d{10}$/.test(String(record.unit_bbl || "")) && /^\d{10}$/.test(String(record.condo_base_bbl || "")));
  if (valid.length < 250_000) throw new Error(`Condo reference safety check failed: expected at least 250,000 valid units, received ${valid.length}`);
  if (!apply) return { fetched: records.length, valid: valid.length, written: 0 };

  const propertyRows = await db.select({
    id: properties.id,
    bbl: properties.bbl,
    bblNormalized: properties.bblNormalized,
    address: properties.address,
    zipCode: properties.zipCode,
    latitude: properties.latitude,
    longitude: properties.longitude,
  }).from(properties).where(eq(properties.state, "NY"));
  const propertyByBbl = new Map<string, typeof propertyRows[number]>();
  for (const property of propertyRows) {
    const key = String(property.bblNormalized || property.bbl || "").replace(/\D/g, "").slice(0, 10);
    if (key) propertyByBbl.set(key, property);
  }

  let written = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const values: InsertCondoUnit[] = valid.slice(i, i + 500).map((record) => {
      const unitBbl = String(record.unit_bbl);
      const baseBbl = String(record.condo_base_bbl);
      const unitDesignation = normalizeUnitDesignation(record.unit_designation);
      const building = propertyByBbl.get(baseBbl);
      const borough = boroughName(normalizeBoroughCode(record.unit_boro));
      const buildingAddress = building?.address ?? null;
      return {
        unitBbl,
        baseBbl,
        condoNumber: record.condo_number || null,
        unitDesignation,
        unitTypeHint: classifyUnitType(unitDesignation),
        buildingPropertyId: building?.id ?? null,
        buildingDisplayAddress: buildingAddress,
        unitDisplayAddress: buildingAddress && unitDesignation ? `${buildingAddress}, Unit ${unitDesignation}` : buildingAddress,
        slug: buildUnitSlug({ unitBbl, buildingAddress, unitDesignation, borough }),
        borough,
        zipCode: building?.zipCode ?? null,
        latitude: building?.latitude ?? null,
        longitude: building?.longitude ?? null,
      };
    });

    if (values.length > 0) {
      await db.insert(condoUnits).values(values).onConflictDoUpdate({
        target: condoUnits.unitBbl,
        set: {
          baseBbl: sql`excluded.base_bbl`,
          condoNumber: sql`excluded.condo_number`,
          unitDesignation: sql`excluded.unit_designation`,
          unitTypeHint: sql`excluded.unit_type_hint`,
          updatedAt: new Date(),
        },
      });
      written += values.length;
    }
  }
  return { fetched: records.length, valid: valid.length, written };
}

async function syncRollingSales(): Promise<{ fetched: number; valid: number; newRows: number; matchedUnits: number; matchedProperties: number }> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const where = `sale_date >= '${since.toISOString().slice(0, 10)}T00:00:00.000'`;
  const records = await fetchSocrata(ROLLING_SALES_DATASET, new URLSearchParams({ "$where": where, "$order": "sale_date,borough,block,lot" }));

  const [unitRows, propertyRows, existingRows] = await Promise.all([
    db.select({ unitBbl: condoUnits.unitBbl, baseBbl: condoUnits.baseBbl }).from(condoUnits),
    db.select({ id: properties.id, bbl: properties.bbl, bblNormalized: properties.bblNormalized }).from(properties).where(eq(properties.state, "NY")),
    db.select({
      saleDate: sales.saleDate,
      salePrice: sales.salePrice,
      rawBorough: sales.rawBorough,
      rawBlock: sales.rawBlock,
      rawLot: sales.rawLot,
      rawAddress: sales.rawAddress,
      rawAptNumber: sales.rawAptNumber,
    }).from(sales).where(gte(sales.saleDate, since)),
  ]);

  const unitByBbl = new Map(unitRows.map((unit) => [unit.unitBbl, unit]));
  const propertyByBbl = new Map<string, string>();
  for (const property of propertyRows) {
    const key = String(property.bblNormalized || property.bbl || "").replace(/\D/g, "").slice(0, 10);
    if (key) propertyByBbl.set(key, property.id);
  }
  const existing = new Set(existingRows.map((sale) => saleFingerprint({
    saleDate: sale.saleDate,
    salePrice: sale.salePrice,
    borough: sale.rawBorough,
    block: sale.rawBlock,
    lot: sale.rawLot,
    address: sale.rawAddress,
    unit: sale.rawAptNumber,
  })));

  const values: InsertSale[] = [];
  let matchedUnits = 0;
  let matchedProperties = 0;
  for (const record of records) {
    const salePrice = parseMoney(record.sale_price);
    const saleDate = record.sale_date ? new Date(record.sale_date) : null;
    const bbl = buildNycBbl(record.borough, record.block, record.lot);
    if (!salePrice || !saleDate || Number.isNaN(saleDate.getTime()) || !bbl) continue;
    const fingerprint = saleFingerprint({ saleDate, salePrice, borough: record.borough, block: record.block, lot: record.lot, address: record.address, unit: record.apartment_number });
    if (existing.has(fingerprint)) continue;
    existing.add(fingerprint);

    const unit = unitByBbl.get(bbl);
    const propertyId = propertyByBbl.get(bbl) ?? propertyByBbl.get(unit?.baseBbl || "") ?? null;
    if (unit) matchedUnits++;
    if (propertyId) matchedProperties++;
    values.push({
      propertyId,
      salePrice,
      saleDate,
      armsLength: salePrice >= 100_000,
      deedType: "NYC_ROLLING_SALE",
      unitBbl: unit?.unitBbl ?? null,
      baseBbl: unit?.baseBbl ?? bbl,
      matchMethod: unit ? "nyc_rolling_unit_bbl" : propertyId ? "nyc_rolling_property_bbl" : "nyc_rolling_unresolved",
      rawBorough: normalizeBoroughCode(record.borough),
      rawBlock: record.block || null,
      rawLot: record.lot || null,
      rawAddress: record.address || null,
      rawAptNumber: normalizeUnitDesignation(record.apartment_number),
      unresolvedReason: unit || propertyId ? null : "No current unit/property identity match",
    });
  }

  if (apply) {
    for (let i = 0; i < values.length; i += 500) await db.insert(sales).values(values.slice(i, i + 500));
    await db.execute(sql`
      UPDATE properties p SET
        last_sale_price = latest.sale_price,
        last_sale_date = latest.sale_date,
        updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (property_id) property_id, sale_price, sale_date
        FROM sales
        WHERE property_id IS NOT NULL
          AND match_method LIKE 'nyc_rolling_%'
        ORDER BY property_id, sale_date DESC
      ) latest
      WHERE p.id = latest.property_id
        AND (p.last_sale_date IS NULL OR latest.sale_date >= p.last_sale_date)
    `);
  }
  return { fetched: records.length, valid: values.length, newRows: apply ? values.length : 0, matchedUnits, matchedProperties };
}

async function main() {
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", lookbackDays, includeReference, recompute }));
  const reference = includeReference ? await syncCondoReference() : null;
  const rollingSales = await syncRollingSales();
  if (apply && recompute) {
    const { refreshAggregates } = await import("../server/productionDataSync");
    await refreshAggregates();
  }
  console.log(JSON.stringify({ reference, rollingSales }, null, 2));
  if (!apply) console.log("Dry run only. Re-run with --apply after reviewing counts; add --include-reference for the monthly 307K-unit snapshot and --recompute to rebuild market aggregates.");
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
