import { db } from "./db";
import {
  properties,
  sales,
  marketAggregates,
  coverageMatrix,
  dataSources,
  comps,
} from "@shared/schema";
import { sql } from "drizzle-orm";

const NYC_ZIPS = [
  { zip: "10001", city: "New York", neighborhood: "Chelsea", county: "New York" },
  { zip: "10011", city: "New York", neighborhood: "West Village", county: "New York" },
  { zip: "10014", city: "New York", neighborhood: "Greenwich Village", county: "New York" },
  { zip: "10021", city: "New York", neighborhood: "Upper East Side", county: "New York" },
  { zip: "10023", city: "New York", neighborhood: "Upper West Side", county: "New York" },
  { zip: "10128", city: "New York", neighborhood: "Yorkville", county: "New York" },
  { zip: "11201", city: "Brooklyn", neighborhood: "Brooklyn Heights", county: "Kings" },
  { zip: "11215", city: "Brooklyn", neighborhood: "Park Slope", county: "Kings" },
  { zip: "11211", city: "Brooklyn", neighborhood: "Williamsburg", county: "Kings" },
  { zip: "11217", city: "Brooklyn", neighborhood: "Boerum Hill", county: "Kings" },
];

const LI_ZIPS = [
  { zip: "11021", city: "Great Neck", neighborhood: "Great Neck Plaza", county: "Nassau" },
  { zip: "11030", city: "Manhasset", neighborhood: "Manhasset", county: "Nassau" },
  { zip: "11542", city: "Glen Cove", neighborhood: "Glen Cove", county: "Nassau" },
  { zip: "11701", city: "Amityville", neighborhood: "Amityville", county: "Suffolk" },
  { zip: "11743", city: "Huntington", neighborhood: "Huntington", county: "Suffolk" },
];

const NJ_ZIPS = [
  { zip: "07302", city: "Jersey City", neighborhood: "Downtown", county: "Hudson" },
  { zip: "07030", city: "Hoboken", neighborhood: "Hoboken", county: "Hudson" },
  { zip: "07960", city: "Morristown", neighborhood: "Morristown", county: "Morris" },
  { zip: "07078", city: "Short Hills", neighborhood: "Short Hills", county: "Essex" },
  { zip: "07458", city: "Oakland", neighborhood: "Oakland", county: "Bergen" },
];

const CT_ZIPS = [
  { zip: "06830", city: "Greenwich", neighborhood: "Downtown Greenwich", county: "Fairfield" },
  { zip: "06840", city: "New Canaan", neighborhood: "New Canaan", county: "Fairfield" },
  { zip: "06820", city: "Darien", neighborhood: "Darien", county: "Fairfield" },
  { zip: "06880", city: "Westport", neighborhood: "Westport", county: "Fairfield" },
  { zip: "06902", city: "Stamford", neighborhood: "Downtown Stamford", county: "Fairfield" },
];

const propertyTypesList = ["SFH", "Condo", "Townhome", "Multi-family 2-4", "Multi-family 5+"];
const confidenceLevelsList = ["Low", "Medium", "High"];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAddress(): string {
  const streetNumber = randomBetween(1, 999);
  const streets = [
    "Main St", "Oak Ave", "Maple Dr", "Park Blvd", "Broadway", "5th Ave",
    "Madison Ave", "Lexington Ave", "Central Park West", "Amsterdam Ave",
    "Columbus Ave", "Washington St", "Franklin St", "Greenwich St"
  ];
  return `${streetNumber} ${randomFrom(streets)}`;
}

function calculateOpportunityScore(
  pricePerSqft: number,
  medianPricePerSqft: number,
  yearBuilt: number,
  sqft: number
): { score: number; confidence: string } {
  const mispricing = Math.min(100, Math.max(0, ((medianPricePerSqft - pricePerSqft) / medianPricePerSqft) * 100 + 50)) * 0.4;
  const yearFactor = Math.min(100, Math.max(0, (yearBuilt - 1900) / 1.2)) * 0.15;
  const sizeFactor = Math.min(100, sqft / 30) * 0.15;
  const liquidity = randomBetween(50, 90) * 0.15;
  const riskFactor = randomBetween(60, 95) * 0.15;
  
  const score = Math.round(mispricing + yearFactor + sizeFactor + liquidity + riskFactor);
  const confidence = score > 70 ? "High" : score > 50 ? "Medium" : "Low";
  
  return { score: Math.min(100, Math.max(0, score)), confidence };
}

async function seedData() {
  console.log("Starting database seed...");
  
  console.log("Clearing existing data...");
  await db.delete(comps);
  await db.delete(sales);
  await db.delete(dataSources);
  await db.delete(coverageMatrix);
  await db.delete(marketAggregates);
  await db.delete(properties);
  console.log("Existing data cleared.");

  const allZips = [
    ...NYC_ZIPS.map(z => ({ ...z, state: "NY" as const })),
    ...LI_ZIPS.map(z => ({ ...z, state: "NY" as const })),
    ...NJ_ZIPS.map(z => ({ ...z, state: "NJ" as const })),
    ...CT_ZIPS.map(z => ({ ...z, state: "CT" as const })),
  ];

  const insertedProperties: Array<{ id: string; zipCode: string; pricePerSqft: number }> = [];

  console.log("Seeding properties...");
  for (const zipInfo of allZips) {
    const propertiesPerZip = randomBetween(8, 15);
    
    const basePrice = zipInfo.state === "NY" && zipInfo.city === "New York" 
      ? randomBetween(800000, 2500000)
      : zipInfo.state === "NY" 
        ? randomBetween(500000, 1200000)
        : zipInfo.state === "NJ"
          ? randomBetween(400000, 900000)
          : randomBetween(600000, 1500000);

    const medianPricePerSqft = basePrice / randomBetween(1200, 2000);

    for (let i = 0; i < propertiesPerZip; i++) {
      const propertyType = randomFrom(propertyTypesList);
      const beds = propertyType === "Condo" ? randomBetween(1, 3) : randomBetween(2, 5);
      const baths = Math.min(beds, randomBetween(1, 4));
      const sqft = propertyType === "Condo" 
        ? randomBetween(600, 1800)
        : randomBetween(1200, 4000);
      const yearBuilt = randomBetween(1920, 2023);
      const priceVariance = 0.7 + Math.random() * 0.6;
      const estimatedValue = Math.round(basePrice * priceVariance);
      const pricePerSqft = Math.round(estimatedValue / sqft);
      
      const { score, confidence } = calculateOpportunityScore(
        pricePerSqft,
        medianPricePerSqft,
        yearBuilt,
        sqft
      );

      const lastSaleYearsAgo = randomBetween(1, 10);
      const lastSalePrice = Math.round(estimatedValue * (0.7 + lastSaleYearsAgo * 0.03));
      const lastSaleDate = new Date();
      lastSaleDate.setFullYear(lastSaleDate.getFullYear() - lastSaleYearsAgo);

      const [inserted] = await db.insert(properties).values({
        address: generateAddress(),
        city: zipInfo.city,
        state: zipInfo.state,
        zipCode: zipInfo.zip,
        county: zipInfo.county,
        neighborhood: zipInfo.neighborhood,
        latitude: 40.7 + Math.random() * 0.3,
        longitude: -74.0 + Math.random() * 0.3,
        propertyType,
        beds,
        baths,
        sqft,
        lotSize: propertyType === "SFH" ? randomBetween(3000, 20000) : null,
        yearBuilt,
        lastSalePrice,
        lastSaleDate,
        estimatedValue,
        pricePerSqft,
        opportunityScore: score,
        confidenceLevel: confidence,
      }).returning({ id: properties.id, zipCode: properties.zipCode, pricePerSqft: properties.pricePerSqft });

      insertedProperties.push({ id: inserted.id, zipCode: inserted.zipCode, pricePerSqft: inserted.pricePerSqft || 0 });
    }
  }
  console.log(`Inserted ${insertedProperties.length} properties`);

  console.log("Seeding sales history...");
  let salesCount = 0;
  for (const prop of insertedProperties) {
    const numSales = randomBetween(1, 4);
    for (let i = 0; i < numSales; i++) {
      const yearsAgo = randomBetween(1, 15);
      const saleDate = new Date();
      saleDate.setFullYear(saleDate.getFullYear() - yearsAgo);
      
      await db.insert(sales).values({
        propertyId: prop.id,
        salePrice: Math.round(prop.pricePerSqft * randomBetween(800, 2500) * (0.6 + yearsAgo * 0.03)),
        saleDate,
        armsLength: Math.random() > 0.1,
        deedType: randomFrom(["Warranty", "Quitclaim", "Grant"]),
      });
      salesCount++;
    }
  }
  console.log(`Inserted ${salesCount} sales records`);

  console.log("Seeding market aggregates...");
  let aggregatesCount = 0;
  for (const zipInfo of allZips) {
    const baseMedian = zipInfo.state === "NY" && zipInfo.city === "New York" 
      ? randomBetween(900000, 1800000)
      : zipInfo.state === "NY" 
        ? randomBetween(550000, 950000)
        : zipInfo.state === "NJ"
          ? randomBetween(450000, 750000)
          : randomBetween(650000, 1100000);

    await db.insert(marketAggregates).values({
      geoType: "zip",
      geoId: zipInfo.zip,
      geoName: `${zipInfo.city} ${zipInfo.zip}`,
      state: zipInfo.state,
      medianPrice: baseMedian,
      medianPricePerSqft: Math.round(baseMedian / randomBetween(1100, 1800)),
      p25Price: Math.round(baseMedian * 0.75),
      p75Price: Math.round(baseMedian * 1.35),
      p25PricePerSqft: Math.round(baseMedian * 0.75 / 1400),
      p75PricePerSqft: Math.round(baseMedian * 1.35 / 1400),
      transactionCount: randomBetween(50, 300),
      turnoverRate: 0.03 + Math.random() * 0.05,
      volatility: 0.05 + Math.random() * 0.1,
      trend3m: -0.05 + Math.random() * 0.1,
      trend6m: -0.03 + Math.random() * 0.08,
      trend12m: 0.02 + Math.random() * 0.06,
    });
    aggregatesCount++;

    await db.insert(marketAggregates).values({
      geoType: "city",
      geoId: zipInfo.city.toLowerCase().replace(/\s+/g, "-"),
      geoName: zipInfo.city,
      state: zipInfo.state,
      medianPrice: baseMedian,
      medianPricePerSqft: Math.round(baseMedian / randomBetween(1100, 1800)),
      p25Price: Math.round(baseMedian * 0.7),
      p75Price: Math.round(baseMedian * 1.4),
      p25PricePerSqft: Math.round(baseMedian * 0.7 / 1400),
      p75PricePerSqft: Math.round(baseMedian * 1.4 / 1400),
      transactionCount: randomBetween(200, 1000),
      turnoverRate: 0.035 + Math.random() * 0.04,
      volatility: 0.04 + Math.random() * 0.08,
      trend3m: -0.04 + Math.random() * 0.08,
      trend6m: -0.02 + Math.random() * 0.06,
      trend12m: 0.01 + Math.random() * 0.05,
    });
    aggregatesCount++;

    await db.insert(marketAggregates).values({
      geoType: "neighborhood",
      geoId: zipInfo.neighborhood.toLowerCase().replace(/\s+/g, "-"),
      geoName: zipInfo.neighborhood,
      state: zipInfo.state,
      medianPrice: baseMedian,
      medianPricePerSqft: Math.round(baseMedian / randomBetween(1100, 1800)),
      p25Price: Math.round(baseMedian * 0.78),
      p75Price: Math.round(baseMedian * 1.32),
      p25PricePerSqft: Math.round(baseMedian * 0.78 / 1400),
      p75PricePerSqft: Math.round(baseMedian * 1.32 / 1400),
      transactionCount: randomBetween(30, 150),
      turnoverRate: 0.025 + Math.random() * 0.045,
      volatility: 0.055 + Math.random() * 0.09,
      trend3m: -0.03 + Math.random() * 0.07,
      trend6m: -0.01 + Math.random() * 0.05,
      trend12m: 0.02 + Math.random() * 0.04,
    });
    aggregatesCount++;
  }
  console.log(`Inserted ${aggregatesCount} market aggregates`);

  console.log("Seeding coverage matrix...");
  const coverageLevelsByState = {
    "NY": ["AltSignals", "Comps", "Comps", "Listings"],
    "NJ": ["Comps", "SalesHistory", "Listings"],
    "CT": ["SalesHistory", "Comps", "PropertyFacts"],
  };

  for (const state of ["NY", "NJ", "CT"]) {
    await db.insert(coverageMatrix).values({
      state,
      coverageLevel: randomFrom(coverageLevelsByState[state as keyof typeof coverageLevelsByState]),
      freshnessSla: state === "NY" ? 1 : state === "NJ" ? 7 : 14,
      sqftCompleteness: 0.85 + Math.random() * 0.12,
      yearBuiltCompleteness: 0.88 + Math.random() * 0.1,
      lastSaleCompleteness: 0.75 + Math.random() * 0.15,
      confidenceScore: 0.7 + Math.random() * 0.25,
      allowedAiClaims: ["pricing", "trends", "comparables", state === "NY" ? "neighborhood_analysis" : "market_overview"],
    });

    const stateZips = allZips.filter(z => z.state === state);
    for (const zipInfo of stateZips.slice(0, 3)) {
      await db.insert(coverageMatrix).values({
        state,
        county: zipInfo.county,
        zipCode: zipInfo.zip,
        coverageLevel: randomFrom(coverageLevelsByState[state as keyof typeof coverageLevelsByState]),
        freshnessSla: state === "NY" ? 1 : 7,
        sqftCompleteness: 0.88 + Math.random() * 0.1,
        yearBuiltCompleteness: 0.9 + Math.random() * 0.08,
        lastSaleCompleteness: 0.78 + Math.random() * 0.15,
        confidenceScore: 0.75 + Math.random() * 0.2,
        allowedAiClaims: ["pricing", "trends", "comparables"],
      });
    }
  }
  console.log("Coverage matrix seeded");

  console.log("Seeding data sources...");
  await db.insert(dataSources).values([
    {
      name: "NYC ACRIS",
      type: "public",
      description: "NYC Automated City Register Information System - property transactions and deeds",
      refreshCadence: "daily",
      lastRefresh: new Date(),
      recordCount: 2500000,
      licensingNotes: "Public data, no restrictions",
      isActive: true,
    },
    {
      name: "NJ OPRA Records",
      type: "public",
      description: "New Jersey Open Public Records Act - property tax and ownership data",
      refreshCadence: "weekly",
      lastRefresh: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      recordCount: 1800000,
      licensingNotes: "Public data, per-request fees may apply",
      isActive: true,
    },
    {
      name: "CT Land Records",
      type: "public",
      description: "Connecticut town clerk land records and property transfers",
      refreshCadence: "weekly",
      lastRefresh: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      recordCount: 950000,
      licensingNotes: "Public data, varies by municipality",
      isActive: true,
    },
    {
      name: "CoreLogic Tax Data",
      type: "paid",
      description: "Comprehensive property tax assessments and ownership history",
      refreshCadence: "monthly",
      lastRefresh: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      recordCount: 4500000,
      licensingNotes: "Licensed data, per-record pricing",
      isActive: true,
    },
    {
      name: "Zillow API",
      type: "paid",
      description: "Zillow property estimates and market trends",
      refreshCadence: "daily",
      lastRefresh: new Date(),
      recordCount: 3200000,
      licensingNotes: "API subscription, rate limits apply",
      isActive: true,
    },
  ]);
  console.log("Data sources seeded");

  console.log("Seeding comparables...");
  let compsCount = 0;
  const propertiesByZip: Record<string, typeof insertedProperties> = {};
  for (const prop of insertedProperties) {
    if (!propertiesByZip[prop.zipCode]) {
      propertiesByZip[prop.zipCode] = [];
    }
    propertiesByZip[prop.zipCode].push(prop);
  }

  for (const prop of insertedProperties) {
    const sameZipProps = propertiesByZip[prop.zipCode].filter(p => p.id !== prop.id);
    const numComps = Math.min(sameZipProps.length, randomBetween(3, 6));
    
    const shuffled = sameZipProps.sort(() => Math.random() - 0.5).slice(0, numComps);
    
    for (const compProp of shuffled) {
      const similarityScore = 0.7 + Math.random() * 0.25;
      const priceDiff = Math.abs(prop.pricePerSqft - compProp.pricePerSqft);
      
      await db.insert(comps).values({
        subjectPropertyId: prop.id,
        compPropertyId: compProp.id,
        similarityScore,
        sqftAdjustment: -0.1 + Math.random() * 0.2,
        ageAdjustment: -0.05 + Math.random() * 0.1,
        bedsAdjustment: -0.05 + Math.random() * 0.1,
        adjustedPrice: Math.round(compProp.pricePerSqft * 1500 * (1 + (Math.random() - 0.5) * 0.1)),
      });
      compsCount++;
    }
  }
  console.log(`Inserted ${compsCount} comparable relationships`);

  console.log("Database seed completed successfully!");
}

seedData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
