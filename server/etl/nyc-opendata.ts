import { db } from "../db";
import { properties, sales, dataSources, comps } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

const NYC_OPENDATA_URLS = {
  pluto: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
  propertySales: "https://data.cityofnewyork.us/resource/usep-8jbt.json",
};

const BOROUGH_MAP: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx", 
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
  MN: "Manhattan",
  BX: "Bronx",
  BK: "Brooklyn",
  QN: "Queens",
  SI: "Staten Island",
};

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "01": "SFH",
  "02": "SFH",
  "03": "SFH",
  "04": "Multi-family 2-4",
  "05": "Multi-family 2-4",
  "06": "Multi-family 2-4",
  "07": "Multi-family 5+",
  "08": "Multi-family 5+",
  "09": "Condo",
  "10": "Condo",
  "11": "Multi-family 5+",
  "12": "Condo",
  "13": "Condo",
  "14": "Condo",
  "15": "Condo",
  "16": "Condo",
  "17": "Condo",
  R1: "SFH",
  R2: "SFH",
  R3: "Multi-family 2-4",
  R4: "Multi-family 2-4",
  R5: "Multi-family 5+",
  R6: "Multi-family 5+",
  R7: "Multi-family 5+",
  R8: "Multi-family 5+",
  R9: "Multi-family 5+",
  RR: "SFH",
  C0: "Condo",
  C1: "Condo",
  C2: "Condo",
  C3: "Condo",
  C4: "Condo",
  C5: "Condo",
  C6: "Condo",
  C7: "Condo",
  C8: "Condo",
  C9: "Condo",
  S0: "SFH",
  S1: "SFH",
  S2: "SFH",
  S3: "SFH",
  S4: "SFH",
  S5: "SFH",
  S9: "SFH",
};

interface PlutoRecord {
  bbl: string;
  borough: string;
  block: string;
  lot: string;
  address: string;
  zipcode: string;
  bldgclass: string;
  landuse: string;
  numfloors: string;
  unitsres: string;
  unitstotal: string;
  lotarea: string;
  bldgarea: string;
  resarea: string;
  yearbuilt: string;
  assesstot: string;
  xcoord: string;
  ycoord: string;
  latitude: string;
  longitude: string;
  cd: string;
  zonedist1: string;
}

interface PropertySaleRecord {
  borough: string;
  neighborhood: string;
  building_class_category: string;
  building_class_at_present: string;
  address: string;
  apartment_number: string;
  zip_code: string;
  residential_units: string;
  commercial_units: string;
  total_units: string;
  land_square_feet: string;
  gross_square_feet: string;
  year_built: string;
  sale_price: string;
  sale_date: string;
}

function calculateOpportunityScore(
  salePrice: number,
  estimatedValue: number,
  yearBuilt: number,
  sqft: number
): { score: number; confidence: string } {
  if (!salePrice || !estimatedValue || salePrice <= 0 || estimatedValue <= 0) {
    return { score: 50, confidence: "Low" };
  }

  const mispricing = Math.min(100, Math.max(0, ((estimatedValue - salePrice) / estimatedValue) * 100 + 50)) * 0.4;
  const yearFactor = Math.min(100, Math.max(0, (yearBuilt - 1900) / 1.2)) * 0.15;
  const sizeFactor = Math.min(100, sqft / 30) * 0.15;
  const liquidity = 70 * 0.15;
  const riskFactor = 75 * 0.15;

  const score = Math.round(mispricing + yearFactor + sizeFactor + liquidity + riskFactor);
  const confidence = score > 70 ? "High" : score > 50 ? "Medium" : "Low";

  return { score: Math.min(100, Math.max(0, score)), confidence };
}

export async function downloadNYCPlutoData(limit: number = 5000): Promise<PlutoRecord[]> {
  console.log(`Downloading NYC PLUTO data (limit: ${limit})...`);

  const residentialQuery = `$where=landuse in ('01','02','03','04') AND unitsres > 0&$limit=${limit}&$order=yearbuilt DESC`;
  const url = `${NYC_OPENDATA_URLS.pluto}?${residentialQuery}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PLUTO data: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Downloaded ${data.length} PLUTO records`);
  return data as PlutoRecord[];
}

export async function downloadNYCPropertySales(limit: number = 5000): Promise<PropertySaleRecord[]> {
  console.log(`Downloading NYC Property Sales data (limit: ${limit})...`);

  const query = `$where=sale_price > 100000 AND year_built > 1800&$limit=${limit}&$order=sale_date DESC`;
  const url = `${NYC_OPENDATA_URLS.propertySales}?${query}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch property sales data: ${response.status}`);
  }

  const data = await response.json();
  console.log(`Downloaded ${data.length} property sale records`);
  return data as PropertySaleRecord[];
}

export async function importNYCProperties(
  plutoData: PlutoRecord[],
  salesData: PropertySaleRecord[]
): Promise<{ propertiesCount: number; salesCount: number }> {
  console.log("Importing NYC properties and sales...");

  const salesByAddress: Record<string, PropertySaleRecord[]> = {};
  for (const sale of salesData) {
    const key = `${sale.address?.toLowerCase().trim()}-${sale.zip_code}`;
    if (!salesByAddress[key]) salesByAddress[key] = [];
    salesByAddress[key].push(sale);
  }

  let propertiesCount = 0;
  let salesCount = 0;
  const insertedPropertyIds: { id: string; zipCode: string; pricePerSqft: number }[] = [];

  for (const record of plutoData) {
    if (!record.address || !record.zipcode) continue;

    const borough = BOROUGH_MAP[record.borough] || "Unknown";
    const bldgClass = record.bldgclass?.substring(0, 2) || "";
    const propertyType = PROPERTY_TYPE_MAP[bldgClass] || "SFH";

    const sqft = parseInt(record.resarea) || parseInt(record.bldgarea) || 1500;
    const yearBuilt = parseInt(record.yearbuilt) || 1950;
    const units = parseInt(record.unitsres) || 1;
    const beds = Math.min(units * 2, 10);
    const baths = Math.max(1, Math.floor(beds * 0.6));
    const lotSize = parseInt(record.lotarea) || null;

    const assessedValue = parseInt(record.assesstot) || 0;
    const estimatedValue = assessedValue > 0 ? assessedValue * 5 : sqft * 600;

    const addressKey = `${record.address?.toLowerCase().trim()}-${record.zipcode}`;
    const matchingSales = salesByAddress[addressKey] || [];
    const latestSale = matchingSales[0];

    const lastSalePrice = latestSale ? parseInt(latestSale.sale_price) || null : null;
    const lastSaleDate = latestSale?.sale_date ? new Date(latestSale.sale_date) : null;

    const pricePerSqft = lastSalePrice && sqft > 0 
      ? Math.round(lastSalePrice / sqft) 
      : Math.round(estimatedValue / sqft);

    const { score, confidence } = calculateOpportunityScore(
      lastSalePrice || estimatedValue,
      estimatedValue,
      yearBuilt,
      sqft
    );

    try {
      const [inserted] = await db.insert(properties).values({
        address: record.address,
        city: borough,
        state: "NY",
        zipCode: record.zipcode,
        county: "New York",
        neighborhood: borough,
        latitude: parseFloat(record.latitude) || null,
        longitude: parseFloat(record.longitude) || null,
        propertyType,
        beds,
        baths,
        sqft,
        lotSize,
        yearBuilt,
        lastSalePrice,
        lastSaleDate,
        estimatedValue: Math.round(estimatedValue),
        pricePerSqft,
        opportunityScore: score,
        confidenceLevel: confidence,
      }).returning({ id: properties.id, zipCode: properties.zipCode, pricePerSqft: properties.pricePerSqft });

      insertedPropertyIds.push({ 
        id: inserted.id, 
        zipCode: inserted.zipCode, 
        pricePerSqft: inserted.pricePerSqft || 0 
      });
      propertiesCount++;

      for (const sale of matchingSales) {
        const salePrice = parseInt(sale.sale_price);
        if (salePrice && salePrice > 10000) {
          await db.insert(sales).values({
            propertyId: inserted.id,
            salePrice,
            saleDate: new Date(sale.sale_date),
            armsLength: true,
            deedType: "Warranty",
          });
          salesCount++;
        }
      }
    } catch (error) {
      console.error(`Error inserting property: ${record.address}`, error);
    }
  }

  console.log(`Creating comparable relationships...`);
  await createComparables(insertedPropertyIds);

  console.log(`Imported ${propertiesCount} properties and ${salesCount} sales`);
  return { propertiesCount, salesCount };
}

async function createComparables(
  propertyData: { id: string; zipCode: string; pricePerSqft: number }[]
): Promise<number> {
  const propertiesByZip: Record<string, typeof propertyData> = {};
  for (const prop of propertyData) {
    if (!propertiesByZip[prop.zipCode]) {
      propertiesByZip[prop.zipCode] = [];
    }
    propertiesByZip[prop.zipCode].push(prop);
  }

  let compsCount = 0;
  for (const prop of propertyData) {
    const sameZipProps = propertiesByZip[prop.zipCode]?.filter(p => p.id !== prop.id) || [];
    const numComps = Math.min(sameZipProps.length, 5);
    const selectedComps = sameZipProps
      .sort(() => Math.random() - 0.5)
      .slice(0, numComps);

    for (const compProp of selectedComps) {
      const similarityScore = 0.7 + Math.random() * 0.25;
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

  console.log(`Created ${compsCount} comparable relationships`);
  return compsCount;
}

export async function createNYCDataSources(): Promise<void> {
  await db.insert(dataSources).values([
    {
      name: "NYC PLUTO",
      type: "public",
      description: "Primary Land Use Tax Lot Output - comprehensive property data for NYC",
      refreshCadence: "monthly",
      lastRefresh: new Date(),
      recordCount: 0,
      licensingNotes: "NYC Open Data - free for public use",
      isActive: true,
    },
    {
      name: "NYC Property Sales",
      type: "public",
      description: "NYC Department of Finance rolling property sales data",
      refreshCadence: "monthly",
      lastRefresh: new Date(),
      recordCount: 0,
      licensingNotes: "NYC Open Data - free for public use",
      isActive: true,
    },
  ]);
}
