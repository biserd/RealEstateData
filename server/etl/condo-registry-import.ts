import { db } from "../db";
import { condoRegistry, properties, entityResolutionMap, type InsertCondoRegistry } from "@shared/schema";
import { eq, sql, and, like, inArray } from "drizzle-orm";

const CONDO_UNITS_API = "https://data.cityofnewyork.us/resource/eguu-7ie3.json";
const CONDOMINIUMS_API = "https://data.cityofnewyork.us/resource/p8u6-a6it.json";
const BATCH_SIZE = 5000;

interface CondoUnitRecord {
  condo_base_boro?: string;
  condo_base_block?: string;
  condo_base_lot?: string;
  condo_base_bbl?: string;
  condo_number?: string;
  condo_key?: string;
  unit_boro?: string;
  unit_block?: string;
  unit_lot?: string;
  unit_bbl?: string;
  unit_designation?: string;
  model?: string;
  geometry_type?: string;
}

interface CondominiumRecord {
  borough?: string;
  block?: string;
  lot?: string;
  condo_number?: string;
  condo_name?: string;
  num_condo_units?: string;
  condo_base_bbl?: string;
}

function buildBbl(borough: string, block: string, lot: string): string {
  const b = borough.padStart(1, "0");
  const bl = block.padStart(5, "0");
  const l = lot.padStart(4, "0");
  return `${b}${bl}${l}`;
}

async function fetchCondoUnits(limit: number = 500000): Promise<CondoUnitRecord[]> {
  console.log("📥 Fetching condo unit records from Digital Tax Map...");
  const allRecords: CondoUnitRecord[] = [];
  let offset = 0;

  while (offset < limit) {
    const url = `${CONDO_UNITS_API}?$limit=${BATCH_SIZE}&$offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`API error: ${res.status}`);
      break;
    }

    const data = await res.json();
    if (!data.length) break;

    allRecords.push(...data);
    console.log(`  Fetched ${allRecords.length} condo units...`);
    offset += BATCH_SIZE;
  }

  console.log(`✅ Total condo units fetched: ${allRecords.length}`);
  return allRecords;
}

async function fetchCondominiums(limit: number = 100000): Promise<Map<string, CondominiumRecord>> {
  console.log("📥 Fetching condominium building records...");
  const condoMap = new Map<string, CondominiumRecord>();
  let offset = 0;

  while (offset < limit) {
    const url = `${CONDOMINIUMS_API}?$limit=${BATCH_SIZE}&$offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) break;

    const data = await res.json();
    if (!data.length) break;

    for (const condo of data) {
      if (condo.condo_number) {
        condoMap.set(condo.condo_number, condo);
      }
    }

    offset += BATCH_SIZE;
  }

  console.log(`✅ Total condominiums fetched: ${condoMap.size}`);
  return condoMap;
}

export async function importCondoRegistry(): Promise<number> {
  console.log("\n🏢 Starting NYC Condo Registry Import\n");

  const condoUnits = await fetchCondoUnits();
  const condominiums = await fetchCondominiums();

  console.log("\n📝 Processing condo unit records...");

  const registryRecords: InsertCondoRegistry[] = [];
  const seenUnitBbls = new Set<string>();

  for (const unit of condoUnits) {
    const unitBbl = unit.unit_bbl;
    if (!unitBbl) continue;
    if (seenUnitBbls.has(unitBbl)) continue;
    seenUnitBbls.add(unitBbl);

    const baseBbl = unit.condo_base_bbl || null;
    const condoNumber = unit.condo_number || null;

    registryRecords.push({
      unitBbl,
      baseBbl,
      condoNumber,
      borough: unit.unit_boro || null,
      block: unit.unit_block || null,
      lot: unit.unit_lot || null,
      unitDesignation: unit.unit_designation || null,
      address: null,
      zipCode: null,
      metadata: { model: unit.model, geometryType: unit.geometry_type, condoKey: unit.condo_key },
    });
  }

  console.log(`\n💾 Inserting ${registryRecords.length} condo registry records...`);

  await db.delete(condoRegistry);

  let inserted = 0;
  const insertBatchSize = 1000;
  for (let i = 0; i < registryRecords.length; i += insertBatchSize) {
    const batch = registryRecords.slice(i, i + insertBatchSize);
    try {
      await db.insert(condoRegistry).values(batch);
      inserted += batch.length;
      if (inserted % 10000 === 0) {
        console.log(`  Inserted ${inserted} records...`);
      }
    } catch (e: any) {
      console.error(`Batch insert error at ${i}:`, e.message?.substring(0, 100));
    }
  }

  console.log(`\n✅ Condo registry import complete: ${inserted} records`);
  return inserted;
}

export async function buildEntityResolutionMap(): Promise<{ matched: number; unmatched: number }> {
  console.log("\n🔗 Building entity resolution map from condo registry...\n");

  const condoRecords = await db.select().from(condoRegistry);
  console.log(`  Found ${condoRecords.length} condo registry records`);

  const allProperties = await db
    .select({ id: properties.id, bbl: properties.bbl, address: properties.address, zipCode: properties.zipCode })
    .from(properties);
  console.log(`  Found ${allProperties.length} properties`);

  const propsByBbl = new Map<string, string>();
  const propsByAddress = new Map<string, string>();

  for (const p of allProperties) {
    if (p.bbl) {
      const normalizedBbl = p.bbl.split(".")[0];
      propsByBbl.set(normalizedBbl, p.id);
    }
    if (p.address && p.zipCode) {
      const key = `${p.address.toUpperCase().trim()}|${p.zipCode}`;
      propsByAddress.set(key, p.id);
    }
  }

  let matched = 0;
  let unmatched = 0;

  await db.delete(entityResolutionMap).where(eq(entityResolutionMap.sourceSystem, "condo_registry"));

  const resolutionRecords: Array<{
    sourceSystem: string;
    sourceRecordId: string;
    sourceBbl: string | null;
    matchedPropertyId: string | null;
    matchType: string;
    matchConfidence: number;
    matchMetadata: any;
  }> = [];

  for (const condo of condoRecords) {
    let matchedPropertyId: string | null = null;
    let matchType = "unmatched";
    let matchConfidence = 0;

    if (condo.unitBbl && propsByBbl.has(condo.unitBbl)) {
      matchedPropertyId = propsByBbl.get(condo.unitBbl)!;
      matchType = "bbl_exact";
      matchConfidence = 1.0;
    } else if (condo.baseBbl && propsByBbl.has(condo.baseBbl)) {
      matchedPropertyId = propsByBbl.get(condo.baseBbl)!;
      matchType = "unit_registry";
      matchConfidence = 0.9;
    } else if (condo.address && condo.zipCode) {
      const addressKey = `${condo.address}|${condo.zipCode}`;
      if (propsByAddress.has(addressKey)) {
        matchedPropertyId = propsByAddress.get(addressKey)!;
        matchType = "address_normalized";
        matchConfidence = 0.7;
      }
    }

    if (matchedPropertyId) {
      matched++;
    } else {
      unmatched++;
    }

    resolutionRecords.push({
      sourceSystem: "condo_registry",
      sourceRecordId: condo.id,
      sourceBbl: condo.unitBbl,
      matchedPropertyId,
      matchType,
      matchConfidence,
      matchMetadata: {
        unitBbl: condo.unitBbl,
        baseBbl: condo.baseBbl,
        address: condo.address,
        unitDesignation: condo.unitDesignation,
      },
    });
  }

  console.log(`\n💾 Inserting ${resolutionRecords.length} entity resolution records...`);

  const insertBatchSize = 1000;
  for (let i = 0; i < resolutionRecords.length; i += insertBatchSize) {
    const batch = resolutionRecords.slice(i, i + insertBatchSize);
    try {
      await db.insert(entityResolutionMap).values(batch);
    } catch (e: any) {
      console.error(`Batch insert error:`, e.message?.substring(0, 100));
    }
  }

  console.log(`\n✅ Entity resolution complete:`);
  console.log(`   Matched: ${matched}`);
  console.log(`   Unmatched: ${unmatched}`);
  console.log(`   Match rate: ${((matched / (matched + unmatched)) * 100).toFixed(1)}%`);

  return { matched, unmatched };
}

export async function enrichPropertiesFromCondoRegistry(): Promise<number> {
  console.log("\n🏠 Enriching properties with unit data from condo registry...\n");

  const condosWithUnits = await db
    .select()
    .from(condoRegistry)
    .where(sql`${condoRegistry.unitDesignation} IS NOT NULL AND ${condoRegistry.unitDesignation} != ''`);

  console.log(`  Found ${condosWithUnits.length} condo records with unit designations`);

  const propsByBbl = new Map<string, { id: string; unit: string | null }>();
  const propsByAddress = new Map<string, { id: string; unit: string | null }>();

  const allProps = await db
    .select({ id: properties.id, bbl: properties.bbl, address: properties.address, zipCode: properties.zipCode, unit: properties.unit })
    .from(properties);

  for (const p of allProps) {
    if (p.bbl) {
      propsByBbl.set(p.bbl.split(".")[0], { id: p.id, unit: p.unit });
    }
    if (p.address && p.zipCode) {
      const key = `${p.address.toUpperCase().trim()}|${p.zipCode}`;
      propsByAddress.set(key, { id: p.id, unit: p.unit });
    }
  }

  let updated = 0;
  const updates: { id: string; unit: string }[] = [];

  for (const condo of condosWithUnits) {
    let unit = condo.unitDesignation?.trim().toUpperCase() || "";
    if (!unit || unit === "-" || unit === "0") continue;

    unit = unit.replace(/^APT\.?\s*/i, "").replace(/^UNIT\s*/i, "").replace(/^#\s*/, "").trim();
    if (!unit) continue;

    let prop = condo.unitBbl ? propsByBbl.get(condo.unitBbl) : null;
    if (!prop && condo.baseBbl) {
      prop = propsByBbl.get(condo.baseBbl);
    }
    if (!prop && condo.address && condo.zipCode) {
      const key = `${condo.address}|${condo.zipCode}`;
      prop = propsByAddress.get(key);
    }

    if (prop && !prop.unit) {
      updates.push({ id: prop.id, unit });
      prop.unit = unit;
    }
  }

  console.log(`  Found ${updates.length} properties to update with unit numbers`);

  for (const upd of updates) {
    try {
      await db.update(properties).set({ unit: upd.unit }).where(eq(properties.id, upd.id));
      updated++;
    } catch (e) {}

    if (updated % 500 === 0 && updated > 0) {
      console.log(`  Updated ${updated} properties...`);
    }
  }

  console.log(`\n✅ Enrichment complete: ${updated} properties updated with unit numbers`);
  return updated;
}

export async function runFullCondoImport() {
  console.log("=".repeat(60));
  console.log("NYC CONDO REGISTRY FULL IMPORT");
  console.log("=".repeat(60));

  const registryCount = await importCondoRegistry();
  const { matched, unmatched } = await buildEntityResolutionMap();
  const enrichedCount = await enrichPropertiesFromCondoRegistry();

  console.log("\n" + "=".repeat(60));
  console.log("IMPORT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Condo registry records: ${registryCount}`);
  console.log(`Entity resolution matches: ${matched} / ${matched + unmatched}`);
  console.log(`Properties enriched with units: ${enrichedCount}`);
  console.log("=".repeat(60));
}
