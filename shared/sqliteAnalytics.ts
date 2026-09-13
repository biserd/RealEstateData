import { sql, type SQL } from "drizzle-orm";

/** PostgreSQL percentile_cont interpolation, ignoring NULLs, on SQLite/D1.
 * Aggregate ORDER BY makes the result independent of scan/index order.
 */
export function percentile(value: SQL, fraction: number, filter: SQL = sql`true`): SQL<number | null> {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error("Invalid percentile");
  const keep = sql`(${filter}) AND (${value}) IS NOT NULL`;
  const values = sql`json_group_array(${value} ORDER BY ${value}) FILTER (WHERE ${keep})`;
  const n = sql`count(${value}) FILTER (WHERE ${keep})`;
  const position = sql`((${n} - 1) * ${sql.raw(String(fraction))})`;
  const lower = sql`CAST(${position} AS INTEGER)`;
  const upper = sql`CAST(ceil(${position}) AS INTEGER)`;
  const lowValue = sql`json_extract(${values}, '$[' || max(0, ${lower}) || ']')`;
  const highValue = sql`json_extract(${values}, '$[' || max(0, ${upper}) || ']')`;
  return sql`(${lowValue} + (${position} - ${lower}) * (${highValue} - ${lowValue}))`;
}

export function mostFrequent(values: string | (string | null)[] | null): string | null {
  const items: (string | null)[] = typeof values === "string" ? JSON.parse(values) : values || [];
  const counts = new Map<string, number>();
  for (const value of items) if (value !== null) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]?.[0] ?? null;
}

/** PostgreSQL float8-to-integer casts round halves to the nearest even integer. */
export function roundedInteger(value: SQL): SQL<number | null> {
  return sql`CAST(CASE WHEN (${value} - floor(${value})) = 0.5
    THEN 2 * round(${value} / 2.0) ELSE round(${value}) END AS INTEGER)`;
}
