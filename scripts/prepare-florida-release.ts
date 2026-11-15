import { open, readFile } from "node:fs/promises";
import { once } from "node:events";
import { finished } from "node:stream/promises";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { floridaCounties } from "../shared/floridaSales";

function literal(value: SQLOutputValue) {
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (typeof value === "string" && !value.includes("\0")) return "'" + value.replace(/'/g, "''") + "'";
  throw new Error("Unsupported Florida export value");
}

const [path, output] = process.argv.slice(2);
if (!path || !output || process.argv.length !== 4) {
  throw new Error("Usage: npm run data:florida:prepare -- snapshot.sqlite d1-import.sql");
}

const manifest = JSON.parse(await readFile(path + ".json", "utf8")) as { release?: string };
if (!manifest.release || !/^fdor-\d+-\d{4}-\d{2}$/.test(manifest.release)) throw new Error("Missing validated source release");
const db = new DatabaseSync(path, { readOnly: true });
try {
  const release = db.prepare("SELECT id, source_updated_at, start_month FROM florida_releases WHERE id = ?").get(manifest.release);
  if (!release) throw new Error("Manifest release does not exist in the snapshot");
  const countyRecords = db.prepare(
    "SELECT g.county_code, g.records, g.latest_month, count(s.parcel_id) AS actual, max(s.sale_month) AS latest " +
    "FROM florida_coverage g LEFT JOIN florida_sales s ON s.release_id = g.release_id AND s.county_code = g.county_code " +
    "WHERE g.release_id = ? GROUP BY g.county_code ORDER BY g.county_code",
  ).all(manifest.release);
  const expected = new Set(floridaCounties.map(county => county.code));
  const records = countyRecords.reduce((sum, county) => sum + Number(county.records), 0);
  if (Number(db.prepare("SELECT count(*) AS n FROM florida_sales WHERE release_id = ?").get(manifest.release)?.n) !== records ||
    countyRecords.length !== expected.size || countyRecords.some(row =>
      !expected.has(Number(row.county_code)) || row.records !== row.actual || row.latest_month !== row.latest || !row.records)) {
    throw new Error("Florida import requires a verified and nonempty snapshot for every county");
  }

  // The export contains no activation. Load it into a separate candidate database.
  const handle = await open(output, "wx");
  const stream = handle.createWriteStream();
  const done = finished(stream);
  const send = async (chunk: string) => {
    if (!stream.write(chunk)) await once(stream, "drain");
  };
  try {
    await send(await readFile(new URL("../migrations/florida_sales.sql", import.meta.url), "utf8") + "\n");
    await send("INSERT INTO florida_releases(id, source_updated_at, start_month) VALUES (" + Object.values(release).map(literal).join(",") + ");\n");
    const releaseSql = literal(manifest.release);
    const statement = "INSERT INTO florida_sales(release_id, county_code, parcel_id, address, city, zip, property_use, sale_month, price) VALUES\n";
    let batch: string[] = [];
    for (const row of db.prepare("SELECT county_code, parcel_id, address, city, zip, property_use, sale_month, price FROM florida_sales WHERE release_id = ? ORDER BY county_code, parcel_id").iterate(manifest.release)) {
      batch.push("(" + releaseSql + "," + Object.values(row).map(literal).join(",") + ")");
      if (batch.length === 150) {
        await send(statement + batch.join(",\n") + ";\n");
        batch = [];
      }
    }
    if (batch.length) await send(statement + batch.join(",\n") + ";\n");
    await send("INSERT INTO florida_coverage VALUES\n" + countyRecords.map(row =>
      "(" + [manifest.release!, row.county_code, row.records, row.latest_month].map(literal).join(",") + ")").join(",\n") + ";\n");
    stream.end();
    await done;
  } catch (error) {
    stream.destroy();
    await done.catch(() => {});
    throw error;
  }
  console.log(JSON.stringify({ release: manifest.release, counties: countyRecords.length, records, state: "ready-to-stage", sql: output }));
} finally {
  db.close();
}
