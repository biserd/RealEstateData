import assert from "node:assert/strict";
import test from "node:test";
import { getSitemapXml } from "../../server/publishedSitemaps";
import { texasDocument, texasSitemapPath } from "../../server/texasDocuments";
import snapshot from "../../server/texasHousingSnapshot.json";

const origin = "https://realtorsdashboard.com";
const locs = (xml: string) => Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => url);
const request = (path: string, method = "GET") => new Request(origin + path, { method });

test("Texas pages share the sitemap eligibility rules and have data-backed internal links", async () => {
  const index = locs(getSitemapXml("/sitemap.xml")!);
  assert.equal(index.filter(url => url === origin + texasSitemapPath).length, 1);
  assert.ok(!locs(getSitemapXml("/sitemap-static.xml")!).includes(origin + "/texas"));
  const listed = locs(getSitemapXml(texasSitemapPath)!);
  const sitemap = new Set(listed);
  assert.equal(sitemap.size, listed.length);
  assert.ok(sitemap.has(origin + "/texas"));

  const home = texasDocument(request("/texas"));
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Compare Texas counties/);

  const landing = await texasDocument(request("/texas")).text();
  const paths = new Map(snapshot.counties.map(county => [county.fips, "/texas/" + county.slug]));
  assert.equal(paths.size, 254);
  const titles = new Set();
  for (const county of snapshot.counties) {
    const path = paths.get(county.fips)!;
    const page = texasDocument(request(path));
    const body = await page.text();
    assert.equal(page.status, 200, path);
    assert.equal(page.headers.has("x-robots-tag"), !sitemap.has(origin + path), path);
    assert.ok(landing.includes('href="' + path + '"'), path);
    assert.ok(body.includes('href="https://comptroller.texas.gov/taxes/property-tax/county-directory/' + county.appraisalPath + '"'), path);
    assert.ok(body.includes('<link rel="canonical" href="' + origin + path + '">'), path);
    assert.equal((body.match(/<h1>/g) || []).length, 1, path);
    assert.equal(body.includes('"@type":"BreadcrumbList"'), sitemap.has(origin + path), path);
    for (const fips of county.neighbors) assert.ok(body.includes('href="' + paths.get(fips) + '"'), path + " " + fips);
    titles.add(body.match(/<title>(.*?)<\/title>/)?.[1]);
  }
  assert.equal(titles.size, 254);
  assert.ok(sitemap.has(origin + "/texas/travis"));
  assert.ok(!sitemap.has(origin + "/texas/loving"));
  assert.ok(listed.every(url => url === origin + "/texas" || [...paths.values()].some(path => url === origin + path)));
});

test("Texas serves sourced estimates, guards sparse geographies, and canonicalizes routes", async () => {
  const harris = await texasDocument(request("/texas/harris")).text();
  assert.match(harris, /\$276,600 ± \$1,878/);
  assert.match(harris, /\$1,401 ± \$7/);
  assert.match(harris, /2025 FHFA price index change/);
  assert.match(harris, /0\.62%/);

  const unknown = texasDocument(request("/texas/not-a-county"));
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get("x-robots-tag"), "noindex, follow");
  const head = texasDocument(request("/texas/harris", "HEAD"));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  const tagged = texasDocument(request("/texas/harris?utm_source=test"));
  assert.equal(tagged.headers.get("x-robots-tag"), "noindex, follow");
  assert.match(await tagged.text(), /rel="canonical" href="https:\/\/realtorsdashboard\.com\/texas\/harris"/);
  const alias = texasDocument(new Request("https://www.realtorsdashboard.com/texas/HARRIS/"));
  assert.equal(alias.status, 301);
  assert.equal(alias.headers.get("location"), origin + "/texas/harris");
});
