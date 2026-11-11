import { d1BatchSize, d1InArray } from "../server/d1Writes";
import { and, eq, gt, gte, or, sql } from "drizzle-orm";
import { integer, sqliteTable, real, text } from "drizzle-orm/sqlite-core";
import { timestamp } from "../shared/sqliteTypes";
import { db } from "../server/db";
import { sales, sourceCatalog } from "../shared/schema";
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
const D1_READ_PAGE = 5_000;
const ROLLING_SALES_SOURCE = sourceById("nyc-rolling-sales");
const CONDO_UNITS_SOURCE = sourceById("nyc-condo-units");

// These migration-only table shapes keep the deployed application compatible
// with the legacy production schema. They are used only by the explicit manual
// refresh command, after 0001_versioned_data_platform.sql has been applied.
const versionedProperties = sqliteTable("properties", {
  id: text("id").primaryKey(),
  bbl: text("bbl"),
  bblNormalized: text("bbl_normalized"),
  state: text("state").notNull(),
  geographyId: text("geography_id"),
});

const versionedCondoUnits = sqliteTable("condo_units", {
  unitBbl: text("unit_bbl").primaryKey(),
  baseBbl: text("base_bbl").notNull(),
  condoNumber: text("condo_number"),
  unitDesignation: text("unit_designation"),
  unitTypeHint: text("unit_type_hint"),
  buildingPropertyId: text("building_property_id"),
  buildingDisplayAddress: text("building_display_address"),
  unitDisplayAddress: text("unit_display_address"),
  slug: text("slug"),
  borough: text("borough"),
  zipCode: text("zip_code"),
  geographyId: text("geography_id"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
});

const versionedSales = sqliteTable("sales", {
  propertyId: text("property_id"),
  salePrice: integer("sale_price").notNull(),
  saleDate: timestamp("sale_date").notNull(),
  armsLength: integer("arms_length", { mode: "boolean" }),
  deedType: text("deed_type"),
  geographyId: text("geography_id"),
  sourceId: text("source_id"),
  sourceRecordId: text("source_record_id"),
  sourceFingerprint: text("source_fingerprint"),
  packageSale: integer("package_sale", { mode: "boolean" }),
  unitBbl: text("unit_bbl"),
  baseBbl: text("base_bbl"),
  matchMethod: text("match_method"),
  rawBorough: text("raw_borough"),
  rawBlock: text("raw_block"),
  rawLot: text("raw_lot"),
  rawAddress: text("raw_address"),
  rawAptNumber: text("raw_apt_number"),
  unresolvedReason: text("unresolved_reason"),
});

const apply = process.argv.includes("--apply");
const referenceOnly = process.argv.includes("--reference-only");
const includeReference = referenceOnly || process.argv.includes("--include-reference");
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
    let response: Response | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        response = await fetch(`${NYC_OPEN_DATA}/${dataset}.json?${pageQuery}`, { headers: sourceHeaders() });
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
    if (!response) throw new Error(`NYC Open Data ${dataset} did not return a response`);
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

async function syncCondoReference() {
  assertSourceMayPublish(CONDO_UNITS_SOURCE);
  const records = await fetchSocrata(CONDO_UNITS_DATASET, new URLSearchParams({
    "$select": "unit_bbl,condo_base_bbl,unit_boro,unit_designation,condo_number",
    "$order": "unit_bbl,:id",
  }));
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
  const changes: Array<typeof versionedCondoUnits.$inferInsert> = [];
  let cursor = "";
  let existingUnits = 0;
  let baseConflicts = 0;
  let changedDesignations = 0;
  while (true) {
    const rows = await db.select({
      unitBbl: versionedCondoUnits.unitBbl,
      baseBbl: versionedCondoUnits.baseBbl,
      condoNumber: versionedCondoUnits.condoNumber,
      unitDesignation: versionedCondoUnits.unitDesignation,
      unitTypeHint: versionedCondoUnits.unitTypeHint,
    }).from(versionedCondoUnits).where(gt(versionedCondoUnits.unitBbl, cursor))
      .orderBy(versionedCondoUnits.unitBbl).limit(D1_READ_PAGE);
    for (const row of rows) {
      const record = validByUnitBbl.get(row.unitBbl);
      if (!record) continue;
      validByUnitBbl.delete(row.unitBbl);
      existingUnits++;
      if (row.baseBbl !== record.condo_base_bbl) {
        baseConflicts++;
        continue;
      }
      const condoNumber = record.condo_number || row.condoNumber;
      const officialDesignation = normalizeUnitDesignation(record.unit_designation);
      const designationChanged = officialDesignation !== null && officialDesignation !== normalizeUnitDesignation(row.unitDesignation);
      const unitDesignation = designationChanged ? officialDesignation : row.unitDesignation;
      if (designationChanged) changedDesignations++;
      if (condoNumber !== row.condoNumber || designationChanged) {
        changes.push({
          unitBbl: row.unitBbl, baseBbl: row.baseBbl, condoNumber, unitDesignation,
          unitTypeHint: designationChanged ? classifyUnitType(unitDesignation) : row.unitTypeHint,
        });
      }
    }
    if (rows.length < D1_READ_PAGE) break;
    cursor = rows[rows.length - 1].unitBbl;
  }

  const report = { fetched: records.length, valid: valid.length, existingUnits, newUnits: validByUnitBbl.size,
    changedUnits: changes.length, changedDesignations, baseConflicts, written: 0 };
  if (!apply) return report;

  const pending = [...validByUnitBbl.values()];
  const newUnits: Array<typeof versionedCondoUnits.$inferInsert> = [];
  for (let index = 0; index < pending.length; index += 400) {
    const group = pending.slice(index, index + 400);
    const baseBbls = [...new Set(group.map((record) => String(record.condo_base_bbl)))];
    const parentRows = await db.execute(sql`
      SELECT id, COALESCE(NULLIF(bbl_normalized,''),bbl) AS bbl, address, zip_code, geography_id, latitude, longitude
      FROM properties WHERE state = 'NY' AND (bbl IN (SELECT value FROM json_each(${JSON.stringify(baseBbls)}))
        OR bbl_normalized IN (SELECT value FROM json_each(${JSON.stringify(baseBbls)})))
      ORDER BY geography_id IS NOT NULL DESC, unit IS NULL DESC, id
    `);
    type Parent = { id: string; bbl: string; address: string; zip_code: string; geography_id: string | null; latitude: number | null; longitude: number | null };
    const parents = new Map<string, Parent>();
    for (const row of parentRows.rows as Parent[]) if (!parents.has(row.bbl)) parents.set(row.bbl, row);
    for (const record of group) {
      const unitBbl = String(record.unit_bbl);
      const baseBbl = String(record.condo_base_bbl);
      const unitDesignation = normalizeUnitDesignation(record.unit_designation);
      const borough = boroughName(normalizeBoroughCode(record.unit_boro));
      const parent = parents.get(baseBbl);
      const buildingAddress = parent?.address ?? null;
      newUnits.push({
        unitBbl, baseBbl, unitDesignation, borough, condoNumber: record.condo_number || null,
        unitTypeHint: classifyUnitType(unitDesignation), buildingPropertyId: parent?.id ?? null,
        buildingDisplayAddress: buildingAddress,
        unitDisplayAddress: buildingAddress && unitDesignation ? `${buildingAddress}, Unit ${unitDesignation}` : buildingAddress,
        slug: buildUnitSlug({ unitBbl, buildingAddress, unitDesignation, borough }),
        zipCode: parent?.zip_code ?? null, geographyId: parent?.geography_id ?? null,
        latitude: parent?.latitude ?? null, longitude: parent?.longitude ?? null,
      });
    }
  }

  const values = [...changes, ...newUnits];
  const size = d1BatchSize(versionedCondoUnits);
  for (let index = 0; index < values.length; index += size * 20) {
    const queries = [];
    for (let offset = index; offset < Math.min(index + size * 20, values.length); offset += size) {
      queries.push(db.insert(versionedCondoUnits).values(values.slice(offset, offset + size)).onConflictDoUpdate({
        target: versionedCondoUnits.unitBbl,
        set: {
          condoNumber: sql`excluded.condo_number`,
          unitDesignation: sql`excluded.unit_designation`,
          unitTypeHint: sql`excluded.unit_type_hint`,
          unitDisplayAddress: sql`CASE WHEN condo_units.building_display_address IS NOT NULL AND excluded.unit_designation IS NOT NULL
            AND condo_units.unit_designation IS NOT excluded.unit_designation
            THEN condo_units.building_display_address || ', Unit ' || excluded.unit_designation
            ELSE condo_units.unit_display_address END`,
          updatedAt: new Date(),
        },
        where: sql`condo_units.base_bbl = excluded.base_bbl`,
      }));
    }
    await db.batch(queries as [typeof queries[number], ...typeof queries[number][]]);
  }
  return { ...report, written: values.length };
}

async function syncRollingSales() {
  assertSourceMayPublish(ROLLING_SALES_SOURCE);
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const where = `sale_date >= '${since.toISOString().slice(0, 10)}T00:00:00.000'`;
  const records = await fetchSocrata(ROLLING_SALES_DATASET, new URLSearchParams({
    "$select": "sale_date,sale_price,borough,block,lot,address,apartment_number",
    "$where": where, "$order": "sale_date,borough,block,lot,:id",
  }));
  const existing = new Set<string>();
  const existingParcelTransfers = new Set<string>();
  const parcelTransferKey = (bbl: string, date: Date, price: number) =>
    [bbl, date.toISOString().slice(0, 10), price].join("|");
  let cursor = "";
  while (true) {
    const rows = await db.select({
      id: sales.id,
      saleDate: sales.saleDate,
      salePrice: sales.salePrice,
      rawBorough: sales.rawBorough,
      rawBlock: sales.rawBlock,
      rawLot: sales.rawLot,
      rawAddress: sales.rawAddress,
      rawAptNumber: sales.rawAptNumber,
      unitBbl: sales.unitBbl,
      baseBbl: sales.baseBbl,
      rollingSourceRecordId: sql<string | null>`CASE WHEN sales.source_id = ${ROLLING_SALES_SOURCE.id} THEN sales.source_record_id END`,
    }).from(sales).where(and(gt(sales.id, cursor), gte(sales.saleDate, since)))
      .orderBy(sales.id).limit(D1_READ_PAGE);
    for (const sale of rows) {
      if (sale.rollingSourceRecordId) existing.add(sale.rollingSourceRecordId);
      existing.add(saleFingerprint({
        saleDate: sale.saleDate, salePrice: sale.salePrice, borough: sale.rawBorough,
        block: sale.rawBlock, lot: sale.rawLot, address: sale.rawAddress, unit: sale.rawAptNumber,
      }));
      const bbl = buildNycBbl(sale.rawBorough, sale.rawBlock, sale.rawLot) || sale.unitBbl || sale.baseBbl;
      if (bbl) existingParcelTransfers.add(parcelTransferKey(bbl, sale.saleDate, sale.salePrice));
    }
    if (rows.length < D1_READ_PAGE) break;
    cursor = rows[rows.length - 1].id;
  }

  const values: Array<typeof versionedSales.$inferInsert> = [];
  const packageSaleCounts = new Map<string, number>();
  for (const record of records) {
    const packageKey = [record.sale_date, parseMoney(record.sale_price), record.borough, record.address].join("|").toUpperCase();
    packageSaleCounts.set(packageKey, (packageSaleCounts.get(packageKey) || 0) + 1);
  }
  const incoming: { record: SocrataRecord; salePrice: number; saleDate: Date; bbl: string; fingerprint: string }[] = [];
  let possibleDuplicateTransfers = 0;
  const newByBorough: Record<string, number> = {};
  let earliestNewSale: string | null = null;
  let latestNewSale: string | null = null;
  for (const record of records) {
    const salePrice = parseMoney(record.sale_price);
    const saleDate = record.sale_date ? new Date(record.sale_date) : null;
    const bbl = buildNycBbl(record.borough, record.block, record.lot);
    if (!salePrice || !saleDate || Number.isNaN(saleDate.getTime()) || !bbl) continue;
    const fingerprint = saleFingerprint({ saleDate, salePrice, borough: record.borough, block: record.block, lot: record.lot, address: record.address, unit: record.apartment_number });
    if (existing.has(fingerprint)) continue;
    existing.add(fingerprint);
    if (existingParcelTransfers.has(parcelTransferKey(bbl, saleDate, salePrice))) {
      possibleDuplicateTransfers++;
      continue;
    }
    incoming.push({ record, salePrice, saleDate, bbl, fingerprint });
    const borough = boroughName(bbl[0]) ?? bbl[0];
    newByBorough[borough] = (newByBorough[borough] || 0) + 1;
    const saleDay = saleDate.toISOString().slice(0, 10);
    if (!earliestNewSale || saleDay < earliestNewSale) earliestNewSale = saleDay;
    if (!latestNewSale || saleDay > latestNewSale) latestNewSale = saleDay;
  }

  const unitByBbl = new Map<string, { unitBbl: string; baseBbl: string; geographyId: string | null }>();
  const bbls = [...new Set(incoming.map((sale) => sale.bbl))];
  for (let offset = 0; offset < bbls.length; offset += 500) {
    const unitRows = await db.select({ unitBbl: versionedCondoUnits.unitBbl, baseBbl: versionedCondoUnits.baseBbl, geographyId: versionedCondoUnits.geographyId })
      .from(versionedCondoUnits).where(d1InArray(versionedCondoUnits.unitBbl, bbls.slice(offset, offset + 500)));
    for (const unit of unitRows) unitByBbl.set(unit.unitBbl, unit);
  }
  const propertyByBbl = new Map<string, { id: string; geographyId: string | null }>();
  const parentBbls = [...new Set([...bbls, ...Array.from(unitByBbl.values(), (unit) => unit.baseBbl)])];
  for (let offset = 0; offset < parentBbls.length; offset += 500) {
    const group = parentBbls.slice(offset, offset + 500);
    const propertyRows = await db.select({ id: versionedProperties.id, bbl: versionedProperties.bbl, bblNormalized: versionedProperties.bblNormalized, geographyId: versionedProperties.geographyId })
      .from(versionedProperties).where(and(eq(versionedProperties.state, "NY"), or(
        d1InArray(versionedProperties.bbl, group), d1InArray(versionedProperties.bblNormalized, group),
      ))).orderBy(versionedProperties.id);
    for (const property of propertyRows) {
      for (const key of [property.bblNormalized, property.bbl]) {
        if (key && (!propertyByBbl.has(key) || (property.geographyId && !propertyByBbl.get(key)?.geographyId))) {
          propertyByBbl.set(key, property);
        }
      }
    }
  }

  let matchedUnits = 0;
  let matchedProperties = 0;
  for (const { record, salePrice, saleDate, bbl, fingerprint } of incoming) {
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

  let newRows = 0;
  let reconciledUnitSales = 0;
  if (apply && values.length > 0) {
    const before = await db.select({ count: sql<number>`count(*)` }).from(versionedSales).where(eq(versionedSales.sourceId, ROLLING_SALES_SOURCE.id));
    const size = d1BatchSize(versionedSales);
    for (let index = 0; index < values.length; index += size * 20) {
      const queries = [];
      for (let offset = index; offset < Math.min(index + size * 20, values.length); offset += size) {
        queries.push(db.insert(versionedSales).values(values.slice(offset, offset + size)).onConflictDoNothing());
      }
      await db.batch(queries as [typeof queries[number], ...typeof queries[number][]]);
    }
    const after = await db.select({ count: sql<number>`count(*)` }).from(versionedSales).where(eq(versionedSales.sourceId, ROLLING_SALES_SOURCE.id));
    newRows = Number(after[0]?.count || 0) - Number(before[0]?.count || 0);
  }
  if (apply) {
    // An unresolved rolling sale stores its source parcel in base_bbl.
    // Require the original borough, block and lot to corroborate the new exact unit match.
    const reconciled = await db.execute(sql`
      UPDATE sales AS s
      SET unit_bbl = cu.unit_bbl, base_bbl = cu.base_bbl,
          property_id = COALESCE(s.property_id, cu.building_property_id),
          geography_id = COALESCE(s.geography_id, cu.geography_id),
          match_method = 'nyc_rolling_unit_bbl', unresolved_reason = NULL
      FROM condo_units cu
      WHERE s.source_id = ${ROLLING_SALES_SOURCE.id} AND s.match_method = 'nyc_rolling_unresolved'
        AND s.unit_bbl IS NULL AND s.base_bbl = cu.unit_bbl
        AND cu.unit_bbl = printf('%d%05d%04d', CAST(s.raw_borough AS INTEGER), CAST(s.raw_block AS INTEGER), CAST(s.raw_lot AS INTEGER))
      RETURNING id
    `);
    reconciledUnitSales = reconciled.rows.length;
  }
  if (apply && (newRows > 0 || reconciledUnitSales > 0)) {
    await db.execute(sql`
      UPDATE properties AS p SET
        last_sale_price = latest.sale_price,
        last_sale_date = latest.sale_date,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')
      FROM (
        SELECT property_id, sale_price, sale_date FROM (
          SELECT property_id, sale_price, sale_date,
            row_number() OVER (PARTITION BY property_id ORDER BY sale_date DESC, id DESC) AS sale_rank
          FROM sales WHERE property_id IS NOT NULL AND match_method LIKE 'nyc_rolling_%'
        ) WHERE sale_rank=1
      ) latest
      WHERE p.id = latest.property_id
        AND (p.last_sale_date IS NULL OR latest.sale_date > p.last_sale_date
          OR (latest.sale_date = p.last_sale_date AND p.last_sale_price IS NOT latest.sale_price))
    `);
  }
  return { fetched: records.length, valid: values.length, possibleDuplicateTransfers, newRows, reconciledUnitSales, matchedUnits, matchedProperties,
    newByBorough, earliestNewSale, latestNewSale };
}

async function main() {
  assertDatabaseWriteAllowed(apply);
  console.log(JSON.stringify({ database: databaseIdentity() }));
  if (process.argv.includes("--recompute")) {
    throw new Error("--recompute is disabled until the legacy aggregate builder is replaced with the reviewed deterministic pipeline.");
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", lookbackDays, includeReference }));
  if (apply) {
    const sources = referenceOnly ? [CONDO_UNITS_SOURCE] : includeReference
      ? [ROLLING_SALES_SOURCE, CONDO_UNITS_SOURCE] : [ROLLING_SALES_SOURCE];
    for (const source of sources) {
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
  if (reference) console.log(JSON.stringify({ reference }));
  const rollingSales = referenceOnly ? null : await syncRollingSales();
  console.log(JSON.stringify({ reference, rollingSales }, null, 2));
  if (!apply) console.log("Dry run only. Re-run with --apply after reviewing counts.");
}

await main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
