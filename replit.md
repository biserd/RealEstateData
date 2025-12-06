# Realtors Dashboard - Real Estate Intelligence Platform

## Overview

**Realtors Dashboard** (formerly TriState Intel) is a subscription SaaS platform empowering buyers, investors, and agents to identify real estate opportunities. Currently covering New York, New Jersey, and Connecticut with nationwide expansion planned. The platform provides market intelligence, proprietary opportunity scoring, and AI-powered property analysis with a focus on transparent, data-backed insights.

**Branding:**
- Platform name: **Realtors Dashboard**
- Logo: **RD** (rounded box with primary background)
- Contact: hello@realtorsdashboard.com
- Vision: National expansion beyond tri-state area

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend uses React 18+ with TypeScript, Vite for tooling, Wouter for routing, and TanStack Query for server state management. The UI is built with Shadcn/ui components, Radix UI primitives, and Tailwind CSS, following a Linear-inspired design philosophy with light/dark mode support.

### Backend

The backend is built with Express.js and TypeScript, utilizing Node's `http` module. Authentication integrates Replit Auth (OpenID Connect) via Passport.js with PostgreSQL-backed session storage. The API is RESTful, returning JSON, and includes robust export functionalities for market reports, property dossiers, and opportunity lists. A monorepo structure is used for client and server code, with shared schemas and an `esbuild` configuration for optimized bundling.

### Database

The platform uses Drizzle ORM with PostgreSQL (Neon serverless driver) and a schema-first approach. Key data models include Users, Properties (with geographic segmentation and opportunity scoring), Sales, Market Aggregates, Coverage Matrix, Watchlists, Comps, Data Sources, and AI Chats. Properties are indexed by multiple geographic levels, and market statistics are pre-computed for performance.

### AI Integration

AI features are powered by OpenAI API (GPT-5) via Replit AI Integrations. It provides Property Analysis, Market Intelligence, and Grounded Responses. AI outputs are structured JSON, incorporate context from property and market data, include confidence scoring, and require data citations to prevent hallucinations.

### Features

-   **Market Explorer:** Provides market statistics by geography.
-   **Opportunity Screener:** Identifies underpriced properties.
-   **Up and Coming ZIPs:** Identifies trending neighborhoods based on a `trendScore` algorithm considering price appreciation, acceleration, opportunity score, and transaction volume.
-   **Property Detail Pages:** Offers in-depth property information with SEO-friendly URLs.
-   **Watchlists:** Allows users to save and monitor properties.
-   **Admin Console:** For managing platform data and settings.
-   **SEO-Friendly URLs:** Descriptive, keyword-rich URLs for better search engine visibility across all features.

## External Dependencies

### Third-Party Services

-   **Authentication:** Replit Auth (OpenID Connect)
-   **AI Services:** Replit AI Integrations (OpenAI-compatible API for GPT-5)
-   **Database:** Neon Serverless PostgreSQL

### Key NPM Packages

-   **UI Components:** `@radix-ui/*`, `cmdk`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`
-   **Forms & Validation:** `react-hook-form`, `@hookform/resolvers`, `zod`, `drizzle-zod`
-   **Data Fetching:** `@tanstack/react-query`
-   **Backend Core:** `express`, `drizzle-orm`, `passport`, `passport-local`, `express-session`, `connect-pg-simple`
-   **Build Tools:** `vite`, `esbuild`, `typescript`, `tsx`
-   **Utilities:** `date-fns`, `nanoid`, `ws`

### Development Tools

-   Replit Vite plugins
-   Drizzle Kit for database migrations
-   Custom `esbuild` scripts

### Real Data & ETL Pipeline

The platform uses real data from:
-   **Zillow Research:** Zillow Home Value Index (ZHVI)
-   **NYC Open Data PLUTO:** Property Land Use Tax Lot Output
-   **NYC Open Data Sales:** Rolling property sales records
The data is processed via ETL scripts (`server/etl/zillow-data.ts`, `server/etl/nyc-opendata.ts`, `server/etl/import-real-data.ts`) to populate the database with comprehensive property and market information.