import { db } from "../server/db";
import { dobPermitsRaw, complaints311Raw, hpdRaw } from "../shared/schema";

const NYC_OPENDATA_BASE = "https://data.cityofnewyork.us/resource";
const BOROUGH_MAP: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

async function runImports() {
  console.log("Starting ETL Imports...");

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateFilter = oneYearAgo.toISOString().split("T")[0];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFilter6m = sixMonthsAgo.toISOString().split("T")[0];

  // Import DOB Permits
  console.log("\nImporting DOB Permits...");
  const permitUrl = `${NYC_OPENDATA_BASE}/rbx6-tga4.json?$where=issued_date>='${dateFilter}'&$limit=15000&$order=issued_date DESC`;
  console.log("Fetching from:", permitUrl);
  const permitRes = await fetch(permitUrl);
  const permits = await permitRes.json() as any[];
  console.log("Fetched", permits.length, "permits");

  let permitCount = 0;
  for (const r of permits) {
    if (!r.job_filing_number) continue;
    try {
      await db.insert(dobPermitsRaw).values({
        id: `permit-${r.job_filing_number}-${r.work_type || "NA"}-${permitCount}`,
        jobNumber: r.job_filing_number,
        bbl: r.bbl || null,
        bin: r.bin || null,
        borough: BOROUGH_MAP[r.borough?.toUpperCase()] || r.borough || null,
        block: r.block || null,
        lot: r.lot || null,
        houseNumber: r.house_no || null,
        streetName: r.street_name || null,
        zipCode: r.zip_code || null,
        jobType: r.filing_reason || null,
        jobDescription: r.job_description?.substring(0, 500) || null,
        workType: r.work_type || null,
        permitStatus: r.permit_status || null,
        issuanceDate: r.issued_date ? new Date(r.issued_date) : null,
        expirationDate: r.expired_date ? new Date(r.expired_date) : null,
        estimatedCost: r.estimated_job_costs ? parseInt(r.estimated_job_costs) : null,
        ownerName: r.owner_business_name || r.owner_name || null,
        rawData: r,
      }).onConflictDoNothing();
      permitCount++;
    } catch (e) {
      // Ignore duplicates
    }
  }
  console.log("Imported", permitCount, "permits");

  // Import 311 complaints
  console.log("\nImporting 311 Complaints...");
  const complaint311Url = `${NYC_OPENDATA_BASE}/erm2-nwe9.json?$where=created_date>='${dateFilter6m}'&$limit=15000&$order=created_date DESC`;
  console.log("Fetching from:", complaint311Url);
  const complaint311Res = await fetch(complaint311Url);
  const complaints311Data = await complaint311Res.json() as any[];
  console.log("Fetched", complaints311Data.length, "311 complaints");

  let complaint311Count = 0;
  for (const r of complaints311Data) {
    if (!r.unique_key) continue;
    try {
      await db.insert(complaints311Raw).values({
        id: `311-${r.unique_key}`,
        uniqueKey: r.unique_key,
        bbl: r.bbl || null,
        latitude: r.latitude ? parseFloat(r.latitude) : null,
        longitude: r.longitude ? parseFloat(r.longitude) : null,
        address: r.incident_address || null,
        city: r.city || null,
        borough: BOROUGH_MAP[r.borough?.toUpperCase()] || r.borough || null,
        zipCode: r.incident_zip || null,
        complaintType: r.complaint_type || null,
        descriptor: r.descriptor || null,
        status: r.status || null,
        createdDate: r.created_date ? new Date(r.created_date) : null,
        closedDate: r.closed_date ? new Date(r.closed_date) : null,
        agency: r.agency || null,
        agencyName: r.agency_name || null,
        rawData: r,
      }).onConflictDoNothing();
      complaint311Count++;
    } catch (e) {
      // Ignore duplicates
    }
  }
  console.log("Imported", complaint311Count, "311 complaints");

  // Import HPD violations
  console.log("\nImporting HPD Violations...");
  const hpdUrl = `${NYC_OPENDATA_BASE}/wvxf-dwi5.json?$where=inspectiondate>='${dateFilter6m}'&$limit=15000&$order=inspectiondate DESC`;
  console.log("Fetching from:", hpdUrl);
  const hpdRes = await fetch(hpdUrl);
  const violations = await hpdRes.json() as any[];
  console.log("Fetched", violations.length, "HPD violations");

  const violationsByBuilding = new Map<string, { total: number; open: number; bbl: string | null; data: any }>();
  for (const r of violations) {
    const buildingId = r.buildingid;
    if (!buildingId) continue;
    const existing = violationsByBuilding.get(buildingId) || { total: 0, open: 0, bbl: r.bbl || null, data: r };
    existing.total++;
    if (r.violationstatus === "Open" || r.currentstatus === "VIOLATION OPEN") existing.open++;
    violationsByBuilding.set(buildingId, existing);
  }

  let hpdCount = 0;
  for (const [buildingId, info] of violationsByBuilding) {
    const r = info.data;
    try {
      await db.insert(hpdRaw).values({
        id: `hpd-${buildingId}`,
        buildingId: buildingId,
        bbl: info.bbl,
        boroId: r.boroid || null,
        borough: BOROUGH_MAP[r.boro?.toUpperCase()] || r.boro || null,
        block: r.block || null,
        lot: r.lot || null,
        houseNumber: r.housenumber || null,
        streetName: r.streetname || null,
        zipCode: r.zip || null,
        totalViolations: info.total,
        openViolations: info.open,
        rawData: { violationSample: r },
      }).onConflictDoNothing();
      hpdCount++;
    } catch (e) {
      // Ignore duplicates
    }
  }
  console.log("Imported", hpdCount, "HPD buildings with violations");

  console.log("\n=== ETL Import Complete ===");
  console.log({
    permits: permitCount,
    complaints311: complaint311Count,
    hpdBuildings: hpdCount,
  });
}

runImports()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  });
