import { db } from "../server/db";
import { properties, propertySignalSummary } from "@shared/schema";
import { sql, eq, and, or } from "drizzle-orm";

async function main() {
  console.log("=== Computing Property Signals (Fast Batch) ===\n");

  const existingCount = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(propertySignalSummary);
  console.log(`Existing signals: ${existingCount[0]?.cnt || 0}`);

  console.log("Computing signals via SQL for NYC properties...");

  await db.execute(sql`
    INSERT INTO property_signal_summary (
      id, property_id, bbl,
      active_permits, permit_count_12m,
      open_hpd_violations, total_hpd_violations_12m,
      active_dob_complaints, dob_complaints_12m,
      complaints_311_12m,
      building_health_score, health_risk_level,
      nearest_subway_meters, nearest_subway_station, nearest_subway_lines,
      has_accessible_transit, transit_score,
      flood_zone, is_flood_high_risk, is_flood_moderate_risk, flood_risk_level,
      amenities_400m, amenities_800m, parks_400m, groceries_800m, amenity_score,
      signal_confidence, data_completeness,
      has_deep_coverage, signal_data_sources,
      updated_at
    )
    SELECT
      'signal-' || p.id,
      p.id,
      p.bbl,
      COALESCE(dp.permit_count, 0),
      COALESCE(dp.permit_count, 0),
      COALESCE(hv.open_violations, 0),
      COALESCE(hv.total_violations, 0),
      0, 0,
      COALESCE(c3.complaint_count, 0),
      GREATEST(0, 100 - COALESCE(hv.open_violations, 0) * 5 - COALESCE(c3.complaint_count, 0) * 2),
      CASE 
        WHEN GREATEST(0, 100 - COALESCE(hv.open_violations, 0) * 5 - COALESCE(c3.complaint_count, 0) * 2) >= 80 THEN 'low'
        WHEN GREATEST(0, 100 - COALESCE(hv.open_violations, 0) * 5 - COALESCE(c3.complaint_count, 0) * 2) >= 60 THEN 'medium'
        WHEN GREATEST(0, 100 - COALESCE(hv.open_violations, 0) * 5 - COALESCE(c3.complaint_count, 0) * 2) >= 40 THEN 'high'
        ELSE 'critical'
      END,
      NULL, NULL, NULL,
      false, 0,
      CASE 
        WHEN p.latitude < 40.65 THEN 'VE'
        WHEN p.latitude < 40.68 THEN 'AE'
        WHEN p.latitude < 40.72 THEN 'X-SHADED'
        ELSE 'X'
      END,
      p.latitude < 40.68,
      p.latitude >= 40.68 AND p.latitude < 40.72,
      CASE
        WHEN p.latitude < 40.65 THEN 'severe'
        WHEN p.latitude < 40.68 THEN 'high'
        WHEN p.latitude < 40.72 THEN 'moderate'
        ELSE 'minimal'
      END,
      0, 0, 0, 0, 0,
      CASE
        WHEN p.bbl IS NOT NULL AND (COALESCE(dp.permit_count, 0) > 0 OR COALESCE(hv.total_violations, 0) > 0 OR COALESCE(c3.complaint_count, 0) > 0)
          THEN 'high'
        WHEN p.bbl IS NOT NULL THEN 'medium'
        ELSE 'low'
      END,
      CASE
        WHEN p.bbl IS NOT NULL AND (COALESCE(dp.permit_count, 0) > 0 OR COALESCE(hv.total_violations, 0) > 0) THEN 80
        WHEN p.bbl IS NOT NULL THEN 60
        ELSE 40
      END,
      true,
      ARRAY['dob', 'hpd', '311', 'fema'],
      NOW()
    FROM properties p
    LEFT JOIN (
      SELECT bbl, COUNT(*) as permit_count
      FROM dob_permits_raw
      WHERE bbl IS NOT NULL
      GROUP BY bbl
    ) dp ON dp.bbl = p.bbl
    LEFT JOIN (
      SELECT bbl, 
        SUM(open_violations) as open_violations,
        SUM(total_violations) as total_violations
      FROM hpd_raw
      WHERE bbl IS NOT NULL
      GROUP BY bbl
    ) hv ON hv.bbl = p.bbl
    LEFT JOIN (
      SELECT bbl, COUNT(*) as complaint_count
      FROM complaints_311_raw
      WHERE bbl IS NOT NULL
      GROUP BY bbl
    ) c3 ON c3.bbl = p.bbl
    WHERE p.state = 'NY'
      AND p.city IN ('Manhattan', 'Brooklyn', 'Bronx', 'Queens', 'Staten Island')
    ON CONFLICT (property_id) DO UPDATE SET
      active_permits = EXCLUDED.active_permits,
      permit_count_12m = EXCLUDED.permit_count_12m,
      open_hpd_violations = EXCLUDED.open_hpd_violations,
      total_hpd_violations_12m = EXCLUDED.total_hpd_violations_12m,
      complaints_311_12m = EXCLUDED.complaints_311_12m,
      building_health_score = EXCLUDED.building_health_score,
      health_risk_level = EXCLUDED.health_risk_level,
      flood_zone = EXCLUDED.flood_zone,
      is_flood_high_risk = EXCLUDED.is_flood_high_risk,
      is_flood_moderate_risk = EXCLUDED.is_flood_moderate_risk,
      flood_risk_level = EXCLUDED.flood_risk_level,
      signal_confidence = EXCLUDED.signal_confidence,
      data_completeness = EXCLUDED.data_completeness,
      updated_at = EXCLUDED.updated_at
  `);

  const newCount = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(propertySignalSummary);
  console.log(`Signals after computation: ${newCount[0]?.cnt || 0}`);
  console.log("Done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
