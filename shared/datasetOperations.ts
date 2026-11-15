const apiBase = "/api/external";
const text = (description: string, maxLength = 100, pattern?: string) => ({
  type: "string" as const, description, minLength: 1, maxLength, ...(pattern && { pattern }),
});
const integer = (description: string, minimum: number, maximum: number, defaultValue?: number) => ({
  type: "integer" as const, description, minimum, maximum, ...(defaultValue !== undefined && { default: defaultValue }),
});
const choice = (description: string, values: string[]) => ({ type: "string" as const, description, enum: values });
const limit = integer("Maximum records to return", 1, 100, 25);
const offset = integer("Number of records to skip", 0, 100_000, 0);
const zip = text("Five-digit ZIP code, including leading zeroes", 5, "^[0-9]{5}$");
const state = text("Two-letter USPS state or DC abbreviation", 2, "^[A-Za-z]{2}$");
const county = text("Florida county slug, for example miami-dade", 40, "^[a-z0-9]+(?:-[a-z0-9]+)*$");
const id = text("Exact published property ID, condo unit BBL, or condo unit slug", 180);
const month = text("Sale month as YYYY-MM", 7, "^[0-9]{4}-(0[1-9]|1[0-2])$");
const price = integer("Price in US dollars", 1, 999_999_999);

export type DatasetField = ReturnType<typeof text> | ReturnType<typeof integer> | ReturnType<typeof choice>;
type Operation = {
  title: string;
  description: string;
  path: string;
  fields: Record<string, DatasetField>;
  required?: string[];
};

export const datasetOperations = {
  list_published_datasets: {
    title: "Published real estate datasets", path: apiBase + "/datasets",
    description: "Discover published nationwide market data, Florida recorded sales, and the NYC property, sale and comparable data. Includes coverage, provenance and available operations.",
    fields: {},
  },
  search_housing_markets: {
    title: "Search U.S. housing markets", path: apiBase + "/housing-markets",
    description: "Search the published 50-state and DC dataset by state, county, Census place, or ZIP. Filter or sort on asking price or Census owner-reported value. Use a geography level to enumerate its records.",
    fields: {
      q: text("Location, for example Springfield, MA or 02108"),
      state, level: choice("Geography", ["state", "county", "place", "zip"]),
      metric: choice("Price filter basis", ["ask", "value"]), min: price, max: price,
      sort: choice("Ordering", ["relevance", "value-asc", "value-desc", "ask-asc", "ask-desc"]),
      page: integer("Result page, starting at 1", 1, 10_000, 1), limit,
    },
  },
  get_housing_market: {
    title: "Get an exact U.S. housing market", path: apiBase + "/housing-markets/:level/:id",
    description: "Get national or exact state, county, or ZIP pricing, housing stock, and available FHFA trend data. No broader substitute is returned.",
    fields: {
      level: choice("Geography type", ["national", "state", "county", "zip"]),
      id: text("US for national, USPS abbreviation for state, five-digit FIPS for county, or five-digit ZIP", 5),
    },
    required: ["level", "id"],
  },
  list_florida_counties: {
    title: "Florida recorded-sale coverage", path: apiBase + "/florida/counties",
    description: "List the active release, property counts and latest recorded-sale month for all 67 Florida counties.",
    fields: {},
  },
  get_florida_sales_profile: {
    title: "Florida recorded-sale market profile", path: apiBase + "/florida/profile",
    description: "Get statewide or county sale price quartiles, property-type and month breakdowns, and the published county ZIP and city breakdowns. Price statistics require at least 10 records.",
    fields: { county },
  },
  search_florida_recorded_sales: {
    title: "Search Florida recorded property sales", path: apiBase + "/florida/sales",
    description: "Read an exact county's published residential sales. Filter by postal ZIP, city, address, property type, or month. Follow the next cursor with the same filters. Dates have month precision.",
    fields: {
      county, zip, city: text("Exact postal city", 46), q: text("Address or city text", 80),
      type: choice("Florida DOR property use code", ["001", "002", "003", "004", "005", "006", "007", "008"]),
      from: month, to: month, cursor: text("Next cursor from the preceding page", 320),
      limit,
    },
    required: ["county"],
  },
  search_nyc_properties: {
    title: "Search published NYC properties and condo units", path: apiBase + "/nyc/properties",
    description: "Browse verified property or residential condo unit identities. Filter by exact NYC ZIP or an address fragment. Property prices are labeled separately from condo sales.",
    fields: { kind: choice("Record type (default property)", ["property", "unit"]), zip, q: text("Address fragment", 80), limit, offset },
  },
  get_nyc_property: {
    title: "Get a published NYC property or condo unit", path: apiBase + "/nyc/properties/:id",
    description: "Resolve a verified published NYC property ID, condo unit BBL, or condo unit page slug.",
    fields: { id },
    required: ["id"],
  },
  list_nyc_recorded_sales: {
    title: "List verified NYC recorded sales", path: apiBase + "/nyc/sales",
    description: "Read verified recorded sales for an exact NYC ZIP, published property ID, condo unit BBL, or building BBL. Provide exactly one location selector. Dates have day precision.",
    fields: { zip, propertyId: id, unitBbl: text("Exact ten-digit condo unit BBL", 10, "^[1-5][0-9]{9}$"), baseBbl: text("Exact ten-digit building BBL", 10, "^[1-5][0-9]{9}$"), limit, offset },
  },
  get_nyc_property_comps: {
    title: "Get published NYC comparable sales", path: apiBase + "/nyc/properties/:id/comps",
    description: "Read the current published comparable sale set for a verified NYC property or condo unit. Scores and adjusted amounts describe the comparable model.",
    fields: { id, limit, offset },
    required: ["id"],
  },
  get_nyc_market_aggregates: {
    title: "Get exact NYC recorded-sale aggregates", path: apiBase + "/nyc/market-stats",
    description: "Read the active NYC market publication by exact ZIP or published geography ID, including date, sample count, price and trend. State statistics summarize published NYC ZIP benchmarks.",
    fields: { geoType: choice("Publication geography type", ["zip", "state", "municipality", "neighborhood", "county"]), geoId: text("ZIP, NY, or an exact published geography ID", 180) },
    required: ["geoType", "geoId"],
  },
} satisfies Record<string, Operation>;

export type DatasetOperationName = keyof typeof datasetOperations;
export const datasetOperationEntries = Object.entries(datasetOperations) as Array<[DatasetOperationName, Operation]>;

export function datasetInputSchema(operation: Operation) {
  return { type: "object" as const, properties: operation.fields, required: operation.required ?? [], additionalProperties: false };
}
