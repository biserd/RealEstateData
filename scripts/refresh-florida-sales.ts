import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname, resolve } from "node:path";
import { floridaCounties, floridaParcelLayer, floridaUses, floridaZip } from "../shared/floridaSales";

const schema = new URL("../migrations/florida_sales.sql", import.meta.url);
const currentMonth = new Date().toISOString().slice(0, 7);
const monthFormat = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const fieldList = "OBJECTID,CO_NO,PARCEL_ID,PHY_ADDR1,PHY_ADDR2,PHY_CITY,PHY_ZIPCD,DOR_UC,QUAL_CD1,M_PAR_SAL1,SALE_YR1,SALE_MO1,SALE_PRC1";
const pageSize = 2000;

type Bounds = { CO_NO: number; first_id: number; last_id: number; parcel_count: number };
type Feature<T> = { attributes: T; geometry?: { x: number; y: number } };
type SourceFields = Record<string, string | number | null | undefined>;
type SaleTuple = [number, string, string, string, string, string, string, number];
type LayerPage<T> = { features: Feature<T>[]; exceededTransferLimit?: boolean };
type County = typeof floridaCounties[number];

const clean = (value: SourceFields[string]) => String(value ?? "").trim().replace(/\s+/g, " ");

async function sourceJson<T>(suffix: string): Promise<T> {
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(floridaParcelLayer + suffix, {
        signal: AbortSignal.timeout(40_000), redirect: "error",
      });
      if (response.status === 429 || response.status >= 500) throw new Error("GIS service HTTP " + response.status);
      if (!response.ok) throw new Error("GIS service refused request, HTTP " + response.status);
      const data: T & { error?: { code: number; message: string } } = await response.json();
      if (data.error) throw new Error("GIS service " + data.error.code + ": " + data.error.message);
      return data;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await sleep(750 * (2 ** attempt));
    }
  }
  throw new Error("GIS service retry limit reached");
}

async function countyBounds() {
  const [min, max, count] = ["min", "max", "count"].map((statisticType, index) => ({
    statisticType, onStatisticField: "OBJECTID", outStatisticFieldName: ["first_id", "last_id", "parcel_count"][index],
  }));
  const params = new URLSearchParams({ f: "json", where: "1=1", groupByFieldsForStatistics: "CO_NO",
    outStatistics: JSON.stringify([min, max, count]), returnGeometry: "false" });
  const { features, exceededTransferLimit } = await sourceJson<LayerPage<Bounds>>("/query?" + params);
  if (!Array.isArray(features) || exceededTransferLimit) throw new Error("Incomplete Florida county inventory");
  const byCounty = new Map(features.map(({ attributes: row }) => [row.CO_NO, row]));
  for (const { code, name } of floridaCounties) {
    const bounds = byCounty.get(code);
    if (!bounds || !Number.isSafeInteger(bounds.first_id) || bounds.first_id > bounds.last_id || bounds.parcel_count < 1) {
      throw new Error("Missing source parcel bounds for " + name);
    }
  }
  return byCounty;
}

async function sourceRevision() {
  const layer = await sourceJson<{ editingInfo?: { lastEditDate?: number } }>("?f=json");
  const changed = layer.editingInfo?.lastEditDate;
  if (!Number.isSafeInteger(changed) || changed! <= 0) throw new Error("Missing source revision");
  return new Date(changed!).toISOString();
}

export function normalizeFloridaSale(county: County, feature: Feature<SourceFields>, startMonth: string): SaleTuple | null {
  const row = feature.attributes;
  const parcel = clean(row.PARCEL_ID);
  const street = clean(row.PHY_ADDR1);
  const unit = clean(row.PHY_ADDR2);
  const city = clean(row.PHY_CITY);
  const zip = clean(row.PHY_ZIPCD);
  const use = clean(row.DOR_UC);
  const month = clean(row.SALE_YR1) + "-" + clean(row.SALE_MO1).padStart(2, "0");
  const price = Number(row.SALE_PRC1);
  const point = feature.geometry;
  if (Number(row.CO_NO) !== county.code || !/^[\w .\/-]{1,40}$/.test(parcel) || !/^\d+[\w/-]*\s+\S/.test(street) ||
    street.length > 80 || unit.length > 40 || /\b(?:REDACTED|CONFIDENTIAL|UNKNOWN|PROTECTED)\b/i.test(street + " " + unit + " " + city) ||
    !/^[a-z][a-z .'-]{1,45}$/i.test(city) || !floridaZip.test(zip) || !Object.hasOwn(floridaUses, use) ||
    !["01", "02"].includes(clean(row.QUAL_CD1)) || clean(row.M_PAR_SAL1) ||
    !monthFormat.test(month) || month < startMonth || month > currentMonth ||
    !Number.isSafeInteger(price) || price < 50_000 || price > 100_000_000 ||
    !point || !(point.x >= -87.7 && point.x <= -79.7 && point.y >= 24.3 && point.y <= 31.1)) return null;
  const address = unit && unit !== street ? street + " " + unit : street;
  return [county.code, parcel, address, city, zip, use, month, price];
}

async function collectCounty(db: DatabaseSync, release: string, county: County, bounds: Bounds, startMonth: string) {
  const completed = db.prepare("SELECT records FROM florida_coverage WHERE release_id = ? AND county_code = ?").get(release, county.code);
  if (completed) return;
  db.prepare("DELETE FROM florida_sales WHERE release_id = ? AND county_code = ?").run(release, county.code);
  db.prepare("DELETE FROM florida_conflicts WHERE county_code = ?").run(county.code);
  const insert = db.prepare("INSERT OR IGNORE INTO florida_sales VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const existing = db.prepare("SELECT address, city, zip, property_use, sale_month, price FROM florida_sales WHERE release_id = ? AND county_code = ? AND parcel_id = ?");
  const conflict = db.prepare("INSERT OR IGNORE INTO florida_conflicts VALUES (?, ?)");
  let cursor = bounds.first_id - 1;
  let fetched = 0;
  const allowedUses = Object.keys(floridaUses).map(use => "'" + use + "'").join(",");
  while (cursor < bounds.last_id) {
    const where = "CO_NO = " + county.code + " AND OBJECTID > " + cursor + " AND OBJECTID <= " + bounds.last_id +
      " AND SALE_YR1 >= " + Number(startMonth.slice(0, 4)) + " AND DOR_UC IN (" + allowedUses + ")" +
      " AND QUAL_CD1 IN ('01','02') AND SALE_PRC1 BETWEEN 50000 AND 100000000";
    const params = new URLSearchParams({ f: "json", where, outFields: fieldList, returnGeometry: "true",
      outSR: "4326", orderByFields: "OBJECTID ASC", resultRecordCount: String(pageSize) });
    const data = await sourceJson<LayerPage<SourceFields>>("/query?" + params);
    if (!Array.isArray(data.features) || (!data.features.length && data.exceededTransferLimit)) throw new Error(county.name + " returned incomplete data");
    const accepted: SaleTuple[] = [];
    for (const feature of data.features) {
      const id = Number(feature.attributes.OBJECTID);
      if (!Number.isSafeInteger(id) || id <= cursor || id > bounds.last_id) throw new Error(county.name + " returned an unordered page");
      cursor = id;
      const sale = normalizeFloridaSale(county, feature, startMonth);
      if (sale) accepted.push(sale);
    }
    db.exec("BEGIN");
    try {
      for (const sale of accepted) {
        if (insert.run(release, ...sale).changes === 0) {
          const prior = existing.get(release, sale[0], sale[1]);
          if (!prior || Object.values(prior).some((value, index) => value !== sale[index + 2])) conflict.run(sale[0], sale[1]);
        }
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    fetched += data.features.length;
    if (!data.exceededTransferLimit && data.features.length < pageSize) break;
  }
  db.prepare("DELETE FROM florida_sales WHERE release_id = ? AND county_code = ? AND parcel_id IN (SELECT parcel_id FROM florida_conflicts WHERE county_code = ?)").run(release, county.code, county.code);
  const summary = db.prepare("SELECT count(*) AS records, max(sale_month) AS latest FROM florida_sales WHERE release_id = ? AND county_code = ?").get(release, county.code);
  if (!summary?.records) throw new Error("No qualifying published sale rows for " + county.name);
  db.prepare("INSERT INTO florida_coverage VALUES (?, ?, ?, ?)").run(release, county.code, summary.records, summary.latest);
  console.log(JSON.stringify({ county: county.name, fetched, ...summary }));
}

async function main() {
  const args = process.argv.slice(2);
  const value = (key: string) => args.find(arg => arg.startsWith("--" + key + "="))?.slice(key.length + 3);
  const output = value("output");
  const startMonth = value("since") || new Date().getUTCFullYear() - 1 + "-01";
  const countyArg = value("county");
  if (!output || !monthFormat.test(startMonth) || startMonth > currentMonth || args.some(arg => !/^--(?:output|since|county)=.+$/.test(arg))) {
    throw new Error("Usage: npm run data:florida -- --output=.cache/florida.sqlite [--since=YYYY-MM] [--county=slug]");
  }
  const counties = countyArg ? floridaCounties.filter(county => county.slug === countyArg) : floridaCounties;
  if (!counties.length) throw new Error("Unknown Florida county " + countyArg);
  const [updated, bounds] = await Promise.all([sourceRevision(), countyBounds()]);
  const release = "fdor-" + Date.parse(updated) + "-" + startMonth;
  await mkdir(dirname(resolve(output)), { recursive: true });
  const db = new DatabaseSync(output);
  try {
    db.exec(await readFile(schema, "utf8"));
    db.exec("CREATE TEMP TABLE florida_conflicts (county_code INTEGER, parcel_id TEXT, PRIMARY KEY (county_code, parcel_id))");
    db.prepare("INSERT OR IGNORE INTO florida_releases(id, source_updated_at, start_month) VALUES (?, ?, ?)").run(release, updated, startMonth);
    // Keep requests bounded. A failed county stays resumable and cannot quietly pass coverage.
    let next = 0;
    const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
      while (next < counties.length) {
        const county = counties[next++];
        await collectCounty(db, release, county, bounds.get(county.code)!, startMonth);
      }
    }));
    for (const result of results) if (result.status === "rejected") throw result.reason;
    if (await sourceRevision() !== updated) {
      db.prepare("DELETE FROM florida_releases WHERE id = ?").run(release);
      throw new Error("The source changed during acquisition. Restart to keep the release consistent.");
    }
    const summary = db.prepare("SELECT county_code, records, latest_month FROM florida_coverage WHERE release_id = ? ORDER BY county_code").all(release);
    await writeFile(output + ".json", JSON.stringify({ release, sourceUpdatedAt: updated, startMonth, coverage: summary }, null, 2));
    console.log(JSON.stringify({ release, counties: summary.length, records: summary.reduce((sum, row) => sum + Number(row.records), 0) }));
  } finally {
    db.close();
  }
}

await main();
