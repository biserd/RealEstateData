import { getTableColumns, sql, type SQLWrapper } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

/** Conservative size: count defaults too, leaving room for UPSERT parameters. */
export function d1BatchSize(table: SQLiteTable, reserved = 1): number {
  return Math.max(1, Math.floor((100 - reserved) / Object.keys(getTableColumns(table)).length));
}

/** One bound JSON value avoids D1's 100-parameter ceiling for large filter lists. */
export function d1InArray(column: SQLWrapper, values: readonly (string | number | boolean | null)[]) {
  return values.length ? sql`${column} IN (SELECT value FROM json_each(${JSON.stringify(values)}))` : sql`false`;
}
