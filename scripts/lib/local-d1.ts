import { DatabaseSync } from "node:sqlite";

/** Test-only D1 binding backed by a local SQLite snapshot; never used by Workers. */
export function localD1(filename: string, readOnly = true) {
  const sqlite = new DatabaseSync(filename, { readOnly });
  sqlite.exec("PRAGMA foreign_keys=ON");
  let queries = 0;
  function prepare(query: string, parameters: unknown[] = []): any {
    if (Buffer.byteLength(query) > 100_000) throw new Error("D1 SQL statement size limit exceeded");
    return {
      bind: (...params: unknown[]) => {
        if (params.length > 100) throw new Error(`D1 bound parameter limit exceeded: ${params.length}`);
        return prepare(query, params);
      },
      async all() {
        queries++;
        const start = performance.now();
        const statement = sqlite.prepare(query);
        const results = statement.all(...parameters as any[]).map(row => ({ ...row }));
        return { success: true, results, meta: { duration: performance.now() - start, changes: Number(sqlite.prepare("SELECT changes() AS n").get()!.n), rows_read: results.length } };
      },
      async raw(options?: { columnNames?: boolean }) {
        queries++;
        const statement = sqlite.prepare(query);
        statement.setReturnArrays(true);
        const rows = statement.all(...parameters as any[]);
        return options?.columnNames ? [statement.columns().map(c => c.name), ...rows] : rows;
      },
      async first(column?: string) { const result = await this.all(); const row = result.results[0] ?? null; return column && row ? row[column] : row; },
      async run() { return this.all(); },
    };
  }
  const binding = {
    prepare,
    async batch(statements: any[]) {
      sqlite.exec("BEGIN");
      try { const result = []; for (const statement of statements) result.push(await statement.all()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    async exec(query: string) { sqlite.exec(query); return { count: 1, duration: 0 }; },
  } as unknown as D1Database;
  return { binding, sqlite, close: () => sqlite.close(), queryCount: () => queries };
}
