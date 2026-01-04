import { db } from "../db";
import { sales, condoUnits, properties } from "@shared/schema";
import { sql, eq, and, isNull } from "drizzle-orm";
import { normalizeAddress, geocodeBBL } from "../services/geoclient";

interface MatchStats {
  total: number;
  unitBblMatch: number;
  geoclientMatch: number;
  blockLotMatch: number;
  unresolved: number;
  conflicts: number;
}

interface UnresolvedBucket {
  reason: string;
  count: number;
  samples: string[];
}

const BOROUGH_CODE_TO_NUM: Record<string, string> = {
  MN: "1", BX: "2", BK: "3", QN: "4", SI: "5",
  "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
};

const BOROUGH_NUM_TO_NAME: Record<string, string> = {
  "1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island",
};

function createBBL(borough: string, block: string, lot: string): string {
  const boroughNum = BOROUGH_CODE_TO_NUM[borough] || borough.padStart(1, "0");
  const blockNum = (block || "").toString().padStart(5, "0");
  const lotNum = (lot || "").toString().padStart(4, "0");
  return boroughNum + blockNum + lotNum;
}

function normalizeBBL(bbl: string): string {
  return bbl.replace(/\./g, "").replace(/^0+/, "").padStart(10, "0");
}

export async function matchTransactions(): Promise<{
  stats: MatchStats;
  unresolvedBuckets: UnresolvedBucket[];
}> {
  console.log("============================================================");
  console.log("🔗 TRANSACTION MATCHING WITH IDENTITY GRAPH");
  console.log("============================================================");

  const stats: MatchStats = {
    total: 0,
    unitBblMatch: 0,
    geoclientMatch: 0,
    blockLotMatch: 0,
    unresolved: 0,
    conflicts: 0,
  };

  const unresolvedReasons: Record<string, { count: number; samples: string[] }> = {};

  console.log("\n📥 Loading condo unit identity graph...");
  const units = await db.select({
    unitBbl: condoUnits.unitBbl,
    baseBbl: condoUnits.baseBbl,
  }).from(condoUnits);

  const unitBblToBaseBbl = new Map<string, string>();
  const blockPrefixToBaseBbls = new Map<string, Set<string>>();
  const baseBblToUnits = new Map<string, string[]>();

  for (const unit of units) {
    if (unit.baseBbl) {
      unitBblToBaseBbl.set(unit.unitBbl, unit.baseBbl);
      
      const existing = baseBblToUnits.get(unit.baseBbl) || [];
      existing.push(unit.unitBbl);
      baseBblToUnits.set(unit.baseBbl, existing);
      
      const blockPrefix = unit.unitBbl.substring(0, 6);
      if (!blockPrefixToBaseBbls.has(blockPrefix)) {
        blockPrefixToBaseBbls.set(blockPrefix, new Set());
      }
      blockPrefixToBaseBbls.get(blockPrefix)!.add(unit.baseBbl);
    }
  }

  console.log(`  Unit BBLs loaded: ${unitBblToBaseBbl.size}`);
  console.log(`  Buildings (base BBLs): ${baseBblToUnits.size}`);
  console.log(`  Block prefixes indexed: ${blockPrefixToBaseBbls.size}`);

  console.log("\n📥 Loading properties with BBL...");
  const propsWithBbl = await db.select({
    id: properties.id,
    bbl: properties.bbl,
    address: properties.address,
    zipCode: properties.zipCode,
  }).from(properties).where(sql`bbl IS NOT NULL`);

  const propBblToId = new Map<string, string>();
  for (const p of propsWithBbl) {
    if (p.bbl) {
      const normalizedBbl = normalizeBBL(p.bbl);
      propBblToId.set(normalizedBbl, p.id);
    }
  }
  console.log(`  Properties with BBL: ${propBblToId.size}`);

  console.log("\n📥 Loading unmatched sales...");
  const unmatchedSales = await db.select().from(sales).where(isNull(sales.matchMethod));
  console.log(`  Unmatched sales: ${unmatchedSales.length}`);
  stats.total = unmatchedSales.length;

  console.log("\n🔄 Matching transactions...");

  for (let i = 0; i < unmatchedSales.length; i++) {
    const sale = unmatchedSales[i];

    let unitBbl: string | null = null;
    let baseBbl: string | null = null;
    let matchMethod: string = "unresolved";
    let unresolvedReason: string | null = null;

    const rawBbl = sale.rawBorough && sale.rawBlock && sale.rawLot
      ? createBBL(sale.rawBorough, sale.rawBlock, sale.rawLot)
      : null;

    if (rawBbl && unitBblToBaseBbl.has(rawBbl)) {
      unitBbl = rawBbl;
      baseBbl = unitBblToBaseBbl.get(rawBbl) || null;
      matchMethod = "unit_bbl";
      stats.unitBblMatch++;
    }
    else if (rawBbl) {
      const blockPrefix = rawBbl.substring(0, 6);
      const matchingBaseBbls = blockPrefixToBaseBbls.get(blockPrefix);

      if (matchingBaseBbls && matchingBaseBbls.size === 1) {
        baseBbl = Array.from(matchingBaseBbls)[0];
        matchMethod = "block_lot";
        stats.blockLotMatch++;
      } else if (matchingBaseBbls && matchingBaseBbls.size > 1) {
        const baseBblArray = Array.from(matchingBaseBbls);
        let bestBaseBbl = baseBblArray[0];
        let maxUnits = 0;
        for (const bb of baseBblArray) {
          const unitCount = baseBblToUnits.get(bb)?.length || 0;
          if (unitCount > maxUnits) {
            maxUnits = unitCount;
            bestBaseBbl = bb;
          }
        }
        baseBbl = bestBaseBbl;
        matchMethod = "block_lot";
        stats.blockLotMatch++;
      } else {
        const propId = propBblToId.get(rawBbl);
        if (propId) {
          matchMethod = "block_lot";
          stats.blockLotMatch++;
          await db.update(sales).set({
            propertyId: propId,
            matchMethod,
            rawBorough: sale.rawBorough,
            rawBlock: sale.rawBlock,
            rawLot: sale.rawLot,
          }).where(eq(sales.id, sale.id));
          continue;
        }

        matchMethod = "unresolved";
        unresolvedReason = "no_unit_or_property_match";
        stats.unresolved++;
        
        if (!unresolvedReasons[unresolvedReason]) {
          unresolvedReasons[unresolvedReason] = { count: 0, samples: [] };
        }
        unresolvedReasons[unresolvedReason].count++;
        if (unresolvedReasons[unresolvedReason].samples.length < 5) {
          unresolvedReasons[unresolvedReason].samples.push(
            `BBL: ${rawBbl}, Addr: ${sale.rawAddress || "N/A"}`
          );
        }
      }
    } else {
      matchMethod = "unresolved";
      unresolvedReason = "missing_bbl_components";
      stats.unresolved++;
      
      if (!unresolvedReasons[unresolvedReason]) {
        unresolvedReasons[unresolvedReason] = { count: 0, samples: [] };
      }
      unresolvedReasons[unresolvedReason].count++;
      if (unresolvedReasons[unresolvedReason].samples.length < 5) {
        unresolvedReasons[unresolvedReason].samples.push(
          `ID: ${sale.id}, Addr: ${sale.rawAddress || "N/A"}`
        );
      }
    }

    await db.update(sales).set({
      unitBbl,
      baseBbl,
      matchMethod,
      unresolvedReason,
    }).where(eq(sales.id, sale.id));

    if ((i + 1) % 500 === 0) {
      console.log(`  Processed ${i + 1}/${unmatchedSales.length} sales...`);
    }
  }

  const unresolvedBuckets: UnresolvedBucket[] = Object.entries(unresolvedReasons).map(
    ([reason, data]) => ({
      reason,
      count: data.count,
      samples: data.samples,
    })
  );

  console.log("\n============================================================");
  console.log("📊 MATCH RESULTS");
  console.log("============================================================");
  console.log(`  Total sales processed: ${stats.total}`);
  console.log(`  Unit BBL match: ${stats.unitBblMatch} (${((stats.unitBblMatch / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Block/Lot match: ${stats.blockLotMatch} (${((stats.blockLotMatch / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Unresolved: ${stats.unresolved} (${((stats.unresolved / stats.total) * 100).toFixed(1)}%)`);

  if (unresolvedBuckets.length > 0) {
    console.log("\n📋 Unresolved Reasons:");
    for (const bucket of unresolvedBuckets) {
      console.log(`  ${bucket.reason}: ${bucket.count}`);
      bucket.samples.forEach(s => console.log(`    - ${s}`));
    }
  }

  return { stats, unresolvedBuckets };
}

export async function reimportSalesWithRawData(): Promise<number> {
  console.log("============================================================");
  console.log("📥 RE-IMPORTING NYC SALES WITH RAW DATA FOR MATCHING");
  console.log("============================================================");

  await db.delete(sales);
  console.log("  Cleared existing sales");

  const NYC_SALES_URL = "https://data.cityofnewyork.us/resource/usep-8jbt.json";
  const limit = 20000;
  const query = `$limit=${limit}&$order=sale_date DESC`;
  const url = `${NYC_SALES_URL}?${query}`;

  console.log(`  Fetching ${limit} sales from NYC Open Data...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sales: ${response.status}`);
  }

  const data = await response.json() as Array<{
    borough: string;
    block: string;
    lot: string;
    address: string;
    apartment_number: string;
    sale_price: string;
    sale_date: string;
    building_class_category: string;
  }>;

  console.log(`  Downloaded ${data.length} sales records`);

  const validSales = data.filter(sale => {
    const price = parseInt((sale.sale_price || "0").replace(/,/g, ""));
    return price > 10000;
  });

  console.log(`  Valid sales (price > $10k): ${validSales.length}`);

  let inserted = 0;
  const batchSize = 500;

  for (let i = 0; i < validSales.length; i += batchSize) {
    const batch = validSales.slice(i, i + batchSize);
    const values = batch.map(sale => ({
      salePrice: parseInt((sale.sale_price || "0").replace(/,/g, "")),
      saleDate: sale.sale_date ? new Date(sale.sale_date) : new Date(),
      armsLength: true,
      deedType: "Deed",
      rawBorough: sale.borough,
      rawBlock: sale.block,
      rawLot: sale.lot,
      rawAddress: sale.address,
      rawAptNumber: sale.apartment_number,
    }));

    try {
      await db.insert(sales).values(values);
      inserted += values.length;
    } catch (e: any) {
      console.error(`  Batch insert error: ${e.message?.substring(0, 100)}`);
    }

    if (inserted % 2000 === 0) {
      console.log(`  Inserted ${inserted} sales...`);
    }
  }

  console.log(`\n✅ Sales import complete: ${inserted} records`);
  return inserted;
}

export async function runFullTransactionMatching(): Promise<void> {
  const importedCount = await reimportSalesWithRawData();
  const { stats, unresolvedBuckets } = await matchTransactions();

  console.log("\n============================================================");
  console.log("✅ FULL TRANSACTION MATCHING COMPLETE");
  console.log("============================================================");
  console.log(`  Imported: ${importedCount} sales`);
  console.log(`  Matched: ${stats.unitBblMatch + stats.blockLotMatch} sales`);
  console.log(`  Unresolved: ${stats.unresolved} sales`);
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runFullTransactionMatching()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}
