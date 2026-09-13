import { getTableColumns, sql } from "drizzle-orm";
import { properties } from "../../shared/schema";

/** Retain the full property record in quarantine, including provenance columns. */
export function propertyRecordJson(alias: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error("Invalid SQL alias");
  const names = [...Object.values(getTableColumns(properties)).map(c => c.name), "geography_id", "published_dataset_version_id"];
  // D1 permits only 32 function arguments (16 JSON key/value pairs). Join
  // complete object interiors to preserve explicit null fields and JSON arrays.
  const chunks = [];
  for (let offset = 0; offset < names.length; offset += 16) {
    const object = sql`json_object(${sql.join(names.slice(offset, offset + 16).flatMap(name => {
      const value = sql.raw(`${alias}."${name}"`);
      return [sql.raw(`'${name.replaceAll("'", "''")}'`), name === "data_sources" ? sql`json(${value})` : value];
    }), sql`, `)})`;
    chunks.push(sql`substr(${object}, 2, length(${object}) - 2)`);
  }
  return sql`json('{' || ${sql.join(chunks, sql` || ',' || `)} || '}')`;
}
