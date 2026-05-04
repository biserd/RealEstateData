# Realtors Dashboard - Real Estate Intelligence Platform

## Overview

Realtors Dashboard is a subscription SaaS platform for buyers, investors, and agents to identify real estate opportunities. It provides market intelligence, proprietary opportunity scoring, and AI-powered property analysis for New York, New Jersey, and Connecticut, with plans for nationwide expansion. The platform focuses on transparent, data-backed insights to empower users.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend uses React 18+, TypeScript, Vite, Wouter for routing, and TanStack Query. UI components are built with Shadcn/ui, Radix UI primitives, and Tailwind CSS, featuring a Linear-inspired design with light/dark mode.

### Backend

The backend is built with Express.js and TypeScript on Node.js. It features a RESTful JSON API, robust export functionalities, and a monorepo structure. Authentication uses Passport Local Strategy with bcrypt for hashing and PostgreSQL for session storage.

### Database

The platform uses Drizzle ORM with PostgreSQL (Neon serverless driver) and a schema-first approach. Key data models include Users, Properties (with geographic segmentation and opportunity scoring), Sales, Market Aggregates, and AI Chats. Properties are geographically indexed, and market statistics are pre-computed.

### AI Integration

AI features for Property Analysis, Market Intelligence, and Grounded Responses are powered by OpenAI API (GPT-5) via Replit AI Integrations. AI outputs are structured JSON, incorporate contextual data, include confidence scoring, and provide data citations to prevent hallucinations.

### Features

-   **Market Explorer:** Provides market statistics by geography.
-   **Opportunity Screener:** Identifies underpriced properties.
-   **Up and Coming ZIPs:** Identifies trending neighborhoods.
-   **Property Detail Pages:** Offers in-depth property information with SEO-friendly URLs.
-   **Watchlists:** Allows users to save and monitor properties.
-   **Admin Console:** For managing platform data and settings.
-   **Tools Pages:** Includes Property Comparison, Neighborhood Report Cards, and an Investment Calculator.
-   **Internal Linking & Browse Pages:** Provides SEO-friendly geographic navigation at state and city levels.

### Real Data & ETL Pipeline

The platform integrates real estate data from multiple public sources (NYC Open Data, CT Open Data, NJ Properties, Zillow Research, NYC Geoclient API). A comprehensive ETL script handles data refresh, signal computation, market aggregate refresh, and data source updates. Historical sales data is backfilled from NYC Open Data.

### Condo Units Data

A `condo_units` table contains over 300K NYC condo unit records, enabling unit-level search and analytics. A multi-tier matching system links sales data to individual condo units.

### SEO & Sitemap System

The platform implements comprehensive SEO with server-side meta tags, JSON-LD structured data, noscript SEO content for crawlers, SEO-friendly unit URLs, paginated sitemaps, a sitemap index, and legacy URL support with redirection.

### Performance

-   **Compression:** Express `compression` middleware gzips HTML/JSON/XML responses (skips images/video/audio).
-   **Sitemap caching:** All sitemap and `robots.txt` routes set public `Cache-Control` with `stale-while-revalidate`.
-   **Code splitting:** Routes other than Landing/Home/Login are loaded via `React.lazy` + `Suspense` to keep the initial bundle small.
-   **Maps on demand:** `MapProvider` is mounted inside `<PropertyMap>` and the activated branch of `<InteractiveStreetView>` instead of the app root, so the Google Maps JS bundle only loads on routes that visibly render a map. Static map and Street View images are served through the on-disk proxy at `/api/img/staticmap` and `/api/img/streetview`.

## External Dependencies

-   **AI Services:** Replit AI Integrations (OpenAI-compatible API for GPT-5)
-   **Database:** Neon Serverless PostgreSQL
-   **Payments:** Stripe (via stripe-replit-sync) for subscription management and multi-app routing.
-   **Authentication:** Passport Local Strategy (bcrypt for password hashing)
-   **Geocoding:** NYC Geoclient API
-   **Market Data:** Zillow Research, FRED MORTGAGE30US series (for live mortgage rates)