import { db } from "../db";
import { condoRegistry, condoUnits, properties } from "@shared/schema";
import { eq, sql, isNotNull, and } from "drizzle-orm";

interface BuildingData {
  id: string;
  bbl: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
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
      latitude: properties.latitude,
      longitude: properties.longitude,
      city: properties.city,
      zipCode: properties.zipCode,
    })
    .from(properties)
    .where(isNotNull(properties.bbl));

  const propsByBbl = new Map<string, BuildingData>();
  const propsByBlock = new Map<string, BuildingData>();
  const blockAddressCounts = new Map<string, Map<string, { count: number; data: BuildingData }>>();
  
  for (const p of allProperties) {
    if (p.bbl) {
      const normalizedBbl = p.bbl.split(".")[0];
      propsByBbl.set(normalizedBbl, {
        id: p.id,
        bbl: p.bbl,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        city: p.city,
        zipCode: p.zipCode,
      });
      
      const block = normalizedBbl.substring(0, 6);
      const lot = parseInt(normalizedBbl.substring(6));
      
      if (lot >= 7501 && p.address && p.latitude && p.longitude) {
        if (!blockAddressCounts.has(block)) {
          blockAddressCounts.set(block, new Map());
        }
        const blockMap = blockAddressCounts.get(block)!;
        const normalizedAddr = p.address.toUpperCase().trim();
        const existing = blockMap.get(normalizedAddr);
        if (existing) {
          existing.count++;
        } else {
          blockMap.set(normalizedAddr, {
            count: 1,
            data: {
              id: p.id,
              bbl: p.bbl,
              address: p.address,
              latitude: p.latitude,
              longitude: p.longitude,
              city: p.city,
              zipCode: p.zipCode,
            }
          });
        }
      }
    }
  }
  
  for (const [block, addressMap] of blockAddressCounts) {
    let bestAddress: { count: number; data: BuildingData } | null = null;
    for (const entry of addressMap.values()) {
      if (!bestAddress || entry.count > bestAddress.count) {
        bestAddress = entry;
      }
    }
    if (bestAddress) {
      propsByBlock.set(block, bestAddress.data);
    }
  }
  
  console.log(`  Indexed ${propsByBbl.size} properties by normalized BBL`);
  console.log(`  Indexed ${propsByBlock.size} blocks with condo unit data`);

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

  const BOROUGH_MAP: Record<string, string> = {
    "1": "Manhattan",
    "2": "Bronx",
    "3": "Brooklyn",
    "4": "Queens",
    "5": "Staten Island",
  };

  for (const reg of registryRecords) {
    if (!reg.unitBbl || !reg.baseBbl) continue;

    if (seenUnitBbls.has(reg.unitBbl)) {
      duplicates++;
      continue;
    }
    seenUnitBbls.add(reg.unitBbl);

    const unitProperty = propsByBbl.get(reg.unitBbl);
    const buildingProperty = propsByBbl.get(reg.baseBbl);
    
    const block = reg.baseBbl.substring(0, 6);
    const blockProperty = propsByBlock.get(block);
    
    const matched = unitProperty || buildingProperty || blockProperty;
    
    let buildingDisplayAddress: string | null = null;
    let unitDisplayAddress: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let borough: string | null = reg.borough ? BOROUGH_MAP[reg.borough] || reg.borough : null;
    let zipCode: string | null = null;
    let buildingPropertyId: string | null = null;

    if (matched) {
      buildingPropertyId = matched.id;
      buildingDisplayAddress = matched.address;
      unitDisplayAddress = formatUnitDisplayAddress(matched.address, reg.unitDesignation);
      latitude = matched.latitude;
      longitude = matched.longitude;
      borough = matched.city || borough;
      zipCode = matched.zipCode;

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
      bin: null,
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
  
  if (!addressPass || !coordsPass) {
    console.log(`\n📝 Note: Run enrich-condo-units-pluto.ts to fill gaps from NYC Open Data.`);
  }

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
