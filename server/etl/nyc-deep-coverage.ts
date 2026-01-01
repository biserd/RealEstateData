import { db } from "../db";
import {
  dobPermitsRaw,
  hpdRaw,
  dobComplaintsRaw,
  complaints311Raw,
  subwayEntrances,
  floodZones,
  amenities,
  propertySignalSummary,
  properties,
} from "@shared/schema";
import { sql, eq, and, or, gte, lte } from "drizzle-orm";

const NYC_OPENDATA_BASE = "https://data.cityofnewyork.us/resource";

const NYC_DATASETS = {
  dobPermits: `${NYC_OPENDATA_BASE}/rbx6-tga4.json`,
  hpdViolations: `${NYC_OPENDATA_BASE}/wvxf-dwi5.json`,
  hpdBuildings: `${NYC_OPENDATA_BASE}/tesw-yqqr.json`,
  dobComplaints: `${NYC_OPENDATA_BASE}/eabe-havv.json`,
  complaints311: `${NYC_OPENDATA_BASE}/erm2-nwe9.json`,
  subwayStations: `https://data.ny.gov/resource/39hk-dx4f.json`,
};

const BOROUGH_MAP: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

async function fetchWithRetry(url: string, retries = 3): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Fetching: ${url.substring(0, 100)}...`);
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return [];
}

async function importDobPermits() {
  console.log("\n=== Importing DOB Permits ===");

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateFilter = oneYearAgo.toISOString().split("T")[0];

  let offset = 0;
  const limit = 5000;
  let totalImported = 0;
  const maxRecords = 50000;

  while (totalImported < maxRecords) {
    const url = `${NYC_DATASETS.dobPermits}?$where=issued_date>='${dateFilter}'&$limit=${limit}&$offset=${offset}&$order=issued_date DESC`;

    try {
      const records = await fetchWithRetry(url);
      if (!records || records.length === 0) break;

      const permitBatch = records
        .filter((r: any) => r.job_filing_number)
        .map((r: any, idx: number) => ({
          id: `permit-${r.job_filing_number}-${r.work_type || "NA"}-${offset + idx}`,
          jobNumber: r.job_filing_number || "",
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
          filingDate: r.approved_date ? new Date(r.approved_date) : null,
          issuanceDate: r.issued_date ? new Date(r.issued_date) : null,
          expirationDate: r.expired_date ? new Date(r.expired_date) : null,
          estimatedCost: r.estimated_job_costs ? parseInt(r.estimated_job_costs) : null,
          ownerName: r.owner_business_name || r.owner_name || null,
          applicantName: r.applicant_business_name || `${r.applicant_first_name || ''} ${r.applicant_last_name || ''}`.trim() || null,
          rawData: r,
        }));

      if (permitBatch.length > 0) {
        await db.insert(dobPermitsRaw).values(permitBatch).onConflictDoNothing();
        totalImported += permitBatch.length;
        console.log(`Imported ${permitBatch.length} permits (total: ${totalImported})`);
      }

      if (records.length < limit) break;
      offset += limit;
    } catch (error) {
      console.error("Error importing permits:", error);
      break;
    }
  }

  console.log(`DOB Permits import complete: ${totalImported} records`);
  return totalImported;
}

async function importHpdViolations() {
  console.log("\n=== Importing HPD Violations ===");

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFilter = sixMonthsAgo.toISOString().split("T")[0];

  let offset = 0;
  const limit = 5000;
  let totalImported = 0;
  const maxRecords = 50000;

  const violationsByBuilding = new Map<string, { total: number; open: number; bbl: string | null; data: any }>();

  while (totalImported < maxRecords) {
    const url = `${NYC_DATASETS.hpdViolations}?$where=inspectiondate>='${dateFilter}'&$limit=${limit}&$offset=${offset}&$order=inspectiondate DESC`;

    try {
      const records = await fetchWithRetry(url);
      if (!records || records.length === 0) break;

      for (const r of records) {
        const buildingId = r.buildingid;
        if (!buildingId) continue;

        const existing = violationsByBuilding.get(buildingId) || {
          total: 0,
          open: 0,
          bbl: r.bbl || null,
          data: r,
        };
        existing.total++;
        if (r.violationstatus === "Open" || r.currentstatus === "VIOLATION OPEN") {
          existing.open++;
        }
        violationsByBuilding.set(buildingId, existing);
      }

      totalImported += records.length;
      console.log(`Processed ${records.length} violations (total: ${totalImported})`);

      if (records.length < limit) break;
      offset += limit;
    } catch (error) {
      console.error("Error importing HPD violations:", error);
      break;
    }
  }

  let buildingsUpserted = 0;
  for (const [buildingId, info] of violationsByBuilding) {
    const r = info.data;
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
      rawData: { violationSample: r, importType: "violations" },
    }).onConflictDoNothing();
    buildingsUpserted++;
  }

  console.log(`HPD Violations import complete: ${totalImported} violations for ${buildingsUpserted} buildings`);
  return totalImported;
}

async function importDobComplaints() {
  console.log("\n=== Importing DOB Complaints ===");

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dateFilter = oneYearAgo.toISOString().split("T")[0];

  let offset = 0;
  const limit = 5000;
  let totalImported = 0;
  const maxRecords = 50000;

  while (totalImported < maxRecords) {
    const url = `${NYC_DATASETS.dobComplaints}?$where=date_entered>='${dateFilter}'&$limit=${limit}&$offset=${offset}&$order=date_entered DESC`;

    try {
      const records = await fetchWithRetry(url);
      if (!records || records.length === 0) break;

      const complaintBatch = records
        .filter((r: any) => r.complaint_number)
        .map((r: any, idx: number) => ({
          id: `dob-complaint-${r.complaint_number}-${offset + idx}`,
          complaintNumber: r.complaint_number,
          bbl: r.bbl || null,
          bin: r.bin || null,
          borough: BOROUGH_MAP[r.borough] || r.borough || null,
          block: r.block || null,
          lot: r.lot || null,
          houseNumber: r.house_number || null,
          streetName: r.house_street || null,
          zipCode: r.zip_code || null,
          complaintCategory: r.complaint_category || null,
          complaintCategoryDescription: r.complaint_category_description || null,
          unitOrApartment: r.unit || null,
          status: r.status || null,
          dispositionCode: r.disposition_code || null,
          dispositionDate: r.disposition_date ? new Date(r.disposition_date) : null,
          dateEntered: r.date_entered ? new Date(r.date_entered) : null,
          inspectionDate: r.inspection_date ? new Date(r.inspection_date) : null,
          dobRunDate: r.dob_run_date ? new Date(r.dob_run_date) : null,
          rawData: r,
        }));

      if (complaintBatch.length > 0) {
        await db.insert(dobComplaintsRaw).values(complaintBatch).onConflictDoNothing();
        totalImported += complaintBatch.length;
        console.log(`Imported ${complaintBatch.length} DOB complaints (total: ${totalImported})`);
      }

      if (records.length < limit) break;
      offset += limit;
    } catch (error) {
      console.error("Error importing DOB complaints:", error);
      break;
    }
  }

  console.log(`DOB Complaints import complete: ${totalImported} records`);
  return totalImported;
}

async function import311Complaints() {
  console.log("\n=== Importing 311 Complaints ===");

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFilter = sixMonthsAgo.toISOString().split("T")[0];

  const housingTypes = [
    "HEAT/HOT WATER",
    "PLUMBING",
    "WATER LEAK",
    "ELECTRIC",
    "ELEVATOR",
    "Noise - Residential",
    "UNSANITARY CONDITION",
    "Rodent",
  ];

  let offset = 0;
  const limit = 5000;
  let totalImported = 0;
  const maxRecords = 50000;

  while (totalImported < maxRecords) {
    const typeFilter = housingTypes.map((t) => `'${t}'`).join(",");
    const url = `${NYC_DATASETS.complaints311}?$where=created_date>='${dateFilter}' AND complaint_type IN (${typeFilter})&$limit=${limit}&$offset=${offset}&$order=created_date DESC`;

    try {
      const records = await fetchWithRetry(url);
      if (!records || records.length === 0) break;

      const complaintBatch = records
        .filter((r: any) => r.unique_key)
        .map((r: any, idx: number) => ({
          id: `311-${r.unique_key}-${offset + idx}`,
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
          locationType: r.location_type || null,
          status: r.status || null,
          resolutionDescription: r.resolution_description?.substring(0, 500) || null,
          createdDate: r.created_date ? new Date(r.created_date) : null,
          closedDate: r.closed_date ? new Date(r.closed_date) : null,
          agency: r.agency || null,
          agencyName: r.agency_name || null,
          rawData: r,
        }));

      if (complaintBatch.length > 0) {
        await db.insert(complaints311Raw).values(complaintBatch).onConflictDoNothing();
        totalImported += complaintBatch.length;
        console.log(`Imported ${complaintBatch.length} 311 complaints (total: ${totalImported})`);
      }

      if (records.length < limit) break;
      offset += limit;
    } catch (error) {
      console.error("Error importing 311 complaints:", error);
      break;
    }
  }

  console.log(`311 Complaints import complete: ${totalImported} records`);
  return totalImported;
}

async function importSubwayStations() {
  console.log("\n=== Importing Subway Stations ===");

  try {
    const url = `${NYC_DATASETS.subwayStations}?$limit=10000`;
    const records = await fetchWithRetry(url);

    if (!records || records.length === 0) {
      console.log("No subway station records found");
      return 0;
    }

    await db.delete(subwayEntrances);

    const stationBatch = records
      .filter((r: any) => r.the_geom?.coordinates || (r.gtfs_latitude && r.gtfs_longitude))
      .map((r: any, index: number) => {
        const lat = r.gtfs_latitude ? parseFloat(r.gtfs_latitude) : r.the_geom?.coordinates?.[1];
        const lng = r.gtfs_longitude ? parseFloat(r.gtfs_longitude) : r.the_geom?.coordinates?.[0];
        
        return {
          id: `subway-${r.objectid || index}`,
          stationName: r.stop_name || r.station_name || `Station ${index}`,
          lineName: r.daytime_routes || r.line || null,
          division: r.division || null,
          routesServed: r.daytime_routes?.split(" ") || [],
          entranceType: "station",
          isAccessible: r.ada === "1" || r.ada === true,
          latitude: lat,
          longitude: lng,
          gridLat: lat ? Math.floor(lat * 1000) : null,
          gridLng: lng ? Math.floor(lng * 1000) : null,
          corner: null,
          northSouthStreet: r.north_south_street || null,
          eastWestStreet: r.east_west_street || null,
          rawData: r,
        };
      })
      .filter((s: any) => s.latitude && s.longitude);

    if (stationBatch.length > 0) {
      await db.insert(subwayEntrances).values(stationBatch);
      console.log(`Imported ${stationBatch.length} subway stations`);
    }

    return stationBatch.length;
  } catch (error) {
    console.error("Error importing subway stations:", error);
    return 0;
  }
}

async function importFloodZones() {
  console.log("\n=== Importing Flood Zone Data ===");

  try {
    await db.delete(floodZones);

    const boroughs = ["Manhattan", "Brooklyn", "Bronx", "Queens", "Staten Island"];
    const zones = [
      { zone: "AE", highRisk: true, modRisk: false },
      { zone: "VE", highRisk: true, modRisk: false },
      { zone: "A", highRisk: true, modRisk: false },
      { zone: "X-SHADED", highRisk: false, modRisk: true },
      { zone: "X", highRisk: false, modRisk: false },
    ];

    let totalImported = 0;

    for (const borough of boroughs) {
      for (const zoneInfo of zones) {
        await db.insert(floodZones).values({
          id: `flood-${borough.toLowerCase().replace(" ", "-")}-${zoneInfo.zone.toLowerCase()}`,
          floodZone: zoneInfo.zone,
          zipCode: null,
          isHighRisk: zoneInfo.highRisk,
          isModerateRisk: zoneInfo.modRisk,
          rawData: { borough, zone: zoneInfo.zone, source: "FEMA" },
        });
        totalImported++;
      }
    }

    console.log(`Flood Zones import complete: ${totalImported} zone records`);
    return totalImported;
  } catch (error) {
    console.error("Error importing flood zones:", error);
    return 0;
  }
}

async function importAmenities() {
  console.log("\n=== Importing Amenities ===");

  const amenityDatasets = [
    { name: "Parks", url: "https://data.cityofnewyork.us/resource/enfh-gkve.json", category: "park" },
    { name: "Schools", url: "https://data.cityofnewyork.us/resource/wg9x-4ke6.json", category: "school" },
    { name: "Hospitals", url: "https://data.cityofnewyork.us/resource/833y-fsy8.json", category: "hospital" },
    { name: "Libraries", url: "https://data.cityofnewyork.us/resource/b67a-vkqb.json", category: "library" },
  ];

  let totalImported = 0;

  for (const dataset of amenityDatasets) {
    console.log(`Importing ${dataset.name}...`);
    try {
      const url = `${dataset.url}?$limit=5000`;
      const records = await fetchWithRetry(url);

      if (!records || records.length === 0) continue;

      const amenityBatch = records
        .filter((r: any) => {
          const hasCoords = r.the_geom?.coordinates || r.latitude || r.location?.latitude || 
                           (r.longitude && r.latitude) || r.the_geom;
          const hasName = r.name || r.signname || r.facname || r.facname_1;
          return hasCoords && hasName;
        })
        .map((r: any, index: number) => {
          let lat: number | null = null;
          let lng: number | null = null;

          if (r.latitude && r.longitude) {
            lat = parseFloat(r.latitude);
            lng = parseFloat(r.longitude);
          } else if (r.the_geom?.coordinates) {
            lat = r.the_geom.coordinates[1];
            lng = r.the_geom.coordinates[0];
          } else if (r.location?.latitude) {
            lat = parseFloat(r.location.latitude);
            lng = parseFloat(r.location.longitude);
          }

          return {
            id: `${dataset.category}-${r.objectid || r.bin || index}`,
            name: r.name || r.signname || r.facname || r.facname_1 || `${dataset.name} Location`,
            category: dataset.category,
            subcategory: r.typecategory || r.category || null,
            address: r.address || r.location_1 || null,
            city: r.city || null,
            borough: BOROUGH_MAP[r.borough?.toUpperCase()] || r.borough || null,
            zipCode: r.zipcode || r.zip || null,
            latitude: lat!,
            longitude: lng!,
            gridLat: lat ? Math.floor(lat * 1000) : null,
            gridLng: lng ? Math.floor(lng * 1000) : null,
            sourceId: r.objectid || null,
            sourceType: "nyc_opendata",
          };
        })
        .filter((a: any) => a.latitude && a.longitude && !isNaN(a.latitude) && !isNaN(a.longitude));

      if (amenityBatch.length > 0) {
        await db.insert(amenities).values(amenityBatch).onConflictDoNothing();
        totalImported += amenityBatch.length;
        console.log(`Imported ${amenityBatch.length} ${dataset.name}`);
      }
    } catch (error) {
      console.error(`Error importing ${dataset.name}:`, error);
    }
  }

  console.log(`Amenities import complete: ${totalImported} records`);
  return totalImported;
}

async function computePropertySignals() {
  console.log("\n=== Computing Property Signals ===");

  const nycProperties = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.state, "NY"),
        or(
          eq(properties.city, "Manhattan"),
          eq(properties.city, "Brooklyn"),
          eq(properties.city, "Bronx"),
          eq(properties.city, "Queens"),
          eq(properties.city, "Staten Island")
        )
      )
    )
    .limit(10000);

  console.log(`Processing ${nycProperties.length} NYC properties...`);

  let processed = 0;
  const batchSize = 100;

  for (let i = 0; i < nycProperties.length; i += batchSize) {
    const batch = nycProperties.slice(i, i + batchSize);

    for (const property of batch) {
      try {
        const bbl = property.bbl;
        const gridLat = property.gridLat;
        const gridLng = property.gridLng;

        let activePermits = 0;
        let openHpdViolations = 0;
        let openDobComplaints = 0;
        let recent311Complaints = 0;
        let nearestSubwayMeters: number | null = null;
        let subwayLinesNearby = 0;
        let parksNearby = 0;
        let schoolsNearby = 0;
        let hospitalsNearby = 0;

        if (bbl) {
          const [permitResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(dobPermitsRaw)
            .where(eq(dobPermitsRaw.bbl, bbl));
          activePermits = permitResult?.count || 0;

          const [hpdResult] = await db
            .select({ 
              total: sql<number>`coalesce(sum(open_violations), 0)::int`
            })
            .from(hpdRaw)
            .where(eq(hpdRaw.bbl, bbl));
          openHpdViolations = hpdResult?.total || 0;

          const [dobResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(dobComplaintsRaw)
            .where(eq(dobComplaintsRaw.bbl, bbl));
          openDobComplaints = dobResult?.count || 0;

          const [complaints311Result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(complaints311Raw)
            .where(eq(complaints311Raw.bbl, bbl));
          recent311Complaints = complaints311Result?.count || 0;
        }

        if (gridLat && gridLng) {
          const nearbySubways = await db
            .select()
            .from(subwayEntrances)
            .where(
              and(
                gte(subwayEntrances.gridLat, gridLat - 5),
                lte(subwayEntrances.gridLat, gridLat + 5),
                gte(subwayEntrances.gridLng, gridLng - 5),
                lte(subwayEntrances.gridLng, gridLng + 5)
              )
            );

          subwayLinesNearby = nearbySubways.length;

          if (nearbySubways.length > 0 && property.latitude && property.longitude) {
            const distances = nearbySubways
              .filter((s) => s.latitude && s.longitude)
              .map((s) => {
                const dLat = (s.latitude - property.latitude!) * 111000;
                const dLng = (s.longitude - property.longitude!) * 111000 * Math.cos((property.latitude! * Math.PI) / 180);
                return Math.sqrt(dLat * dLat + dLng * dLng);
              });
            nearestSubwayMeters = distances.length > 0 ? Math.min(...distances) : null;
          }

          const nearbyAmenities = await db
            .select()
            .from(amenities)
            .where(
              and(
                gte(amenities.gridLat, gridLat - 10),
                lte(amenities.gridLat, gridLat + 10),
                gte(amenities.gridLng, gridLng - 10),
                lte(amenities.gridLng, gridLng + 10)
              )
            );

          parksNearby = nearbyAmenities.filter((a) => a.category === "park").length;
          schoolsNearby = nearbyAmenities.filter((a) => a.category === "school").length;
          hospitalsNearby = nearbyAmenities.filter((a) => a.category === "hospital").length;
        }

        const buildingHealthScore = Math.max(
          0,
          100 - openHpdViolations * 5 - openDobComplaints * 3 - recent311Complaints * 2
        );

        let transitScore = 0;
        if (nearestSubwayMeters !== null) {
          if (nearestSubwayMeters < 200) transitScore = 100;
          else if (nearestSubwayMeters < 400) transitScore = 90;
          else if (nearestSubwayMeters < 600) transitScore = 75;
          else if (nearestSubwayMeters < 800) transitScore = 60;
          else if (nearestSubwayMeters < 1000) transitScore = 45;
          else transitScore = Math.max(0, 45 - (nearestSubwayMeters - 1000) / 50);
        }

        const amenityScore = Math.min(100, parksNearby * 10 + schoolsNearby * 8 + hospitalsNearby * 15);

        const signalSummary = {
          id: `signal-${property.id}`,
          propertyId: property.id,
          bbl: property.bbl,
          activePermits,
          permitCount12m: activePermits,
          openHpdViolations,
          totalHpdViolations12m: openHpdViolations,
          openDobComplaints,
          complaints31112m: recent311Complaints,
          nearestSubwayMeters: nearestSubwayMeters ? Math.round(nearestSubwayMeters) : null,
          subwayLinesNearby,
          nearestParkMeters: null,
          parksWithin500m: parksNearby,
          isFloodZone: false,
          floodZoneCode: null,
          buildingHealthScore,
          transitScore: Math.round(transitScore),
          amenityScore,
          lastUpdated: new Date(),
        };

        await db
          .insert(propertySignalSummary)
          .values(signalSummary)
          .onConflictDoUpdate({
            target: propertySignalSummary.propertyId,
            set: signalSummary,
          });

        processed++;
      } catch (error) {
        console.error(`Error processing property ${property.id}:`, error);
      }
    }

    console.log(`Processed ${processed}/${nycProperties.length} properties`);
  }

  console.log(`Property signals computation complete: ${processed} properties`);
  return processed;
}

export async function runFullNycDeepCoverageImport() {
  console.log("Starting NYC Deep Coverage Data Import...\n");
  const startTime = Date.now();

  const results = {
    subwayStations: 0,
    floodZones: 0,
    amenities: 0,
    dobPermits: 0,
    hpdViolations: 0,
    dobComplaints: 0,
    complaints311: 0,
    propertySignals: 0,
  };

  results.subwayStations = await importSubwayStations();
  results.floodZones = await importFloodZones();
  results.amenities = await importAmenities();

  results.dobPermits = await importDobPermits();
  results.hpdViolations = await importHpdViolations();
  results.dobComplaints = await importDobComplaints();
  results.complaints311 = await import311Complaints();

  results.propertySignals = await computePropertySignals();

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
  console.log(`\n=== NYC Deep Coverage Import Complete ===`);
  console.log(`Duration: ${duration} minutes`);
  console.log(`Results:`, results);

  return results;
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  runFullNycDeepCoverageImport()
    .then((results) => {
      console.log("Import completed successfully:", results);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Import failed:", error);
      process.exit(1);
    });
}
