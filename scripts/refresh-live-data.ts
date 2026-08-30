import { eq, gte, sql } from "drizzle-orm";
import { boolean, integer, pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { db } from "../server/db";
import { properties, sales, sourceCatalog } from "../shared/schema";
import { assertSourceMayPublish } from "../pipeline/contracts";
import { sourceById } from "../pipeline/sourceCatalog";
import {
  buildNycBbl,
  buildUnitSlug,
  classifyUnitType,
  normalizeBoroughCode,
  normalizeUnitDesignation,
  parseMoney,
  saleFingerprint,
} from "./lib/real-estate-normalization";
import { assertDatabaseWriteAllowed, databaseIdentity } from "./lib/database-safety";

const NYC_OPEN_DATA = "https://data.cityofnewyork.us/resource";
const ROLLING_SALES_DATASET = "usep-8jbt";
const CONDO_UNITS_DATASET = "eguu-7ie3";
const PAGE_SIZE = 20_000;
const ROLLING_SALES_SOURCE = sourceById("nyc-rolling-sales");
const CONDO_UNITS_SOURCE = sourceById("nyc-condo-units");

// These migration-only table shapes keep the deployed application compatible
// with the legacy production schema. They are used only by the explicit manual
// refresh command, after 0001_versioned_data_platform.sql has been applied.
const versionedProperties = pgTable("properties", {
  id: varchar("id").primaryKey(),
  bbl: varchar("bbl"),
  bblNormalized: varchar("bbl_normalized"),
  state: varchar("state").notNull(),
  geographyId: varchar("geography_id"),
});

const versionedCondoUnits = pgTable("condo_units", {
  unitBbl: varchar("unit_bbl").primaryKey(),
  baseBbl: varchar("base_bbl").notNull(),
  condoNumber: varchar("condo_number"),
  unitDesignation: varchar("unit_designation"),
  unitTypeHint: varchar("unit_type_hint"),
  buildingPropertyId: varchar("building_property_id"),
  buildingDisplayAddress: text("building_display_address"),
  unitDisplayAddress: text("unit_display_address"),
  slug: varchar("slug"),
  borough: varchar("borough"),
  zipCode: varchar("zip_code"),
  geographyId: varchar("geography_id"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const versionedSales = pgTable("sales", {
  propertyId: varchar("property_id"),
  salePrice: integer("sale_price").notNull(),
  saleDate: timestamp("sale_date").notNull(),
  armsLength: boolean("arms_length"),
  deedType: varchar("deed_type"),
  geographyId: varchar("geography_id"),
  sourceId: varchar("source_id"),
  sourceRecordId: varchar("source_record_id"),
  sourceFingerprint: varchar("source_fingerprint"),
  packageSale: boolean("package_sale"),
  unitBbl: varchar("unit_bbl"),
  baseBbl: varchar("base_bbl"),
  matchMethod: varchar("match_method"),
  rawBorough: varchar("raw_borough"),
  rawBlock: varchar("raw_block"),
  rawLot: varchar("raw_lot"),
  rawAddress: text("raw_address"),
  rawAptNumber: varchar("raw_apt_number"),
  unresolvedReason: varchar("unresolved_reason"),
});

const apply = process.argv.includes("--apply");
const includeReference = process.argv.includes("--include-reference");
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
  assertSourceMayPublish(CONDO_UNITS_SOURCE);
  const records = await fetchSocrata(CONDO_UNITS_DATASET, new URLSearchParams({ "$order": "unit_bbl" }));
  const validByUnitBbl = new Map<string, SocrataRecord>();
  for (const record of records) {
    const unitBbl = String(record.unit_bbl || "");
    const baseBbl = String(record.condo_base_bbl || "");
    if (/^\d{10}$/.test(unitBbl) && /^\d{10}$/.test(baseBbl) && !validByUnitBbl.has(unitBbl)) {
      // The official snapshot occasionally contains byte-for-byte duplicate rows.
      // PostgreSQL cannot update one conflict key twice in a single INSERT, so keep
      // the first occurrence from the source's deterministic unit_bbl ordering.
      validByUnitBbl.set(unitBbl, record);
    }
  }
  const valid = [...validByUnitBbl.values()];
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
    const values: Array<typeof versionedCondoUnits.$inferInsert> = valid.slice(i, i + 500).map((record) => {
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
        geographyId: building?.zipCode ? `zip:NY:${building.zipCode}` : null,
        latitude: building?.latitude ?? null,
        longitude: building?.longitude ?? null,
      };
    });

    if (values.length > 0) {
      await db.insert(versionedCondoUnits).values(values).onConflictDoUpdate({
        target: versionedCondoUnits.unitBbl,
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
  assertSourceMayPublish(ROLLING_SALES_SOURCE);
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const where = `sale_date >= '${since.toISOString().slice(0, 10)}T00:00:00.000'`;
  const records = await fetchSocrata(ROLLING_SALES_DATASET, new URLSearchParams({ "$where": where, "$order": "sale_date,borough,block,lot" }));

  const [unitRows, propertyRows, existingRows] = await Promise.all([
    db.select({ unitBbl: versionedCondoUnits.unitBbl, baseBbl: versionedCondoUnits.baseBbl, geographyId: versionedCondoUnits.geographyId }).from(versionedCondoUnits),
    db.select({ id: versionedProperties.id, bbl: versionedProperties.bbl, bblNormalized: versionedProperties.bblNormalized, geographyId: versionedProperties.geographyId }).from(versionedProperties).where(eq(versionedProperties.state, "NY")),
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
  const propertyByBbl = new Map<string, { id: string; geographyId: string | null }>();
  for (const property of propertyRows) {
    const key = String(property.bblNormalized || property.bbl || "").replace(/\D/g, "").slice(0, 10);
    if (key) propertyByBbl.set(key, { id: property.id, geographyId: property.geographyId });
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

  const values: Array<typeof versionedSales.$inferInsert> = [];
  const packageSaleCounts = new Map<string, number>();
  for (const record of records) {
    const packageKey = [record.sale_date, parseMoney(record.sale_price), record.borough, record.address].join("|").toUpperCase();
    packageSaleCounts.set(packageKey, (packageSaleCounts.get(packageKey) || 0) + 1);
  }
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
    const property = propertyByBbl.get(bbl) ?? propertyByBbl.get(unit?.baseBbl || "") ?? null;
    const propertyId = property?.id ?? null;
    if (unit) matchedUnits++;
    if (propertyId) matchedProperties++;
    values.push({
      propertyId,
      salePrice,
      saleDate,
      armsLength: salePrice >= 100_000,
      deedType: "NYC_ROLLING_SALE",
      geographyId: property?.geographyId ?? unit?.geographyId ?? null,
      sourceId: ROLLING_SALES_SOURCE.id,
      sourceRecordId: fingerprint,
      sourceFingerprint: fingerprint,
      packageSale: (packageSaleCounts.get([record.sale_date, salePrice, record.borough, record.address].join("|").toUpperCase()) || 0) > 1,
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
    for (let i = 0; i < values.length; i += 500) await db.insert(versionedSales).values(values.slice(i, i + 500));
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
  assertDatabaseWriteAllowed(apply);
  console.log(JSON.stringify({ database: databaseIdentity() }));
  if (process.argv.includes("--recompute")) {
    throw new Error("--recompute is disabled until the legacy aggregate builder is replaced with the reviewed deterministic pipeline.");
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", lookbackDays, includeReference }));
  if (apply) {
    for (const source of [ROLLING_SALES_SOURCE, CONDO_UNITS_SOURCE]) {
      await db.insert(sourceCatalog).values({
        id: source.id,
        owner: source.owner,
        name: source.name,
        endpoint: source.endpoint,
        license: "Official public-record source; preserve attribution and periodically revalidate terms.",
        redistributionStatus: source.redistributionStatus,
        cadence: source.cadence,
        expectedLagDays: source.expectedLagDays,
        coverage: source.coverage,
        adapterVersion: source.adapterVersion,
        active: source.active,
      }).onConflictDoUpdate({ target: sourceCatalog.id, set: { adapterVersion: source.adapterVersion, updatedAt: new Date() } });
    }
  }
  const reference = includeReference ? await syncCondoReference() : null;
  const rollingSales = await syncRollingSales();
  console.log(JSON.stringify({ reference, rollingSales }, null, 2));
  if (!apply) console.log("Dry run only. Re-run with --apply after reviewing counts; add --include-reference for the monthly 307K-unit snapshot.");
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
