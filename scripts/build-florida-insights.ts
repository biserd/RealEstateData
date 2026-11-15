import { DatabaseSync } from "node:sqlite";
import { readFile, rename, writeFile } from "node:fs/promises";
import {
  floridaCounties, floridaUses, floridaZip,
  type FloridaCountyProfile, type FloridaInsightsSnapshot, type FloridaPriceGroup,
} from "../shared/floridaSales";

type SalesRow = { zip: string; city: string; property_use: string; sale_month: string; price: number };
type Groups = Map<string, number[]>;

function priceSummary(prices: number[]) {
  const sorted = prices.slice().sort((a, b) => a - b);
  if (!sorted.length) throw new Error("Cannot summarize an empty price sample");
  const percentile = (p: number) => {
    const index = (sorted.length - 1) * p;
    const floor = Math.floor(index);
    return Math.round(sorted[floor] + (sorted[Math.ceil(index)] - sorted[floor]) * (index - floor));
  };
  return { records: sorted.length, p25: percentile(0.25), median: percentile(0.5), p75: percentile(0.75) };
}

function addToGroup(groups: Groups, key: string, price: number) {
  let prices = groups.get(key);
  if (!prices) groups.set(key, prices = []);
  prices.push(price);
}

function busiest(groups: Groups, limit: number): FloridaPriceGroup[] {
  return [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, limit)
    .map(([key, prices]) => ({ key, ...priceSummary(prices) }));
}

function latestMonths(groups: Groups): FloridaPriceGroup[] {
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).slice(0, 6)
    .map(([key, prices]) => ({ key, ...priceSummary(prices) }));
}

function countyNeighbors(raw: string) {
  const normalizedName = (name: string) => name.replace(/ County, FL$/, "").toLowerCase().replace(/[^a-z]/g, "");
  const codes = new Map(floridaCounties.map(county => [normalizedName(county.name), county.code]));
  const result = new Map(floridaCounties.map(county => [county.code, new Set<number>()]));
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0].trim() !== "County Name|County GEOID|Neighbor Name|Neighbor GEOID|Length") throw new Error("Unexpected Census adjacency file");
  for (const line of lines.slice(1)) {
    const [left, leftId, right, rightId] = line.split("|");
    if (!leftId?.startsWith("12") || !rightId?.startsWith("12") || leftId === rightId) continue;
    const county = codes.get(normalizedName(left));
    const neighbor = codes.get(normalizedName(right));
    if (!county || !neighbor) throw new Error("Unrecognized Florida county in Census adjacency: " + line);
    result.get(county)!.add(neighbor);
  }
  if ([...result].some(([code, adjacent]) => !adjacent.size || [...adjacent].some(other => !result.get(other)?.has(code)))) {
    throw new Error("Incomplete Florida county adjacency");
  }
  return result;
}

const [database, adjacencyFile, output = "server/floridaInsightsSnapshot.json"] = process.argv.slice(2);
if (!database || !adjacencyFile) {
  throw new Error("Usage: npx tsx scripts/build-florida-insights.ts snapshot.sqlite county_adjacency2026.txt [output.json]");
}
const { release } = JSON.parse(await readFile(database + ".json", "utf8")) as { release?: string };
if (!release || !/^fdor-\d+-\d{4}-\d{2}$/.test(release)) throw new Error("Missing verified Florida snapshot release");
const neighbors = countyNeighbors(await readFile(adjacencyFile, "utf8"));
const db = new DatabaseSync(database, { readOnly: true });
try {
  const coverage = db.prepare("SELECT county_code, records, latest_month FROM florida_coverage WHERE release_id = ?").all(release);
  if (coverage.length !== floridaCounties.length) throw new Error("All 67 county totals are required");
  const query = db.prepare("SELECT zip, city, property_use, sale_month, price FROM florida_sales WHERE release_id = ? AND county_code = ?");
  const profiles: Record<string, FloridaCountyProfile> = {};
  const statePrices: number[] = [], stateZips = new Set<string>(), stateTypes: Groups = new Map(), stateMonths: Groups = new Map();
  for (const county of floridaCounties) {
    const prices: number[] = [], zipGroups: Groups = new Map(), cityGroups: Groups = new Map(), types: Groups = new Map(), months: Groups = new Map();
    for (const value of query.iterate(release, county.code)) {
      const row = value as SalesRow;
      if (!floridaZip.test(row.zip) || !row.city.trim() || !Object.hasOwn(floridaUses, row.property_use) ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.sale_month) || !Number.isSafeInteger(row.price) || row.price < 50_000 || row.price > 100_000_000) {
        throw new Error("Invalid published record in " + county.name);
      }
      prices.push(row.price);
      statePrices.push(row.price);
      stateZips.add(row.zip);
      addToGroup(zipGroups, row.zip, row.price);
      addToGroup(cityGroups, row.city.trim().toUpperCase(), row.price);
      addToGroup(types, row.property_use, row.price);
      addToGroup(months, row.sale_month, row.price);
      addToGroup(stateTypes, row.property_use, row.price);
      addToGroup(stateMonths, row.sale_month, row.price);
    }
    const expected = coverage.find(row => row.county_code === county.code);
    const recentMonths = latestMonths(months);
    if (!expected || expected.records !== prices.length || expected.latest_month !== recentMonths[0]?.key) {
      throw new Error("Profile does not match verified coverage for " + county.name);
    }
    profiles[county.code] = {
      ...priceSummary(prices), zipCount: zipGroups.size, topZips: busiest(zipGroups, 8), topCities: busiest(cityGroups, 6),
      propertyTypes: busiest(types, Infinity), recentMonths, neighbors: [...neighbors.get(county.code)!].sort((a, b) => a - b),
    };
  }
  const total = db.prepare("SELECT count(*) AS records FROM florida_sales WHERE release_id = ?").get(release);
  if (total?.records !== statePrices.length) throw new Error("County profiles do not account for all Florida records");
  const data: FloridaInsightsSnapshot = { release, counties: profiles, statewide: {
    ...priceSummary(statePrices), zipCount: stateZips.size, propertyTypes: busiest(stateTypes, Infinity), recentMonths: latestMonths(stateMonths),
  } };
  const outputText = JSON.stringify(data).replace(/,"(\d{2})":/g, ',\n"$1":');
  await writeFile(output + ".tmp", outputText + "\n");
  await rename(output + ".tmp", output);
  console.log(JSON.stringify({ release, counties: coverage.length, records: data.statewide.records, zips: stateZips.size, median: data.statewide.median }));
} finally {
  db.close();
}
