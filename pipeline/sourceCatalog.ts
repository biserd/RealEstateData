import type { SourceDefinition } from "./contracts";

/** Fail-closed catalog. A listed source is not publishable unless both active
 * and redistributionStatus=approved. This prevents a placeholder regional
 * adapter from silently becoming a marketed data source. */
export const SOURCE_CATALOG: readonly SourceDefinition[] = [
  {
    id: "nyc-rolling-sales",
    owner: "NYC Department of Finance / NYC Open Data",
    name: "NYC Citywide Rolling Calendar Sales",
    endpoint: "https://data.cityofnewyork.us/resource/usep-8jbt.json",
    cadence: "weekly",
    expectedLagDays: 14,
    coverage: { states: ["NY"], recordTypes: ["recorded_sales"], notes: "New York City only" },
    redistributionStatus: "approved",
    adapterVersion: "1.0.0",
    active: true,
  },
  {
    id: "nyc-condo-units",
    owner: "NYC Department of Finance / NYC Open Data",
    name: "NYC Digital Tax Map Condominium Units",
    endpoint: "https://data.cityofnewyork.us/resource/eguu-7ie3.json",
    cadence: "monthly",
    expectedLagDays: 45,
    coverage: { states: ["NY"], recordTypes: ["unit_identity"], notes: "New York City only" },
    redistributionStatus: "approved",
    adapterVersion: "1.0.0",
    active: true,
  },
  {
    id: "nys-salesweb",
    owner: "New York State Department of Taxation and Finance",
    name: "NYS SalesWeb / RP-5217",
    endpoint: "https://www.tax.ny.gov/research/property/assess/sales/salesweb.htm",
    cadence: "weekly",
    expectedLagDays: 60,
    coverage: { states: ["NY"], recordTypes: ["recorded_sales"], notes: "Non-NYC; automated access and redistribution review required" },
    redistributionStatus: "review_required",
    adapterVersion: "0.1.0-contract-only",
    active: false,
  },
  {
    id: "nj-modiv-sr1a",
    owner: "New Jersey Division of Taxation",
    name: "MOD-IV and SR1A",
    endpoint: "https://www.nj.gov/treasury/taxation/lpt/statdata.shtml",
    cadence: "annual",
    expectedLagDays: 180,
    coverage: { states: ["NJ"], recordTypes: ["assessment", "recorded_sales"], notes: "File shape, cadence, automation, and redistribution review required" },
    redistributionStatus: "review_required",
    adapterVersion: "0.1.0-contract-only",
    active: false,
  },
  {
    id: "ct-opm-municipal-sales",
    owner: "Connecticut OPM and municipal assessors",
    name: "Connecticut Real Estate Sales",
    endpoint: "https://portal.ct.gov/OPM/Root/Databases/DatabasesResources",
    cadence: "annual",
    expectedLagDays: 180,
    coverage: { states: ["CT"], recordTypes: ["recorded_sales", "assessment"], notes: "Municipality-by-municipality coverage validation required" },
    redistributionStatus: "review_required",
    adapterVersion: "0.1.0-contract-only",
    active: false,
  },
  {
    id: "licensed-reso",
    owner: "User-selected MLS/vendor",
    name: "Licensed RESO Web API",
    endpoint: "",
    cadence: "licensed_incremental",
    expectedLagDays: 1,
    coverage: { states: [], recordTypes: ["listings"], notes: "Credentials, display rules, retention rules, and coverage contract required" },
    redistributionStatus: "review_required",
    adapterVersion: "0.1.0-contract-only",
    active: false,
  },
] as const;

export function sourceById(id: string): SourceDefinition {
  const source = SOURCE_CATALOG.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown source: ${id}`);
  return source;
}

export function publishableSources(): SourceDefinition[] {
  return SOURCE_CATALOG.filter((source) => source.active && source.redistributionStatus === "approved");
}
