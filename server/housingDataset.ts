import {
  acsPeriod, counties, countiesByFips, countyHpiRevision, countyHpiYear, countyPath, countyState, fhfaQuarter, housingRoot,
  housingSearchPath, housingSources, nation, publishedOn, reliable, statePath, states, statesByCode,
  type CountyMarket, type Estimate, type Housing, type ListingSummary, type Prices, type StateMarket,
} from "./usHousingData";
import { housingLocalCoverage, readHousingFilters, searchHousing, zipHousingArea, type SearchRow } from "./usHousingSearch";
import { DatasetError } from "./datasetError";
import { SITEMAP_ORIGIN } from "./sitemapSnapshot";
import texas from "./texasHousingSnapshot.json";

export const housingDataset = {
  id: "us-housing-markets", publishedOn, currency: "USD",
  coverage: { statesAndDc: states.length, countiesAndEquivalents: counties.length, ...housingLocalCoverage },
  sources: {
    census: { name: "U.S. Census Bureau American Community Survey", period: acsPeriod, url: housingSources.census },
    inventory: { name: "Realtor.com® Economic Research", period: housingSources.inventoryPeriod, url: housingSources.inventory },
    fhfaState: { name: "FHFA purchase-only HPI, seasonally adjusted", period: fhfaQuarter, url: housingSources.prices },
    fhfaCounty: { name: "FHFA developmental all-transactions HPI", throughYear: countyHpiYear, revisedAt: countyHpiRevision, url: housingSources.prices },
    zipGeography: { name: "Census ZIP Code Tabulation Areas", url: housingSources.zcta },
  },
  notes: [
    "Census home values are owner-reported five-year estimates. Gross rent includes applicable utilities.",
    "Median asking price describes an MLS listing snapshot. Active listing counts are aggregate values.",
    "FHFA reports index movements in percent. Census ZIP areas and postal listing ZIPs have separate boundaries and definitions.",
    "Missing and publisher-suppressed figures are returned as null.",
  ],
  url: SITEMAP_ORIGIN + housingRoot,
};

const appraisal = new Map(texas.counties.map(county => [county.slug, county.appraisalPath]));
const stateRef = (state: StateMarket) => ({ code: state.code, name: state.name, url: SITEMAP_ORIGIN + statePath(state) });
const countyRef = (county: CountyMarket) => ({ fips: county.fips, name: county.name, state: countyState(county).code, url: SITEMAP_ORIGIN + countyPath(county) });

function estimate(value: Estimate) {
  return reliable(value) ? { estimateUsd: value[0], marginOfError90Usd: value[1] } : null;
}

function listing(value: ListingSummary | null) {
  return value ? { medianAskingPriceUsd: value[0], activeListingCount: value[1], medianDaysOnMarket: value[2] } : null;
}

function prices(row: Prices) {
  return {
    census: { medianHomeValue: estimate(row.homeValue), medianGrossMonthlyRent: estimate(row.rent) },
    listings: listing(row.listing),
  };
}

function housing(area: Housing) {
  const [detached, attached, multifamily, mobileHome, other] = area.structures;
  const [total, margin] = area.housingUnits;
  return {
    housingUnits: total, housingUnitsMarginOfError90: margin, occupied: area.occupied,
    vacant: total === null ? null : total - area.occupied, ownerOccupied: area.ownerOccupied,
    renterOccupied: area.occupied - area.ownerOccupied,
    structures: { detached, attached, multifamily, mobileHome, other },
  };
}

function searchRow(row: SearchRow) {
  return {
    name: row.name, level: row.level, ...(row.path && { url: SITEMAP_ORIGIN + row.path }),
    states: row.states.map(stateRef), relatedCounties: row.counties?.map(countyRef) ?? [],
    ...prices(row), housingUnits: row.level === "zip" ? null : row.houses,
  };
}

export function searchHousingDataset(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) params.set(key, String(value));
  if (input.state && !statesByCode.has(String(input.state).toUpperCase())) {
    throw new DatasetError(400, "Use a valid two-letter state or DC abbreviation.");
  }
  const limit = Number(input.limit ?? 25);
  const filters = readHousingFilters(params);
  const results = searchHousing(filters, limit, false);
  if (results.reversed) throw new DatasetError(400, "The minimum price must not exceed the maximum price.");
  return {
    dataset: housingDataset, records: results.rows.map(searchRow),
    pagination: { total: results.total, count: results.rows.length, limit, page: results.page,
      nextPage: results.page < results.maxPage ? results.page + 1 : null },
  };
}

export function exactHousingDataset(level: string, id: string) {
  const dataset = housingDataset;
  if (level === "national" && id.toUpperCase() === "US") {
    return { dataset, geography: { level, id: "US", name: "United States", url: dataset.url },
      ...prices({ ...nation, listing: null }), housing: housing(nation), states: states.map(stateRef) };
  }
  if (level === "state") {
    const area = statesByCode.get(id.toUpperCase());
    if (area) return { dataset, geography: { level, ...stateRef(area), fips: area.fips, censusDivision: area.division },
      ...prices(area), housing: housing(area),
      fhfa: { quarterChangePercent: area.hpi[0], yearChangePercent: area.hpi[1], fiveYearChangePercent: area.hpi[2] },
    };
  }
  if (level === "county") {
    const area = countiesByFips.get(id);
    if (area) {
      const tx = area.fips.startsWith("48") && appraisal.get(area.slug);
      return { dataset, geography: { level, ...countyRef(area) }, ...prices(area), housing: housing(area),
        fhfa: area.hpi.map(([year, annualChangePercent]) => ({ year, annualChangePercent })),
        neighboringCounties: area.neighbors.map(fips => countiesByFips.get(fips)!).map(countyRef),
        ...(tx && { officialPropertyRecordsUrl: "https://comptroller.texas.gov/taxes/property-tax/county-directory/" + tx }),
      };
    }
  }
  if (level === "zip") {
    const area = zipHousingArea(id);
    if (area) return { dataset, geography: { level, id, url: SITEMAP_ORIGIN + housingSearchPath + "?" + new URLSearchParams({ q: id, level }) },
      ...prices({ homeValue: area[2], rent: area[3], listing: area[4] }),
      states: area[0].map(code => stateRef(statesByCode.get(code)!)),
      relatedCounties: area[1].map(fips => countyRef(countiesByFips.get(fips)!)),
    };
  }
  throw new DatasetError(404, "No published housing market matches this exact geography.");
}
