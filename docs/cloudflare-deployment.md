# Cloudflare deployment

The application is configured as a Cloudflare Worker with Workers Static Assets, an Express compatibility bridge for API routes, and a native Cloudflare Email Service binding.

## What is already Cloudflare-ready

- Vite assets build to `dist/public` and are served directly by Workers Static Assets.
- Only API, sitemap, and database-backed SEO routes invoke Worker compute; ordinary static assets and most SPA navigation are served asset-first.
- Express API routes run through Cloudflare's `node:http` compatibility adapter.
- PostgreSQL application queries and login sessions use Neon's fetch-based driver, avoiding long-lived Node TCP connections in the Worker.
- Transactional email uses the `EMAIL` `send_email` binding. Resend is no longer used.
- Stripe uses direct API calls and signature-verified webhooks; the Replit Stripe connector and mirrored `stripe.*` schema are no longer required by request handling.
- AI calls use the native Workers AI binding and the single approved `@cf/zai-org/glm-5.3-flash` model. No third-party AI key is required.
- The unused Replit object-storage scaffold and its Google Cloud dependencies have been removed. The current application has no registered upload route; add an R2 binding if uploads are introduced later.
- Default property/location previews are generated from application data and make no Google request.
- Street View is loaded only after a click through the Maps Embed API. Rich multi-marker maps retain their existing click-to-load Maps JavaScript behavior.

## Prerequisites

1. Use a Workers Paid plan for Cloudflare Email Service sends to arbitrary recipients.
2. Put `realtorsdashboard.com` on Cloudflare DNS and onboard the domain under **Compute > Email Service > Email Sending**. Cloudflare adds the required bounce MX, SPF, DKIM, and DMARC records.
3. Create separate, website-restricted Google keys:
   - `VITE_GOOGLE_MAPS_API_KEY`: Maps JavaScript API only.
   - `VITE_GOOGLE_MAPS_EMBED_API_KEY`: Maps Embed API only.
   These values are public browser credentials and must be supplied to the frontend build environment.
4. Provide the Postgres connection URL. Store it as a Worker secret; do not place it in `wrangler.jsonc`.

## Local validation

Wrangler 4.127 or newer requires Node.js 22 or newer.

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

After the database URL and the other production credentials are available:

```sh
npx wrangler secret put DATABASE_URL
npx wrangler secret put SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PUBLISHABLE_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npm run build
npx wrangler deploy
```

Additional integrations used by enabled routes must also be set with `wrangler secret put` (NYC Geoclient, schools, or other provider credentials). Configure Stripe's production webhook endpoint as `https://realtorsdashboard.com/api/stripe/webhook`. Do not deploy until `npm run deploy:dry-run` succeeds and `/api/health` reports `databaseConfigured: true` in staging.

## Database note

The current data layer remains PostgreSQL and now uses the Neon serverless HTTP driver. This is supported on Workers and lets a Neon-backed site move without a database rewrite. The `sessions` table already lives in the Drizzle schema and is used directly, so authentication no longer depends on `connect-pg-simple` or a separate Node TCP pool.

If the supplied production URL is not a Neon database, choose one of these before deployment:

- Migrate the data to Neon and keep the current fetch-based driver.
- Create a Hyperdrive binding for the existing PostgreSQL provider and adapt `server/db.ts` to Hyperdrive's connection string and a supported PostgreSQL driver.

The current Worker deliberately returns HTTP 503 for API requests until `DATABASE_URL` is configured while still allowing static assets to be served.

## Remaining cutover gates

- Provide the production/staging PostgreSQL URLs and identify the provider.
- Provide Cloudflare account access, onboard the sending domain, and confirm the Workers Paid plan for arbitrary email recipients.
- Provide production secrets and the two browser-restricted Google keys at build time.
- Register the direct Stripe webhook only after a staging Worker URL exists.
- Decide where the heavyweight data-import/ETL scripts run. They remain CLI batch jobs and are not part of the request-serving Worker; Cloudflare Workflows or an external batch runner is a separate migration.

The Workers AI binding does not require an API-key secret. Deploy only after Workers Paid billing is enabled for the account.

## Cloudflare Email limits

Cloudflare Email Sending is currently beta and requires a Workers Paid plan for arbitrary recipients. New accounts begin with conservative daily limits, so validate expected registration, password-reset, activation, alert, and digest volume before removing the old provider credentials from production. Configure bounce/suppression handling and monitor Email Service logs before cutover.
