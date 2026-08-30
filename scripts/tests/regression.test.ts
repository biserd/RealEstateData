import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalRedirectTarget, isDatabaseBackedPagePath, isPrivatePagePath } from "../../server/entityPagePolicy";
import { inferTriStateFromZip, normalizeZipCode } from "../../shared/triStateGeography";
import { assertDatabaseWriteAllowed } from "../lib/database-safety";
import {
  buildNycBbl,
  classifyUnitType,
  normalizeUnitDesignation,
  parseMoney,
  saleFingerprint,
} from "../lib/real-estate-normalization";
import {
  buildMarketSnapshots,
  buildRankings,
  candidatePasses,
  selectComparableSales,
  validateCandidate,
  type PublicPropertyFact,
  type VerifiedSaleFact,
} from "../../pipeline/analytics";
import { assertSourceMayPublish } from "../../pipeline/contracts";
import { sourceById } from "../../pipeline/sourceCatalog";
import { buildings, condoUnits, marketAggregates, properties, sales } from "../../shared/schema";

test("database-backed URL policy recognizes only supported entity pages", () => {
  assert.equal(isDatabaseBackedPagePath("/unit/example-123"), true);
  assert.equal(isDatabaseBackedPagePath("/properties/abc"), true);
  assert.equal(isDatabaseBackedPagePath("/property/legacy-id"), true);
  assert.equal(isDatabaseBackedPagePath("/building/1012345678"), true);
  assert.equal(isDatabaseBackedPagePath("/unit/"), false);
  assert.equal(isDatabaseBackedPagePath("/guides/example"), false);
});

test("account and API-key routes are explicitly private", () => {
  for (const path of ["/login", "/register", "/forgot-password", "/reset-password", "/checkout/success", "/saved-properties", "/admin-console", "/settings", "/portfolio", "/api-access"]) {
    assert.equal(isPrivatePagePath(path), true, path);
  }
  assert.equal(isPrivatePagePath("/developers"), false);
});

test("SEO routing, sitemaps, and social assets enforce the indexability contract", () => {
  const worker = readFileSync(new URL("../../server/worker.ts", import.meta.url), "utf8");
  const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
  const seo = readFileSync(new URL("../../server/seoMetaTags.ts", import.meta.url), "utf8");
  const tools = readFileSync(new URL("../../client/src/pages/Tools.tsx", import.meta.url), "utf8");
  const image = readFileSync(new URL("../../client/public/og-image.png", import.meta.url));
  assert.match(wrangler, /"\/\*"[\s\S]*"!\/assets\/\*"/);
  assert.match(worker, /status: 404/);
  assert.match(worker, /x-robots-tag/);
  assert.match(routes, /current_market_snapshots/);
  assert.doesNotMatch(routes, /<changefreq>|<priority>/);
  assert.doesNotMatch(routes, /\{ url: "\/api-access"/);
  assert.match(seo, /return null;/);
  assert.doesNotMatch(seo, /SingleFamilyResidence/);
  for (const route of ["/tools", "/tools/nyc-zip-market-snapshot", "/tools/nyc-price-per-square-foot", "/tools/nyc-neighborhood-momentum"]) {
    assert.match(seo, new RegExp(route.replaceAll("/", "\\/")), route);
  }
  assert.match(tools, /matchMode === "exact"/);
  assert.match(tools, /will not substitute state-wide or unrelated data/);
  assert.doesNotMatch(tools, /google\.maps|maps\.googleapis|MapContainer/i);
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("free tool landing pages have indexable server metadata and sitemap entries", async () => {
  process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
  const { getMetaForUrl, getStaticSitemapEntries } = await import("../../server/seoMetaTags");
  const paths = [
    "/tools",
    "/tools/nyc-zip-market-snapshot",
    "/tools/nyc-price-per-square-foot",
    "/tools/nyc-neighborhood-momentum",
  ];
  const sitemapPaths = new Set(getStaticSitemapEntries().map((entry) => entry.path));
  for (const path of paths) {
    const meta = await getMetaForUrl(`${path}?zip=10001`);
    assert.equal(meta?.canonicalPath, path, path);
    assert.match(meta?.bodyHtml || "", /recorded|tools/i, path);
    assert.equal(sitemapPaths.has(path), true, path);
  }
});

test("public page predicates use one published, canonical, non-quarantined contract", () => {
  const eligibility = readFileSync(new URL("../../server/publicPageEligibility.ts", import.meta.url), "utf8");
  const storage = readFileSync(new URL("../../server/storage.ts", import.meta.url), "utf8");
  const seo = readFileSync(new URL("../../server/seoMetaTags.ts", import.meta.url), "utf8");
  assert.match(eligibility, /current_market_snapshots/);
  assert.match(eligibility, /canonical_geographies/);
  assert.match(eligibility, /data_quality_quarantine/);
  assert.match(eligibility, /BETWEEN 100000 AND 100000000/);
  assert.match(storage, /publicPropertyPageSql/);
  assert.match(storage, /publicUnitPageSql/);
  assert.match(storage, /recent_sale_quarantine/);
  assert.match(storage, /getRecentSalesForArea[\s\S]*publicPropertyPredicate\(\)/);
  assert.match(seo, /publicPropertyPageSql/);
  assert.match(seo, /publicUnitPageSql/);
});

test("legacy entity URLs redirect only when the canonical path differs", () => {
  assert.equal(canonicalRedirectTarget("/unit/1012345678", "/unit/canonical-1012345678"), "/unit/canonical-1012345678");
  assert.equal(canonicalRedirectTarget("/unit/canonical-1012345678", "/unit/canonical-1012345678"), null);
});

test("NYC identifiers are normalized without inventing data", () => {
  assert.equal(buildNycBbl("Manhattan", "1515", "1552"), "1015151552");
  assert.equal(buildNycBbl("unknown", "1515", "1552"), null);
  assert.equal(normalizeUnitDesignation("Unit e4a"), "E4A");
});

test("source values are validated and deterministic", () => {
  assert.equal(parseMoney("$1,250,000.00"), 1_250_000);
  assert.equal(parseMoney("$0"), null);
  assert.equal(classifyUnitType("Parking Space P2"), "parking");
  assert.equal(classifyUnitType("4A"), "residential");

  const input = {
    saleDate: new Date("2026-07-01T00:00:00.000Z"),
    salePrice: 1_250_000,
    borough: "Manhattan",
    block: "1515",
    lot: "1552",
    address: "120 East 87 Street",
    unit: "E4A",
  };
  assert.equal(saleFingerprint(input), saleFingerprint(input));
});

test("ZIP fallback inference is conservative and preserves tri-state identity", () => {
  assert.equal(normalizeZipCode(" 10977-1234 "), "10977");
  assert.equal(inferTriStateFromZip("10977"), "NY");
  assert.equal(inferTriStateFromZip("07030"), "NJ");
  assert.equal(inferTriStateFromZip("06901"), "CT");
  assert.equal(inferTriStateFromZip("94105"), null);
});

test("production writes require an explicit confirmation and recent backup", () => {
  const original = {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_ENV: process.env.DATABASE_ENV,
    CONFIRM_PRODUCTION_WRITE: process.env.CONFIRM_PRODUCTION_WRITE,
    BACKUP_VERIFIED_AT: process.env.BACKUP_VERIFIED_AT,
  };

  try {
    process.env.DATABASE_URL = "postgresql://example.invalid/app";
    process.env.DATABASE_ENV = "production";
    delete process.env.CONFIRM_PRODUCTION_WRITE;
    delete process.env.BACKUP_VERIFIED_AT;
    assert.throws(() => assertDatabaseWriteAllowed(true), /Production write blocked/);

    process.env.CONFIRM_PRODUCTION_WRITE = "YES";
    process.env.BACKUP_VERIFIED_AT = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    assert.throws(() => assertDatabaseWriteAllowed(true), /no more than 24 hours old/);

    process.env.BACKUP_VERIFIED_AT = new Date().toISOString();
    assert.doesNotThrow(() => assertDatabaseWriteAllowed(true));
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("approved refresh path cannot import the generated-data aggregate builder", () => {
  const source = readFileSync(new URL("../refresh-live-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /productionDataSync|create-comps|server\/seed/);
  assert.match(source, /--recompute is disabled/);
});

test("the schema push command is protected by the database write gate", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
  assert.match(packageJson.scripts["db:push"], /database-write-gate/);
});

test("the application shell provides shared tooltip context and a visible crash fallback", () => {
  const appSource = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");
  assert.match(appSource, /import \{ TooltipProvider \} from "@\/components\/ui\/tooltip"/);
  assert.match(appSource, /<TooltipProvider delayDuration=\{200\}>[\s\S]*<Router \/>[\s\S]*<\/TooltipProvider>/);
  assert.match(appSource, /class AppErrorBoundary/);
  assert.match(appSource, /This page could not load/);
});

test("manual dataset publication cannot leave a day-old browser API response", () => {
  const workerSource = readFileSync(new URL("../../server/worker.ts", import.meta.url), "utf8");
  const criticalPages = [
    "../../client/src/pages/UpAndComingZips.tsx",
    "../../client/src/pages/MarketExplorer.tsx",
    "../../client/src/pages/OpportunityScreener.tsx",
    "../../client/src/pages/InvestmentCalculator.tsx",
    "../../client/src/pages/Tools.tsx",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
  assert.match(workerSource, /PUBLIC_CACHE_REVISION = "2026-08-30-versioned-market-v3"/);
  assert.match(workerSource, /max-age=0, must-revalidate, s-maxage=\$\{ttl\}/);
  assert.match(workerSource, /private, no-store, max-age=0, must-revalidate/);
  assert.doesNotMatch(workerSource, /trending-zips"\) return 900/);
  for (const pageSource of criticalPages) assert.match(pageSource, /cache: "no-store"/);
});

test("published ranking retries transient failures without reloading the application", () => {
  const pageSource = readFileSync(new URL("../../client/src/pages/UpAndComingZips.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /retry: 2/);
  assert.match(pageSource, /void refetch\(\)/);
  assert.doesNotMatch(pageSource, /window\.location\.reload\(\)/);
  assert.doesNotMatch(pageSource, /strong appreciation potential|better investment opportunities/);
});

test("deployed legacy table models remain safe before the additive migration", () => {
  for (const [tableName, table] of Object.entries({ properties, sales, marketAggregates, condoUnits, buildings })) {
    assert.equal("geographyId" in table, false, `${tableName} must not select migration-only columns before 0001 is applied`);
  }
  assert.equal("sourceFingerprint" in sales, false);
  assert.equal("publishedDatasetVersionId" in properties, false);
});

function sale(id: string, geographyId: string, date: string, price: number, propertyId = id): VerifiedSaleFact {
  return {
    id,
    geographyId,
    propertyId,
    salePrice: price,
    saleDate: new Date(date),
    sqft: 1_000,
    propertyType: "Condo",
    beds: 2,
    armsLength: true,
    packageSale: false,
    identityResolved: true,
    sourceId: "nyc-rolling-sales",
  };
}

test("market snapshots and rankings are deterministic and reject empty destinations", () => {
  const sales: VerifiedSaleFact[] = [];
  for (let index = 0; index < 6; index++) {
    sales.push(sale(`prior-${index}`, "zip:NY:10001", `2025-${String(index + 1).padStart(2, "0")}-15`, 500_000 + index * 10_000));
    sales.push(sale(`current-${index}`, "zip:NY:10001", `2025-${String(index + 7).padStart(2, "0")}-15`, 600_000 + index * 10_000));
  }
  const periodEnd = new Date("2026-01-01T00:00:00.000Z");
  const first = buildMarketSnapshots(sales, periodEnd);
  const second = buildMarketSnapshots([...sales].reverse(), periodEnd);
  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
  assert.equal(first[0].transactionCount, 6);
  assert.ok((first[0].trendPercent || 0) > 0);

  const noDestination = buildRankings(first, new Map());
  assert.equal(noDestination[0].eligible, false);
  assert.deepEqual(noDestination[0].exclusionReasons, ["no_public_destination_properties"]);
  const eligible = buildRankings(first, new Map([["zip:NY:10001", 3]]));
  assert.equal(eligible[0].eligible, true);
  assert.equal(eligible[0].rank, 1);
});

test("comps are source-backed, same-geography, reproducible, and rule filtered", () => {
  const subject: PublicPropertyFact = { id: "subject", geographyId: "zip:NY:10001", propertyType: "Condo", beds: 2, sqft: 1_000, yearBuilt: 2000 };
  const sales = [
    sale("best", subject.geographyId, "2025-12-01", 650_000, "other-1"),
    { ...sale("package", subject.geographyId, "2025-11-01", 640_000, "other-2"), packageSale: true },
    sale("wrong-geo", "zip:NJ:07030", "2025-12-01", 620_000, "other-3"),
  ];
  const first = selectComparableSales(subject, sales, new Date("2026-01-01T00:00:00.000Z"));
  const second = selectComparableSales(subject, [...sales].reverse(), new Date("2026-01-01T00:00:00.000Z"));
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((member) => member.saleId), ["best"]);
});

test("critical candidate quality failures always block publication", () => {
  const quality = validateCandidate({
    snapshots: [],
    rankings: [],
    contradictoryGeographyCount: 1,
    duplicateSourceRecordCount: 0,
    comparableSetCount: 0,
    sourceAgeDays: 46,
  });
  assert.equal(candidatePasses(quality), false);
  assert.ok(quality.some((result) => result.ruleId === "cross_geography_contradictions" && result.status === "fail"));
  assert.ok(quality.some((result) => result.ruleId === "comparable_sets_nonempty" && result.status === "fail"));
  assert.ok(quality.some((result) => result.ruleId === "source_freshness_days" && result.status === "fail"));
});

test("regional and listing sources remain fail-closed until rights and adapters are approved", () => {
  assert.doesNotThrow(() => assertSourceMayPublish(sourceById("nyc-rolling-sales")));
  assert.throws(() => assertSourceMayPublish(sourceById("nys-salesweb")), /not active|cannot publish/);
  assert.throws(() => assertSourceMayPublish(sourceById("licensed-reso")), /not active|cannot publish/);
});

test("atomic publication migration requires validation and preserves the prior version", () => {
  const migration = readFileSync(new URL("../../migrations/0001_versioned_data_platform.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION publish_validated_dataset/);
  assert.match(migration, /candidate must be validated before publication/);
  assert.match(migration, /critical quality failures block publication/);
  assert.match(migration, /SET status = 'retired'/);
  assert.doesNotMatch(migration, /TRUNCATE/i);
});
