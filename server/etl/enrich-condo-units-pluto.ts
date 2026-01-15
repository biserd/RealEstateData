import { db } from "../db";
import { condoUnits } from "../../shared/schema";
import { sql, isNull, eq } from "drizzle-orm";

const BOROUGH_CODES: Record<string, string> = {
  "1": "MN",
  "2": "BX",
  "3": "BK",
  "4": "QN",
  "5": "SI",
};

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

interface PlutoRecord {
  borough: string;
  block: string;
  lot: string;
  address: string;
  latitude: string;
  longitude: string;
  zipcode: string;
  bbl: string;
}

async function fetchPlutoBlock(borough: string, block: string): Promise<PlutoRecord[]> {
  const boroughCode = BOROUGH_CODES[borough];
  if (!boroughCode) return [];

  const url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?$limit=100&block=${parseInt(block)}&borough=${boroughCode}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  PLUTO API error for block ${borough}${block}: ${response.status}`);
      return [];
    }
    const data = await response.json() as PlutoRecord[];
    return data;
  } catch (error: any) {
    console.error(`  PLUTO fetch error for block ${borough}${block}: ${error.message}`);
    return [];
  }
}

export async function enrichCondoUnitsFromPluto(): Promise<{
  blocksProcessed: number;
  unitsUpdated: number;
}> {
  console.log("============================================================");
  console.log("🔄 ENRICHING CONDO UNITS FROM NYC PLUTO");
  console.log("============================================================");

  console.log("\n📥 Finding blocks without address data...");
  const missingBlocksResult = await db.execute(sql`
    SELECT DISTINCT 
      SUBSTRING(base_bbl, 1, 1) as borough,
      SUBSTRING(base_bbl, 2, 5) as block,
      COUNT(*) as unit_count
    FROM condo_units
    WHERE building_display_address IS NULL
    GROUP BY SUBSTRING(base_bbl, 1, 1), SUBSTRING(base_bbl, 2, 5)
    ORDER BY unit_count DESC
  `);

  const missingBlocks = missingBlocksResult.rows as Array<{
    borough: string;
    block: string;
    unit_count: string;
  }>;

  console.log(`  Found ${missingBlocks.length} blocks without address data`);
  const totalMissingUnits = missingBlocks.reduce((sum, b) => sum + parseInt(b.unit_count), 0);
  console.log(`  Total units to enrich: ${totalMissingUnits}`);

  let blocksProcessed = 0;
  let unitsUpdated = 0;
  const batchSize = 10;

  console.log("\n🌐 Fetching PLUTO data and updating condo_units...");

  for (let i = 0; i < missingBlocks.length; i += batchSize) {
    const batch = missingBlocks.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (block) => {
        const plutoData = await fetchPlutoBlock(block.borough, block.block);
        
        const condoLots = plutoData.filter(
          (p) => parseInt(p.lot) >= 7501 && p.address && p.latitude && p.longitude
        );
        
        if (condoLots.length === 0) {
          const anyWithData = plutoData.find(p => p.address && p.latitude && p.longitude);
          if (anyWithData) {
            condoLots.push(anyWithData);
          }
        }
        
        if (condoLots.length === 0) {
          return { block, updated: 0 };
        }
        
        const addressCounts = new Map<string, { count: number; data: PlutoRecord }>();
        for (const lot of condoLots) {
          const addr = lot.address.toUpperCase().trim();
          const existing = addressCounts.get(addr);
          if (existing) {
            existing.count++;
          } else {
            addressCounts.set(addr, { count: 1, data: lot });
          }
        }
        
        let bestMatch: PlutoRecord | null = null;
        let bestCount = 0;
        const addressEntries = Array.from(addressCounts.values());
        for (const entry of addressEntries) {
          if (entry.count > bestCount) {
            bestCount = entry.count;
            bestMatch = entry.data;
          }
        }

        if (!bestMatch) {
          return { block, updated: 0 };
        }

        const blockPattern = block.borough + block.block + "%";
        const address = bestMatch.address.toUpperCase();
        const lat = parseFloat(bestMatch.latitude);
        const lng = parseFloat(bestMatch.longitude);
        const boro = BOROUGH_NAMES[block.borough] || "";
        const zip = bestMatch.zipcode || "";
        
        await db.execute(sql`
          UPDATE condo_units
          SET 
            building_display_address = ${address}::text,
            unit_display_address = ${address}::text || ', ' || COALESCE(unit_designation, ''),
            latitude = ${lat},
            longitude = ${lng},
            borough = ${boro}::text,
            zip_code = ${zip}::text
          WHERE base_bbl LIKE ${blockPattern}
          AND building_display_address IS NULL
        `);
        
        return { block, updated: parseInt(block.unit_count) };
      })
    );

    for (const result of batchResults) {
      if (result.updated > 0) {
        blocksProcessed++;
        unitsUpdated += result.updated;
      }
    }

    if ((i + batchSize) % 50 === 0 || i + batchSize >= missingBlocks.length) {
      console.log(`  Processed ${Math.min(i + batchSize, missingBlocks.length)}/${missingBlocks.length} blocks, updated ${unitsUpdated} units`);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("\n✅ PLUTO enrichment complete!");
  console.log(`   Blocks with data: ${blocksProcessed}`);
  console.log(`   Units updated: ${unitsUpdated}`);

  return { blocksProcessed, unitsUpdated };
}

export async function verifyEnrichment(): Promise<void> {
  console.log("\n🔍 Verifying enrichment results...");

  const totalResult = await db.select({ count: sql`count(*)` }).from(condoUnits);
  const total = Number(totalResult[0].count);

  const withAddressResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM condo_units WHERE building_display_address IS NOT NULL
  `);
  const withAddress = Number(withAddressResult.rows[0].cnt);

  const withCoordsResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM condo_units WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  `);
  const withCoords = Number(withCoordsResult.rows[0].cnt);

  const addressPct = ((withAddress / total) * 100).toFixed(2);
  const coordsPct = ((withCoords / total) * 100).toFixed(2);

  console.log(`\n📊 Final Coverage:`);
  console.log(`   Total units: ${total}`);
  console.log(`   With address: ${withAddress} (${addressPct}%)`);
  console.log(`   With coords: ${withCoords} (${coordsPct}%)`);

  const addressPass = parseFloat(addressPct) >= 99;
  const coordsPass = parseFloat(coordsPct) >= 99;

  console.log(`\n🧪 Acceptance Tests:`);
  console.log(`   ≥99% with address: ${addressPass ? "✅ PASS" : "❌ FAIL"} (${addressPct}%)`);
  console.log(`   ≥99% with coords: ${coordsPass ? "✅ PASS" : "❌ FAIL"} (${coordsPct}%)`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  enrichCondoUnitsFromPluto()
    .then(() => verifyEnrichment())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}
