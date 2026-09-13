import { sql, type SQL } from "drizzle-orm";
import { propertyRecordJson } from "./lib/property-record-json";
import { db } from "../server/db";
import { assertDatabaseWriteAllowed, databaseIdentity } from "./lib/database-safety";

const apply = process.argv.includes("--apply");

async function count(query: SQL): Promise<number> {
  const result = await db.execute(query);
  return Number((result.rows[0] as { count?: number | string } | undefined)?.count ?? 0);
}

async function main() {
  assertDatabaseWriteAllowed(apply);
  console.log(JSON.stringify({ database: databaseIdentity() }));
  const generatedSalesWhere = sql`
    property_id IS NOT NULL
    AND match_method IS NULL
    AND unit_bbl IS NULL
    AND base_bbl IS NULL
    AND raw_borough IS NULL
    AND raw_block IS NULL
    AND raw_lot IS NULL
    AND raw_address IS NULL
    AND deed_type IN ('Warranty','Quitclaim','Grant')
  `;
  const shadowPropertiesWhere = sql`
    NULLIF(TRIM(p.bbl), '') IS NULL
    AND NOT EXISTS (SELECT 1 FROM entity_resolution_map erm WHERE erm.matched_property_id = p.id AND erm.match_confidence >= 0.90)
    AND NOT EXISTS (
      SELECT 1 FROM sales s WHERE s.property_id = p.id
        AND (s.match_method IS NOT NULL OR s.raw_block IS NOT NULL OR s.raw_lot IS NOT NULL)
    )
  `;

  const [generatedSales, shadowProperties] = await Promise.all([
    count(sql`SELECT CAST(COUNT(*) AS INTEGER) AS count FROM sales WHERE ${generatedSalesWhere}`),
    count(sql`SELECT CAST(COUNT(*) AS INTEGER) AS count FROM properties p WHERE ${shadowPropertiesWhere}`),
  ]);

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", generatedSales, shadowProperties }, null, 2));
  if (!apply) {
    console.log("Dry run only. Re-run with --apply to quarantine shadow properties and remove only the unmistakably generated sales rows.");
    return;
  }

  await db.execute(sql`
    INSERT INTO data_quality_quarantine (source_table, source_id, reason, severity, record)
    SELECT 'properties', p.id, 'unverified_shadow_property', 'high', ${propertyRecordJson("p")}
    FROM properties p
    WHERE ${shadowPropertiesWhere}
    ON CONFLICT (source_table, source_id, reason) DO UPDATE
      SET record = EXCLUDED.record, quarantined_at = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')
  `);

  const deleted = await db.execute(sql`DELETE FROM sales WHERE ${generatedSalesWhere} RETURNING id`);
  console.log(JSON.stringify({ quarantinedProperties: shadowProperties, deletedGeneratedSales: deleted.rows.length }, null, 2));
  console.log("Property rows were quarantined, not hard-deleted. Runtime publication filters keep them off all public pages while source owners review them.");
}

await main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
