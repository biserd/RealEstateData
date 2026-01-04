import { db } from "../db";
import { condoUnits, buildings } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function populateBuildingsFromCondoUnits() {
  console.log("============================================================");
  console.log("📥 POPULATING BUILDINGS TABLE FROM CONDO UNITS");
  console.log("============================================================\n");

  const buildingData = await db.execute(sql`
    SELECT 
      base_bbl,
      MIN(building_display_address) as display_address,
      MIN(bin) as bin,
      AVG(latitude) as latitude,
      AVG(longitude) as longitude,
      MIN(borough) as borough,
      MIN(zip_code) as zip_code,
      COUNT(*) as unit_count,
      COUNT(*) FILTER (WHERE unit_type_hint = 'residential') as residential_unit_count
    FROM condo_units
    WHERE base_bbl IS NOT NULL
    GROUP BY base_bbl
    ORDER BY unit_count DESC
  `);

  console.log(`  Found ${buildingData.rows.length} distinct buildings from condo units\n`);

  let inserted = 0;
  let errors = 0;

  for (const row of buildingData.rows as any[]) {
    try {
      await db.insert(buildings)
        .values({
          baseBbl: row.base_bbl,
          displayAddress: row.display_address,
          bin: row.bin,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          borough: row.borough,
          zipCode: row.zip_code,
          unitCount: parseInt(row.unit_count),
          residentialUnitCount: parseInt(row.residential_unit_count),
        })
        .onConflictDoUpdate({
          target: buildings.baseBbl,
          set: {
            displayAddress: row.display_address,
            bin: row.bin,
            latitude: row.latitude ? parseFloat(row.latitude) : null,
            longitude: row.longitude ? parseFloat(row.longitude) : null,
            borough: row.borough,
            zipCode: row.zip_code,
            unitCount: parseInt(row.unit_count),
            residentialUnitCount: parseInt(row.residential_unit_count),
            updatedAt: sql`now()`,
          },
        });
      inserted++;
      
      if (inserted % 1000 === 0) {
        console.log(`  Inserted ${inserted}/${buildingData.rows.length} buildings...`);
      }
    } catch (err) {
      errors++;
      if (errors <= 3) {
        console.error(`  Error inserting building ${row.base_bbl}:`, err);
      }
    }
  }

  console.log(`\n✅ Buildings population complete`);
  console.log(`  Total inserted/updated: ${inserted}`);
  console.log(`  Errors: ${errors}`);

  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_buildings,
      SUM(unit_count) as total_units,
      SUM(residential_unit_count) as residential_units,
      AVG(unit_count)::int as avg_units_per_building,
      MAX(unit_count) as max_units
    FROM buildings
  `);

  console.log(`\n📊 Buildings table stats:`);
  const s = stats.rows[0] as any;
  console.log(`  Total buildings: ${s.total_buildings}`);
  console.log(`  Total units: ${s.total_units}`);
  console.log(`  Residential units: ${s.residential_units}`);
  console.log(`  Avg units/building: ${s.avg_units_per_building}`);
  console.log(`  Max units in building: ${s.max_units}`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  populateBuildingsFromCondoUnits()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}
