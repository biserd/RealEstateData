import { db } from "../db";
import { condoRegistry, condoUnits, properties } from "@shared/schema";
import { eq, sql, isNotNull, and } from "drizzle-orm";

interface BuildingData {
  id: string;
  bbl: string;
  address: string;
  bin: string | null;
  latitude: number | null;
  longitude: number | null;
  borough: string | null;
  zipCode: string | null;
}

function formatUnitDisplayAddress(buildingAddress: string, unitDesignation: string | null): string {
  if (!unitDesignation) return buildingAddress;
  
  const unit = unitDesignation.trim().toUpperCase();
  if (!unit) return buildingAddress;
  
  if (unit.startsWith("APT") || unit.startsWith("UNIT") || unit.startsWith("#")) {
    return `${buildingAddress}, ${unit}`;
  }
  
  return `${buildingAddress}, Unit ${unit}`;
}

export async function populateCondoUnits(): Promise<{
  total: number;
  withAddress: number;
  withCoords: number;
  duplicates: number;
}> {
  console.log("\n" + "=".repeat(60));
  console.log("🏢 POPULATING CONDO UNITS TABLE");
  console.log("=".repeat(60));

  console.log("\n📥 Loading condo registry records...");
  const registryRecords = await db.select().from(condoRegistry);
  console.log(`  Found ${registryRecords.length} condo registry records`);

  console.log("\n📥 Loading properties with coordinates...");
  const allProperties = await db
    .select({
      id: properties.id,
      bbl: properties.bbl,
      address: properties.address,
      bin: properties.bin,
      latitude: properties.latitude,
      longitude: properties.longitude,
      borough: properties.borough,
      zipCode: properties.zipCode,
    })
    .from(properties)
    .where(isNotNull(properties.bbl));

  const propsByBbl = new Map<string, BuildingData>();
  for (const p of allProperties) {
    if (p.bbl) {
      propsByBbl.set(p.bbl, {
        id: p.id,
        bbl: p.bbl,
        address: p.address,
        bin: p.bin,
        latitude: p.latitude,
        longitude: p.longitude,
        borough: p.borough,
        zipCode: p.zipCode,
      });
    }
  }
  console.log(`  Indexed ${propsByBbl.size} properties by BBL`);

  console.log("\n🗑️  Clearing existing condo_units...");
  await db.delete(condoUnits);

  console.log("\n🏗️  Building condo unit records...");
  
  const unitRecords: Array<{
    unitBbl: string;
    baseBbl: string;
    condoNumber: string | null;
    unitDesignation: string | null;
    buildingPropertyId: string | null;
    buildingDisplayAddress: string | null;
    unitDisplayAddress: string | null;
    bin: string | null;
    latitude: number | null;
    longitude: number | null;
    borough: string | null;
    zipCode: string | null;
  }> = [];

  const seenUnitBbls = new Set<string>();
  let duplicates = 0;
  let withAddress = 0;
  let withCoords = 0;

  for (const reg of registryRecords) {
    if (!reg.unitBbl || !reg.baseBbl) continue;

    if (seenUnitBbls.has(reg.unitBbl)) {
      duplicates++;
      continue;
    }
    seenUnitBbls.add(reg.unitBbl);

    const building = propsByBbl.get(reg.baseBbl);
    
    let buildingDisplayAddress: string | null = null;
    let unitDisplayAddress: string | null = null;
    let bin: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let borough: string | null = reg.borough;
    let zipCode: string | null = null;
    let buildingPropertyId: string | null = null;

    if (building) {
      buildingPropertyId = building.id;
      buildingDisplayAddress = building.address;
      unitDisplayAddress = formatUnitDisplayAddress(building.address, reg.unitDesignation);
      bin = building.bin;
      latitude = building.latitude;
      longitude = building.longitude;
      borough = building.borough || reg.borough;
      zipCode = building.zipCode;

      if (buildingDisplayAddress) withAddress++;
      if (latitude && longitude) withCoords++;
    }

    unitRecords.push({
      unitBbl: reg.unitBbl,
      baseBbl: reg.baseBbl,
      condoNumber: reg.condoNumber,
      unitDesignation: reg.unitDesignation,
      buildingPropertyId,
      buildingDisplayAddress,
      unitDisplayAddress,
      bin,
      latitude,
      longitude,
      borough,
      zipCode,
    });
  }

  console.log(`  Prepared ${unitRecords.length} unit records`);
  console.log(`  With address: ${withAddress} (${(withAddress/unitRecords.length*100).toFixed(1)}%)`);
  console.log(`  With coords: ${withCoords} (${(withCoords/unitRecords.length*100).toFixed(1)}%)`);
  console.log(`  Duplicates skipped: ${duplicates}`);

  console.log("\n💾 Inserting condo units in batches...");
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < unitRecords.length; i += batchSize) {
    const batch = unitRecords.slice(i, i + batchSize);
    await db.insert(condoUnits).values(batch);
    inserted += batch.length;
    
    if (inserted % 10000 === 0 || inserted === unitRecords.length) {
      console.log(`  Inserted ${inserted}/${unitRecords.length} units`);
    }
  }

  console.log("\n✅ Condo units population complete!");
  console.log(`   Total units: ${unitRecords.length}`);
  console.log(`   With address: ${withAddress} (${(withAddress/unitRecords.length*100).toFixed(2)}%)`);
  console.log(`   With coords: ${withCoords} (${(withCoords/unitRecords.length*100).toFixed(2)}%)`);
  console.log(`   Duplicates: ${duplicates}`);

  return {
    total: unitRecords.length,
    withAddress,
    withCoords,
    duplicates,
  };
}

export async function verifyCondoUnits(): Promise<boolean> {
  console.log("\n🔍 Verifying condo_units table...");

  const totalResult = await db.select({ count: sql`count(*)` }).from(condoUnits);
  const total = Number(totalResult[0].count);

  const withAddressResult = await db
    .select({ count: sql`count(*)` })
    .from(condoUnits)
    .where(isNotNull(condoUnits.buildingDisplayAddress));
  const withAddress = Number(withAddressResult[0].count);

  const withCoordsResult = await db
    .select({ count: sql`count(*)` })
    .from(condoUnits)
    .where(and(isNotNull(condoUnits.latitude), isNotNull(condoUnits.longitude)));
  const withCoords = Number(withCoordsResult[0].count);

  const duplicatesResult = await db.execute(sql`
    SELECT unit_bbl, COUNT(*) as cnt 
    FROM condo_units 
    GROUP BY unit_bbl 
    HAVING COUNT(*) > 1
  `);
  const duplicates = duplicatesResult.rows.length;

  const addressPct = (withAddress / total * 100).toFixed(2);
  const coordsPct = (withCoords / total * 100).toFixed(2);

  console.log(`\n📊 Verification Results:`);
  console.log(`   Total units: ${total}`);
  console.log(`   With address: ${withAddress} (${addressPct}%)`);
  console.log(`   With coords: ${withCoords} (${coordsPct}%)`);
  console.log(`   Duplicate unit_bbls: ${duplicates}`);

  const addressPass = parseFloat(addressPct) >= 99;
  const coordsPass = parseFloat(coordsPct) >= 99;
  const noDuplicates = duplicates === 0;

  console.log(`\n🧪 Acceptance Tests:`);
  console.log(`   ≥99% with address: ${addressPass ? '✅ PASS' : '❌ FAIL'} (${addressPct}%)`);
  console.log(`   ≥99% with coords: ${coordsPass ? '✅ PASS' : '❌ FAIL'} (${coordsPct}%)`);
  console.log(`   0 duplicate unit_bbl: ${noDuplicates ? '✅ PASS' : '❌ FAIL'} (${duplicates})`);

  return addressPass && coordsPass && noDuplicates;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  populateCondoUnits()
    .then(() => verifyCondoUnits())
    .then((passed) => {
      process.exit(passed ? 0 : 1);
    })
    .catch((err) => {
      console.error("Failed:", err);
      process.exit(1);
    });
}
