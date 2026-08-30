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

```bash
# Full database profile and integrity checks. Exits 2 for critical findings.
npm run data:audit

# Dry-run quarantine/deletion counts (default; no writes).
npm run data:cleanup

# Quarantine unverified properties and delete only unmistakably generated sales.
npm run data:cleanup -- --apply

# Dry-run official NYC rolling-sales refresh (default; no writes).
npm run data:refresh

# Apply official rolling-sales updates, then rebuild verified aggregates.
npm run data:refresh -- --apply --recompute

# Monthly official Digital Tax Map condo-unit snapshot plus sales refresh.
npm run data:refresh -- --include-reference --apply --recompute

# Local pure regression tests.
npm run test:regression

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

The disabled `scripts/refresh-all-data.ts` must not be restored: it generated random NJ/CT addresses, coordinates, attributes, scores, and sales. Those rows are not “live data.”

## Live listing data

Public-record feeds provide recorded transactions and assessor/tax facts, not live MLS inventory. Current for-sale/for-rent status requires a licensed RESO Web API feed from an MLS or an authorized data vendor. Add that as a separate source adapter after credentials, allowed fields, retention rules, and display rights are confirmed. Do not scrape consumer portals.

## Recommended schedule

- Daily: run `data:audit`; alert on critical findings or freshness SLA failures.
- Weekly: dry-run and apply rolling-sales refresh, then recompute aggregates.
- Monthly: include the condo-unit reference snapshot and reconcile adds/removals.
- Quarterly/source release: refresh PLUTO and run a complete entity-resolution audit.
- After every applied refresh: run `regression:live`, regenerate/purge sitemap caches, and compare row counts/freshness to the previous successful run.
