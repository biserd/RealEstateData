# Realtors Dashboard - Real Estate Intelligence Platform

## Overview

Realtors Dashboard is a subscription SaaS platform designed for buyers, investors, and agents to identify real estate opportunities. It currently provides market intelligence, proprietary opportunity scoring, and AI-powered property analysis for New York, New Jersey, and Connecticut, with plans for nationwide expansion. The platform focuses on transparent, data-backed insights to empower users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18+, TypeScript, Vite, Wouter for routing, and TanStack Query for server state. UI components leverage Shadcn/ui, Radix UI primitives, and Tailwind CSS, following a Linear-inspired design with light/dark mode.

### Backend

The backend utilizes Express.js and TypeScript, running on Node's `http` module. Authentication is handled by Passport Local Strategy with bcrypt for password hashing and PostgreSQL for session storage. It features a RESTful API returning JSON, robust export functionalities, and a monorepo structure for client and server code with shared schemas and `esbuild` optimization.

### Database

The platform uses Drizzle ORM with PostgreSQL (Neon serverless driver) and a schema-first approach. Key data models include Users, Properties (with geographic segmentation and opportunity scoring), Sales, Market Aggregates, Coverage Matrix, Watchlists, Comps, Data Sources, and AI Chats. Properties are indexed geographically, and market statistics are pre-computed.

### AI Integration

AI features, including Property Analysis, Market Intelligence, and Grounded Responses, are powered by OpenAI API (GPT-5) via Replit AI Integrations. AI outputs are structured JSON, incorporate contextual property and market data, include confidence scoring, and provide data citations to prevent hallucinations.

### Features

-   **Market Explorer:** Provides market statistics by geography.
-   **Opportunity Screener:** Identifies underpriced properties.
-   **Up and Coming ZIPs:** Identifies trending neighborhoods using a `trendScore` algorithm.
-   **Property Detail Pages:** Offers in-depth property information with SEO-friendly URLs.
-   **Watchlists:** Allows users to save and monitor properties.
-   **Admin Console:** For managing platform data and settings.
-   **SEO-Friendly URLs:** Descriptive, keyword-rich URLs for better search engine visibility.

### Authentication System

The platform uses username/password authentication with Passport Local Strategy and bcrypt hashing. API endpoints are provided for user registration, login, logout, and retrieving the current authenticated user.

### Real Data & ETL Pipeline

The platform integrates real estate data from multiple public sources:
- **NYC Open Data** (free, no auth): PLUTO (176K properties), DOB Permits (20K), 311 Complaints (20K), HPD Violations (4.4K), Sales, Condo Registry
- **CT Open Data** (free SODA API at data.ct.gov): CAMA property data from 25 towns (12K properties) with assessed values, sale history, and building details
- **NJ Properties** (4.6K): Generated from real municipality data (40 municipalities) with realistic values based on NJ MOD-IV assessment ranges
- **Zillow Research**: ZHVI market trends by ZIP, city, county, and metro
- **NYC Geoclient API**: Address normalization and geocoding

The comprehensive refresh script (`scripts/refresh-all-data.ts`) handles all ETL: NYC data refresh, NJ/CT imports, fast SQL-based signal computation (176K signals), market aggregate refresh (1.6K aggregates across ZIP/city/county/neighborhood levels), and data source/coverage matrix updates. CT import uses zip_code fallback mapping for records missing zip codes. Signal computation uses a single SQL INSERT...SELECT with JOINs on DOB/HPD/311 tables for performance.

**Historical Sales Backfill:** `scripts/backfill-historical-sales.ts` pulls multi-year ACRIS deed records (Master + Legals datasets, 2020-present) from NYC Open Data, joins by `document_id`, resolves to `unitBbl`/`baseBbl` via the condo unit identity graph (unit-bbl exact match → block-prefix → block-lot fallback), distributes deed amounts across multi-BBL legals, filters $50K-$10M residential, and inserts into `sales` with `matchMethod=acris_historical_*`. Supports `START_YEAR`/`END_YEAR` for year-scoped runs and `BOROUGHS=1,2,3,4,5` + `SKIP_CLEAR=1` for splitting heavy years across bash invocations. Includes retry-with-backoff for SODA's flaky deep-pagination 500s and chunks legals per borough to stay under the 10K offset cap. Backfill yields ~180K sales spanning 2020-2025 across 5 NYC boroughs, powering the multi-year Building Price Trends UI on UnitDetail.

**Building Price Trends:** `getUnitOpportunityData` in `server/storage.ts` returns `buildingAvgPricePerYear` (year, avgPrice, medianPrice, minPrice, maxPrice, saleCount, yoyPct using median) and `buildingTrendSummary` (threeYearPct, lastYearPct, direction). UnitDetail renders these as a header trend summary plus per-row inline scaled bars, sale counts, min-max ranges, median price, and colored YoY% badges (TrendingUp/Down/Minus icons).

**Building Detail Page (`/building/:baseBbl`):** Wide layout (max-w-6xl) with a 2-column hero (StreetView + interactive PropertyMap showing the building marker plus up to 50 nearest comp properties within 1.5 km, distance-filtered client-side from `/api/properties/area?geoType=zip`). Header card shows residential/total/parking-storage unit counts and BBL. Three tabs: Overview (default), Units, Sales. The Overview tab uses `/api/buildings/:baseBbl/insights` (`getBuildingInsights` storage method) to render: 4 stat cards (Total Sales, Median Sale, YoY Median, Last Sale), a Sale Price Range card with min/avg/max plus a "vs ZIP median" comparison sourced from `marketAggregates`, a Unit Mix card with per-type rows (residential/parking/storage/commercial/other) and proportional bars, and a Yearly Sales Trend card with inline scaled bars per year showing median price, sale count, and min-max range.

### Condo Units Data

The `condo_units` table contains over 300K NYC condo unit records, enabling unit-level search and analytics. It includes unitBbl, baseBbl, unitDesignation, display addresses, and geographic coordinates, with classifications for residential, parking, commercial, and storage units. A multi-tier matching system links sales data to individual condo units.

### SEO & Sitemap System

The platform implements comprehensive SEO optimization:
- **Server-Side Meta Tags**: `server/seoMetaTags.ts` injects unique title, description, OG (title/description/type/url/site_name), canonical, and Twitter tags per page at the HTML level (in `static.ts` for production). This ensures crawlers see page-specific meta without needing JavaScript rendering. Covers unit pages (300K+), property pages, building pages, neighborhood pages, browse pages, and static pages.
- **JSON-LD Structured Data**: Each `PageMeta` can carry an optional `jsonLd` object that is injected as a `<script type="application/ld+json">` tag in the head. Property pages emit `SingleFamilyResidence` (address, floorSize, numberOfRooms, yearBuilt, geo). Unit pages emit `Residence`. Building pages emit `ApartmentComplex` with unit counts. Neighborhood/browse pages emit `Place`. JSON output is escaped (`<`, `>`, `&` → `\u00xx`) to prevent script-tag breakout.
- **Noscript SEO Body Content**: For non-JS crawlers (Bing, Yandex, AI bots), `injectMetaTags` injects a `<noscript><main id="seo-content">` block containing the page's `<h1>` plus key facts (address, price, sqft, beds/baths, year built, opportunity score, market stats). React users never see this because `<noscript>` is hidden when JS executes. Crawlers without JS get readable, indexable content.
- **SEO-Friendly Unit URLs**: Format `/unit/{address}-unit-{designation}-{borough}-{9-digit-bbl}` (e.g., `/unit/1-water-street-unit-suba-manhattan-000041001`)
- **Paginated Sitemaps**: Unit sitemaps paginated at 40k items per file (8 files for 300k+ units)
- **Sitemap Index**: `/sitemap.xml` includes static pages, properties, and units
- **Legacy URL Support**: Old unitBbl URLs redirect to SEO-friendly slugs
- **Unit Resolver API**: `/api/units/resolve/:idOrSlug` handles both slug and legacy BBL lookups
- **Admin Slug Generation**: `/api/admin/generate-unit-slugs` for batch slug generation
- **Content-Signal**: robots.txt includes `Content-Signal: ai-train=yes, search=yes, ai-input=yes`

## External Dependencies

### Third-Party Services

-   **AI Services:** Replit AI Integrations (OpenAI-compatible API for GPT-5)
-   **Database:** Neon Serverless PostgreSQL
-   **Payments:** Stripe (via stripe-replit-sync) for subscription management. Multi-app routing via `APP_SLUG` metadata on checkout sessions and webhook ignore gate.
-   **Authentication:** Passport Local Strategy (bcrypt for password hashing)
-   **Geocoding:** NYC Geoclient API

### Subscription System

The platform implements a three-tier freemium model (Free, Pro, Premium) managed via Stripe. Features are gated based on subscription tier, with usage limits enforced for the Free tier. API endpoints exist for subscription status, checkout, and billing portal access.

**Multi-App Stripe Routing:** The Stripe account is shared across multiple apps (aitracker, nycschoolsratings, realtorsdashboard). Each app tags checkout sessions with `metadata.app = APP_SLUG` and `subscription_data.metadata.app = APP_SLUG`. The webhook handler lets stripe-replit-sync verify/sync all events, then gates business logic (user subscription sync) by checking `metadata.app`. For older subscriptions without metadata, it falls back to matching price IDs against the database via `getValidPriceIds()`. Idempotency is enforced by in-memory event ID tracking.

### Developer API Access

Pro subscribers can generate API keys to programmatically access platform data via external API endpoints for properties, market stats, comps, and trending ZIP codes. API key management is available, including generation and revocation, with rate limiting enforced.

### Tools Pages

Three standalone power-user tools accessible via the Header "Tools" dropdown and Footer:

-   **Property Comparison (`/compare`):** Side-by-side comparison table of up to 2 properties (Free) or 4 (Pro). Search by ZIP/city/address surfaces an area picker, then shows nearby properties to add. Compares address, location, type, price, $/sqft, beds, baths, sqft, year built, and opportunity score. Selected property IDs are persisted in the URL (`?ids=...`) for shareable comparisons via the Share button.
-   **Neighborhood Report Cards (`/neighborhood/:geoId?geoType=zip|neighborhood`):** Letter grade (A–F) plus market stats (median price, $/sqft, count, 3mo trend) and six neighborhood indicators (Development, Safety, Transit, Amenities, Flood Risk, Building Health). Free tier sees Development/Flood/Building; Pro unlocks Safety/Transit/Amenities (locked cards blur and link to `/pricing`). Includes property type and bedroom distributions.
-   **Investment Calculator (`/calculator`):** Real-time rental property analyzer with three scenarios via tabs: **Standard** (buy & hold), **Refinance** (rate-and-term refi at a future year, with closing-cost deduction and "Refi" reference line on the chart), and **BRRRR** (Buy/Rehab/Rent/Refinance/Repeat — 75% LTV cash-out refi at year 1 based on After Repair Value, with a dedicated Refinance Outcome card showing total project cost, refi loan, cash-out, and cash-left-in / "Infinite Return" badge). Inputs cover property/loan, income/expenses, growth assumptions (appreciation, rent growth, expense growth), and scenario-specific fields. Outputs include monthly cash flow, cap rate, cash-on-cash, 5/10/30-year total return, GRM, DSCR, break-even occupancy, monthly expense breakdown, and a 30-year projection chart (recharts) with cumulative cash flow + equity + total return lines. **Live mortgage rates** are fetched from the FRED MORTGAGE30US series (server-cached 24h via `/api/calculator/defaults`) and prefilled on first load; a header badge shows the current 30yr fixed rate with `as-of` date. **Property autofill** lets users search by address/ZIP/city to populate price/rent/tax-rate from any platform property via `/api/calculator/property/:id` (uses 0.7% rule for rent estimate when missing). **Save/Share** persists scenarios to `localStorage` (named, up to 20) and serializes inputs to URL query params (compact short keys) for shareable links via the Share button. Reset button restores defaults. Pro users see a Market Context card with state median price/trend; Free users see a blurred preview that links to `/pricing`.

All Pro upgrade paths on these tools navigate to `/pricing` rather than opening modals, consistent with the platform's monetization policy.

### Internal Linking & Browse Pages

State and city browse pages (`/browse/:state` and `/browse/:state/:city`) provide SEO-friendly geographic navigation with:
- State pages showing city listings, stats (total properties, median price), property type breakdowns, and top opportunities
- City pages with ZIP code breakdowns, paginated property listings, and market stats
- Breadcrumb navigation (Home > State > City)
- Similar Properties section on PropertyDetail pages (same ZIP, type, and price range matching with fallback)
- Server-side SEO meta tags for browse pages (`seoMetaTags.ts`)
- Dedicated `sitemap-browse.xml` included in sitemap index
- Browse API endpoints: `/api/browse/states`, `/api/browse/state/:state`, `/api/browse/state/:state/properties`, `/api/browse/state/:state/city/:city`, `/api/browse/state/:state/city/:city/properties`, `/api/properties/:id/similar`