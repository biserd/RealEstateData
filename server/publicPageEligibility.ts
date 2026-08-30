import { sql, type SQL } from "drizzle-orm";

function tableAlias(alias: string): SQL {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error("Unsafe SQL alias");
  return sql.raw(alias);
}

function triStateZip(alias: SQL, column = "zip_code"): SQL {
  const zip = sql`${alias}.${sql.raw(column)}`;
  const state = sql`${alias}.state`;
  return sql`(
    (${state} = 'NY' AND (${zip} ~ '^(10|11|12|13|14)[0-9]{3}$' OR ${zip} IN ('00501', '00544', '06390')))
    OR (${state} = 'NJ' AND ${zip} ~ '^0[7-8][0-9]{3}$')
    OR (${state} = 'CT' AND ${zip} ~ '^0[6][0-9]{3}$' AND ${zip} <> '06390')
  )`;
}

/** One contract for public property APIs, metadata, browse counts and sitemaps. */
export function publicPropertyPageSql(alias = "p"): SQL {
  const p = tableAlias(alias);
  return sql`
    NULLIF(BTRIM(${p}.address), '') IS NOT NULL
    AND NULLIF(BTRIM(${p}.city), '') IS NOT NULL
    AND ${p}.zip_code ~ '^[0-9]{5}$'
    AND ${triStateZip(p)}
    AND ${p}.latitude BETWEEN 38 AND 46
    AND ${p}.longitude BETWEEN -80 AND -69
    AND COALESCE(${p}.estimated_value, ${p}.last_sale_price, 0) BETWEEN 50000 AND 100000000
    AND EXISTS (
      SELECT 1
      FROM canonical_geographies public_geo
      JOIN current_market_snapshots public_snapshot
        ON public_snapshot.geography_id = public_geo.id
       AND public_snapshot.transaction_count >= 5
      WHERE public_geo.id = ${p}.geography_id
        AND public_geo.type = 'zip'
        AND public_geo.zip_code = ${p}.zip_code
        AND public_geo.state = ${p}.state
    )
    AND NOT EXISTS (
      SELECT 1 FROM data_quality_quarantine public_quarantine
      WHERE public_quarantine.source_table = 'properties'
        AND public_quarantine.source_id = ${p}.id
        AND public_quarantine.review_status IN ('pending', 'rejected')
    )
    AND EXISTS (
      SELECT 1 FROM sales verified_sale
      WHERE verified_sale.property_id = ${p}.id
        AND verified_sale.sale_price BETWEEN 50000 AND 100000000
        AND verified_sale.sale_date >= NOW() - INTERVAL '120 months'
        AND (
          verified_sale.source_id IS NOT NULL
          OR verified_sale.match_method IS NOT NULL
          OR verified_sale.raw_block IS NOT NULL
          OR verified_sale.raw_lot IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM data_quality_quarantine sale_quarantine
          WHERE sale_quarantine.source_table = 'sales'
            AND sale_quarantine.source_id = verified_sale.id
            AND sale_quarantine.review_status IN ('pending', 'rejected')
        )
    )
  `;
}

/** Unit pages require a recent, exact, source-backed unit sale from published geography. */
export function publicUnitPageSql(alias = "cu"): SQL {
  const cu = tableAlias(alias);
  return sql`
    ${cu}.unit_type_hint = 'residential'
    AND ${cu}.unit_bbl ~ '^[1-5][0-9]{9}$'
    AND ${cu}.base_bbl ~ '^[1-5][0-9]{9}$'
    AND NULLIF(BTRIM(${cu}.building_display_address), '') IS NOT NULL
    AND NULLIF(BTRIM(${cu}.unit_designation), '') IS NOT NULL
    AND ${cu}.latitude BETWEEN 40 AND 41
    AND ${cu}.longitude BETWEEN -75 AND -73
    AND EXISTS (
      SELECT 1
      FROM canonical_geographies unit_geo
      JOIN current_market_snapshots unit_snapshot
        ON unit_snapshot.geography_id = unit_geo.id
       AND unit_snapshot.transaction_count >= 5
      WHERE unit_geo.id = ${cu}.geography_id
        AND unit_geo.type = 'zip'
        AND unit_geo.state = 'NY'
        AND unit_geo.zip_code = ${cu}.zip_code
    )
    AND NOT EXISTS (
      SELECT 1 FROM data_quality_quarantine unit_quarantine
      WHERE unit_quarantine.source_table = 'condo_units'
        AND unit_quarantine.source_id = ${cu}.unit_bbl
        AND unit_quarantine.review_status IN ('pending', 'rejected')
    )
    AND EXISTS (
      SELECT 1 FROM sales verified_unit_sale
      WHERE verified_unit_sale.unit_bbl = ${cu}.unit_bbl
        AND verified_unit_sale.sale_price BETWEEN 100000 AND 100000000
        AND verified_unit_sale.sale_date >= NOW() - INTERVAL '120 months'
        AND (
          verified_unit_sale.source_id IS NOT NULL
          OR verified_unit_sale.match_method IS NOT NULL
          OR verified_unit_sale.raw_block IS NOT NULL
          OR verified_unit_sale.raw_lot IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM data_quality_quarantine unit_sale_quarantine
          WHERE unit_sale_quarantine.source_table = 'sales'
            AND unit_sale_quarantine.source_id = verified_unit_sale.id
            AND unit_sale_quarantine.review_status IN ('pending', 'rejected')
        )
    )
  `;
}
