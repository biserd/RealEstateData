import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { floridaCounties } from "../../shared/floridaSales";
import { floridaDocument, floridaSitemap } from "../../server/floridaDocuments";
import { localD1 } from "../lib/local-d1";

const origin = "https://realtorsdashboard.com";
const request = (path: string, method = "GET") => new Request(origin + path, { method });

test("Florida directory, searchable county pages, and sitemap use the same verified publication", async () => {
  const { binding, sqlite, close } = localD1(":memory:", false);
  try {
    sqlite.exec(readFileSync(new URL("../../migrations/florida_sales.sql", import.meta.url), "utf8"));
    sqlite.exec("INSERT INTO florida_releases VALUES ('first','2026-10-01T00:00:00Z','2025-01',NULL)");
    assert.equal(await floridaSitemap(binding), null);
    assert.equal((await floridaDocument(request("/florida/miami-dade"), binding)).status, 404);
    const sale = sqlite.prepare("INSERT INTO florida_sales VALUES ('first', ?, ?, ?, 'TEST CITY', '33155', '001', '2026-06', 500000)");
    const coverage = sqlite.prepare("INSERT INTO florida_coverage VALUES ('first', ?, ?, '2026-06')");
    for (const { code } of floridaCounties) {
      sale.run(code, "1", "1 Test St");
      if (code !== 23) coverage.run(code, 1);
    }
    sqlite.exec("UPDATE florida_releases SET published_at = '2026-11-15T00:00:00Z'");
    await assert.rejects(floridaSitemap(binding), /Incomplete Florida/);
    for (let id = 2; id <= 51; id++) sale.run(23, String(id).padStart(3, "0"), String(id) + ' Test <St>');
    coverage.run(23, 51);
    const states = await floridaSitemap(binding);
    const paths = Array.from(states!.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) => url.slice(origin.length));
    assert.equal(new Set(paths).size, 68);
    const page = await floridaDocument(request("/florida"), binding);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /117 sale-backed residential properties across all 67 counties/);
    for (const path of paths.slice(1)) {
      const county = await floridaDocument(request(path, "HEAD"), binding);
      assert.equal(county.status, 200, path);
      assert.equal(await county.text(), "");
    }
    const county = await floridaDocument(request("/florida/miami-dade"), binding);
    const body = await county.text();
    assert.match(body, /June 2026/);
    assert.match(body, /Test &lt;St&gt;/);
    assert.match(body, /page=2/);
    const filtered = await floridaDocument(request("/florida/miami-dade?zip=33155&q=Test&page=2"), binding);
    assert.equal(filtered.status, 200);
    assert.equal(filtered.headers.get("x-robots-tag"), "noindex, follow");
    assert.match(await filtered.text(), /Previous page/);
    const unknown = await floridaDocument(request("/florida/imaginary"), binding);
    assert.equal(unknown.status, 404);
    const redirect = await floridaDocument(request("/florida/Miami-Dade/"), binding);
    assert.equal(redirect.headers.get("location"), origin + "/florida/miami-dade");
  } finally {
    close();
  }
});
