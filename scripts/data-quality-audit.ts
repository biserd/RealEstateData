import { sql, type SQL } from "drizzle-orm";
import { db } from "../server/db";

type Check = {
  id: string;
  severity: "critical" | "high" | "medium" | "info";
  count: number;
  explanation: string;
};

async function scalar(query: SQL): Promise<number> {
  const result = await db.execute(query);
  return Number((result.rows[0] as { count?: number | string } | undefined)?.count ?? 0);
}

async function main() {
  const [profileResult, checks] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM properties) AS properties,
        (SELECT COUNT(*)::int FROM condo_units) AS condo_units,
        (SELECT COUNT(*)::int FROM sales) AS sales,
        (SELECT MAX(sale_date) FROM sales WHERE match_method IS NOT NULL OR raw_block IS NOT NULL OR unit_bbl IS NOT NULL) AS latest_verified_sale,
        (SELECT MAX(imported_at) FROM pluto_raw) AS latest_pluto_import,
        (SELECT MAX(imported_at) FROM acris_raw) AS latest_acris_import,
        (SELECT MAX(imported_at) FROM dob_permits_raw) AS latest_permit_import,
        (SELECT MAX(imported_at) FROM complaints_311_raw) AS latest_311_import,
        (SELECT MAX(imported_at) FROM hpd_raw) AS latest_hpd_import
    `),
    Promise.all([
      scalar(sql`SELECT COUNT(*)::int AS count FROM (SELECT slug FROM condo_units WHERE slug IS NOT NULL GROUP BY slug HAVING COUNT(*) > 1) d`),
      scalar(sql`
        SELECT COUNT(*)::int AS count FROM condo_units cu
        WHERE cu.unit_type_hint = 'residential'
          AND cu.latitude IS NOT NULL AND cu.longitude IS NOT NULL
          AND EXISTS (SELECT 1 FROM sales s WHERE s.base_bbl = cu.base_bbl AND s.sale_price >= 100000)
          AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.unit_bbl = cu.unit_bbl AND s.sale_price >= 100000)
      `),
      scalar(sql`
        SELECT COUNT(*)::int AS count FROM properties p
        WHERE NULLIF(BTRIM(p.address), '') IS NULL
           OR NULLIF(BTRIM(p.city), '') IS NULL
           OR p.state NOT IN ('NY','NJ','CT')
           OR p.zip_code !~ '^[0-9]{5}$'
           OR p.latitude NOT BETWEEN 38 AND 46
           OR p.longitude NOT BETWEEN -80 AND -69
           OR COALESCE(p.estimated_value, p.last_sale_price, 0) NOT BETWEEN 50000 AND 100000000
      `),
      scalar(sql`
        SELECT COUNT(*)::int AS count FROM properties p
        WHERE NULLIF(BTRIM(p.bbl), '') IS NULL
          AND NOT EXISTS (SELECT 1 FROM entity_resolution_map erm WHERE erm.matched_property_id = p.id AND erm.match_confidence >= 0.90)
          AND NOT EXISTS (
            SELECT 1 FROM sales s WHERE s.property_id = p.id
              AND (s.match_method IS NOT NULL OR s.raw_block IS NOT NULL OR s.raw_lot IS NOT NULL)
          )
      `),
      scalar(sql`
        SELECT COUNT(*)::int AS count FROM sales s
        WHERE s.property_id IS NOT NULL
          AND s.match_method IS NULL
          AND s.unit_bbl IS NULL
          AND s.base_bbl IS NULL
          AND s.raw_borough IS NULL
          AND s.raw_block IS NULL
          AND s.raw_lot IS NULL
          AND s.raw_address IS NULL
          AND s.deed_type IN ('Warranty','Quitclaim','Grant')
      `),
      scalar(sql`SELECT COUNT(*)::int AS count FROM sales s LEFT JOIN properties p ON p.id = s.property_id WHERE s.property_id IS NOT NULL AND p.id IS NULL`),
      scalar(sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT state, UPPER(BTRIM(address)) AS address_key, COALESCE(UPPER(BTRIM(unit)), ''), zip_code
          FROM properties
          GROUP BY state, UPPER(BTRIM(address)), COALESCE(UPPER(BTRIM(unit)), ''), zip_code
          HAVING COUNT(*) > 1
        ) duplicates
      `),
    ]),
  ]);

  const values = checks.map(Number);
  const findings: Check[] = [
    { id: "duplicate_unit_slugs", severity: "critical", count: values[0], explanation: "Duplicate canonical unit URLs." },
    { id: "building_only_shadow_units", severity: "high", count: values[1], explanation: "Units with building context but no sale matched to the exact unit; these are now excluded from public surfaces." },
    { id: "invalid_property_core_fields", severity: "high", count: values[2], explanation: "Property records with invalid identity, geography, or price fields." },
    { id: "unverified_shadow_properties", severity: "high", count: values[3], explanation: "Properties without a parcel key, confident source match, or source-backed sale; these are now excluded from public surfaces." },
    { id: "likely_generated_sales", severity: "critical", count: values[4], explanation: "Legacy sales with the exact signature of the retired random demo generator." },
    { id: "orphan_sales", severity: "critical", count: values[5], explanation: "Sales referencing a property that no longer exists." },
    { id: "duplicate_property_natural_keys", severity: "medium", count: values[6], explanation: "Duplicate normalized address/unit/ZIP identities." },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    profile: profileResult.rows[0] ?? {},
    findings,
    publicPolicy: {
      unit: "Residential, valid address/geography, and an exact unit-level recorded sale in the last 120 months.",
      property: "Valid core fields plus a parcel key, confident entity match, or source-backed sale.",
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (findings.some((finding) => finding.severity === "critical" && finding.count > 0)) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
