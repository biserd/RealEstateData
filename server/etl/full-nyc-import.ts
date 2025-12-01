import { db } from "../db";
import { 
  properties, 
  plutoRaw, 
  valuationsRaw, 
  acrisRaw, 
  hpdRaw,
  propertyValuations,
  propertyTransactions,
  propertyCompliance,
  propertyProfiles,
  propertyDataLinks,
  dataSources,
  comps,
  sales,
} from "@shared/schema";
import { sql, eq } from "drizzle-orm";

const NYC_OPENDATA_URLS = {
  pluto: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
  valuations: "https://data.cityofnewyork.us/resource/yjxr-fw8i.json",
  acrisMaster: "https://data.cityofnewyork.us/resource/bnx9-e6tj.json",
  acrisLegals: "https://data.cityofnewyork.us/resource/8h5j-fqxa.json",
  hpdBuildings: "https://data.cityofnewyork.us/resource/tesw-yqqr.json",
  hpdViolations: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
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

const BOROUGH_TO_COUNTY: Record<string, string> = {
  Manhattan: "New York",
  Bronx: "Bronx",
  Brooklyn: "Kings",
  Queens: "Queens",
  "Staten Island": "Richmond",
};

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "01": "SFH", "02": "SFH", "03": "SFH",
  "04": "Multi-family 2-4", "05": "Multi-family 2-4", "06": "Multi-family 2-4",
  "07": "Multi-family 5+", "08": "Multi-family 5+", "09": "Condo",
  "10": "Condo", "11": "Multi-family 5+", "12": "Condo", "13": "Condo",
  R1: "SFH", R2: "SFH", R3: "Multi-family 2-4", R4: "Multi-family 2-4",
  R5: "Multi-family 5+", R6: "Multi-family 5+", R7: "Multi-family 5+",
  C0: "Condo", C1: "Condo", C2: "Condo", C4: "Condo", C6: "Condo",
  S0: "SFH", S1: "SFH", S2: "SFH", S3: "SFH", S4: "SFH",
  A0: "SFH", A1: "SFH", A2: "SFH", A3: "SFH", A4: "SFH", A5: "SFH",
  B1: "SFH", B2: "SFH", B3: "SFH", B9: "SFH",
  D0: "Multi-family 5+", D1: "Multi-family 5+", D3: "Multi-family 5+",
  H1: "Mixed-Use", H2: "Mixed-Use", H3: "Mixed-Use", H4: "Mixed-Use",
  K1: "Commercial", K2: "Commercial", K3: "Commercial", K4: "Commercial",
  O1: "Commercial", O2: "Commercial", O3: "Commercial", O4: "Commercial",
  V0: "Vacant Land", V1: "Vacant Land", V2: "Vacant Land", V3: "Vacant Land",
};

function createBBL(borough: string, block: string, lot: string): string {
  const boroughMap: Record<string, string> = {
    MN: "1", BX: "2", BK: "3", QN: "4", SI: "5",
    "1": "1", "2": "2", "3": "3", "4": "4", "5": "5",
    MANHATTAN: "1", BRONX: "2", BROOKLYN: "3", QUEENS: "4", "STATEN ISLAND": "5",
  };
  const boroughNum = boroughMap[borough?.toUpperCase()] || borough?.padStart(1, "0") || "0";
  const blockNum = (block || "0").toString().padStart(5, "0");
  const lotNum = (lot || "0").toString().padStart(4, "0");
  return `${boroughNum}${blockNum}${lotNum}`;
}

async function fetchWithPagination(
  baseUrl: string,
  query: string,
  totalLimit: number,
  batchSize: number = 10000
): Promise<any[]> {
  const allRecords: any[] = [];
  let offset = 0;
  
  while (offset < totalLimit) {
    const currentBatchSize = Math.min(batchSize, totalLimit - offset);
    const url = `${baseUrl}?${query}&$limit=${currentBatchSize}&$offset=${offset}`;
    
    console.log(`  Fetching: offset=${offset}, limit=${currentBatchSize}...`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`  HTTP error: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`  No more records at offset ${offset}`);
        break;
      }
      
      allRecords.push(...data);
      console.log(`  Fetched ${data.length}. Total: ${allRecords.length}`);
      
      if (data.length < currentBatchSize) break;
      
      offset += batchSize;
      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      console.error(`  Fetch error at offset ${offset}:`, error);
      break;
    }
  }
  
  return allRecords;
}

// ============================================
// PLUTO IMPORT - Full tax lot data
// ============================================
export async function importFullPluto(limit: number = 500000): Promise<number> {
  console.log("\n📦 Importing Full PLUTO Dataset...");
  
  const query = "$order=bbl";
  const records = await fetchWithPagination(NYC_OPENDATA_URLS.pluto, query, limit);
  console.log(`  Downloaded ${records.length} PLUTO records`);
  
  let imported = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((r: any) => ({
      bbl: r.bbl || createBBL(r.borough, r.block, r.lot),
      borough: r.borough,
      block: r.block,
      lot: r.lot,
      address: r.address,
      zipCode: r.zipcode,
      bldgClass: r.bldgclass,
      landUse: r.landuse,
      ownerName: r.ownername,
      numFloors: parseFloat(r.numfloors) || null,
      unitsRes: parseInt(r.unitsres) || null,
      unitsTotal: parseInt(r.unitstotal) || null,
      lotArea: parseInt(r.lotarea) || null,
      bldgArea: parseInt(r.bldgarea) || null,
      resArea: parseInt(r.resarea) || null,
      officeArea: parseInt(r.officearea) || null,
      retailArea: parseInt(r.retailarea) || null,
      yearBuilt: parseInt(r.yearbuilt) || null,
      yearAltered1: parseInt(r.yearalter1) || null,
      yearAltered2: parseInt(r.yearalter2) || null,
      condoNo: r.condono,
      xCoord: parseFloat(r.xcoord) || null,
      yCoord: parseFloat(r.ycoord) || null,
      latitude: parseFloat(r.latitude) || null,
      longitude: parseFloat(r.longitude) || null,
      communityDistrict: r.cd,
      zoneDist1: r.zonedist1,
      zoneDist2: r.zonedist2,
      overlay1: r.overlay1,
      overlay2: r.overlay2,
      spdist1: r.spdist1,
      spdist2: r.spdist2,
      assessLand: parseInt(r.assessland) || null,
      assessTot: parseInt(r.assesstot) || null,
      exemptLand: parseInt(r.exemptland) || null,
      exemptTot: parseInt(r.exempttot) || null,
      rawData: r,
    })).filter(v => v.bbl);
    
    if (values.length > 0) {
      try {
        await db.insert(plutoRaw).values(values);
        imported += values.length;
      } catch (error) {
        console.error(`  Error inserting batch at ${i}:`, error);
      }
    }
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Imported ${imported} PLUTO records...`);
    }
  }
  
  console.log(`✅ Imported ${imported} PLUTO records to staging`);
  return imported;
}

// ============================================
// VALUATIONS IMPORT - Tax assessment data
// ============================================
export async function importValuations(limit: number = 500000): Promise<number> {
  console.log("\n💰 Importing Property Valuations...");
  
  const query = "$order=bbl";
  const records = await fetchWithPagination(NYC_OPENDATA_URLS.valuations, query, limit);
  console.log(`  Downloaded ${records.length} valuation records`);
  
  let imported = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((r: any) => ({
      bbl: r.bbl || createBBL(r.boro, r.block, r.lot),
      borough: r.boro,
      block: r.block,
      lot: r.lot,
      taxClass: r.tc,
      buildingClass: r.bldg_class,
      ownerName: r.owner,
      address: r.housenum_lo ? `${r.housenum_lo} ${r.street_name}` : r.street_name,
      aptNo: r.aptno,
      zipCode: r.zip_code,
      assessYear: parseInt(r.year) || new Date().getFullYear(),
      landValue: parseInt(r.curavl_land) || parseInt(r.avtot) || null,
      totalValue: parseInt(r.curavl_tot) || parseInt(r.avtot) || null,
      transitionalLand: parseInt(r.curtxbl_land) || null,
      transitionalTotal: parseInt(r.curtxbl_tot) || null,
      newLandValue: parseInt(r.newavl_land) || null,
      newTotalValue: parseInt(r.newavl_tot) || null,
      exemptionCodeOne: r.exempt_code_1,
      exemptionCodeTwo: r.exempt_code_2,
      exemptionCodeThree: r.exempt_code_3,
      exemptionCodeFour: r.exempt_code_4,
      rawData: r,
    })).filter(v => v.bbl);
    
    if (values.length > 0) {
      try {
        await db.insert(valuationsRaw).values(values);
        imported += values.length;
      } catch (error) {
        console.error(`  Error inserting batch at ${i}:`, error);
      }
    }
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Imported ${imported} valuation records...`);
    }
  }
  
  console.log(`✅ Imported ${imported} valuation records to staging`);
  return imported;
}

// ============================================
// ACRIS IMPORT - Deed and mortgage transactions
// ============================================
export async function importAcris(limit: number = 200000): Promise<number> {
  console.log("\n📜 Importing ACRIS Transactions...");
  
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const dateStr = fiveYearsAgo.toISOString().split('T')[0];
  
  const query = `$where=recorded_datetime > '${dateStr}' AND doc_type in ('DEED','DEEDO','MTGE','ASST','AGMT')&$order=recorded_datetime DESC`;
  const records = await fetchWithPagination(NYC_OPENDATA_URLS.acrisMaster, query, limit);
  console.log(`  Downloaded ${records.length} ACRIS records`);
  
  let imported = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((r: any) => {
      const bbl = r.borough && r.block && r.lot 
        ? createBBL(r.borough, r.block, r.lot)
        : null;
      
      return {
        documentId: r.document_id || `ACRIS-${Date.now()}-${Math.random()}`,
        recordType: "MASTER",
        bbl,
        borough: r.borough,
        block: r.block,
        lot: r.lot,
        docType: r.doc_type,
        docDate: r.document_date ? new Date(r.document_date) : null,
        recordedDateTime: r.recorded_datetime ? new Date(r.recorded_datetime) : null,
        docAmount: parseFloat(r.document_amt) || null,
        percentTransferred: parseFloat(r.percent_trans) || null,
        goodThroughDate: r.good_through_date ? new Date(r.good_through_date) : null,
        streetNumber: r.street_number,
        streetName: r.street_name,
        unit: r.unit,
        rawData: r,
      };
    }).filter(v => v.documentId);
    
    if (values.length > 0) {
      try {
        await db.insert(acrisRaw).values(values);
        imported += values.length;
      } catch (error) {
        console.error(`  Error inserting batch at ${i}:`, error);
      }
    }
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Imported ${imported} ACRIS records...`);
    }
  }
  
  console.log(`✅ Imported ${imported} ACRIS records to staging`);
  return imported;
}

// ============================================
// HPD IMPORT - Building registrations and violations
// ============================================
export async function importHpd(limit: number = 200000): Promise<number> {
  console.log("\n🏢 Importing HPD Building Data...");
  
  const query = "$order=bbl";
  const records = await fetchWithPagination(NYC_OPENDATA_URLS.hpdBuildings, query, limit);
  console.log(`  Downloaded ${records.length} HPD building records`);
  
  let imported = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((r: any) => {
      const bbl = r.bbl || (r.boroid && r.block && r.lot 
        ? createBBL(r.boroid, r.block, r.lot) 
        : null);
      
      return {
        bbl,
        buildingId: r.buildingid,
        registrationId: r.registrationid,
        boroId: r.boroid,
        borough: BOROUGH_MAP[r.boroid] || r.boroid,
        block: r.block,
        lot: r.lot,
        houseNumber: r.housenumber,
        streetName: r.streetname,
        zipCode: r.zip,
        registrationStatus: r.registrationenddate ? "Active" : "Inactive",
        buildingOwnerName: r.ownername || r.corporationname,
        buildingOwnerPhone: r.businessphone,
        buildingOwnerEmail: null,
        agentName: r.managementcompanyname,
        agentPhone: r.managementphone,
        agentAddress: r.managementaddress,
        numFloors: parseInt(r.stories) || null,
        numApartments: parseInt(r.legalunits) || null,
        numLegalUnits: parseInt(r.legalclassa) || null,
        totalViolations: null,
        openViolations: null,
        totalComplaints: null,
        openComplaints: null,
        lastInspectionDate: null,
        rawData: r,
      };
    }).filter(v => v.bbl || v.buildingId);
    
    if (values.length > 0) {
      try {
        await db.insert(hpdRaw).values(values);
        imported += values.length;
      } catch (error) {
        console.error(`  Error inserting batch at ${i}:`, error);
      }
    }
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Imported ${imported} HPD records...`);
    }
  }
  
  console.log(`✅ Imported ${imported} HPD records to staging`);
  return imported;
}

// ============================================
// NORMALIZE DATA - Create unified properties
// ============================================
export async function normalizeToProperties(): Promise<number> {
  console.log("\n🔗 Normalizing data to properties table...");
  
  const plutoRecords = await db.select().from(plutoRaw);
  console.log(`  Processing ${plutoRecords.length} PLUTO records...`);
  
  let created = 0;
  const batchSize = 500;
  
  for (let i = 0; i < plutoRecords.length; i += batchSize) {
    const batch = plutoRecords.slice(i, i + batchSize);
    const values = batch.map(r => {
      const borough = BOROUGH_MAP[r.borough || ""] || r.borough || "Unknown";
      const county = BOROUGH_TO_COUNTY[borough] || "New York";
      const bldgClass = r.bldgClass?.substring(0, 2) || "";
      const propertyType = PROPERTY_TYPE_MAP[bldgClass] || "SFH";
      
      const sqft = r.resArea || r.bldgArea || 1500;
      const units = r.unitsRes || 1;
      const beds = units <= 1 ? 3 : (units <= 4 ? units + 1 : null);
      const baths = units <= 1 ? 2 : (units <= 4 ? units : null);
      
      const assessedValue = r.assessTot || 0;
      const estimatedValue = assessedValue > 0 
        ? Math.min(assessedValue * 3, 50000000)
        : Math.min(sqft * 400, 10000000);
      
      const pricePerSqft = sqft > 0 ? Math.round(estimatedValue / sqft) : 400;
      
      const opportunityScore = 50 + Math.floor(Math.random() * 30);
      
      return {
        bbl: r.bbl,
        address: r.address || "Unknown Address",
        city: borough,
        state: "NY" as const,
        zipCode: r.zipCode || "00000",
        county,
        neighborhood: r.communityDistrict ? `CD ${r.communityDistrict}` : borough,
        latitude: r.latitude,
        longitude: r.longitude,
        propertyType,
        beds,
        baths,
        sqft,
        lotSize: r.lotArea,
        yearBuilt: r.yearBuilt,
        estimatedValue: Math.round(estimatedValue),
        pricePerSqft,
        opportunityScore,
        confidenceLevel: opportunityScore > 70 ? "High" : opportunityScore > 50 ? "Medium" : "Low",
        dataSources: ["PLUTO"],
      };
    }).filter(v => v.bbl && v.address);
    
    if (values.length > 0) {
      try {
        await db.insert(properties).values(values).onConflictDoNothing();
        created += values.length;
      } catch (error) {
        console.error(`  Error inserting batch at ${i}:`, error);
      }
    }
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Created ${created} properties...`);
    }
  }
  
  console.log(`✅ Created ${created} normalized properties`);
  return created;
}

// ============================================
// ENRICH PROPERTIES - Link all datasets
// ============================================
export async function enrichProperties(): Promise<void> {
  console.log("\n🔄 Enriching properties with all data sources...");
  
  const allProperties = await db.select({ id: properties.id, bbl: properties.bbl }).from(properties);
  console.log(`  Found ${allProperties.length} properties to enrich`);
  
  const propertiesByBbl: Record<string, string> = {};
  for (const p of allProperties) {
    if (p.bbl) propertiesByBbl[p.bbl] = p.id;
  }
  
  console.log("  Linking valuations...");
  const valuations = await db.select().from(valuationsRaw);
  let valLinked = 0;
  
  for (const val of valuations) {
    const propertyId = propertiesByBbl[val.bbl];
    if (propertyId) {
      try {
        await db.insert(propertyValuations).values({
          propertyId,
          bbl: val.bbl,
          assessYear: val.assessYear || new Date().getFullYear(),
          taxClass: val.taxClass,
          landValue: val.landValue,
          totalValue: val.totalValue,
        }).onConflictDoNothing();
        valLinked++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${valLinked} valuations`);
  
  console.log("  Linking ACRIS transactions...");
  const acrisRecords = await db.select().from(acrisRaw);
  let txLinked = 0;
  
  for (const tx of acrisRecords) {
    if (!tx.bbl) continue;
    const propertyId = propertiesByBbl[tx.bbl];
    if (propertyId && tx.recordedDateTime) {
      try {
        let txType = "transfer";
        if (tx.docType === "DEED" || tx.docType === "DEEDO") txType = "sale";
        else if (tx.docType === "MTGE") txType = "mortgage";
        else if (tx.docType === "ASST") txType = "assignment";
        
        await db.insert(propertyTransactions).values({
          propertyId,
          bbl: tx.bbl,
          documentId: tx.documentId,
          transactionType: txType,
          transactionDate: tx.recordedDateTime,
          amount: tx.docAmount,
        }).onConflictDoNothing();
        txLinked++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${txLinked} transactions`);
  
  console.log("  Linking HPD compliance data...");
  const hpdRecords = await db.select().from(hpdRaw);
  let hpdLinked = 0;
  
  for (const hpd of hpdRecords) {
    if (!hpd.bbl) continue;
    const propertyId = propertiesByBbl[hpd.bbl];
    if (propertyId) {
      try {
        await db.insert(propertyCompliance).values({
          propertyId,
          bbl: hpd.bbl,
          registrationStatus: hpd.registrationStatus,
          totalViolations: hpd.totalViolations || 0,
          openViolations: hpd.openViolations || 0,
          totalComplaints: hpd.totalComplaints || 0,
          openComplaints: hpd.openComplaints || 0,
          complianceScore: 100 - Math.min(100, (hpd.openViolations || 0) * 10),
          riskLevel: (hpd.openViolations || 0) > 5 ? "high" : (hpd.openViolations || 0) > 0 ? "medium" : "low",
        }).onConflictDoNothing();
        hpdLinked++;
      } catch (e) {}
    }
  }
  console.log(`  Linked ${hpdLinked} HPD records`);
  
  console.log(`✅ Enrichment complete`);
}

// ============================================
// CREATE COMPARABLES - Generate comp relationships
// ============================================
export async function createComparables(): Promise<number> {
  console.log("\n🔄 Creating comparable relationships...");
  
  const allProps = await db.select({
    id: properties.id,
    zipCode: properties.zipCode,
    pricePerSqft: properties.pricePerSqft,
    propertyType: properties.propertyType,
  }).from(properties);
  
  console.log(`  Found ${allProps.length} properties`);
  
  const propertiesByZip: Record<string, typeof allProps> = {};
  for (const prop of allProps) {
    if (!propertiesByZip[prop.zipCode]) {
      propertiesByZip[prop.zipCode] = [];
    }
    propertiesByZip[prop.zipCode].push(prop);
  }
  
  let compsCount = 0;
  const batchSize = 1000;
  let compBatch: any[] = [];
  
  for (let i = 0; i < allProps.length; i++) {
    const prop = allProps[i];
    const sameZipProps = propertiesByZip[prop.zipCode]
      ?.filter(p => p.id !== prop.id && p.propertyType === prop.propertyType) || [];
    
    const numComps = Math.min(sameZipProps.length, 5);
    const selectedComps = sameZipProps
      .sort(() => Math.random() - 0.5)
      .slice(0, numComps);
    
    for (const compProp of selectedComps) {
      const adjustedPrice = Math.min(
        2000000000,
        Math.round((Math.min(compProp.pricePerSqft || 400, 10000)) * 1500 * (1 + (Math.random() - 0.5) * 0.1))
      );
      
      compBatch.push({
        subjectPropertyId: prop.id,
        compPropertyId: compProp.id,
        similarityScore: 0.7 + Math.random() * 0.25,
        sqftAdjustment: -0.1 + Math.random() * 0.2,
        ageAdjustment: -0.05 + Math.random() * 0.1,
        bedsAdjustment: -0.05 + Math.random() * 0.1,
        adjustedPrice,
      });
      compsCount++;
    }
    
    if (compBatch.length >= batchSize) {
      await db.insert(comps).values(compBatch);
      compBatch = [];
      console.log(`  Created ${compsCount} comps...`);
    }
  }
  
  if (compBatch.length > 0) {
    await db.insert(comps).values(compBatch);
  }
  
  console.log(`✅ Created ${compsCount} comparable relationships`);
  return compsCount;
}

// ============================================
// UPDATE DATA SOURCES
// ============================================
export async function updateDataSources(): Promise<void> {
  console.log("\n📊 Updating data source records...");
  
  const plutoCount = await db.select({ count: sql`count(*)::int` }).from(plutoRaw);
  const valCount = await db.select({ count: sql`count(*)::int` }).from(valuationsRaw);
  const acrisCount = await db.select({ count: sql`count(*)::int` }).from(acrisRaw);
  const hpdCount = await db.select({ count: sql`count(*)::int` }).from(hpdRaw);
  
  const sources = [
    {
      name: "NYC PLUTO (Full)",
      type: "public",
      description: "Complete Primary Land Use Tax Lot Output - all NYC tax lots",
      refreshCadence: "monthly",
      lastRefresh: new Date(),
      recordCount: Number(plutoCount[0]?.count) || 0,
      licensingNotes: "NYC Open Data - free for public use",
      isActive: true,
    },
    {
      name: "NYC Property Valuations",
      type: "public",
      description: "Department of Finance property tax assessments",
      refreshCadence: "annually",
      lastRefresh: new Date(),
      recordCount: Number(valCount[0]?.count) || 0,
      licensingNotes: "NYC Open Data - free for public use",
      isActive: true,
    },
    {
      name: "ACRIS Real Property",
      type: "public",
      description: "Automated City Register Information System - deed and mortgage records",
      refreshCadence: "daily",
      lastRefresh: new Date(),
      recordCount: Number(acrisCount[0]?.count) || 0,
      licensingNotes: "NYC Open Data - free for public use",
      isActive: true,
    },
    {
      name: "HPD Buildings",
      type: "public",
      description: "Housing Preservation & Development building registrations",
      refreshCadence: "monthly",
      lastRefresh: new Date(),
      recordCount: Number(hpdCount[0]?.count) || 0,
      licensingNotes: "NYC Open Data - free for public use",
      isActive: true,
    },
  ];
  
  for (const source of sources) {
    await db.insert(dataSources).values(source).onConflictDoNothing();
  }
  
  console.log("✅ Data sources updated");
}

// ============================================
// MAIN IMPORT FUNCTION
// ============================================
export async function runFullImport(options: {
  plutoLimit?: number;
  valuationsLimit?: number;
  acrisLimit?: number;
  hpdLimit?: number;
} = {}): Promise<void> {
  const {
    plutoLimit = 500000,
    valuationsLimit = 500000,
    acrisLimit = 200000,
    hpdLimit = 200000,
  } = options;
  
  console.log("=".repeat(60));
  console.log("FULL NYC DATA IMPORT PIPELINE");
  console.log("=".repeat(60));
  console.log("");
  console.log("This will import data from 4 NYC Open Data sources:");
  console.log("  1. PLUTO - Tax lot data (up to " + plutoLimit.toLocaleString() + " records)");
  console.log("  2. Property Valuations (up to " + valuationsLimit.toLocaleString() + " records)");
  console.log("  3. ACRIS - Transactions (up to " + acrisLimit.toLocaleString() + " records)");
  console.log("  4. HPD - Building data (up to " + hpdLimit.toLocaleString() + " records)");
  console.log("");
  
  const startTime = Date.now();
  
  console.log("Step 1: Clearing existing staging data...");
  await db.delete(plutoRaw);
  await db.delete(valuationsRaw);
  await db.delete(acrisRaw);
  await db.delete(hpdRaw);
  await db.delete(propertyValuations);
  await db.delete(propertyTransactions);
  await db.delete(propertyCompliance);
  await db.delete(comps);
  await db.delete(properties);
  console.log("✅ Staging tables cleared\n");
  
  console.log("Step 2: Importing raw data from NYC Open Data...");
  const plutoCount = await importFullPluto(plutoLimit);
  const valCount = await importValuations(valuationsLimit);
  const acrisCount = await importAcris(acrisLimit);
  const hpdCount = await importHpd(hpdLimit);
  
  console.log("\nStep 3: Normalizing to properties table...");
  const propCount = await normalizeToProperties();
  
  console.log("\nStep 4: Enriching properties with all sources...");
  await enrichProperties();
  
  console.log("\nStep 5: Creating comparable relationships...");
  const compsCount = await createComparables();
  
  console.log("\nStep 6: Updating data source records...");
  await updateDataSources();
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  console.log("\n" + "=".repeat(60));
  console.log("IMPORT COMPLETE!");
  console.log("=".repeat(60));
  console.log("");
  console.log("Summary:");
  console.log(`  - PLUTO records: ${plutoCount.toLocaleString()}`);
  console.log(`  - Valuation records: ${valCount.toLocaleString()}`);
  console.log(`  - ACRIS records: ${acrisCount.toLocaleString()}`);
  console.log(`  - HPD records: ${hpdCount.toLocaleString()}`);
  console.log(`  - Normalized properties: ${propCount.toLocaleString()}`);
  console.log(`  - Comparable relationships: ${compsCount.toLocaleString()}`);
  console.log(`  - Time elapsed: ${elapsed}s`);
  console.log("");
  console.log("=".repeat(60));
}

if (require.main === module) {
  runFullImport({
    plutoLimit: 500000,
    valuationsLimit: 500000,
    acrisLimit: 200000,
    hpdLimit: 200000,
  })
    .then(() => {
      console.log("Full import completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
