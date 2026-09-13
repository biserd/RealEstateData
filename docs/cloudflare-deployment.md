# Cloudflare deployment

The application is configured as a Cloudflare Worker with Workers Static Assets, an Express compatibility bridge for API routes, and a native Cloudflare Email Service binding.

## What is already Cloudflare-ready

- Vite assets build to `dist/public` and are served directly by Workers Static Assets.
- Only API, sitemap, and database-backed SEO routes invoke Worker compute; ordinary static assets and most SPA navigation are served asset-first.
- Express API routes run through Cloudflare's `node:http` compatibility adapter.
- Application queries and login sessions use the native `DB` Cloudflare D1 binding through Drizzle's SQLite driver.
- Transactional email uses the `EMAIL` `send_email` binding. Resend is no longer used.
- Stripe uses direct API calls and signature-verified webhooks; the Replit Stripe connector and mirrored `stripe.*` schema are no longer required by request handling.
- AI calls use the native Workers AI binding and the single approved `@cf/zai-org/glm-5.3-flash` model. No third-party AI key is required.
- The unused Replit object-storage scaffold and its Google Cloud dependencies have been removed. The current application has no registered upload route; add an R2 binding if uploads are introduced later.
- The text-first frontend does not load Google Maps JavaScript, Static Maps, Street View, or map embeds.

## Prerequisites

1. Use a Workers Paid plan for Cloudflare Email Service sends to arbitrary recipients.
2. Put `realtorsdashboard.com` on Cloudflare DNS and onboard the domain under **Compute > Email Service > Email Sending**. Cloudflare adds the required bounce MX, SPF, DKIM, and DMARC records.
3. Apply the D1 migrations and configure the `DB` binding in `wrangler.jsonc`. Use a separate D1 database for each environment.

## Local validation

Wrangler 4.127 or newer requires Node.js 22.16 or newer (Node 24 recommended for migration validation).

```sh
npm install
npm run cf:types
npm run check
npm run build
npm run deploy:dry-run
```

Copy `.dev.vars.example` to `.dev.vars` for local Worker development. Email sending should be tested only after the domain is onboarded; the binding is intentionally not configured as a remote development binding.

Workers AI always executes remotely. Local AI feature testing therefore requires Cloudflare authentication and a Workers Paid plan because `glm-5.3-flash` is a paid-access model. Use `npm run dev`; the legacy `npm run dev:node` process does not have access to the native AI binding.

## Secrets and deployment

After the D1 database and production credentials are available:

```sh
npx wrangler secret put SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npm run build
npx wrangler deploy
```

Additional integrations used by enabled routes must also be set with `wrangler secret put` (NYC Geoclient, schools, or other provider credentials). Configure Stripe's production webhook endpoint as `https://realtorsdashboard.com/api/stripe/webhook`. Do not deploy until `npm run deploy:dry-run` succeeds and `/api/health` reports `databaseConfigured: true` in staging.

## Database operations

Production uses `realtors-dashboard-production` through `DB`. D1 does not use a connection-string secret or Hyperdrive. The previous Neon database remains a rollback source; see [D1 migration](d1-migration.md).

Run `npx wrangler d1 migrations apply DB --local` to prepare local development. The manual data commands use `scripts/run-d1.ts`; local is the default. Remote operations require `D1_REMOTE=1` and `DATABASE_ENV=production`. Applied production writes additionally require the existing confirmation and recent-backup controls. See [data integrity and refresh](data-integrity-and-refresh.md).

Never use `drizzle-kit push` against production: the database also preserves catalog tables and constraints not represented by every application model. Review and apply versioned SQL from `migrations/d1`.

Heavy data imports remain explicit CLI jobs. No automatic refresh is enabled by this migration.

## Cloudflare Email limits

Cloudflare Email Sending is currently beta and requires a Workers Paid plan for arbitrary recipients. New accounts begin with conservative daily limits, so validate expected registration, password-reset, activation, alert, and digest volume before removing the old provider credentials from production. Configure bounce/suppression handling and monitor Email Service logs before cutover.
