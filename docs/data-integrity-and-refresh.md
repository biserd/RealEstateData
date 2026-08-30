# Data integrity and refresh operations

## Publication policy

The public site no longer publishes every row that happens to exist in Postgres.

- Unit pages require a residential unit with valid identity/address fields, coordinates, and at least one recorded sale matched to the exact `unit_bbl` in the past 120 months.
- Property pages require valid identity/geography/value fields plus one of: a parcel key, a 0.90+ entity-resolution match, or a source-backed recorded sale.
- Missing database-backed pages return HTTP 404 with `X-Robots-Tag: noindex, nofollow, noarchive`.
- Legacy identifiers redirect permanently to the current canonical URL when the entity still exists.

This deliberately removes legacy NJ/CT demo records and building-only condo shells from browse, search, API detail, and sitemap surfaces without immediately destroying rows that may be referenced by customer data.

## Commands

All database commands require `DATABASE_URL`. Production and development must use separate database URLs.

Applied writes also require an explicit `DATABASE_ENV`. Production writes are blocked unless the reviewed command has `CONFIRM_PRODUCTION_WRITE=YES` and `BACKUP_VERIFIED_AT` contains an ISO timestamp for a recoverable backup or Neon branch verified within the prior 24 hours. These values are command-scoped controls, not permanent Worker variables.

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

For each requested refresh: run `data:audit`, acquire the selected source
partitions, build a candidate, review its quality and freshness report, and use
the separate publication confirmation only after approval. After publication,
run `regression:live`, purge sitemap caches, and compare counts and freshness to
the previous successful release.

## P3-P7 versioned pipeline

`migrations/0001_versioned_data_platform.sql` is additive and creates canonical geography, source catalog, refresh-run, raw-manifest, source-entity, crosswalk, quarantine, quality-result, dataset-version, comp, market-snapshot, and ranking tables. It also defines `publish_validated_dataset`, the only approved publication operation. That function locks the candidate, rejects critical failures or empty outputs, retires the prior release, and publishes the candidate in one database transaction.

Apply the schema only after the write gate has a recent verified backup/Neon branch. Review the SQL in Neon before application; it intentionally contains no `TRUNCATE` and leaves legacy tables readable during migration.

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

`wrangler.pipeline.example.jsonc` contains the reviewed R2, Queue/DLQ, and
Workflow binding shape. It intentionally contains no Cron trigger and is not
merged into the active Worker config: create and validate those resources
against the development Neon branch first, merge the bindings, regenerate
Worker types, dry-run the package, and run two successful manually triggered
development refreshes before production use.

Active source adapters are fail-closed in `pipeline/sourceCatalog.ts`:

- NYC rolling sales and condo identity: active and approved.
- NYS SalesWeb (including 10977), NJ MOD-IV/SR1A, CT OPM/municipal: contract-only and disabled pending access/rights/shape validation.
- RESO/current listings: disabled until a licensed feed, credentials, coverage, display, and retention rules are supplied.

The public `?envelope=1` market APIs expose requested/effective geography, exact/broadened/coverage-gap/stale-snapshot mode, records, sample coverage, source date, ingestion/publication dates, dataset version, and warnings. `/api/data/status` exposes the same release status for health and UI use.
