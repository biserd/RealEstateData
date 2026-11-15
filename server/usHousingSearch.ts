import placeRows from "./usHousingPlaces.json";
import zipRows from "./usHousingZips.json";
import {
  counties, countiesByFips, countyPath, countyState, housingRoot, publishedOn, reliable, statePath, states, statesByCode,
  type CountyMarket, type Place, type Prices, type StateMarket, type ZipArea,
} from "./usHousingData";

const places = placeRows as unknown as Record<string, Place[]>;
const zips = zipRows as unknown as Record<string, ZipArea>;
export const pageSize = 40;
const levels = ["state", "county", "place", "zip"] as const;
type Level = typeof levels[number];
type Sort = "relevance" | "value-asc" | "value-desc" | "ask-asc" | "ask-desc";

export type SearchFilters = {
  q: string;
  state: string;
  level: Level | "";
  metric: "ask" | "value";
  min: number | undefined;
  max: number | undefined;
  sort: Sort;
  page: number;
};
export type SearchRow = Prices & {
  name: string;
  level: Level;
  states: StateMarket[];
  counties?: CountyMarket[];
  path?: string;
  houses: number;
};

export function topPlaces(state: StateMarket, limit: number) {
  return places[state.code].filter(([, , value, rent]) => reliable(value) || reliable(rent))
    .toSorted((a, b) => b[1] - a[1]).slice(0, limit);
}

const normalize = (word: string) => word.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
  .replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const placeName = (name: string) => normalize(name.replace(/ (?:city|town|village|borough|CDP|municipality)$/, ""));
const stateNames = new Map<string, StateMarket>();
for (const state of states) {
  stateNames.set(normalize(state.name), state);
  stateNames.set(state.code.toLowerCase(), state);
}
stateNames.set("washington dc", statesByCode.get("DC")!);
const stateQueries = [...stateNames.keys()].sort((a, b) => b.length - a.length);
const stateKeys = new Map(states.map(state => [state.code, normalize(state.name)]));
const countyKeys = new Map(counties.map(county => [county.fips, normalize(county.name)]));
const placeKeys = new Map(states.map(state => [state.code, places[state.code].map(([name]) => placeName(name))]));

function amount(input: string | null) {
  if (!input || !/^\d{1,9}$/.test(input) || Number(input) <= 0) return undefined;
  return Number(input);
}

export function readHousingFilters(params: URLSearchParams): SearchFilters {
  const level = params.get("level") as Level;
  const sort = params.get("sort") as Sort;
  const state = (params.get("state") || "").toUpperCase();
  const page = params.get("page") || "";
  return {
    q: (params.get("q") || "").trim().slice(0, 100),
    state: statesByCode.has(state) ? state : "",
    level: levels.includes(level) ? level : "",
    metric: params.get("metric") === "ask" ? "ask" : "value",
    min: amount(params.get("min")),
    max: amount(params.get("max")),
    sort: ["value-asc", "value-desc", "ask-asc", "ask-desc"].includes(sort) ? sort : "relevance",
    page: /^[1-9]\d{0,3}$/.test(page) ? Number(page) : 1,
  };
}

function searchLocation(query: string, explicitState: string) {
  const name = normalize(query);
  const exactState = stateNames.get(name);
  if (exactState) return { name, state: explicitState, exactState };
  for (const suffix of stateQueries) {
    const code = stateNames.get(suffix)!.code;
    if (name.endsWith(" " + suffix) && (!explicitState || explicitState === code)) {
      return { name: name.slice(0, -suffix.length - 1), state: code, exactState: undefined };
    }
  }
  return { name, state: explicitState, exactState: undefined };
}

function matchName(key: string, query: string) {
  if (!query) return 1;
  if (key === query) return 4;
  if (key.startsWith(query + " ")) return 3;
  const words = key.split(" ");
  return query.split(" ").every(term => words.some(word => word.startsWith(term))) ? 2 : 0;
}

function price(row: Prices, metric: "ask" | "value") {
  return metric === "ask" ? row.listing?.[0] : reliable(row.homeValue) ? row.homeValue[0] : undefined;
}

function comparePrice(left: SearchRow, right: SearchRow, sort: Sort) {
  if (sort === "relevance") return 0;
  const metric = sort.startsWith("ask") ? "ask" : "value";
  const a = price(left, metric), b = price(right, metric);
  if (a === undefined || b === undefined) return Number(a === undefined) - Number(b === undefined);
  return sort.endsWith("desc") ? b - a : a - b;
}

export function searchHousing(filters: SearchFilters) {
  const { name, state, exactState } = searchLocation(filters.q, filters.state);
  const selected = state ? states.filter(s => s.code === state) : states;
  const selectedCodes = new Set(selected.map(s => s.code));
  const matches: Array<{ row: SearchRow; rank: number }> = [];
  const digits = /^\d{3,5}$/.test(name);
  const wants = (level: Level) => !filters.level || filters.level === level;
  const reversed = filters.min !== undefined && filters.max !== undefined && filters.min > filters.max;
  function add(row: SearchRow, rank: number) {
    if (!rank) return;
    if (filters.min !== undefined || filters.max !== undefined) {
      const value = price(row, filters.metric);
      if (value === undefined || value < (filters.min ?? 0) || value > (filters.max ?? Infinity)) return;
    }
    matches.push({ row, rank });
  }
  if (!reversed && !digits && wants("state")) {
    for (const market of selected) {
      add({ ...market, level: "state", states: [market], path: statePath(market), houses: market.housingUnits[0]! },
        exactState === market ? 8 : matchName(stateKeys.get(market.code)!, name));
    }
  }
  if (!reversed && !digits && wants("county")) {
    for (const county of counties) {
      const market = countyState(county);
      if (county.fips === "11001" || !selectedCodes.has(market.code)) continue;
      const rank = matchName(countyKeys.get(county.fips)!, name);
      if (rank) add({ ...county, level: "county", states: [market], path: countyPath(county), houses: county.housingUnits[0]! }, rank);
    }
  }
  if (!reversed && !digits && wants("place") && (name || state || filters.level === "place")) {
    for (const market of selected) {
      const keys = placeKeys.get(market.code)!;
      places[market.code].forEach(([label, houses, homeValue, rent], i) => {
        const rank = matchName(keys[i], name);
        if (rank) add({ name: label, houses, homeValue, rent, listing: null, level: "place", states: [market] }, rank);
      });
    }
  }
  if (!reversed && wants("zip") && (digits || (!name && (filters.level === "zip" || state || filters.min !== undefined || filters.max !== undefined)))) {
    const candidates = name.length === 5 && digits
      ? (zips[name] ? [[name, zips[name]] as const] : [])
      : Object.entries(zips).filter(([code]) => code.startsWith(name));
    for (const [code, [codes, countyIds, homeValue, rent, listing]] of candidates) {
      if (!codes.some(code => selectedCodes.has(code))) continue;
      add({
        name: code, homeValue, rent, listing, houses: 0, level: "zip",
        states: codes.map(id => statesByCode.get(id)!),
        counties: countyIds.map(fips => countiesByFips.get(fips)!),
      }, code === name ? 8 : 2);
    }
  }
  matches.sort((a, b) => comparePrice(a.row, b.row, filters.sort) ||
    b.rank - a.rank || b.row.houses - a.row.houses || a.row.name.localeCompare(b.row.name));
  const maxPage = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(filters.page, maxPage);
  return {
    total: matches.length, page, maxPage, reversed,
    rows: matches.slice((page - 1) * pageSize, page * pageSize).map(result => result.row),
  };
}

export type LocalDirectory = "cities" | "zip-codes";

const zipsByState = new Map(states.map(state => [state.code, [] as Array<[string, ZipArea]>]));
for (const [code, area] of Object.entries(zips)) {
  if (reliable(area[2]) || reliable(area[3]) || area[4]) {
    for (const state of area[0]) zipsByState.get(state)!.push([code, area]);
  }
}
const directoryPlaces = new Map(states.map(state => [state.code,
  places[state.code].filter(([, , value, rent]) => reliable(value) || reliable(rent))
    .toSorted((a, b) => a[0].localeCompare(b[0])),
]));

export function localPath(state: StateMarket, directory: LocalDirectory) {
  return housingRoot + "/" + state.slug + "/" + directory;
}

export function localPlaces(state: StateMarket) {
  return directoryPlaces.get(state.code)!;
}

export function localZips(state: StateMarket) {
  return zipsByState.get(state.code)!.toSorted((a, b) => a[0].localeCompare(b[0]));
}

export function localDirectoryAvailable(state: StateMarket, directory: LocalDirectory) {
  const count = directory === "cities" ? directoryPlaces.get(state.code)!.length : zipsByState.get(state.code)!.length;
  return count >= 10;
}

export const localHousingSitemapEntries = states.flatMap(state =>
  (["cities", "zip-codes"] as const).filter(directory => localDirectoryAvailable(state, directory))
    .map(directory => ({ path: localPath(state, directory), lastmod: publishedOn })));
