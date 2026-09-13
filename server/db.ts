import { drizzle } from "drizzle-orm/d1";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import * as schema from "@shared/schema";

const dialect = new SQLiteAsyncDialect();
function createDatabase(binding: D1Database) {
  const orm = drizzle(binding, { schema });
  return Object.assign(orm, {
    // Keep the existing raw-query result shape. ORM queries use native D1.
    async execute(statement: SQL): Promise<{ rows: Record<string, any>[] }> {
      const query = dialect.sqlToQuery(statement);
      const params = query.params.map((value) => value instanceof Date
        ? value.toISOString().replace(/Z$/, "000Z")
        : typeof value === "boolean" ? Number(value) : value);
      const result = await binding.prepare(query.sql).bind(...params).all<Record<string, any>>();
      return { rows: result.results };
    },
  });
}

export let db: ReturnType<typeof createDatabase>;

// Called before importing the application, both by the Worker and script runner.
export function configureDatabase(binding: D1Database): void {
  if (!binding) throw new Error("The DB D1 binding is required.");
  db = createDatabase(binding);
}
