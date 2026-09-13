# Neon to D1 migration — September 13, 2026

## Production target

- Worker: `realtors-dashboard`, serving `realtorsdashboard.com` and `www.realtorsdashboard.com`.
- Native Worker binding: `DB`.
- D1 database: `realtors-dashboard-production` (`9329644b-3c17-4ddd-82d7-e51f1a544768`), ENAM.
- Source: Neon project `little-hill-53993129`, branch `realestatedashboard` (`br-orange-union-ayxbc6np`), database `neondb`.

The application uses `drizzle-orm/d1` and SQLite models. It no longer reads `DATABASE_URL` or uses Hyperdrive. Existing email, AI, rate-limit, Durable Object, domain and secret configuration is preserved. Retain the Neon branch and old connection secret during the rollback window.

## Scope and sizing

The initial consistent snapshot contained **3,491,706 rows in 83 source tables** (53 public, 29 Stripe archive and one system table). PostgreSQL occupied 2,610,601,984 bytes. D1 after import and added lookup indexes occupied **2,250,465,280 bytes**. These are different database engines, so file sizes are not expected to match.

All source tables were retained, including archived data. PostgreSQL schemas are flattened: public names stay unchanged, `stripe.<name>` becomes `stripe__<name>`, and `_system.<name>` becomes `_system__<name>`. D1 also contains migration bookkeeping tables.

The [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) require the paid plan for this database: 10 GB per database, compared with 500 MB on Free. The 10 GB ceiling cannot be increased. Plan retention or partitioning before approaching it. Rows were checked against the 2 MB limit; the largest exported row was approximately 6 KB. Queries use bounded inserts and JSON ID sets to respect the 100-parameter limit. Heavy refresh jobs remain manual.

## Compatibility changes

- UUIDs remain strings. Dates are UTC ISO text with six fractional digits; Drizzle maps them to JavaScript `Date`. JSON and arrays are stored as JSON text; booleans use SQLite integers.
- Primary keys, foreign keys, unique and check constraints, partial indexes, views and update triggers were converted from the live catalog.
- The unused archived Stripe GIN index on `accounts.api_key_hashes` has no equivalent and was omitted; its data is preserved.
- PostgreSQL casts, intervals, regular expressions, `DISTINCT ON`, JSON aggregation and merge expressions were converted to SQLite equivalents.
- Percentiles retain continuous interpolation and null filtering. Integer medians retain PostgreSQL's nearest-even tie behavior.
- Dataset publication uses a validated single-insert trigger, so a failed publication cannot retire the currently published dataset.
- Added property, sale and comparable-set indexes prevent expensive scans on detail pages.
- Login sessions retain their IDs, JSON and expiry timestamps. The production session-signing secret is unchanged.

## Verification and cutover

The full source export used a read-only repeatable-read transaction. Per-table row counts and SHA-256 hashes were checked while creating a local SQLite copy; integrity and foreign-key checks passed. The D1 import used 69 bounded SQL files, each recorded in `migration_import_parts` with its source hash and row count.

Before cutover, all 83 D1 counts matched, all 69 import audit records matched, `foreign_key_check` was empty and `quick_check` returned `ok`. Nineteen storage comparisons matched the original PostgreSQL implementation; unspecified ordering within tied scores was compared by score. Forty-eight HTTP preview checks passed, including data envelopes, search, ZIP reports, unit resolution, canonical pages and all five sitemaps. Tests cover sessions, Date/JSON conversion, large ID filters, percentiles and atomic publication. CI runs application and data-script type checks, regression tests, D1 tests, release checks and Worker packaging.

The final cutover procedure briefly pauses requests, exports a fresh consistent Neon snapshot, reconciles changes into D1, repeats count/integrity checks, then deploys the D1 Worker. Session rows are replaced from that final snapshot to exclude preview sessions. Neither Neon data nor the Neon branch is deleted.

Private source exports, SQLite copies, import SQL, connection credentials and detailed verification reports stay outside Git. The `scripts/d1-*` tools are migration utilities, not recurring refresh jobs; do not rerun the initial import against the live database.

The existing data-quality audit still identifies historical generated/shadow records. This migration preserves them faithfully and keeps the existing public-eligibility filters and quarantined ETL policy. It does not publish or clean up those records.

## Operations

Use Node 22.16+ (Node 24 recommended).

```sh
# Local development database only
npx wrangler d1 migrations apply DB --local
npm run dev

# Read-only production audit (shell syntax shown for POSIX)
D1_REMOTE=1 DATABASE_ENV=production npm run data:audit
```

Production data writes additionally require `CONFIRM_PRODUCTION_WRITE=YES` and a `BACKUP_VERIFIED_AT` timestamp within 24 hours. Review the specific operation and verify a recoverable D1 backup before setting them. `wrangler.data.jsonc` explicitly targets production; local development does not use remote D1 by default. Provision a separate D1 database and configuration before using staging. Never point staging at this production ID.

Apply reviewed SQL migrations from `migrations/d1`; do not use `drizzle-kit push` against the live catalog. Use D1 Time Travel and periodic exports for recovery. Monitor database growth, rows scanned and query latency, particularly during manual analytics refreshes.

## Rollback

The pre-migration Worker version was `ff792b8c-2d3e-4efb-bc51-c2780f917018` (source commit `1357f5e`). Before D1 accepts new production writes, restoring that Worker version returns traffic to the retained Neon database and existing secret.

After D1 accepts production writes, do **not** blindly roll back the Worker: Neon will be stale. Pause writes, preserve a D1 recovery point/export, reconcile new user/session/payment data back to the chosen target, and only then switch traffic. A Worker rollback does not roll back or synchronize database contents.
