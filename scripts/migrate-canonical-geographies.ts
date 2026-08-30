import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { assertDatabaseWriteAllowed, databaseIdentity } from "./lib/database-safety";

const apply = process.argv.includes("--apply");

type CountRow = { count: number | string };

async function scalarCount(statement: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(statement);
  return Number((result.rows[0] as CountRow | undefined)?.count || 0);
}

async function main() {
  assertDatabaseWriteAllowed(apply);
  const [validStateZipPairs, contradictions, unresolvedSales, unresolvedUnits] = await Promise.all([
    scalarCount(sql`SELECT count(*) FROM (SELECT DISTINCT state, zip_code FROM properties WHERE state IN ('NY','NJ','CT') AND zip_code ~ '^[0-9]{5}$') pairs`),
    scalarCount(sql`
      SELECT count(*) FROM properties
      WHERE state IN ('NY','NJ','CT') AND zip_code ~ '^[0-9]{5}$'
        AND CASE
          WHEN zip_code LIKE '06%' THEN 'CT'
          WHEN zip_code LIKE '07%' OR zip_code LIKE '08%' THEN 'NJ'
          WHEN zip_code LIKE '10%' OR zip_code LIKE '11%' OR zip_code LIKE '12%' OR zip_code LIKE '13%' OR zip_code LIKE '14%' THEN 'NY'
          ELSE NULL
        END IS DISTINCT FROM state
    `),
    scalarCount(sql`SELECT count(*) FROM sales WHERE property_id IS NOT NULL AND geography_id IS NULL`),
    scalarCount(sql`SELECT count(*) FROM condo_units WHERE zip_code IS NOT NULL AND geography_id IS NULL`),
  ]);

  console.log(JSON.stringify({
    database: databaseIdentity(),
    mode: apply ? "apply" : "dry-run",
    validStateZipPairs,
    contradictions,
    unresolvedSales,
    unresolvedUnits,
  }, null, 2));
  if (!apply) return;

  // State and ZIP names are deliberately conservative. City/county labels are
  // not copied from legacy rows because those labels are exactly where the
  // historical cross-state corruption occurred.
  await db.execute(sql`
    INSERT INTO canonical_geographies (id, type, state, canonical_name)
    VALUES
      ('state:NY', 'state', 'NY', 'New York'),
      ('state:NJ', 'state', 'NJ', 'New Jersey'),
      ('state:CT', 'state', 'CT', 'Connecticut')
    ON CONFLICT (id) DO UPDATE SET canonical_name = EXCLUDED.canonical_name, updated_at = now()
  `);
  await db.execute(sql`
    INSERT INTO canonical_geographies (id, type, state, zip_code, canonical_name)
    SELECT DISTINCT 'zip:' || state || ':' || zip_code, 'zip', state, zip_code, 'ZIP ' || zip_code
    FROM properties
    WHERE state IN ('NY','NJ','CT') AND zip_code ~ '^[0-9]{5}$'
      AND CASE
        WHEN zip_code LIKE '06%' THEN 'CT'
        WHEN zip_code LIKE '07%' OR zip_code LIKE '08%' THEN 'NJ'
        WHEN zip_code LIKE '10%' OR zip_code LIKE '11%' OR zip_code LIKE '12%' OR zip_code LIKE '13%' OR zip_code LIKE '14%' THEN 'NY'
        ELSE NULL
      END = state
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO data_quality_quarantine (source_table, source_id, reason, severity, record)
    SELECT 'properties', id, 'state_zip_contradiction', 'critical', to_jsonb(properties)
    FROM properties
    WHERE state IN ('NY','NJ','CT') AND zip_code ~ '^[0-9]{5}$'
      AND CASE
        WHEN zip_code LIKE '06%' THEN 'CT'
        WHEN zip_code LIKE '07%' OR zip_code LIKE '08%' THEN 'NJ'
        WHEN zip_code LIKE '10%' OR zip_code LIKE '11%' OR zip_code LIKE '12%' OR zip_code LIKE '13%' OR zip_code LIKE '14%' THEN 'NY'
        ELSE NULL
      END IS DISTINCT FROM state
    ON CONFLICT (source_table, source_id, reason) DO UPDATE
      SET record = EXCLUDED.record, severity = 'critical', quarantined_at = now()
  `);
  await db.execute(sql`
    UPDATE properties
    SET geography_id = 'zip:' || state || ':' || zip_code
    WHERE state IN ('NY','NJ','CT') AND zip_code ~ '^[0-9]{5}$'
      AND EXISTS (SELECT 1 FROM canonical_geographies geography WHERE geography.id = 'zip:' || properties.state || ':' || properties.zip_code)
  `);
  await db.execute(sql`
    UPDATE sales sale SET geography_id = property.geography_id
    FROM properties property
    WHERE sale.property_id = property.id AND property.geography_id IS NOT NULL
  `);
  await db.execute(sql`
    UPDATE condo_units unit SET geography_id = geography.id
    FROM canonical_geographies geography
    WHERE geography.type = 'zip' AND geography.state = 'NY' AND geography.zip_code = unit.zip_code
  `);
  await db.execute(sql`
    UPDATE buildings building SET geography_id = geography.id
    FROM canonical_geographies geography
    WHERE geography.type = 'zip' AND geography.state = 'NY' AND geography.zip_code = building.zip_code
  `);
  await db.execute(sql`
    UPDATE market_aggregates aggregate SET geography_id = geography.id
    FROM canonical_geographies geography
    WHERE aggregate.geo_type = 'zip' AND geography.type = 'zip'
      AND aggregate.state = geography.state AND aggregate.geo_id = geography.zip_code
  `);

  const reconciliation = await db.execute(sql`
    SELECT state, zip_code,
      count(*)::int AS properties,
      count(*) FILTER (WHERE geography_id IS NOT NULL)::int AS linked_properties,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM data_quality_quarantine q
        WHERE q.source_table = 'properties' AND q.source_id = properties.id
      ))::int AS quarantined_properties
    FROM properties
    WHERE state IN ('NY','NJ','CT') AND zip_code ~ '^[0-9]{5}$'
    GROUP BY state, zip_code
    ORDER BY state, zip_code
  `);
  console.log(JSON.stringify({ reconciliation: reconciliation.rows }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
