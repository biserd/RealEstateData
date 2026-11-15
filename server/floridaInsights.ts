import snapshot from "./floridaInsightsSnapshot.json";
import {
  floridaAdjacencySource, floridaCounties, floridaUses,
  type FloridaCountyProfile, type FloridaInsightsSnapshot, type FloridaMarketProfile, type FloridaPriceGroup,
} from "../shared/floridaSales";
import { escapeSitemapXml as escape } from "./sitemapSnapshot";

const data = snapshot as FloridaInsightsSnapshot;
const minimumMedianSample = 10;
const countyByCode = new Map(floridaCounties.map(county => [county.code, county]));
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const labelFloridaMonth = (month: string) => monthFormat.format(new Date(month + "-01T00:00:00Z"));
export const floridaAmount = (price: number) => dollars.format(price);
export const floridaCount = (count: number) => count.toLocaleString("en-US");

export function getFloridaInsights(release: string, coverage: ReadonlyMap<number, { records: number; latest_month: string }>) {
  if (data.release !== release || coverage.size !== floridaCounties.length) return null;
  const valid = floridaCounties.every(({ code }) => {
    const published = coverage.get(code);
    const profile = data.counties[code];
    return published && profile && profile.records === published.records && profile.recentMonths[0]?.key === published.latest_month;
  });
  return valid ? data : null;
}

function medianText(group: FloridaPriceGroup | FloridaMarketProfile) {
  return group.records >= minimumMedianSample ? floridaAmount(group.median) : "Small sample";
}

function propertyLabel(code: string) {
  return floridaUses[code as keyof typeof floridaUses];
}

function cityLabel(city: string) {
  return city.toLowerCase().replace(/(^|[\s-])\p{L}/gu, initial => initial.toUpperCase());
}

function cell(value: string, numeric = false) {
  return '<td' + (numeric ? ' class="amount"' : '') + '>' + escape(value) + '</td>';
}

function summaryCards(profile: FloridaMarketProfile) {
  return '<dl class="facts"><div><dt>Median sale price</dt><dd>' + medianText(profile) +
    '</dd></div><div><dt>Middle 50% of prices</dt><dd>' +
    (profile.records >= minimumMedianSample ? floridaAmount(profile.p25) + '–' + floridaAmount(profile.p75) : "Small sample") +
    '</dd></div><div><dt>ZIP codes in snapshot</dt><dd>' + floridaCount(profile.zipCount) + '</dd></div></dl>';
}

function groupTable(label: string, firstColumn: string, rows: readonly FloridaPriceGroup[], rowHeading: (group: FloridaPriceGroup) => string) {
  return '<div class="results" role="region" aria-label="' + escape(label) + '" tabindex="0"><table class="comparison">' +
    '<thead><tr><th scope="col">' + escape(firstColumn) + '</th><th scope="col" class="amount">Records</th>' +
    '<th scope="col" class="amount">Median price</th></tr></thead><tbody>' +
    rows.map(row => '<tr><th scope="row">' + rowHeading(row) + '</th>' + cell(floridaCount(row.records), true) +
      cell(medianText(row), true) + '</tr>').join('') + '</tbody></table></div>';
}

function methodNote() {
  return '<p class="muted">Each parcel contributes its most recent reported sale if it met the state’s qualification rules. ' +
    'The median is the middle sale price, and half the analyzed prices fall between the 25th and 75th percentiles. ' +
    'We show a median when a group has at least 10 records. Counts describe this snapshot and do not measure all sales or current listings.</p>';
}

export function statewideSummary(profiles: FloridaInsightsSnapshot) {
  const state = profiles.statewide;
  return '<section aria-labelledby="state-overview"><h2 id="state-overview">Florida sales at a glance</h2>' + summaryCards(state) +
    '<p>Use the county comparison to see how the sale price and number of published records vary by county. ' +
    'For a closer comparison, open a county and filter its sales by ZIP and property type.</p>' +
    groupTable("Florida prices by property type", "Property type", state.propertyTypes, group => escape(propertyLabel(group.key))) +
    methodNote() + '</section>';
}

export function countyComparisonDirectory(profiles: FloridaInsightsSnapshot) {
  const rows = floridaCounties.map(county => {
    const profile = profiles.counties[county.code];
    return '<tr><th scope="row"><a href="/florida/' + county.slug + '">' + escape(county.name) + ' County</a></th>' +
      cell(floridaCount(profile.records), true) + cell(medianText(profile), true) + cell(floridaCount(profile.zipCount), true) +
      cell(labelFloridaMonth(profile.recentMonths[0].key)) + '</tr>';
  });
  return '<section aria-labelledby="county-comparison"><h2 id="county-comparison">Compare Florida counties</h2>' +
    '<div class="results" role="region" aria-label="Florida county comparison" tabindex="0"><table><thead><tr><th scope="col">County</th>' +
    '<th scope="col" class="amount">Records</th><th scope="col" class="amount">Median price</th>' +
    '<th scope="col" class="amount">ZIPs</th><th scope="col">Latest sale month</th></tr></thead><tbody>' +
    rows.join("") + '</tbody></table></div></section>';
}

function filterLink(path: string, key: "zip" | "city" | "type", value: string, label: string) {
  return '<a href="' + escape(path + "?" + new URLSearchParams({ [key]: value }) + "#search-sales") + '">' + escape(label) + '</a>';
}

export function countySummary(profile: FloridaCountyProfile, countyName: string) {
  const busiestType = profile.propertyTypes[0];
  return '<section aria-labelledby="county-overview"><h2 id="county-overview">' + escape(countyName) + ' County sales at a glance</h2>' +
    summaryCards(profile) + '<p>The largest property group in this county is ' + escape(propertyLabel(busiestType.key).toLowerCase()) +
    ', with ' + floridaCount(busiestType.records) + ' records. ' +
    'Compare the same property type and nearby ZIPs before using a county price as a reference.</p>' +
    '<p class="jump"><a href="#search-sales">Search sales</a><a href="#nearby-markets">Neighboring counties</a>' +
    '<a href="#zip-breakdown">ZIP breakdown</a><a href="#price-history">Sale months</a></p></section>';
}

export function countyDetails(county: { code: number; slug: string; name: string }, profiles: FloridaInsightsSnapshot) {
  const profile = profiles.counties[county.code];
  const path = "/florida/" + county.slug;
  const neighbors = profile.neighbors.map(code => {
    const adjacent = countyByCode.get(code)!;
    const stat = profiles.counties[code];
    return '<li><a href="/florida/' + adjacent.slug + '">' + escape(adjacent.name) + ' County property sales</a>' +
      '<span class="muted"> · ' + floridaCount(stat.records) + ' records, ' + medianText(stat) + ' median</span></li>';
  }).join("");
  return '<section aria-labelledby="zip-breakdown"><h2 id="zip-breakdown">ZIP codes and cities with the most records</h2>' +
    '<p>Select a ZIP code or city to see the properties included in that group.</p>' +
    groupTable("ZIP codes by number of records", "ZIP code", profile.topZips, group => filterLink(path, "zip", group.key, group.key)) +
    groupTable("Postal cities by number of records", "Postal city", profile.topCities, group =>
      filterLink(path, "city", group.key, cityLabel(group.key))) + '</section>' +
    '<section aria-labelledby="property-breakdown"><h2 id="property-breakdown">Sale prices by property type</h2>' +
    groupTable("County prices by property type", "Property type", profile.propertyTypes, group =>
      filterLink(path, "type", group.key, propertyLabel(group.key))) + '</section>' +
    '<section aria-labelledby="price-history"><h2 id="price-history">Recent sale months</h2>' +
    '<p>These are the latest months with records in this release. Differences in the mix of properties and reporting completeness affect the medians.</p>' +
    groupTable("County prices by sale month", "Sale month", profile.recentMonths, group => escape(labelFloridaMonth(group.key))) +
    methodNote() + '</section>' +
    '<section aria-labelledby="nearby-markets"><h2 id="nearby-markets">Neighboring Florida counties</h2><ul>' + neighbors +
    '</ul><p class="muted">County relationships follow the <a href="' + floridaAdjacencySource +
    '">U.S. Census Bureau adjacency file</a>. <a href="/florida#county-comparison">Compare all 67 counties</a>.</p></section>';
}
