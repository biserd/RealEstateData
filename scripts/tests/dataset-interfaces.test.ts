import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import express from "express";
import { configureDatabase, db } from "../../server/db";
import { runDatasetOperation } from "../../server/datasetService";
import { floridaCounties } from "../../shared/floridaSales";
import { datasetOperationEntries } from "../../shared/datasetOperations";
import { users } from "../../shared/schema";
import floridaSnapshot from "../../server/floridaInsightsSnapshot.json";
import { apiKeyService } from "../../server/apiKeyService";
import { localD1 } from "../lib/local-d1";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

function fixtures() {
  const ny = localD1(":memory:", false), fl = localD1(":memory:", false);
  configureDatabase(ny.binding);
  ny.sqlite.exec(read("migrations/d1/0000_neon_schema.sql"));
  ny.sqlite.exec(`
    INSERT INTO published_dataset_versions(id,environment,status,published_at)
    VALUES ('release','production','published','2026-11-15T00:00:00Z');
    INSERT INTO canonical_geographies(id,type,state,zip_code,canonical_name)
    VALUES ('zip-10021','zip','NY','10021','Upper East Side');
    INSERT INTO market_snapshots_v2(dataset_version_id,geography_id,period_start,period_end,transaction_count,median_price,source_coverage,confidence)
    VALUES ('release','zip-10021','2026-01-01','2026-11-01',8,650000,'{}','medium');
    INSERT INTO properties(id,address,city,state,zip_code,property_type,latitude,longitude,estimated_value,geography_id,bbl_normalized)
    VALUES ('home','101 Test St','Manhattan','NY','10021','SFH',40.7,-74,600000,'zip-10021','1001000001');
    INSERT INTO condo_units(unit_bbl,base_bbl,unit_designation,building_display_address,unit_display_address,
      latitude,longitude,borough,zip_code,geography_id,slug)
    VALUES ('1001001001','1001000001','1A','101 Test St','101 Test St Unit 1A',40.7,-74,'Manhattan','10021','zip-10021','unit-fixture');
    INSERT INTO sales(id,property_id,sale_date,sale_price,match_method,unit_bbl)
    VALUES ('home-sale','home','2026-09-01T00:00:00.000000Z',620000,'block_lot',NULL),
      ('unit-sale','home','2026-09-02T00:00:00.000000Z',730000,'unit_bbl','1001001001'),
      ('unit-rejected','home','2026-09-03T00:00:00.000000Z',2000000,'unit_bbl','1001001001'),
      ('home-unverified','home','2026-09-03T00:00:00.000000Z',990000,NULL,NULL);
    INSERT INTO data_quality_quarantine(source_table,source_id,reason,record,review_status)
    VALUES ('sales','unit-rejected','Fixture quarantine','{}','rejected');
    INSERT INTO comparable_sets_v2(id,dataset_version_id,subject_type,subject_id,rule_version,period_start,period_end,confidence)
    VALUES ('set','release','property','home','v1','2026-01-01','2026-11-01','medium');
    INSERT INTO comparable_members_v2(id,comparable_set_id,sale_id,weight,inclusion_reason)
    VALUES ('match','set','unit-sale',0.8,'eligible'),('excluded','set','unit-rejected',0.9,'fixture');
  `);
  fl.sqlite.exec(read("migrations/florida_sales.sql"));
  const release = floridaSnapshot.release;
  fl.sqlite.prepare("INSERT INTO florida_releases VALUES (?, '2026-10-01T00:00:00Z','2025-01','2026-11-15T00:00:00Z')").run(release);
  const areas = floridaSnapshot.counties as Record<string, typeof floridaSnapshot.counties["23"]>;
  const county = fl.sqlite.prepare("INSERT INTO florida_coverage VALUES (?, ?, ?, ?)");
  for (const { code } of floridaCounties) county.run(release, code, areas[code].records, areas[code].recentMonths[0].key);
  const insert = fl.sqlite.prepare("INSERT INTO florida_sales VALUES (?,23,?,?,'MIAMI','33034','001',?,?)");
  insert.run(release, "A", "1 Test Road", "2026-06", 350000);
  insert.run(release, "B", "2 Test Road", "2026-06", 400000);
  insert.run(release, "C", "3 Test Road", "2026-05", 420000);
  return { ny, fl };
}

test("partner dataset reads preserve exact geography, source definitions, and the current publication", async () => {
  const { ny, fl } = fixtures();
  try {
    const catalog = await runDatasetOperation("list_published_datasets", {}, fl.binding) as any;
    assert.deepEqual(catalog.datasets.map((d: any) => d.status), ["published", "published", "published"]);
    assert.equal(catalog.datasets[0].coverage.statesAndDc, 51);
    assert.equal(catalog.datasets[1].coverage.counties, 67);
    const zip = await runDatasetOperation("get_housing_market", { level: "zip", id: "02108" }) as any;
    assert.equal(zip.geography.id, "02108");
    assert.equal(zip.census.medianHomeValue.estimateUsd, 1667600);
    assert.equal(zip.dataset.sources.inventory.period, "2026-10");
    const texas = await runDatasetOperation("get_housing_market", { level: "county", id: "48201" }) as any;
    assert.match(texas.officialPropertyRecordsUrl, /harris\.php$/);
    assert.ok(texas.neighboringCounties.length);
    const search = await runDatasetOperation("search_housing_markets", { level: "county", state: "OH", metric: "ask", max: 400000, limit: 2 }) as any;
    assert.equal(search.records.length, 2);
    assert.ok(search.records.every((row: any) => row.listings.medianAskingPriceUsd <= 400000));
    assert.equal(search.pagination.nextPage, 2);
    await assert.rejects(runDatasetOperation("search_housing_markets", { state: "ZZ" }), /valid two-letter/);
    const empty = await runDatasetOperation("search_housing_markets", { level: "state", page: 7 }) as any;
    assert.deepEqual(empty.records, []);
    const profile = await runDatasetOperation("get_florida_sales_profile", { county: "miami-dade" }, fl.binding) as any;
    assert.equal(profile.profile.medianPriceUsd, 625000);
    const args = { county: "miami-dade", zip: "33034", limit: 1 };
    const first = await runDatasetOperation("search_florida_recorded_sales", args, fl.binding) as any;
    assert.equal(first.dataset.datePrecision, "month");
    assert.equal(first.records[0].parcelId, "A");
    const cursor = first.pagination.nextCursor;
    const second = await runDatasetOperation("search_florida_recorded_sales", { ...args, cursor }, fl.binding) as any;
    assert.equal(second.records[0].parcelId, "B");
    await assert.rejects(runDatasetOperation("search_florida_recorded_sales", { ...args, zip: "33155", cursor }, fl.binding), /same county and filters/);
    const sale = await runDatasetOperation("list_nyc_recorded_sales", { zip: "10021" }) as any;
    assert.deepEqual(sale.records.map((row: any) => row.id), ["unit-sale", "home-sale"]);
    assert.deepEqual(sale.records.map((row: any) => row.saleDate), ["2026-09-02", "2026-09-01"]);
    const building = await runDatasetOperation("list_nyc_recorded_sales", { baseBbl: "1001000001" }) as any;
    assert.deepEqual(building.records.map((row: any) => row.id), ["unit-sale", "home-sale"]);
    const unit = await runDatasetOperation("get_nyc_property", { id: "unit-fixture" }) as any;
    assert.equal(unit.property.id, "1001001001");
    const comps = await runDatasetOperation("get_nyc_property_comps", { id: "home" }) as any;
    assert.deepEqual(comps.records.map((record: any) => record.id), ["match"]);
    const aggregate = await runDatasetOperation("get_nyc_market_aggregates", { geoType: "zip", geoId: "10021" }) as any;
    assert.equal(aggregate.records[0].medianPrice, 650000);
    assert.deepEqual((await runDatasetOperation("get_nyc_market_aggregates", { geoType: "zip", geoId: "02108" })).records, []);
  } finally {
    ny.close();
    fl.close();
  }
});

test("authenticated REST and MCP use the same payload and keep discovery public", async () => {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export class DurableObject {}", shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
  const { ny, fl } = fixtures();
  const { registerDatasetRoutes } = await import("../../server/datasetRoutes");
  const { createRealtorsMcp } = await import("../../server/mcpTools");
  const { configureQuotaNamespace } = await import("../../server/quota");
  const [user] = await db.insert(users).values({ email: "dataset-test@example.invalid", subscriptionTier: "pro", subscriptionStatus: "active" }).returning();
  const { rawKey } = await apiKeyService.generateApiKey(user.id);
  configureQuotaNamespace({
    getByName: () => ({
      consume: async () => ({ allowed: true, used: 1, remaining: 999, limit: 1000, resetAt: Date.now() + 60000 }),
    }),
  } as unknown as Parameters<typeof configureQuotaNamespace>[0]);
  const app = express();
  registerDatasetRoutes(app, fl.binding);
  const http = app.listen(0, "127.0.0.1");
  try {
    await once(http, "listening");
    const address = http.address();
    assert.ok(address && typeof address !== "string");
    const url = "http://127.0.0.1:" + address.port;
    const route = "/api/external/housing-markets/zip/02108";
    assert.equal((await fetch(url + route)).status, 401);
    const header = { "x-api-key": rawKey };
    const api = await fetch(url + route, { headers: header });
    assert.equal(api.status, 200);
    assert.equal(api.headers.get("cache-control"), "private, no-store");
    assert.equal((await fetch(url + "/api/external/housing-markets?limit=2&limit=3", { headers: header })).status, 400);
    assert.equal((await fetch(url + "/api/external/housing-markets/county/99999", { headers: header })).status, 404);
    const payload = await api.json() as any;
    const rpc = (method: string, params: unknown = {}) => new Request("https://realtorsdashboard.com/mcp", {
      method: "POST", headers: { accept: "application/json, text/event-stream", "content-type": "application/json",
        "mcp-protocol-version": "2025-11-25" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    async function result(response: Response) {
      const raw = await response.text();
      return JSON.parse(raw.startsWith("{") ? raw : raw.split("\n").find(line => line.startsWith("data: "))!.slice(6));
    }
    const discovery = await result(await createRealtorsMcp().fetch(rpc("tools/list")));
    for (const [name, operation] of datasetOperationEntries) {
      const tool = discovery.result.tools.find((entry: any) => entry.name === name);
      assert.ok(tool, name);
      const spec = JSON.parse(read("client/public/openapi.json"));
      assert.equal(spec.paths[operation.path.replace(/:([a-z]+)/g, "{$1}")].get.operationId, name);
      assert.equal(tool.annotations.readOnlyHint, true);
    }
    const args = { name: "get_housing_market", arguments: { level: "zip", id: "02108" } };
    const anonymous = await result(await createRealtorsMcp().fetch(rpc("tools/call", args)));
    assert.equal(anonymous.result.isError, true);
    const authenticated = await result(await createRealtorsMcp({ id: user.id, tier: "pro" }, fl.binding).fetch(rpc("tools/call", args)));
    assert.deepEqual(authenticated.result.structuredContent, payload.data);
    const florida = await result(await createRealtorsMcp({ id: user.id, tier: "pro" }, fl.binding).fetch(
      rpc("tools/call", { name: "search_florida_recorded_sales", arguments: { county: "miami-dade", limit: 1 } })));
    assert.equal(florida.result.structuredContent.records[0].address, "1 Test Road");
  } finally {
    http.closeAllConnections();
    http.close();
    configureQuotaNamespace(undefined);
    hooks.deregister();
    ny.close();
    fl.close();
  }
});
