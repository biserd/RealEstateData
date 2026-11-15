import assert from "node:assert/strict";
import test from "node:test";
import { getSitemapXml } from "../../server/publishedSitemaps";
import { texasDocument } from "../../server/texasDocuments";
import { housingBrowseRedirect, housingDocument } from "../../server/usHousingDocuments";
import {
  counties, countyPath, countyState, housingRoot, housingSitemapPath, statePath, states,
} from "../../server/usHousingData";
import { readHousingFilters, searchHousing } from "../../server/usHousingSearch";

const origin = "https://realtorsdashboard.com";
const req = (path: string, method = "GET") => new Request(origin + path, { method });
const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const find = (query: string) => searchHousing(readHousingFilters(new URLSearchParams(query)));

test("the national sitemap and directory cover every state and only eligible canonical county paths", async () => {
  const index = locations(getSitemapXml("/sitemap.xml")!);
  assert.equal(index.filter(url => url === origin + housingSitemapPath).length, 1);
  const entries = locations(getSitemapXml(housingSitemapPath)!);
  const texas = locations(getSitemapXml("/sitemap-texas.xml")!);
  assert.equal(new Set([...entries, ...texas]).size, entries.length + texas.length);
  assert.equal(states.length, 51);
  assert.equal(counties.length, 3144);
  const national = await housingDocument(req(housingRoot)).text();
  for (const state of states) {
    const path = statePath(state);
    assert.ok(national.includes('href="' + path + '"'), state.name);
    const res = state.code === "TX" ? texasDocument(req(path)) : housingDocument(req(path));
    const body = await res.text();
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("x-robots-tag"), null, path);
    assert.ok(body.includes('rel="canonical" href="' + origin + path + '"'));
    assert.ok(body.includes("Realtor.com® Economic Research"));
    assert.ok(body.includes('"@type":"BreadcrumbList"'));
    assert.ok([...entries, ...texas].includes(origin + path), path);
    if (state.code !== "DC") {
      for (const county of counties.filter(c => countyState(c) === state)) {
        assert.ok(body.includes('href="' + countyPath(county) + '"'), county.name);
      }
    }
  }
  const sitemap = new Set(entries);
  for (const county of counties.filter(c => !["DC", "TX"].includes(countyState(c).code))) {
    const path = countyPath(county);
    const response = housingDocument(req(path, "HEAD"));
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("x-robots-tag") === null, sitemap.has(origin + path), path);
    assert.equal(await response.text(), "");
  }
  assert.ok(!entries.some(url => url.includes("?") || url.includes("/search") || url.endsWith("/district-of-columbia/district-of-columbia")));
});

test("server search matches each geography, keeps ZIP leading zeroes, and applies price filters before paginating", async () => {
  assert.equal(find("q=OH").rows[0].name, "Ohio");
  assert.equal(find("q=Washington%2C+D.C.").rows[0].name, "District of Columbia");
  const city = find("q=Springfield%2C+MA&state=MA&level=place").rows[0];
  assert.match(city.name, /^Springfield/);
  assert.equal(city.states[0].code, "MA");
  assert.equal(find("q=Orange+County%2C+CA&level=county").rows[0].path, "/housing-markets/california/orange");
  const zip = find("q=02108").rows[0];
  assert.equal(zip.name, "02108");
  assert.equal(zip.homeValue[0], 1667600);
  assert.equal(zip.states[0].code, "MA");
  assert.equal(find("q=02108&state=TX").total, 0);
  const filtered = find("state=OH&level=county&metric=ask&max=400000&sort=ask-asc");
  assert.ok(filtered.rows.length > 1);
  const prices = filtered.rows.map(row => row.listing![0]);
  assert.ok(prices.every(price => price <= 400000));
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.equal(find("level=county&page=2").page, 2);
  assert.equal(find("min=500000&max=400000").reversed, true);
  const res = housingDocument(req("/housing-markets/search?q=02108"));
  assert.equal(res.headers.get("x-robots-tag"), "noindex, follow");
  assert.match(await res.text(), /02108/);
});

test("existing sales pages and aliases remain connected without duplicate market URLs", async () => {
  assert.equal(housingBrowseRedirect("/browse/nj"), "/housing-markets/new-jersey");
  assert.equal(housingBrowseRedirect("/browse/NY"), undefined);
  assert.equal(housingDocument(req("/housing-markets/texas")).headers.get("location"), origin + "/texas");
  assert.equal(housingDocument(req("/housing-markets/texas/dallas")).headers.get("location"), origin + "/texas/dallas");
  assert.equal(housingDocument(req("/Housing-Markets/Alaska/")).headers.get("location"), origin + "/housing-markets/alaska");
  assert.equal(housingDocument(req("/housing-markets/made-up/rubbish")).status, 404);
  const florida = await housingDocument(req("/housing-markets/florida/miami-dade")).text();
  assert.ok(florida.includes('href="/florida/miami-dade"'));
  assert.ok(florida.includes("Asking prices and inventory"));
  assert.ok((await housingDocument(req("/housing-markets/new-york")).text()).includes('href="/browse/ny"'));
});

test("published city and ZIP comparison tables are crawlable without indexing search queries", async () => {
  const entries = locations(getSitemapXml(housingSitemapPath)!);
  const cityPath = "/housing-markets/massachusetts/cities";
  const zipPath = "/housing-markets/massachusetts/zip-codes";
  const hubPath = "/housing-markets/massachusetts";
  assert.ok(entries.includes(origin + cityPath));
  assert.ok(entries.includes(origin + zipPath));
  const results = await Promise.all([hubPath, cityPath, zipPath].map(async path => {
    const page = housingDocument(req(path));
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("x-robots-tag"), null);
    return page.text();
  }));
  assert.ok(results[0].includes('href="' + cityPath + '"'));
  assert.ok(results[0].includes('href="' + zipPath + '"'));
  assert.match(results[1], /Boston city/);
  assert.match(results[2], /02108/);
  assert.ok(!results[2].includes("/housing-markets/search?"));
  assert.equal(housingDocument(req("/housing-markets/district-of-columbia/cities")).status, 404);
});
