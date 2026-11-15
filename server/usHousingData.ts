import profiles from "./usHousingSnapshot.json";

export type Estimate = [value: number | null, margin: number | null];
export type ListingSummary = [asking: number, active: number, days: number | null];
export type Prices = { homeValue: Estimate; rent: Estimate; listing: ListingSummary | null };
export type Housing = Omit<Prices, "listing"> & {
  housingUnits: Estimate;
  occupied: number;
  ownerOccupied: number;
  structures: number[];
};
export type Market = Housing & { name: string; fips: string; slug: string; listing: ListingSummary | null };
export type StateMarket = Market & { code: string; division: string; hpi: [quarter: number, year: number, fiveYears: number] };
export type CountyMarket = Market & { neighbors: string[]; hpi: [year: number, annualChange: number][] };
export type Place = [name: string, homes: number, value: Estimate, rent: Estimate];
export type ZipArea = [states: string[], counties: string[], value: Estimate, rent: Estimate, listing: ListingSummary | null];

export const housingRoot = "/housing-markets";
export const housingSearchPath = housingRoot + "/search";
export const housingSitemapPath = "/sitemap-housing-markets.xml";
export const housingSources = {
  census: "https://www.census.gov/programs-surveys/acs/data/summary-file." + profiles.acsYear + ".html",
  inventory: "https://www.realtor.com/research/data/",
  inventoryPeriod: profiles.inventoryMonth,
  prices: "https://www.fhfa.gov/data/hpi/datasets",
  adjacency: "https://www.census.gov/geographies/reference-files/" + profiles.adjacencyYear + "/geo/county-adjacency.html",
  zcta: "https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html",
};
export const acsPeriod = (profiles.acsYear - 4) + "–" + profiles.acsYear;
export const inventoryMonth = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(profiles.inventoryMonth + "-01T00:00:00Z"));
export const fhfaQuarter = profiles.fhfaPeriod;
export const countyHpiYear = profiles.countyHpiYear;
export const countyHpiRevision = profiles.countyHpiRevision;
export const publishedOn = profiles.publishedOn;
export const nation = profiles.nation as Housing;
export const states = profiles.states as StateMarket[];
export const counties = profiles.counties as CountyMarket[];
export const statesBySlug = new Map(states.map(state => [state.slug, state]));
export const statesByCode = new Map(states.map(state => [state.code, state]));
export const statesByFips = new Map(states.map(state => [state.fips, state]));
export const countiesByFips = new Map(counties.map(county => [county.fips, county]));
export const countiesByState = new Map(states.map(state => [state.fips, [] as CountyMarket[]]));
for (const county of counties) countiesByState.get(county.fips.slice(0, 2))!.push(county);
for (const group of countiesByState.values()) group.sort((a, b) => a.name.localeCompare(b.name));

export function statePath(state: StateMarket) {
  return state.code === "TX" ? "/texas" : housingRoot + "/" + state.slug;
}

export function countyState(county: CountyMarket) {
  return statesByFips.get(county.fips.slice(0, 2))!;
}

export function countyPath(county: CountyMarket) {
  const state = countyState(county);
  return county.fips === "11001" ? statePath(state) : statePath(state) + "/" + county.slug;
}

export function reliable(estimate: Estimate): estimate is [number, number] {
  const [value, margin] = estimate;
  return value !== null && margin !== null && value > 0 && margin <= value / 2;
}

export function indexableCounty(county: CountyMarket) {
  return county.listing !== null || reliable(county.homeValue) ||
    (county.housingUnits[0]! >= 100 && (reliable(county.rent) || county.hpi.length >= 3));
}

export const housingSitemapEntries = [
  housingRoot,
  ...states.filter(s => s.code !== "TX").map(statePath),
  ...counties.filter(c => c.fips !== "11001" && countyState(c).code !== "TX" && indexableCounty(c)).map(countyPath),
].map(path => ({ path, lastmod: publishedOn }));

export const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const integer = new Intl.NumberFormat("en-US");
export const share = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
export const change = new Intl.NumberFormat("en-US", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 2 });

export function estimateText(estimate: Estimate, withMargin = false) {
  return reliable(estimate) ? dollars.format(estimate[0]) + (withMargin ? " ± " + dollars.format(estimate[1]) : "") : "Insufficient data";
}
