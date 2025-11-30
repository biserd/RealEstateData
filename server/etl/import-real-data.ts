import { db } from "../db";
import { 
  properties, 
  sales, 
  marketAggregates, 
  coverageMatrix, 
  dataSources, 
  comps,
  watchlistProperties,
  watchlists,
  alerts,
  notifications,
  aiChats,
} from "@shared/schema";
import { downloadZillowData, importZillowMarketAggregates, createZillowDataSource } from "./zillow-data";
import { 
  downloadNYCPlutoData, 
  downloadNYCPropertySales, 
  importNYCProperties,
  createNYCDataSources,
} from "./nyc-opendata";

async function clearAllData(): Promise<void> {
  console.log("Clearing existing data...");

  await db.delete(aiChats);
  await db.delete(notifications);
  await db.delete(alerts);
  await db.delete(watchlistProperties);
  await db.delete(watchlists);
  await db.delete(comps);
  await db.delete(sales);
  await db.delete(dataSources);
  await db.delete(coverageMatrix);
  await db.delete(marketAggregates);
  await db.delete(properties);

  console.log("All existing data cleared.");
}

async function createCoverageMatrix(): Promise<void> {
  console.log("Creating coverage matrix...");

  await db.insert(coverageMatrix).values([
    {
      state: "NY",
      coverageLevel: "Comps",
      freshnessSla: 1,
      sqftCompleteness: 0.92,
      yearBuiltCompleteness: 0.95,
      lastSaleCompleteness: 0.88,
      confidenceScore: 0.90,
      allowedAiClaims: ["pricing", "trends", "comparables", "neighborhood_analysis"],
    },
    {
      state: "NJ",
      coverageLevel: "MarketOnly",
      freshnessSla: 30,
      sqftCompleteness: 0.70,
      yearBuiltCompleteness: 0.75,
      lastSaleCompleteness: 0.60,
      confidenceScore: 0.65,
      allowedAiClaims: ["pricing", "trends"],
    },
    {
      state: "CT",
      coverageLevel: "MarketOnly",
      freshnessSla: 30,
      sqftCompleteness: 0.68,
      yearBuiltCompleteness: 0.72,
      lastSaleCompleteness: 0.58,
      confidenceScore: 0.62,
      allowedAiClaims: ["pricing", "trends"],
    },
  ]);

  console.log("Coverage matrix created.");
}

async function importRealData(): Promise<void> {
  console.log("=".repeat(60));
  console.log("REAL DATA IMPORT - Tri-State Real Estate Intelligence Platform");
  console.log("=".repeat(60));
  console.log("");

  await clearAllData();
  console.log("");

  console.log("Step 1: Downloading Zillow Research data...");
  const zillowData = await downloadZillowData();
  console.log("");

  console.log("Step 2: Importing Zillow market aggregates...");
  const marketCount = await importZillowMarketAggregates(zillowData);
  console.log("");

  console.log("Step 3: Downloading NYC Open Data (PLUTO)...");
  const plutoData = await downloadNYCPlutoData(3000);
  console.log("");

  console.log("Step 4: Downloading NYC Property Sales...");
  const salesData = await downloadNYCPropertySales(5000);
  console.log("");

  console.log("Step 5: Importing NYC properties and sales...");
  const { propertiesCount, salesCount } = await importNYCProperties(plutoData, salesData);
  console.log("");

  console.log("Step 6: Creating data sources...");
  await createZillowDataSource();
  await createNYCDataSources();
  console.log("");

  console.log("Step 7: Creating coverage matrix...");
  await createCoverageMatrix();
  console.log("");

  console.log("=".repeat(60));
  console.log("IMPORT COMPLETE!");
  console.log("=".repeat(60));
  console.log("");
  console.log("Summary:");
  console.log(`  - Market Aggregates: ${marketCount} (Zillow ZHVI data)`);
  console.log(`  - Properties: ${propertiesCount} (NYC PLUTO + Sales)`);
  console.log(`  - Sales Records: ${salesCount} (NYC DOF Sales)`);
  console.log(`  - Data Sources: 3 (Zillow, NYC PLUTO, NYC Sales)`);
  console.log(`  - Coverage Matrix: 3 states (NY full, NJ/CT market-only)`);
  console.log("");
  console.log("Note: NY has full property-level data from NYC Open Data.");
  console.log("NJ and CT have market aggregates only from Zillow Research.");
  console.log("=".repeat(60));
}

importRealData()
  .then(() => {
    console.log("Import finished successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
