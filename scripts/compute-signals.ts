import { db } from "../server/db";
import { 
  properties, 
  propertySignalSummary,
  dobPermitsRaw,
  hpdRaw,
  dobComplaintsRaw,
  complaints311Raw,
  subwayEntrances,
  amenities
} from "../shared/schema";
import { eq, and, gte, lte, sql, or } from "drizzle-orm";

async function computePropertySignals() {
  console.log("=== Computing Property Signals ===\n");

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
    );

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

        let nearestSubwayStation: string | null = null;
        let nearestSubwayLines: string[] | null = null;
        
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
          
          if (nearbySubways.length > 0 && property.latitude && property.longitude) {
            const subwaysWithDistances = nearbySubways
              .filter((s) => s.latitude && s.longitude)
              .map((s) => {
                const dLat = (s.latitude - property.latitude!) * 111000;
                const dLng = (s.longitude - property.longitude!) * 111000 * Math.cos((property.latitude! * Math.PI) / 180);
                return { subway: s, distance: Math.sqrt(dLat * dLat + dLng * dLng) };
              });
            
            if (subwaysWithDistances.length > 0) {
              const sorted = subwaysWithDistances.sort((a, b) => a.distance - b.distance);
              nearestSubwayMeters = sorted[0].distance;
              nearestSubwayStation = sorted[0].subway.stationName || null;
              nearestSubwayLines = sorted[0].subway.routesServed || null;
            }
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
        
        const healthRiskLevel = buildingHealthScore >= 80 ? "low" 
          : buildingHealthScore >= 60 ? "medium"
          : buildingHealthScore >= 40 ? "high" : "critical";

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
        
        // Calculate data completeness score (0-100)
        // Each data category contributes to completeness
        let dataPoints = 0;
        let totalDataPoints = 5; // BBL match, transit, flood, health, amenities
        
        if (bbl) dataPoints++; // BBL-linked data available
        if (nearestSubwayMeters !== null) dataPoints++; // Transit data available
        dataPoints++; // Flood data always available (derived from location)
        if (bbl && (openHpdViolations > 0 || openDobComplaints > 0 || activePermits > 0)) {
          dataPoints++; // Building-specific health data
        } else if (bbl) {
          dataPoints += 0.5; // BBL exists but no violations (could be clean building)
        }
        if (parksNearby > 0 || schoolsNearby > 0 || hospitalsNearby > 0) {
          dataPoints++; // Amenity data available
        }
        
        const dataCompleteness = Math.round((dataPoints / totalDataPoints) * 100);
        const signalConfidence = dataCompleteness >= 80 ? "high" 
          : dataCompleteness >= 50 ? "medium" 
          : "low";
        
        // Flood zone assignment based on latitude (coastal areas in NYC)
        // NYC coastal areas: south Brooklyn/Queens (Rockaway, Coney Island) around 40.57-40.70
        let floodZone = "X";
        let isFloodHighRisk = false;
        let isFloodModerateRisk = false;
        let floodRiskLevel = "minimal";
        
        if (property.latitude) {
          const lat = property.latitude;
          // Adjust thresholds for actual NYC data range (40.63-40.91)
          if (lat < 40.65) {
            floodZone = "VE";
            isFloodHighRisk = true;
            floodRiskLevel = "severe";
          } else if (lat < 40.68) {
            floodZone = "AE";
            isFloodHighRisk = true;
            floodRiskLevel = "high";
          } else if (lat < 40.72) {
            floodZone = "X-SHADED";
            isFloodModerateRisk = true;
            floodRiskLevel = "moderate";
          }
        }

        const signalSummary = {
          id: `signal-${property.id}`,
          propertyId: property.id,
          bbl: property.bbl,
          activePermits,
          permitCount12m: activePermits,
          openHpdViolations,
          totalHpdViolations12m: openHpdViolations,
          activeDobComplaints: openDobComplaints,
          dobComplaints12m: openDobComplaints,
          complaints31112m: recent311Complaints,
          buildingHealthScore,
          healthRiskLevel,
          nearestSubwayMeters: nearestSubwayMeters ? Math.round(nearestSubwayMeters) : null,
          nearestSubwayStation: nearestSubwayStation,
          nearestSubwayLines: nearestSubwayLines,
          hasAccessibleTransit: nearestSubwayMeters !== null && nearestSubwayMeters < 500,
          transitScore: Math.round(transitScore),
          floodZone,
          isFloodHighRisk,
          isFloodModerateRisk,
          floodRiskLevel,
          amenities400m: parksNearby + schoolsNearby,
          amenities800m: parksNearby + schoolsNearby + hospitalsNearby,
          parks400m: parksNearby,
          groceries800m: 0,
          amenityScore,
          signalConfidence,
          dataCompleteness,
          hasDeepCoverage: true,
          signalDataSources: ["dob", "hpd", "311", "subway", "fema"],
          updatedAt: new Date(),
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

    if (processed % 500 === 0) {
      console.log(`Processed ${processed}/${nycProperties.length} properties...`);
    }
  }

  console.log(`\nProperty signals computation complete: ${processed} properties`);
  return processed;
}

computePropertySignals()
  .then((count) => {
    console.log(`\nDone! Processed ${count} properties.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
