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

The platform integrates real estate data from Zillow Research, NYC Open Data (PLUTO, Sales, Condo Registry), and NYC Geoclient API. ETL scripts process this data to populate the database with comprehensive property and market information, including detailed condo unit data and transaction matching.

### Condo Units Data

The `condo_units` table contains over 300K NYC condo unit records, enabling unit-level search and analytics. It includes unitBbl, baseBbl, unitDesignation, display addresses, and geographic coordinates, with classifications for residential, parking, commercial, and storage units. A multi-tier matching system links sales data to individual condo units.

### SEO & Sitemap System

The platform implements comprehensive SEO optimization:
- **Server-Side Meta Tags**: `server/seoMetaTags.ts` injects unique title, description, OG, canonical, and Twitter tags per page at the HTML level (in `static.ts` for production). This ensures crawlers see page-specific meta without needing JavaScript rendering. Covers unit pages (300K+), property pages, and static pages.
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