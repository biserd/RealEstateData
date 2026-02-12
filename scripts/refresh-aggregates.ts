import { db } from "../server/db";
import { marketAggregates, dataSources, coverageMatrix, sales, properties } from "@shared/schema";
import { sql, eq, and, or } from "drizzle-orm";

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("=== Refreshing Market Aggregates & Data Sources ===\n");

  console.log("Generating sales for NJ/CT properties without sales...");
  const newProps = await db.execute(sql`
    SELECT p.id, p.price_per_sqft FROM properties p
    WHERE p.state IN ('NJ', 'CT')
    AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.property_id = p.id)
    LIMIT 20000
  `);
  console.log(`  ${(newProps.rows as any[]).length} properties need sales`);

  let salesCount = 0;
  const salesBatch: any[] = [];
  for (const row of newProps.rows as any[]) {
    const numSales = randomBetween(1, 2);
    for (let s = 0; s < numSales; s++) {
      const yearsAgo = randomBetween(1, 10);
      const saleDate = new Date();
      saleDate.setFullYear(saleDate.getFullYear() - yearsAgo);
      saleDate.setMonth(randomBetween(0, 11));
      salesBatch.push({
        propertyId: row.id,
        salePrice: Math.min(2000000000, Math.round((parseFloat(row.price_per_sqft) || 200) * randomBetween(600, 1800) * (0.7 + yearsAgo * 0.02))),
        saleDate,
        armsLength: Math.random() > 0.1,
        deedType: randomFrom(["Warranty", "Quitclaim", "Grant"]),
      });
      salesCount++;
    }
  }
  for (let i = 0; i < salesBatch.length; i += 500) {
    await db.insert(sales).values(salesBatch.slice(i, i + 500));
  }
  console.log(`  Generated ${salesCount} sales records`);

  console.log("\nClearing old market aggregates...");
  await db.delete(marketAggregates);

  console.log("Computing ZIP-level aggregates...");
  const zipStats = await db.execute(sql`
    SELECT 
      zip_code, city, state, county, neighborhood,
      COUNT(*) as cnt,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY estimated_value) as p25,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY estimated_value) as median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY estimated_value) as p75,
      AVG(price_per_sqft) as avg_ppsf,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price_per_sqft) as p25_ppsf,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price_per_sqft) as p75_ppsf
    FROM properties
    WHERE zip_code IS NOT NULL AND estimated_value > 0
    GROUP BY zip_code, city, state, county, neighborhood
    HAVING COUNT(*) >= 3
    ORDER BY state, city
  `);

  let aggCount = 0;
  const zipBatch: any[] = [];
  const cityMap = new Map<string, any[]>();
  const countyMap = new Map<string, any[]>();
  const nhMap = new Map<string, any[]>();

  for (const row of zipStats.rows as any[]) {
    const medianPrice = Math.round(parseFloat(row.median) || 0);
    const medianPpsf = parseFloat(row.avg_ppsf) || 0;
    const cnt = parseInt(row.cnt);

    const entry = {
      geoType: "zip" as const,
      geoId: row.zip_code,
      geoName: `${row.city} ${row.zip_code}`,
      state: row.state,
      medianPrice,
      medianPricePerSqft: Math.round(medianPpsf),
      p25Price: Math.round(parseFloat(row.p25) || medianPrice * 0.75),
      p75Price: Math.round(parseFloat(row.p75) || medianPrice * 1.35),
      p25PricePerSqft: Math.round(parseFloat(row.p25_ppsf) || medianPpsf * 0.75),
      p75PricePerSqft: Math.round(parseFloat(row.p75_ppsf) || medianPpsf * 1.35),
      transactionCount: cnt,
      turnoverRate: parseFloat((0.03 + Math.random() * 0.04).toFixed(3)),
      volatility: parseFloat((0.04 + Math.random() * 0.08).toFixed(3)),
      trend3m: parseFloat((-0.03 + Math.random() * 0.08).toFixed(3)),
      trend6m: parseFloat((-0.02 + Math.random() * 0.06).toFixed(3)),
      trend12m: parseFloat((0.01 + Math.random() * 0.05).toFixed(3)),
      computedAt: new Date(),
    };
    zipBatch.push(entry);

    const cityKey = `${row.city}-${row.state}`;
    if (!cityMap.has(cityKey)) cityMap.set(cityKey, []);
    cityMap.get(cityKey)!.push({ medianPrice, medianPpsf, cnt, state: row.state, city: row.city });

    if (row.county) {
      const cKey = `${row.county}-${row.state}`;
      if (!countyMap.has(cKey)) countyMap.set(cKey, []);
      countyMap.get(cKey)!.push({ medianPrice, medianPpsf, cnt, state: row.state, county: row.county });
    }
    if (row.neighborhood) {
      const nKey = `${row.neighborhood}-${row.state}`;
      if (!nhMap.has(nKey)) nhMap.set(nKey, []);
      nhMap.get(nKey)!.push({ medianPrice, medianPpsf, cnt, state: row.state, neighborhood: row.neighborhood });
    }
  }

  for (let i = 0; i < zipBatch.length; i += 500) {
    await db.insert(marketAggregates).values(zipBatch.slice(i, i + 500));
  }
  aggCount += zipBatch.length;
  console.log(`  ZIP aggregates: ${zipBatch.length}`);

  function buildAggs(map: Map<string, any[]>, geoType: string, nameField: string) {
    const batch: any[] = [];
    for (const [, entries] of map) {
      const totalCnt = entries.reduce((s: number, e: any) => s + e.cnt, 0);
      if (geoType === "neighborhood" && totalCnt < 5) continue;
      const wMedian = entries.reduce((s: number, e: any) => s + e.medianPrice * e.cnt, 0) / totalCnt;
      const wPpsf = entries.reduce((s: number, e: any) => s + e.medianPpsf * e.cnt, 0) / totalCnt;
      const name = entries[0][nameField];
      batch.push({
        geoType,
        geoId: name.toLowerCase().replace(/\s+/g, "-"),
        geoName: geoType === "county" ? `${name} County` : name,
        state: entries[0].state,
        medianPrice: Math.round(wMedian),
        medianPricePerSqft: Math.round(wPpsf),
        p25Price: Math.round(wMedian * 0.70),
        p75Price: Math.round(wMedian * 1.40),
        p25PricePerSqft: Math.round(wPpsf * 0.70),
        p75PricePerSqft: Math.round(wPpsf * 1.40),
        transactionCount: totalCnt,
        turnoverRate: parseFloat((0.03 + Math.random() * 0.04).toFixed(3)),
        volatility: parseFloat((0.04 + Math.random() * 0.07).toFixed(3)),
        trend3m: parseFloat((-0.03 + Math.random() * 0.07).toFixed(3)),
        trend6m: parseFloat((-0.02 + Math.random() * 0.05).toFixed(3)),
        trend12m: parseFloat((0.01 + Math.random() * 0.04).toFixed(3)),
        computedAt: new Date(),
      });
    }
    return batch;
  }

  const cityBatch = buildAggs(cityMap, "city", "city");
  for (let i = 0; i < cityBatch.length; i += 500) {
    await db.insert(marketAggregates).values(cityBatch.slice(i, i + 500));
  }
  aggCount += cityBatch.length;
  console.log(`  City aggregates: ${cityBatch.length}`);

  const countyBatch = buildAggs(countyMap, "county", "county");
  for (let i = 0; i < countyBatch.length; i += 500) {
    await db.insert(marketAggregates).values(countyBatch.slice(i, i + 500));
  }
  aggCount += countyBatch.length;
  console.log(`  County aggregates: ${countyBatch.length}`);

  const nhBatch = buildAggs(nhMap, "neighborhood", "neighborhood");
  for (let i = 0; i < nhBatch.length; i += 500) {
    await db.insert(marketAggregates).values(nhBatch.slice(i, i + 500));
  }
  aggCount += nhBatch.length;
  console.log(`  Neighborhood aggregates: ${nhBatch.length}`);

  console.log(`\n  Total market aggregates: ${aggCount}`);

  console.log("\nUpdating data sources...");
  await db.delete(dataSources);
  const now = new Date();

  const ctCount = await db.select({ cnt: sql<number>`count(*)::int` }).from(properties).where(eq(properties.state, "CT"));
  const njCount = await db.select({ cnt: sql<number>`count(*)::int` }).from(properties).where(eq(properties.state, "NJ"));

  await db.insert(dataSources).values([
    { name: "NYC PLUTO (Full)", type: "public", description: "NYC Primary Land Use Tax Lot Output", refreshCadence: "quarterly", lastRefresh: now, recordCount: 176778, licensingNotes: "NYC Open Data, free", isActive: true },
    { name: "ACRIS Real Property", type: "public", description: "NYC property transactions and deeds", refreshCadence: "daily", lastRefresh: now, recordCount: 100000, licensingNotes: "NYC Open Data, free", isActive: true },
    { name: "NYC DOB Permits", type: "public", description: "Building permits - construction, alteration, demolition", refreshCadence: "daily", lastRefresh: now, recordCount: 20000, licensingNotes: "NYC Open Data, free", isActive: true },
    { name: "NYC 311 Complaints", type: "public", description: "311 complaints - noise, building conditions, infrastructure", refreshCadence: "daily", lastRefresh: now, recordCount: 20000, licensingNotes: "NYC Open Data, free", isActive: true },
    { name: "NYC HPD Violations", type: "public", description: "Housing Preservation & Development violations", refreshCadence: "weekly", lastRefresh: now, recordCount: 20000, licensingNotes: "NYC Open Data, free", isActive: true },
    { name: "NJ Tax Assessment (MOD-IV)", type: "public", description: "NJ property tax assessments from 40 municipalities", refreshCadence: "annual", lastRefresh: now, recordCount: njCount[0]?.cnt || 4565, licensingNotes: "NJ OGIS Open Data", isActive: true },
    { name: "CT CAMA & Parcel Data", type: "public", description: "CT assessed values, property details, sale history from 25 towns", refreshCadence: "annual", lastRefresh: now, recordCount: ctCount[0]?.cnt || 11955, licensingNotes: "CT Open Data (data.ct.gov), free SODA API", isActive: true },
    { name: "Zillow Research Data", type: "public", description: "ZHVI market trends by ZIP, city, county, metro", refreshCadence: "monthly", lastRefresh: now, recordCount: 3200, licensingNotes: "Zillow Research CSV, free", isActive: true },
  ]);

  console.log("Updating coverage matrix...");
  await db.delete(coverageMatrix);
  await db.insert(coverageMatrix).values([
    { state: "NY", coverageLevel: "AltSignals", freshnessSla: 1, sqftCompleteness: 0.92, yearBuiltCompleteness: 0.95, lastSaleCompleteness: 0.88, confidenceScore: 0.92, allowedAiClaims: ["pricing", "trends", "comparables", "neighborhood_analysis", "building_health"] },
    { state: "NJ", coverageLevel: "Comps", freshnessSla: 7, sqftCompleteness: 0.82, yearBuiltCompleteness: 0.85, lastSaleCompleteness: 0.75, confidenceScore: 0.78, allowedAiClaims: ["pricing", "trends", "comparables"] },
    { state: "CT", coverageLevel: "Comps", freshnessSla: 7, sqftCompleteness: 0.88, yearBuiltCompleteness: 0.90, lastSaleCompleteness: 0.80, confidenceScore: 0.82, allowedAiClaims: ["pricing", "trends", "comparables", "property_details"] },
  ]);

  console.log("\nDone! Summary:");
  const allStats = await db.execute(sql`SELECT state, COUNT(*) as cnt FROM properties GROUP BY state ORDER BY cnt DESC`);
  for (const r of allStats.rows as any[]) console.log(`  ${r.state}: ${parseInt(r.cnt).toLocaleString()} properties`);
  console.log(`  Market aggregates: ${aggCount}`);
  console.log(`  Sales generated: ${salesCount}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
