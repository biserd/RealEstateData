import { generatedDocumentResponse } from "./documentResponse";
import { escapeSitemapXml as escape, SITEMAP_ORIGIN } from "./sitemapSnapshot";
import { floridaCounties } from "../shared/floridaSales";
import {
  acsPeriod, change, counties, countiesByFips, countiesByState, countyHpiRevision, countyHpiYear, countyPath, countyState,
  dollars, estimateText, fhfaQuarter, housingRoot, housingSearchPath, housingSources, indexableCounty, integer,
  inventoryMonth, nation, publishedOn, share, statePath, states, statesByCode, statesBySlug, type CountyMarket,
  type Housing, type ListingSummary, type Market, type StateMarket,
} from "./usHousingData";
import {
  localDirectoryAvailable, localPath, localPlaces, localZips, readHousingFilters, searchHousing, topPlaces,
  type LocalDirectory, type SearchFilters, type SearchRow,
} from "./usHousingSearch";

const countyRoutes = new Map(counties.map(county => [countyState(county).slug + "/" + county.slug, county]));
const floridaSlugs = new Set(floridaCounties.map(county => county.slug));
const nationalTrail = [{ name: "Home", path: "/" }, { name: "U.S. housing markets", path: housingRoot }];
type Crumb = { name: string; path: string };

export function isHousingDocument(pathname: string) {
  const path = pathname.toLowerCase();
  return path === housingRoot || path.startsWith(housingRoot + "/");
}

export function housingBrowseRedirect(pathname: string) {
  const code = /^\/browse\/([a-z]{2})\/?$/i.exec(pathname)?.[1].toUpperCase();
  if (!code || ["NY", "TX", "FL"].includes(code)) return;
  const state = statesByCode.get(code);
  if (state) return statePath(state);
}

const link = (path: string, label: string) => '<a href="' + escape(path) + '">' + escape(label) + "</a>";
const stateLink = (state: StateMarket) => link(statePath(state), state.name);
const countyLink = (county: CountyMarket) => link(countyPath(county), county.name);
const units = (area: Housing) => integer.format(area.housingUnits[0]!);
const pct = (value: number) => change.format(value / 100);
const ask = (listing: ListingSummary | null) => listing ? dollars.format(listing[0]) : "Unavailable";
const filtersFor = (state = ""): SearchFilters => ({
  q: "", state, level: "", metric: "value", min: undefined, max: undefined, sort: "relevance", page: 1,
});

function stats(items: Array<[label: string, value: string]>) {
  return '<dl class="stats">' + items.map(([label, value]) =>
    "<div><dt>" + escape(label) + "</dt><dd>" + escape(value) + "</dd></div>").join("") + "</dl>";
}

function table(label: string, columns: string[], rows: string[][]) {
  return '<div class="table-scroll" role="region" aria-label="' + escape(label) + '" tabindex="0">' +
    "<table><thead><tr>" + columns.map(column => '<th scope="col">' + escape(column) + "</th>").join("") +
    '</tr></thead><tbody>' + rows.map(([heading, ...cells]) => '<tr><th scope="row">' + heading + "</th>" +
      cells.map(cell => "<td>" + cell + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
}

function marketFacts(area: Housing, listing: ListingSummary | null) {
  return stats([
    ["Median owner-reported home value", estimateText(area.homeValue, true)],
    ["Median monthly gross rent", estimateText(area.rent, true)],
    ["Estimated housing units", units(area)],
    ["Median asking price, " + inventoryMonth, ask(listing)],
  ]);
}

function marketRow(area: Market, name: string, trend: string) {
  return [name, estimateText(area.homeValue), estimateText(area.rent), ask(area.listing), units(area), trend];
}

const marketHeaders = (name: string, trend: string) =>
  [name, "Median home value", "Median gross rent", "Median asking price", "Housing units", trend];

export function housingInventorySection(listing: ListingSummary | null) {
  const title = '<section id="asking-prices"><h2>Asking prices and inventory</h2>';
  const source = link(housingSources.inventory, "Realtor.com® Economic Research");
  if (!listing) return title + "<p>There is no verified asking-price figure for this area in the " +
    inventoryMonth + " snapshot from " + source + ".</p></section>";
  return title + stats([
    ["Median asking price", ask(listing)],
    ["Active listings", integer.format(listing[1])],
    ["Median days on market", listing[2] === null ? "Unavailable" : integer.format(listing[2])],
  ]) + "<p>" + inventoryMonth + " MLS listing aggregates from " + source + ".</p></section>";
}

function housingStock(area: Housing) {
  const labels = ["Single-family detached", "Single-family attached", "Multifamily", "Mobile home", "Other structures"];
  const total = area.housingUnits[0]!;
  return '<section id="housing-stock"><h2>Housing stock and occupancy</h2>' +
    "<p>The Census estimates " + integer.format(area.occupied) + " occupied units and " +
    integer.format(total - area.occupied) + " vacant units. Of the occupied units, " +
    integer.format(area.ownerOccupied) + " are owner-occupied and " +
    integer.format(area.occupied - area.ownerOccupied) + " are renter-occupied.</p>" +
    table("Housing by structure", ["Structure", "Units", "Share"], labels.map((label, i) =>
      [label, integer.format(area.structures[i]), total > 0 ? share.format(area.structures[i] / total) : "Unavailable"])) + "</section>";
}

function methodology() {
  return '<section id="sources"><h2>Sources and definitions</h2><ul><li>' +
    link(housingSources.census, "U.S. Census Bureau American Community Survey") + ", " + acsPeriod +
    " five-year estimates. Home values are reported by owners. Gross rent includes applicable utilities. " +
    "The ± amounts give the 90% margin of error. Dollar estimates with a margin larger than half the estimate are withheld.</li><li>" +
    link(housingSources.inventory, "Realtor.com® Economic Research") + ", " + inventoryMonth +
    " MLS listing aggregates. Median asking prices reflect listed prices. Geographic data with a publisher quality flag " +
    "or fewer than 10 active listings is omitted.</li><li>" +
    link(housingSources.prices, "Federal Housing Finance Agency") + " measures price change with the seasonally adjusted " +
    "state purchase-only index for " + fhfaQuarter + " and the developmental county all-transactions index through " +
    countyHpiYear + " where published, revised " + countyHpiRevision + ".</li><li>" +
    link(housingSources.adjacency, "Census county adjacency file") + " identifies counties sharing boundaries. " +
    link(housingSources.zcta, "Census ZIP Code Tabulation Areas") + " approximate mailing ZIP boundaries. " +
    link("/methodology/data-coverage", "See full site coverage") + ".</li></ul><p>Snapshot published " +
    escape(publishedOn) + ".</p></section>";
}

const searchLevels: Array<[SearchFilters["level"], string]> = [
  ["", "All places"], ["state", "States and DC"], ["county", "Counties and equivalents"],
  ["place", "Cities, towns and Census places"], ["zip", "ZIP / Census ZIP area"],
];

function select(name: string, label: string, items: Array<[string, string]>, value: string) {
  return "<label>" + label + '<select name="' + name + '">' + items.map(([id, text]) =>
    '<option value="' + escape(id) + '"' + (id === value ? " selected" : "") + ">" + escape(text) + "</option>").join("") +
    "</select></label>";
}

export function housingSearchForm(filters = filtersFor()) {
  return '<form class="market-search" action="' + housingSearchPath + '" method="get">' +
    '<label class="wide">Location<input name="q" type="search" maxlength="100" placeholder="County, city, state or ZIP" value="' +
    escape(filters.q) + '"></label>' +
    select("state", "State", [["", "All states and DC"], ...states.map(s => [s.code, s.name] as [string, string])], filters.state) +
    select("level", "Geography", searchLevels, filters.level) +
    select("metric", "Price filter uses", [["value", "Owner-reported median"], ["ask", "Median asking price"]], filters.metric) +
    '<label>Minimum price<input name="min" type="number" min="1" max="999999999" value="' + (filters.min ?? "") + '"></label>' +
    '<label>Maximum price<input name="max" type="number" min="1" max="999999999" value="' + (filters.max ?? "") + '"></label>' +
    select("sort", "Sort", [
      ["relevance", "Best match"], ["ask-asc", "Asking price, low to high"], ["ask-desc", "Asking price, high to low"],
      ["value-asc", "Home value, low to high"], ["value-desc", "Home value, high to low"],
    ], filters.sort) + '<button type="submit">Search housing markets</button></form>';
}

function searchHref(options: URLSearchParams, page: number) {
  const params = new URLSearchParams(options);
  if (page === 1) params.delete("page");
  else params.set("page", String(page));
  return housingSearchPath + (params.size ? "?" + params : "");
}

function searchSection(url: URL) {
  const filters = readHousingFilters(url.searchParams);
  const { rows, total, page, maxPage, reversed } = searchHousing(filters);
  const form = housingSearchForm(filters);
  const help = "<p>Search by state, county, Census place or five-digit ZIP. You can add a state after the name, for example " +
    "“Springfield, MA.” Owner-reported values cover " + acsPeriod + ". Asking prices come from the " + inventoryMonth +
    " monthly snapshot.</p>";
  if (!total) {
    return form + help + (reversed
      ? "<p>Enter a maximum price greater than or equal to your minimum.</p>"
      : "<p>No matching markets have the selected data. Try removing the price filter, checking the state, or browsing the directory.</p>") +
      "<p>" + link(housingRoot + "#states", "Browse all states and DC") + "</p>";
  }
  const resultRows = rows.map((row: SearchRow) => [
    (row.path ? link(row.path, row.name) : escape(row.name)) + "<small>" +
    ({ state: "State or DC", county: "County or equivalent", place: "Census place", zip: "ZIP / Census ZIP area" }[row.level]) +
    "</small>", (row.counties?.length ? row.counties.map(countyLink) : row.states.map(stateLink)).join(", "),
    escape(estimateText(row.homeValue)), escape(estimateText(row.rent)), escape(ask(row.listing)),
  ]);
  return form + help + "<p>" + integer.format(total) + " markets found. Page " + page + " of " + maxPage + ".</p>" +
    table("Housing market search results", ["Market", "Related markets", "Median home value", "Median gross rent", "Median asking price"], resultRows) +
    '<nav class="pager" aria-label="Search result pages">' +
    (page > 1 ? link(searchHref(url.searchParams, page - 1), "Previous page") : "") +
    (page < maxPage ? link(searchHref(url.searchParams, page + 1), "Next page") : "") + "</nav>" +
    "<p>ZIP results label Census area estimates and USPS asking-price aggregates separately in the columns. " +
    "A Census ZIP area can cross county or state lines.</p>" + methodology();
}

function nationwide() {
  return "<p>Compare home values, asking prices, rents and price trends across all 50 states and Washington, DC. " +
    "Find a state or county profile, or search by Census place and ZIP.</p>" + housingSearchForm() +
    '<section id="states"><h2>Compare states and Washington, DC</h2>' +
    "<p>Home values and rent use the " + acsPeriod + " Census estimates. Asking prices use the " + inventoryMonth +
    " MLS snapshot. FHFA changes are year over year through " + fhfaQuarter + ".</p>" +
    table("State housing markets", marketHeaders("State or district", "FHFA year-over-year change"),
      states.map(state => marketRow(state, stateLink(state), pct(state.hpi[1])).map((cell, i) => i === 0 ? cell : escape(cell)))) +
    "</section><section><h2>U.S. housing benchmarks</h2>" +
    stats([["Median owner-reported home value", estimateText(nation.homeValue, true)],
      ["Median monthly gross rent", estimateText(nation.rent, true)], ["Estimated housing units", units(nation)]]) +
    "</section>" + housingStock(nation) + methodology();
}

function countyTrend(county: CountyMarket, year = countyHpiYear) {
  const entry = county.hpi.find(([observed]) => observed === year);
  return entry ? pct(entry[1]) : "Unavailable";
}

function countyTable(list: CountyMarket[], comparison: string) {
  return table(comparison, marketHeaders("County or equivalent", "FHFA change, " + countyHpiYear), list.map(county =>
    marketRow(county, countyLink(county), countyTrend(county)).map((cell, i) => i === 0 ? cell : escape(cell))));
}

function stateComparisons(state: StateMarket) {
  const peers = states.filter(other => other.division === state.division && other.code !== state.code);
  return '<section id="regional-comparison"><h2>Compare ' + escape(state.division) + " housing markets</h2>" +
    table("Regional state comparison", marketHeaders("State or district", "FHFA year-over-year change"),
      [state, ...peers].map(area => marketRow(area, stateLink(area), pct(area.hpi[1])).map((cell, i) => i === 0 ? cell : escape(cell)))) +
    "<p>" + link(housingRoot + "#states", "Compare all states and DC") + ".</p></section>";
}

function recordedSales(state: StateMarket, county?: CountyMarket) {
  if (state.code === "FL") {
    const path = county && floridaSlugs.has(county.slug) ? "/florida/" + county.slug : "/florida";
    return "<p>" + link(path, "Browse Florida recorded residential sales") + " from the state parcel roll.</p>";
  }
  if (state.code === "NY") {
    return "<p>" + link("/browse/ny", "Browse verified NYC sales and ZIP reports") + " with property-level records where supported.</p>";
  }
  return "";
}


function localDirectoryLinks(state: StateMarket) {
  const links = (["cities", "zip-codes"] as const).filter(directory => localDirectoryAvailable(state, directory))
    .map(directory => "<li>" + link(localPath(state, directory), directory === "cities"
      ? "Census cities and places" : "ZIP and Census ZIP areas") + "</li>");
  return links.length ? '<section id="local-directories"><h2>Explore more local housing data</h2><ul>' +
    links.join("") + "</ul></section>" : "";
}

function localAreaBody(state: StateMarket, directory: LocalDirectory) {
  const stateName = escape(state.name);
  const search = housingSearchForm(filtersFor(state.code));
  const place = directory === "cities";
  const columns = place ? ["Census place", "Housing units", "Median home value", "Median gross rent"] :
    ["ZIP / Census ZIP area", "Related counties", "Median home value", "Median gross rent", "Median asking price"];
  const rows = place ? localPlaces(state).map(([name, homes, value, rent]) => [
    escape(name), integer.format(homes), estimateText(value), estimateText(rent),
  ]) : localZips(state).map(([zip, [, fips, value, rent, listing]]) => [
    escape(zip),
    fips.length ? fips.map(id => countyLink(countiesByFips.get(id)!)).join(", ") : stateLink(state),
    estimateText(value), estimateText(rent), ask(listing),
  ]);
  const note = place ? "Includes Census cities, towns, villages and designated places. Housing figures are five-year estimates." :
    "Census ZIP areas can cross borders. County links show geographic overlaps. Owner-reported statistics use Census areas, while asking prices use the publisher’s postal ZIP totals.";
  return "<p>Compare " + integer.format(rows.length) + " published " + (place ? "Census places" : "ZIP or Census ZIP areas") +
    " in " + stateName + ". " + note + "</p>" +
    "<p>" + link(statePath(state), "See " + state.name + " state and county data") + ".</p>" +
    search + table(place ? "Census place comparison" : "ZIP housing market comparison", columns, rows) +
    localDirectoryLinks(state) + methodology();
}

function stateBody(state: StateMarket) {
  const list = countiesByState.get(state.fips)!;
  const name = escape(state.name);
  const isDistrict = state.code === "DC";
  const trend = '<section id="price-trends"><h2>FHFA house price changes</h2><p>' + fhfaQuarter +
    " seasonally adjusted purchase-only index.</p>" +
    stats([["Quarter over quarter", pct(state.hpi[0])], ["Year over year", pct(state.hpi[1])], ["Five years", pct(state.hpi[2])]]) +
    "</section>";
  return "<p>Compare " + name + " housing values, asking prices, rents, housing stock and local price trends." +
    (isDistrict ? "" : " This market includes " + integer.format(list.length) + " counties or equivalents.") + "</p>" +
    recordedSales(state) + marketFacts(state, state.listing) +
    '<p class="jump">' + (isDistrict ? "" : link("#counties", "Compare local markets")) + link("#asking-prices", "Asking prices") +
    link("#price-trends", "Price trends") + link("#housing-stock", "Housing stock") + link("#sources", "Sources") + "</p>" +
    housingSearchForm(filtersFor(state.code)) +
    (isDistrict ? "" : '<section id="counties"><h2>' + name + " county housing markets</h2>" +
      "<p>Compare available values, rents and prices. Select any county to see its full profile and neighboring markets.</p>" +
      countyTable(list, state.name + " county comparison") + "</section>") +
    housingInventorySection(state.listing) + trend + housingStock(state) +
    '<section id="local-places"><h2>Housing estimates for the largest Census places</h2>' +
    table("Census place estimates", ["Census place", "Housing units", "Median home value", "Median gross rent"],
      topPlaces(state, 10).map(([place, houses, value, rent]) =>
        [escape(place), integer.format(houses), estimateText(value), estimateText(rent)])) + "</section>" + localDirectoryLinks(state) + stateComparisons(state) + methodology();
}

function countyBody(county: CountyMarket, state: StateMarket) {
  const title = escape(county.name);
  const neighbors = county.neighbors.map(fips => countiesByFips.get(fips)!);
  const timeline = [...county.hpi].reverse().map(([year, annualChange]) => [String(year), pct(annualChange)]);
  return "<p>Compare " + title + " with other " + escape(state.name) + " markets and nearby counties. " +
    "Figures come from separate surveys, listing snapshots, and FHFA price indexes.</p>" +
    recordedSales(state, county) + marketFacts(county, county.listing) + housingInventorySection(county.listing) +
    '<section id="price-trends"><h2>Annual FHFA house price changes</h2>' +
    (timeline.length ? table("Annual county price index", ["Year", "Year-over-year change"], timeline)
      : "<p>FHFA has no published annual series for this county in the current snapshot.</p>") +
    "<p>" + link(statePath(state) + "#price-trends", "View recent statewide FHFA trends") + ".</p></section>" +
    housingStock(county) + '<section id="neighbors"><h2>Compare neighboring housing markets</h2>' +
    (neighbors.length ? countyTable([county, ...neighbors], "Nearby county housing markets") : "<p>No other counties share a land boundary in the Census file.</p>") +
    "<p>" + link(statePath(state), "Browse " + state.name + " housing data") + " or " +
    link(housingRoot + "#states", "compare states and DC") + ".</p></section>" + methodology();
}

const css = ":root{color-scheme:light dark;--bg:#f8fafc;--panel:white;--ink:#162235;--muted:#455873;--line:#d5dfe9;--link:#1259b5}" +
  "@media(prefers-color-scheme:dark){:root{--bg:#0e1724;--panel:#162235;--ink:#f1f5f9;--muted:#b6c6dd;--line:#38465a;--link:#91c3ff}}" +
  "*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--bg);font:1rem/1.55 system-ui,sans-serif}" +
  "header,footer,.table-scroll,.stats div,.market-search{background:var(--panel);border:1px solid var(--line)}" +
  "main,header nav,footer p{max-width:76rem;margin:auto;padding:1rem}main{padding-block:1.75rem}" +
  "h1{font-size:clamp(2rem,5vw,3rem);line-height:1.12;margin:.9rem 0}p,section li{max-width:78ch}section{margin-top:1.8rem}" +
  "a{color:var(--link);text-underline-offset:.17em}.crumbs ol{margin:0;list-style:none;padding:0}" +
  "header nav,.crumbs ol,.jump,.pager{display:flex;gap:.6rem 1rem;flex-wrap:wrap}.crumbs li+li:before{content:'›';margin-right:.65rem;color:var(--muted)}" +
  ".stats,.market-search{display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(min(13rem,100%),1fr))}" +
  ".stats div,.market-search{border-radius:.5rem;padding:.75rem}.stats dt,small{color:var(--muted)}.stats dd{font-size:1.2rem;font-weight:650;margin:0}" +
  ".market-search{margin-block:1.15rem;align-items:end}.market-search label{display:grid;gap:.25rem}input,select,button{font:inherit;min-width:0;width:100%;padding:.5rem;border:1px solid var(--line);border-radius:.35rem;color:var(--ink);background:var(--panel)}" +
  "button{background:#1259b5;color:white;cursor:pointer}.market-search .wide{grid-column:1/-1}.table-scroll{overflow:auto;max-height:40rem}" +
  "table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:.55rem .7rem;border-bottom:1px solid var(--line);vertical-align:top}" +
  "th[scope=row]{font-weight:550;min-width:10rem}thead th{position:sticky;top:0;background:var(--panel)}td{white-space:nowrap}" +
  "td:has(a){white-space:normal;min-width:12rem}small{display:block}.pager{margin-top:.75rem}";

function document(request: Request, title: string, description: string, path: string, trail: Crumb[], body: string, indexable: boolean, status = 200) {
  const canonical = SITEMAP_ORIGIN + path;
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": status === 200 && path !== housingSearchPath && !new URL(request.url).search
      ? "public, max-age=300, no-transform" : "no-store, no-transform",
    "x-content-type-options": "nosniff",
  });
  if (!indexable) headers.set("x-robots-tag", "noindex, follow");
  const breadcrumbs = '<nav class="crumbs" aria-label="Breadcrumb"><ol>' + trail.map((entry, i) =>
    i === trail.length - 1 ? '<li aria-current="page">' + escape(entry.name) + "</li>" :
      "<li>" + link(entry.path, entry.name) + "</li>").join("") + "</ol></nav>";
  const schema = indexable ? '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: trail.map((entry, i) => ({
      "@type": "ListItem", position: i + 1, name: entry.name, item: SITEMAP_ORIGIN + entry.path,
    })),
  }).replace(/</g, "\\u003c") + "</script>" : "";
  return generatedDocumentResponse(request,
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>" + escape(title) + ' | Realtors Dashboard</title><meta name="description" content="' +
    escape(description) + '"><link rel="canonical" href="' + escape(canonical) + '">' + schema + "<style>" + css + "</style></head><body>" +
    '<header><nav aria-label="Main"><strong>' + link("/", "Realtors Dashboard") + "</strong>" +
    link(housingRoot, "U.S. housing markets") + link("/browse/ny", "NYC recorded sales") +
    link("/florida", "Florida recorded sales") + link("/methodology/data-coverage", "Data coverage") + "</nav></header>" +
    "<main>" + breadcrumbs + "<h1>" + escape(title) + "</h1>" + body + "</main><footer><p>" +
    link(housingRoot + "#states", "All states and DC") + "</p></footer></body></html>", status, headers);
}

export function housingDocument(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase().replace(/\/+$/, "");
  const indexable = !url.search;
  if (path === housingRoot || path === housingSearchPath) {
    if (url.pathname !== path || url.hostname === "www.realtorsdashboard.com") {
      return Response.redirect(SITEMAP_ORIGIN + path + url.search, 301);
    }
    return path === housingSearchPath
      ? document(request, "Search U.S. Housing Markets", "Find housing data by location and price.", path,
          [...nationalTrail, { name: "Search", path }], request.method === "HEAD" ? "" : searchSection(url), false)
      : document(request, "U.S. Housing Markets by State", "Compare home values, asking prices, rents, and local price trends across all 50 states and Washington, DC.",
          path, nationalTrail, request.method === "HEAD" ? "" : nationwide(), indexable);
  }
  const suffix = path.slice(housingRoot.length + 1);
  const local = /^([^/]+)\/(cities|zip-codes)$/.exec(suffix);
  const localState = local && statesBySlug.get(local[1]);
  const directory = local?.[2] as LocalDirectory | undefined;
  if (localState && directory && localDirectoryAvailable(localState, directory)) {
    const canonical = localPath(localState, directory);
    if (url.pathname !== canonical || url.hostname === "www.realtorsdashboard.com") {
      return Response.redirect(SITEMAP_ORIGIN + canonical + url.search, 301);
    }
    const scope = directory === "cities" ? "Cities and Census Places" : "ZIP Code Housing Data";
    return document(request, localState.name + " " + scope,
      "Compare published home values and rent across " + localState.name + " " + scope.toLowerCase() + ".",
      canonical, [...nationalTrail, { name: localState.name, path: statePath(localState) }, { name: scope, path: canonical }],
      request.method === "HEAD" ? "" : localAreaBody(localState, directory), indexable);
  }
  const county = countyRoutes.get(suffix);
  const state = county ? countyState(county) : statesBySlug.get(suffix);
  if (!state) {
    return document(request, "Housing market not found", "Browse published U.S. housing markets.", path, nationalTrail,
      "<p>" + link(housingRoot + "#states", "Browse all states and DC") + "</p>", false, 404);
  }
  const canonical = county ? countyPath(county) : statePath(state);
  if (url.pathname !== canonical || url.hostname === "www.realtorsdashboard.com") {
    return Response.redirect(SITEMAP_ORIGIN + canonical + url.search, 301);
  }
  const trail = [...nationalTrail, { name: state.name, path: statePath(state) }];
  if (county) {
    trail.push({ name: county.name, path: canonical });
    return document(request, county.name + ", " + state.code + " Housing Market",
      "Explore home values, asking prices, rent, and neighboring markets in " + county.name + ", " + state.name + ".",
      canonical, trail, request.method === "HEAD" ? "" : countyBody(county, state), indexable && indexableCounty(county));
  }
  return document(request, state.name + " Housing Market Data",
    "Compare county housing data, asking prices, rents, and house price trends in " + state.name + ".",
    canonical, trail, request.method === "HEAD" ? "" : stateBody(state), indexable);
}
