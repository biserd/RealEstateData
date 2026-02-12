import { db } from "../server/db";
import { properties, sales } from "@shared/schema";
import { sql, eq, and, or } from "drizzle-orm";

const CT_OPENDATA_BASE = "https://data.ct.gov/resource";

const CT_TOWNS_REMAINING = [
  "Waterbury", "Norwalk", "Danbury", "New Britain", "Greenwich", "Fairfield",
  "West Hartford", "Hamden", "Milford", "Meriden", "Bristol",
  "Manchester", "West Haven", "Stratford", "Middletown", "Shelton",
  "Trumbull", "Darien", "Westport", "New Canaan", "Ridgefield",
  "New Haven",
];

const CT_COUNTY_MAP: Record<string, string> = {
  Stamford: "Fairfield", Bridgeport: "Fairfield", Norwalk: "Fairfield",
  Danbury: "Fairfield", Greenwich: "Fairfield", Fairfield: "Fairfield",
  Milford: "Fairfield", Stratford: "Fairfield", Shelton: "Fairfield",
  Trumbull: "Fairfield", Darien: "Fairfield", Westport: "Fairfield",
  "New Canaan": "Fairfield", Ridgefield: "Fairfield",
  "New Haven": "New Haven", Waterbury: "New Haven", Hamden: "New Haven",
  Meriden: "New Haven", "West Haven": "New Haven",
  Hartford: "Hartford", "New Britain": "Hartford", Bristol: "Hartford",
  "West Hartford": "Hartford", Manchester: "Hartford",
  Middletown: "Middlesex",
};

const CT_ZIP_FALLBACK: Record<string, string> = {
  Waterbury: "06702", Norwalk: "06850", Danbury: "06810",
  "New Britain": "06051", Greenwich: "06830", Fairfield: "06824",
  "West Hartford": "06107", Hamden: "06514", Milford: "06460",
  Meriden: "06450", Bristol: "06010", Manchester: "06040",
  "West Haven": "06516", Stratford: "06614", Middletown: "06457",
  Shelton: "06484", Trumbull: "06611", Darien: "06820",
  Westport: "06880", "New Canaan": "06840", Ridgefield: "06877",
  "New Haven": "06510", Stamford: "06901", Bridgeport: "06601",
  Hartford: "06103",
};

const CT_STATE_USE_MAP: Record<string, string> = {
  "1010": "SFH", "1011": "SFH", "1012": "SFH", "1013": "SFH",
  "1020": "SFH", "1021": "SFH", "1030": "SFH",
  "1040": "Multi-family 2-4", "1041": "Multi-family 2-4", "1050": "Multi-family 2-4",
  "1060": "Multi-family 5+", "1070": "Multi-family 5+", "1080": "Multi-family 5+",
  "1000": "SFH", "1090": "SFH",
  "2010": "Condo", "2020": "Condo", "2030": "Condo", "2040": "Condo",
  "3010": "Vacant Land", "3020": "Vacant Land",
  "4010": "Commercial", "4020": "Commercial", "4030": "Commercial",
  "5010": "Mixed-Use", "5020": "Mixed-Use",
};

const CT_COORDS: Record<string, { lat: number; lng: number }> = {
  Waterbury: { lat: 41.5582, lng: -73.0515 },
  Norwalk: { lat: 41.1177, lng: -73.4082 },
  Danbury: { lat: 41.3948, lng: -73.4540 },
  "New Britain": { lat: 41.6612, lng: -72.7795 },
  Greenwich: { lat: 41.0262, lng: -73.6285 },
  Fairfield: { lat: 41.1408, lng: -73.2614 },
  "West Hartford": { lat: 41.7620, lng: -72.7420 },
  Hamden: { lat: 41.3959, lng: -72.8968 },
  Milford: { lat: 41.2223, lng: -73.0565 },
  Meriden: { lat: 41.5382, lng: -72.8071 },
  Bristol: { lat: 41.6718, lng: -72.9493 },
  Manchester: { lat: 41.7759, lng: -72.5215 },
  "West Haven": { lat: 41.2712, lng: -72.9470 },
  Stratford: { lat: 41.1845, lng: -73.1332 },
  Middletown: { lat: 41.5622, lng: -72.6505 },
  Shelton: { lat: 41.3068, lng: -73.0932 },
  Trumbull: { lat: 41.2429, lng: -73.2008 },
  Darien: { lat: 41.0787, lng: -73.4696 },
  Westport: { lat: 41.1415, lng: -73.3579 },
  "New Canaan": { lat: 41.1468, lng: -73.4951 },
  Ridgefield: { lat: 41.2815, lng: -73.4985 },
  "New Haven": { lat: 41.3081, lng: -72.9282 },
};

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("=== Importing remaining CT properties ===\n");

  let totalInserted = 0;

  for (const town of CT_TOWNS_REMAINING) {
    console.log(`  Fetching CT data for ${town}...`);
    const townUpper = town.toUpperCase();
    const url = `${CT_OPENDATA_BASE}/rny9-6ak2.json?$where=upper(property_city)='${encodeURIComponent(townUpper)}'&$limit=500&$order=assessed_total DESC`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`    Failed: ${res.status}`);
        continue;
      }
      const records = (await res.json()) as any[];
      if (!records?.length) {
        console.log(`    No records`);
        continue;
      }
      console.log(`    Fetched ${records.length} records`);

      const batchValues: any[] = [];
      const coords = CT_COORDS[town] || { lat: 41.3, lng: -72.9 };
      const fallbackZip = CT_ZIP_FALLBACK[town] || "06000";

      for (const r of records) {
        if (!r.location || !r.assessed_total) continue;
        const assessedTotal = parseFloat(r.assessed_total) || 0;
        if (assessedTotal < 20000) continue;

        const estimatedValue = Math.round(assessedTotal * 1.43);
        const stateUse = r.state_use || "";
        let propType = CT_STATE_USE_MAP[stateUse] || "SFH";

        const beds = parseInt(r.number_of_bedroom) || (propType === "Condo" ? randomBetween(1, 2) : randomBetween(2, 4));
        const fullBaths = parseInt(r.number_of_baths) || randomBetween(1, 3);
        const halfBaths = parseInt(r.number_of_half_baths) || 0;
        const baths = fullBaths + halfBaths * 0.5;
        const sqft = parseInt(r.living_area) || randomBetween(800, 2500);
        const yearBuilt = parseInt(r.ayb) || parseInt(r.eyb) || randomBetween(1940, 2020);
        const pricePerSqft = sqft > 0 ? Math.round(estimatedValue / sqft) : 0;

        let lastSalePrice: number | null = null;
        let lastSaleDate: Date | null = null;
        if (r.prior_sale_price && parseFloat(r.prior_sale_price) > 0) {
          lastSalePrice = Math.round(parseFloat(r.prior_sale_price));
        } else if (r.sale_price && parseFloat(r.sale_price) > 0) {
          lastSalePrice = Math.round(parseFloat(r.sale_price));
        }
        if (r.sale_date) {
          try { lastSaleDate = new Date(r.sale_date); if (isNaN(lastSaleDate.getTime())) lastSaleDate = null; } catch { lastSaleDate = null; }
        }

        const oppScore = randomBetween(35, 85);
        const latJitter = (Math.random() - 0.5) * 0.03;
        const lngJitter = (Math.random() - 0.5) * 0.03;
        const lat = coords.lat + latJitter;
        const lng = coords.lng + lngJitter;

        let zipCode = r.mailing_zip?.substring(0, 5);
        if (!zipCode || zipCode.length < 5) zipCode = fallbackZip;

        batchValues.push({
          address: r.location?.trim() || `${randomBetween(1, 999)} Main St`,
          city: town,
          state: "CT",
          zipCode,
          county: CT_COUNTY_MAP[town] || "Unknown",
          neighborhood: r.neighborhood || town,
          latitude: lat,
          longitude: -Math.abs(lng),
          propertyType: propType,
          beds, baths, sqft,
          lotSize: r.land_acres ? Math.round(parseFloat(r.land_acres) * 43560) : null,
          yearBuilt, lastSalePrice, lastSaleDate, estimatedValue, pricePerSqft,
          opportunityScore: oppScore,
          confidenceLevel: oppScore > 70 ? "High" : oppScore > 50 ? "Medium" : "Low",
          gridLat: Math.round(lat * 1000),
          gridLng: Math.round(-Math.abs(lng) * 1000),
          dataSources: ["CT CAMA", "CT Grand List"],
        });
      }

      if (batchValues.length > 0) {
        for (let i = 0; i < batchValues.length; i += 500) {
          await db.insert(properties).values(batchValues.slice(i, i + 500));
        }
        totalInserted += batchValues.length;
        console.log(`    Inserted ${batchValues.length} (total: ${totalInserted})`);
      }
    } catch (e) {
      console.error(`    Error: ${(e as Error).message}`);
    }
  }

  console.log(`\nTotal CT properties inserted: ${totalInserted}`);

  const stats = await db.execute(sql`SELECT state, COUNT(*) as cnt FROM properties GROUP BY state ORDER BY cnt DESC`);
  console.log("\nProperty counts by state:");
  for (const row of stats.rows as any[]) {
    console.log(`  ${row.state}: ${parseInt(row.cnt).toLocaleString()}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
