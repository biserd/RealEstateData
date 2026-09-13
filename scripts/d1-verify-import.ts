import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';

const source = process.env.D1_VERIFY_SOURCE || '../source-backup';
const manifest = JSON.parse(readFileSync(`${source}/manifest.json`, 'utf8'));
if (!manifest.complete) throw new Error('Source export is incomplete');
const tables = [];
for (const table of manifest.tables) {
  const name = table.schema === 'public' ? table.name : `${table.schema}__${table.name}`;
  const result = await db.execute(sql.raw(`SELECT COUNT(*) AS n FROM "${name.replaceAll('"', '""')}"`));
  tables.push({ table: name, expected: table.count, actual: result.rows[0].n, ok: table.count === result.rows[0].n });
}
const audit = await db.execute(sql`SELECT part_name, content_sha256, row_count FROM migration_import_parts`);
const imported = JSON.parse(readFileSync('../source-backup/d1-import/manifest.json', 'utf8'));
const partsMatch = audit.rows.length === imported.parts.length && imported.parts.every((part: any) =>
  audit.rows.some(row => row.part_name === part.file && row.content_sha256 === part.contentSha256 && row.row_count === part.rows));
const foreignKeys = await db.execute(sql`PRAGMA foreign_key_check`);
const integrity = await db.execute(sql`PRAGMA quick_check`);
const ok = tables.every(t => t.ok) && partsMatch && foreignKeys.rows.length === 0 && integrity.rows.every(row => Object.values(row)[0] === 'ok');
const report = { ok, sourceSnapshot: manifest.captured_at, totalRows: tables.reduce((sum, t) => sum + t.actual, 0), tables, importParts: audit.rows.length, partsMatch, foreignKeys: foreignKeys.rows, integrity: integrity.rows };
writeFileSync(process.env.D1_VERIFY_REPORT || '../d1-remote-verification.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok, totalRows: report.totalRows, tableCount: tables.length, partsMatch, mismatches: tables.filter(t => !t.ok), foreignKeys: foreignKeys.rows, integrity: integrity.rows }, null, 2));
if (!ok) process.exitCode = 1;
