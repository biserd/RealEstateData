> Production now uses D1. The historical PostgreSQL migration commands below document the earlier rollout; use `migrations/d1` and the D1 runner for current operations.

# Data integrity and refresh operations

## Publication policy

The public site no longer publishes every row that happens to exist in Postgres.

- Unit pages require a residential unit with valid identity/address fields, coordinates, and at least one recorded sale matched to the exact `unit_bbl` in the past 120 months.
- Property pages require valid identity/geography/value fields plus one of: a parcel key, a 0.90+ entity-resolution match, or a source-backed recorded sale.
- Missing database-backed pages return HTTP 404 with `X-Robots-Tag: noindex, nofollow, noarchive`.
- Legacy identifiers redirect permanently to the current canonical URL when the entity still exists.

This deliberately removes legacy NJ/CT demo records and building-only condo shells from browse, search, API detail, and sitemap surfaces without immediately destroying rows that may be referenced by customer data.

## Commands

Database commands use the D1 runner. Local D1 is the default. Set `D1_REMOTE=1` and `DATABASE_ENV=production` explicitly to target the production database in `wrangler.data.jsonc`. Each deployed environment must use a separate D1 database; no connection string is required.

Applied writes also require an explicit `DATABASE_ENV`. Production writes are blocked unless the reviewed command has `CONFIRM_PRODUCTION_WRITE=YES` and `BACKUP_VERIFIED_AT` contains an ISO timestamp for a recoverable D1 backup or export verified within the prior 24 hours. These values are command-scoped controls, not permanent Worker variables.

```bash
# Confirm which database host/environment the local command will use.
npm run data:safety

# Full database profile and integrity checks. Exits 2 for critical findings.
npm run data:audit

# Dry-run quarantine/deletion counts (default; no writes).
npm run data:cleanup

# Quarantine unverified properties and delete only unmistakably generated sales.
npm run data:cleanup -- --apply

# Dry-run official NYC rolling-sales refresh (default; no writes).
npm run data:refresh

# Apply official rolling-sales updates. This records deterministic source IDs,
# fingerprints, geography links, and package-sale flags.
npm run data:refresh -- --apply

# Monthly official Digital Tax Map condo-unit snapshot plus sales refresh.
npm run data:refresh -- --include-reference --apply

# Apply the Digital Tax Map identity changes independently of the sales import.
npm run data:refresh -- --reference-only --apply

# Local pure regression tests.
npm run test:regression

# Preview canonical geography migration/reconciliation (no writes).
npm run data:geography

# Preview deterministic market/ranking candidate and quality gates (no writes).
npm run data:candidate

# Static release-policy checks (no DB/network access).
npm run release:check

# Production smoke test, sitemap inventory, and sampled entity-page checks.
npm run regression:live

# Expensive: request every entity URL currently advertised by all sitemaps.
npm run regression:live -- --all-entity-pages
```

`SOCRATA_APP_TOKEN` is optional but recommended for sustained NYC Open Data imports. It is not committed to the repository.

## Official inputs

- [NYC Citywide Rolling Calendar Sales](https://data.cityofnewyork.us/dataset/NYC-Citywide-Rolling-Calendar-Sales/usep-8jbt): prior twelve months of recorded NYC sales, normally refreshed monthly.
- [Digital Tax Map: Condominium Units](https://data.cityofnewyork.us/City-Government/Digital-Tax-Map-Condominium-Units/eguu-7ie3): official unit/base BBL identities; use as a monthly reference snapshot.
- [ACRIS Real Property Master](https://data.cityofnewyork.us/City-Government/ACRIS-Real-Property-Master/bnx9-e6tj): recorded real-property documents; retain for historical/backfill and document-level verification.
- [PLUTO](https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks): lot/building reference data; refresh when NYC publishes a new release.

The disabled `scripts/refresh-all-data.ts` must not be restored: it generated random NJ/CT addresses, coordinates, attributes, scores, and sales. Those rows are not “live data.” `data:refresh --recompute` remains blocked. The replacement is `data:candidate`, which computes deterministic transaction-based snapshots and rankings into a candidate dataset and never truncates the active release.

The deployable application TypeScript gate excludes `server/etl/**` because that directory is quarantined legacy tooling, not a production runtime or an approved refresh path. New pipeline work should live in reviewed scripts with source contracts, dry-run support, and the production-write guard before it is added to the gate.

## Live listing data

Public-record feeds provide recorded transactions and assessor/tax facts, not live MLS inventory. Current for-sale/for-rent status requires a licensed RESO Web API feed from an MLS or an authorized data vendor. Add that as a separate source adapter after credentials, allowed fields, retention rules, and display rights are confirmed. Do not scrape consumer portals.

## Manual refresh policy

There is no scheduled or real-time import. An operator explicitly starts every
source acquisition and every publication. The website serves only the latest
approved snapshot and never calls upstream real-estate sources during a page
request.

Entity sitemaps are captured from the active D1 publication with the same
eligibility rules as public pages. The Worker serves the captured inventory
without querying D1. For each entity, `lastmod` uses its update date or the
ingestion date of the latest verified transaction, whichever is later. After deployment,
check the live apex sitemap and a sample of newly eligible pages before
resubmitting the existing sitemap index in Search Console. A sitemap submission
requests discovery; Google still decides whether and when each page is indexed.

For each requested refresh: run `data:audit`, acquire the selected source
partitions, build a candidate, review its quality and freshness report, and use
the separate publication confirmation only after approval. After publication,
update the version and verified counts in `server/publishedHomepageSnapshot.ts`,
run `npm run data:sitemaps` against production with `D1_REMOTE=1` and
`DATABASE_ENV=production`, and commit the resulting sitemap snapshot.
Deploy the Worker, run
`regression:live`, and compare freshness to the previous successful release.

## P3-P7 versioned pipeline

`migrations/0001_versioned_data_platform.sql` is additive and creates canonical geography, source catalog, refresh-run, raw-manifest, source-entity, crosswalk, quarantine, quality-result, dataset-version, comp, market-snapshot, and ranking tables. It also defines `publish_validated_dataset`, the only approved publication operation. That function locks the candidate, rejects critical failures or empty outputs, retires the prior release, and publishes the candidate in one database transaction.

Apply the schema only after the write gate has a recent verified recoverable backup. Review the SQL in `migrations/d1` before application; it intentionally contains no `TRUNCATE` and leaves legacy tables readable during migration.

The candidate lifecycle is:

```bash
# 1. Dry-run reconciliation and candidate computation.
npm run data:geography
npm run data:candidate

# 2. After migration and review, create a validated candidate (not published).
npm run data:geography -- --apply
npm run data:candidate -- --apply

# 3. Only after reviewing the printed candidate/run IDs and quality report.
CONFIRM_DATASET_PUBLISH=YES npm run data:candidate -- --apply --publish
```

Production additionally requires `CONFIRM_PRODUCTION_WRITE=YES` and a `BACKUP_VERIFIED_AT` no older than 24 hours. The final publish command recomputes a fresh candidate; it does not publish an arbitrary candidate ID.

If the D1 member load is interrupted after all comp sets are staged, resume only
the same candidate with its original `periodEnd` printed in the candidate report:

```bash
CONFIRM_DATASET_PUBLISH=YES npm run data:candidate -- --apply --publish \
  --resume-candidate=<candidate-id> --period-end=<original-ISO-period-end>
```

The resume path verifies candidate status, environment, period end, set count,
and every expected comp member before publication. It skips already inserted
members. Production still requires the explicit write confirmation and a recent
verified D1 Time Travel bookmark or export.

`wrangler.pipeline.example.jsonc` contains the reviewed R2, Queue/DLQ, and
Workflow binding shape. It intentionally contains no Cron trigger and is not
merged into the active Worker config: create and validate those resources
against the development D1 database first, merge the bindings, regenerate
Worker types, dry-run the package, and run two successful manually triggered
development refreshes before production use.

Active source adapters are fail-closed in `pipeline/sourceCatalog.ts`:

- NYC rolling sales and condo identity: active and approved.
- NYS SalesWeb (including 10977), NJ MOD-IV/SR1A, CT OPM/municipal: contract-only and disabled pending access/rights/shape validation.
- RESO/current listings: disabled until a licensed feed, credentials, coverage, display, and retention rules are supplied.

The public `?envelope=1` market APIs expose requested/effective geography, exact/broadened/coverage-gap/stale-snapshot mode, records, sample coverage, source date, ingestion/publication dates, dataset version, and warnings. `/api/data/status` exposes the same release status for health and UI use.

## Statewide Florida property sales

The statewide directory is separate from the Alachua exact-day pilot. The
[2026 Florida statewide parcel layer](https://geodata.floridagio.gov/) covers all
67 counties. It publishes transfer month and year, so the directory keeps that
precision and does not put these records into day-level comps or NYC rankings.
The importer takes the latest qualifying transfer field supplied by the parcel
roll. It keeps the public physical address and parcel identity, filters out
out-of-range prices, missing addresses, multi-parcel transactions and conflicting
duplicates, and does not fetch owners' names or mailing addresses.

Manually acquire and prepare a candidate with Node 22 or later:

```bash
npm run data:florida -- --output=.cache/florida/statewide.sqlite --since=2025-01
npm run data:florida:prepare -- .cache/florida/statewide.sqlite .cache/florida/statewide-d1.sql
```

The source's edit timestamp and requested start month identify a release. A rerun
can resume unfinished counties for that same source revision. A run with
`--county=miami-dade`, for example, can verify a single county. Preparing the D1
import requires all 67 counties to have verified rows and matching totals.

Build the county profiles from the same verified candidate SQLite snapshot
before committing and deploying its Worker. Download the official
[Census county adjacency file](https://www2.census.gov/geo/docs/reference/county_adjacency/county_adjacency2026.txt)
alongside the staged snapshot.

\`\`\`bash
npx tsx scripts/build-florida-insights.ts .cache/florida/statewide.sqlite .cache/florida/county-adjacency-2026.txt
\`\`\`

This updates \`server/floridaInsightsSnapshot.json\` with statewide and county
price distributions, sale months, ZIPs, postal cities, property types, and
links to neighboring Florida counties. Pages use these profiles only when
their release ID, county counts, and most recent sale months match active D1
coverage. The request path reads precomputed profiles rather than scanning
Florida sales to recalculate statistics.

Stage the generated SQL in a separate Florida D1 database. It leaves the release
inactive. Verify counts, test the site against the staged binding, and activate
the exact staged ID only after the checks pass. The command below assumes
`Florida-candidate` names the new database and `fdor-approved-id` is replaced
with the checked ID from the preparation command.

```bash
npx wrangler d1 execute Florida-candidate --remote --file=.cache/florida/statewide-d1.sql
npx wrangler d1 execute Florida-candidate --remote --command "SELECT count(*) AS counties, sum(records) AS records FROM florida_coverage GROUP BY release_id;"
npx wrangler d1 execute Florida-candidate --remote --command "UPDATE florida_releases SET published_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 'fdor-approved-id' AND (SELECT count(*) FROM florida_coverage WHERE release_id = florida_releases.id) = 67 AND (SELECT sum(records) FROM florida_coverage WHERE release_id = florida_releases.id) = (SELECT count(*) FROM florida_sales WHERE release_id = florida_releases.id);"
```

Bind the verified Florida database as `FL_SALES_DB`. After deploying, check
`/florida`, the 67 county URLs, a ZIP/address search, and the Florida child
sitemap linked from `/sitemap.xml`. Keep the prior database available so
rolling back the Worker also restores its prior Florida snapshot.

## Texas county housing data

The Texas directory covers Census housing estimates and available FHFA annual
price trends for all 254 counties. It links to the Texas Comptroller's county
appraisal directory for parcel and appraisal records. The Census median is an
owner-reported estimate. The FHFA series measures price change for the mortgages
in its sample. Individual Texas closing prices and active listings require
a separate feed.

Manually build a candidate with a fresh local cache directory and Python 3.10 or
later. Set the ACS and adjacency vintages to available official releases and
use the publication date for the deployment.

```bash
python scripts/build-texas-housing.py --cache .cache/texas-2026-11-15 --acs-year 2024 --adjacency-year 2026 --published-on 2026-11-15
```

Review the generated `server/texasHousingSnapshot.json`, including statewide
and county estimates, FHFA revision date, and any counties with sparse data.
Run `npx tsx --test scripts/tests/texas-housing.test.ts` before deploying.
The Worker bundles the verified snapshot. The profile and sitemap share
one eligibility check, so counties with insufficient market data stay available
through the comparison directory and outside `/sitemap-texas.xml`.

## Nationwide housing markets

The nationwide directory covers all 50 states and Washington, DC. The public
snapshot joins Census American Community Survey 5-year estimates, FHFA
state and county house price indexes, and monthly MLS aggregate statistics from
Realtor.com® Economic Research. The directory labels the source period and
distinguishes owner-reported values, asking prices, and price-index movements.
NYC and Florida retain their separate recorded-sale pages. The Texas hub and
county profiles keep their existing canonical URLs.

Generate a manual candidate with Python 3.10 or later and a fresh source cache.
Check the current Census release, the quarter on the FHFA state summary table,
and the month of the three matching Realtor.com research files before running.

```bash
python scripts/build-us-housing.py --cache .cache/us-housing-2026-11-15 --acs-year 2024 --adjacency-year 2026 --inventory-month 2026-10 --fhfa-period 2026Q2 --published-on 2026-11-15
```

Review state and county counts, the verified period of each source, ACS margins
of error, and the count of publisher-flagged or thin listing samples. County
data joins by exact FIPS. ZIP/Census area search uses the Census relationship
file and keeps borough, county and state identities from source geography.
Connecticut Census planning regions do not inherit estimates from historical
county FIPS. Check representative searches, canonicals and sitemap URLs.
Deploy a new Worker only after the regression and build checks pass.

Three read-only JSON snapshots are bundled with the Worker. It serves the
profiles, search results and sitemap without querying a database or a source API.
Search result pages and county pages that lack adequate pricing evidence are
outside the sitemap. States with enough supported Census places or ZIP areas
also link to crawlable comparison directories for those figures. Search results
link to the matching state and supported county profiles.
