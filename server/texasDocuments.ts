import snapshot from "./texasHousingSnapshot.json";
import { generatedDocumentResponse } from "./documentResponse";
import { escapeSitemapXml as escape, SITEMAP_ORIGIN } from "./sitemapSnapshot";

type Estimate = [value: number | null, margin: number | null];
type HousingArea = {
  homeValue: Estimate;
  rent: Estimate;
  housingUnits: Estimate;
  occupied: number;
  ownerOccupied: number;
  structures: { detached: number; attached: number; multiUnit: number; mobile: number; other: number };
  hpi: [year: number, change: number][];
};
type County = HousingArea & {
  fips: string;
  name: string;
  slug: string;
  appraisalPath: string;
  neighbors: string[];
};

const root = "/texas";
export const texasSitemapPath = "/sitemap-texas.xml";
const counties: County[] = snapshot.counties as County[];
const state: HousingArea = snapshot.state as HousingArea;
const bySlug = new Map(counties.map(county => [county.slug, county]));
const byFips = new Map(counties.map(county => [county.fips, county]));
const census = "https://www.census.gov/programs-surveys/acs/data/summary-file." + snapshot.acsYear + ".html";
const fhfa = "https://www.fhfa.gov/data/hpi/datasets";
const appraisal = "https://comptroller.texas.gov/taxes/property-tax/county-directory/";
const adjacency = "https://www.census.gov/geographies/reference-files/" + snapshot.adjacencyYear + "/geo/county-adjacency.html";
const parcelProgram = "https://geographic.texas.gov/stratmap/land-parcels";
const acsPeriod = (snapshot.acsYear - 4) + "–" + snapshot.acsYear;
const trendYear = state.hpi.at(-1)![0];
const number = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const signed = new Intl.NumberFormat("en-US", {
  style: "percent", signDisplay: "exceptZero", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function supportedEstimate(estimate: Estimate): estimate is [number, number] {
  const [value, margin] = estimate;
  return value !== null && margin !== null && value > 0 && margin <= value / 2;
}

function hasMarketProfile(area: HousingArea) {
  return supportedEstimate(area.homeValue) || supportedEstimate(area.rent) ||
    area.hpi.filter(([year]) => year >= trendYear - 4).length >= 3;
}

export function isTexasDocument(pathname: string) {
  return pathname === root || pathname.startsWith(root + "/");
}

const countyPath = (county: County) => root + "/" + county.slug;
const countyLink = (county: County) => '<a href="' + countyPath(county) + '">' + escape(county.name) + " County</a>";
const publicPaths = [root, ...counties.filter(hasMarketProfile).map(countyPath)];

export const texasSitemapEntries = publicPaths.map(path => ({ path, lastmod: snapshot.publishedOn }));

function estimateText(estimate: Estimate, showMargin = false) {
  if (!supportedEstimate(estimate)) return "Insufficient data";
  const [value, margin] = estimate;
  return dollars.format(value) + (showMargin ? " ± " + dollars.format(margin) : "");
}

function trendFor(area: HousingArea, year: number) {
  const change = area.hpi.find(([observed]) => observed === year)?.[1];
  return change === undefined ? "Unavailable" : signed.format(change / 100);
}

function stat(label: string, value: string) {
  return "<div><dt>" + escape(label) + "</dt><dd>" + escape(value) + "</dd></div>";
}

function facts(area: HousingArea) {
  const latestTrend = area.hpi.at(-1);
  return '<dl class="facts">' + stat("Median owner-reported home value", estimateText(area.homeValue, true)) +
    stat("Median monthly gross rent", estimateText(area.rent, true)) +
    stat("Estimated housing units", number.format(area.housingUnits[0]!) + " ± " + number.format(area.housingUnits[1]!)) +
    (latestTrend ? stat(latestTrend[0] + " FHFA price index change", signed.format(latestTrend[1] / 100)) : "") + "</dl>";
}

function table(label: string, columns: string[], rows: string[][]) {
  return '<div class="table-scroll" role="region" aria-label="' + escape(label) + '" tabindex="0">' +
    '<table><thead><tr>' + columns.map(column => '<th scope="col">' + escape(column) + "</th>").join("") +
    "</tr></thead><tbody>" + rows.map(([heading, ...cells]) => '<tr><th scope="row">' + heading + "</th>" +
      cells.map(cell => "<td>" + escape(cell) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
}

function housingStock(area: HousingArea) {
  const total = area.housingUnits[0]!;
  const occupied = area.occupied;
  const types: Array<[string, number]> = [
    ["Single-family detached", area.structures.detached],
    ["Single-family attached", area.structures.attached],
    ["Units in multifamily buildings", area.structures.multiUnit],
    ["Mobile homes", area.structures.mobile],
    ["Other structures", area.structures.other],
  ];
  return '<section aria-labelledby="housing-stock"><h2 id="housing-stock">Housing stock and occupancy</h2>' +
    "<p>The Census estimates " + number.format(occupied) + " occupied and " + number.format(total - occupied) +
    " vacant housing units. Of the occupied units, " + number.format(area.ownerOccupied) + " were owner-occupied and " +
    number.format(occupied - area.ownerOccupied) + " were renter-occupied.</p>" +
    table("Housing units by structure", ["Structure", "Units", "Share"], types.map(([label, count]) =>
      [label, number.format(count), percent.format(count / total)])) + "</section>";
}

function priceHistory(area: HousingArea, county?: County) {
  const heading = '<section aria-labelledby="price-history"><h2 id="price-history">House price index history</h2>';
  if (!area.hpi.length) {
    return heading + '<p>FHFA does not publish a recent annual series for this county. ' +
      '<a href="/texas#price-history">View the statewide series</a> and compare nearby counties below.</p></section>';
  }
  const columns = ["Year", county ? county.name + " County" : "Texas"];
  if (county) columns.push("Texas");
  const rows = [...area.hpi].reverse().map(([year, change]) => {
    const row = [String(year), signed.format(change / 100)];
    if (county) row.push(trendFor(state, year));
    return row;
  });
  return heading + "<p>Annual changes track the FHFA single-family house price index. The index uses sale prices and " +
    "mortgage-related appraisals from eligible loans, and its coverage varies by county.</p>" +
    table("Annual FHFA house price index changes", columns, rows) + "</section>";
}

function comparisonRow(county: County) {
  return [
    countyLink(county),
    estimateText(county.homeValue),
    estimateText(county.rent),
    number.format(county.housingUnits[0]!),
    trendFor(county, trendYear),
  ];
}

const comparisonColumns = ["County", "Median home value", "Median gross rent", "Housing units", "FHFA change, " + trendYear];

function methodology() {
  return '<section aria-labelledby="sources"><h2 id="sources">Sources and definitions</h2>' +
    '<ul><li><a href="' + census + '">U.S. Census Bureau American Community Survey</a>, ' + acsPeriod +
    " five-year estimates. Home value is the median reported by owners, and gross rent includes rent and applicable utilities. " +
    "The ± figure is the published 90% margin of error. We withhold dollar estimates when the margin exceeds half the estimate " +
    "or the Census does not report a value. Tables B25002, B25003, B25024, B25064 and B25077.</li>" +
    '<li><a href="' + fhfa + '">FHFA Annual All-Transactions House Price Index</a>, revised ' +
    escape(snapshot.fhfaUpdatedOn) + ". This developmental index measures percent change. It cannot establish a home’s sale price.</li>" +
    '<li><a href="' + adjacency + '">Census county adjacency file</a> for counties sharing a boundary and the <a href="' +
    appraisal + '">Texas Comptroller county directory</a> for appraisal contacts. <a href="/methodology/data-coverage">See site coverage</a>.</li></ul></section>';
}

function statewide() {
  return "<p>Compare housing values, rents, the mix of homes and annual house price trends across all 254 Texas counties. " +
    "Open a county to compare nearby markets and find the appraisal district for a specific property.</p>" +
    facts(state) + '<p class="jump"><a href="#counties">Compare counties</a><a href="#housing-stock">Housing stock</a>' +
    '<a href="#price-history">Price history</a><a href="#sources">Sources</a></p>' + housingStock(state) + priceHistory(state) +
    '<section aria-labelledby="counties"><h2 id="counties">Compare Texas counties</h2>' +
    "<p>Housing figures come from the " + acsPeriod + " Census estimates. Find your county alphabetically below.</p>" +
    table("Texas county housing comparison", comparisonColumns, counties.map(comparisonRow)) + "</section>" + methodology();
}

function countyProfile(county: County) {
  const name = escape(county.name);
  const adjacent = county.neighbors.map(fips => byFips.get(fips)!);
  return "<p>Compare " + name + " County housing and nearby Texas counties using Census estimates and available FHFA trends. " +
    '<a href="#property-records">Look up a specific property</a> through the county appraisal district.</p>' + facts(county) +
    '<p class="jump"><a href="#housing-stock">Housing stock</a><a href="#price-history">Price history</a>' +
    '<a href="#nearby">Nearby counties</a><a href="#sources">Sources</a></p>' +
    housingStock(county) + priceHistory(county, county) +
    '<section aria-labelledby="nearby"><h2 id="nearby">Compare neighboring Texas counties</h2>' +
    table("Neighboring county housing comparison", comparisonColumns, [county, ...adjacent].map(comparisonRow)) +
    '<p><a href="/texas#counties">Compare all 254 Texas counties</a></p></section>' +
    '<section aria-labelledby="property-records"><h2 id="property-records">' + name + " County property records</h2>" +
    '<p>Use the <a href="' + appraisal + county.appraisalPath + '">' + name + " County appraisal district directory</a> " +
    "to find the district website and search by property address or account number. Appraisal records can help confirm parcel " +
    'identity, assessed values and tax jurisdictions. For statewide parcel downloads, see the <a href="' + parcelProgram +
    '">Texas Geographic Information Office</a>.</p><p>Texas coverage here is county-level housing research and links to official ' +
    "property records. Individual closed-sale prices and active listings require a separate data source.</p></section>" + methodology();
}

const css = ":root{color-scheme:light dark;--panel:#fff;--line:#d4dee8;--ink:#162235;--muted:#435675;--bg:#f8fafc;--link:#1259b5}" +
  "@media(prefers-color-scheme:dark){:root{--panel:#162235;--line:#38465a;--ink:#f1f5f9;--muted:#b6c6dd;--bg:#0e1724;--link:#91c3ff}}" +
  "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:1rem/1.55 system-ui,sans-serif}" +
  "header,footer,.facts div,.table-scroll{background:var(--panel);border:1px solid var(--line)}" +
  "main,header nav,footer p{max-width:72rem;margin:auto;padding:1rem}main{padding-block:1.75rem}" +
  "h1{font-size:clamp(2rem,5vw,3rem);line-height:1.1;margin-top:.8rem}h2{margin-bottom:.6rem}p,section ul{max-width:78ch}" +
  "a{color:var(--link);text-underline-offset:.17em}.crumbs ol{margin:0;list-style:none;padding:0}" +
  "header nav,.crumbs ol,.jump{display:flex;flex-wrap:wrap;gap:.5rem 1rem}.crumbs li+li:before{content:'›';margin-right:.6rem;color:var(--muted)}" +
  ".facts{display:grid;gap:.65rem;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))}.facts div{padding:.65rem .85rem;border-radius:.35rem}" +
  ".facts dt{color:var(--muted)}.facts dd{margin:0;font-size:1.18rem;font-weight:650}" +
  "section{margin-top:1.8rem}.table-scroll{overflow:auto}table{text-align:left;width:100%;border-collapse:collapse}" +
  "th,td{padding:.52rem .72rem;border-bottom:1px solid var(--line)}td{white-space:nowrap}th[scope=row]{font-weight:550}";

function html(request: Request, county: County | undefined, status: number) {
  const url = new URL(request.url);
  const path = county ? countyPath(county) : root;
  const canonical = SITEMAP_ORIGIN + path;
  const indexable = status === 200 && !url.search && (!county || hasMarketProfile(county));
  const title = status === 404 ? "Texas county not found" :
    county ? county.name + " County, TX Housing Market Data" : "Texas Housing Market Data by County";
  const description = status === 404 ? "Browse Texas counties and compare local housing data." : county
    ? "Compare home values, rent, housing stock and available price trends in " + county.name + " County, Texas. Find official property records and nearby county data."
    : "Compare median home values, rent, housing stock and house price trends across all 254 Texas counties, with links to official property records.";
  const trail = [{ name: "Home", path: "/" }, { name: "Texas housing data", path: root }];
  if (county) trail.push({ name: county.name + " County", path });
  const breadcrumbs = status === 404 ? "" : '<nav class="crumbs" aria-label="Breadcrumb"><ol>' +
    trail.map(({ name, path }, index) => index === trail.length - 1
      ? '<li aria-current="page">' + escape(name) + "</li>"
      : '<li><a href="' + path + '">' + escape(name) + "</a></li>").join("") + "</ol></nav>";
  const schema = indexable ? '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((entry, index) => ({
      "@type": "ListItem", position: index + 1, name: entry.name, item: SITEMAP_ORIGIN + entry.path,
    })),
  }).replace(/</g, "\\u003c") + "</script>" : "";
  const content = status === 404 ? '<p><a href="/texas#counties">Browse Texas counties</a></p>' :
    county ? countyProfile(county) : statewide();
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": status === 200 && !url.search ? "public, max-age=300, no-transform" : "no-store, no-transform",
    "x-content-type-options": "nosniff",
  });
  if (!indexable) headers.set("x-robots-tag", "noindex, follow");
  return generatedDocumentResponse(request,
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>" + escape(title) + ' | Realtors Dashboard</title><meta name="description" content="' + escape(description) + '">' +
    '<link rel="canonical" href="' + canonical + '">' + schema + "<style>" + css + "</style></head><body>" +
    '<header><nav aria-label="Main"><strong><a href="/">Realtors Dashboard</a></strong><a href="/browse/ny">New York</a>' +
    '<a href="/florida">Florida property sales</a><a href="/texas">Texas housing data</a><a href="/methodology/data-coverage">Data coverage</a></nav></header>' +
    "<main>" + breadcrumbs + "<h1>" + escape(title) + "</h1>" + content + "</main>" +
    '<footer><p><a href="/texas#counties">Texas county comparison</a></p></footer></body></html>', status, headers);
}

export function texasDocument(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const county = path === root ? undefined : bySlug.get(path.slice(root.length + 1).toLowerCase());
  if (path !== root && !county) return html(request, undefined, 404);
  const canonical = county ? countyPath(county) : root;
  if (url.hostname === "www.realtorsdashboard.com" || url.pathname !== canonical) {
    return Response.redirect(SITEMAP_ORIGIN + canonical + url.search, 301);
  }
  return html(request, county, 200);
}
