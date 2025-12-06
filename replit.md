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

The backend is built with Express.js and TypeScript, utilizing Node's `http` module. Authentication uses **Passport Local Strategy** with username/password authentication, bcrypt password hashing (12 rounds), and PostgreSQL-backed session storage. The API is RESTful, returning JSON, and includes robust export functionalities for market reports, property dossiers, and opportunity lists. A monorepo structure is used for client and server code, with shared schemas and an `esbuild` configuration for optimized bundling.

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

-   **Authentication:** Username/password with Passport Local Strategy (bcrypt for password hashing)
-   **AI Services:** Replit AI Integrations (OpenAI-compatible API for GPT-5)
-   **Database:** Neon Serverless PostgreSQL
-   **Payments:** Stripe integration via stripe-replit-sync for subscription management

### Subscription System

The platform uses a freemium model with Stripe for payment processing:

**Tiers:**
-   **Free:** Basic market explorer, view-only opportunity screener, 3 watchlist properties, no exports
-   **Pro ($29/month or $290/year):** Unlimited features, AI assistant, Deal Memo generator, exports, unlimited watchlists/alerts

**Backend Implementation:**
-   `server/stripeClient.ts` - Stripe client initialization and sync setup
-   `server/stripeService.ts` - Checkout, billing portal, price validation services
-   `server/webhookHandlers.ts` - Webhook processing and user subscription updates
-   Webhook route registered BEFORE express.json() for raw body access

**Database Fields (users table):**
-   `subscriptionTier`: 'free' or 'pro'
-   `stripeCustomerId`: Stripe customer ID
-   `stripeSubscriptionId`: Active subscription ID
-   `subscriptionStatus`: 'active', 'canceled', 'past_due', etc.

**API Endpoints:**
-   `GET /api/subscription` - Get current user's subscription status
-   `POST /api/checkout` - Create Stripe checkout session (validates price IDs against Pro Plan)
-   `POST /api/billing-portal` - Create customer portal session
-   `GET /api/stripe/products` - List available products/prices
-   `POST /api/stripe/webhook/:uuid` - Stripe webhook handler

**Feature Gating:**
-   `requirePro` middleware gates AI features, exports, unlimited watchlists, and API access
-   Frontend uses `useSubscription` hook and `UpgradePrompt` component for gated features
-   Pro badge displayed in header for subscribed users

### Developer API Access

Pro subscribers can generate API keys to programmatically access the platform:

**Backend Implementation:**
-   `server/apiKeyService.ts` - Secure API key generation (bcrypt hashed), storage, and validation
-   `server/apiMiddleware.ts` - Bearer token validation, Pro subscription checking, rate limiting
-   Rate limits: 10 requests/second burst, 10,000 requests/day quota

**Database (api_keys table):**
-   `id`: Primary key
-   `userId`: Foreign key to users
-   `keyHash`: bcrypt hash of the API key
-   `prefix`: First 8 characters for display
-   `lastFour`: Last 4 characters for identification
-   `status`: 'active' or 'revoked'
-   `requestCount`: Usage tracking
-   `lastUsedAt`: Last usage timestamp

**External API Endpoints (Pro only):**
-   `GET /api/external/properties` - Search/filter properties with pagination
-   `GET /api/external/properties/:id` - Get single property details
-   `GET /api/external/market-stats` - Market statistics by geography
-   `GET /api/external/comps/:propertyId` - Comparable properties
-   `GET /api/external/up-and-coming` - Trending ZIP codes

**API Key Management Endpoints:**
-   `GET /api/api-keys` - Get current user's API key info
-   `POST /api/api-keys/generate` - Generate new API key (revokes existing)
-   `POST /api/api-keys/:keyId/revoke` - Revoke API key

**Frontend Pages:**
-   `/settings` - Account settings with API key management (Pro users)
-   `/developers` - Public developer documentation with code examples
-   `/api-access` - Marketing page showcasing API benefits, endpoints, and pricing
-   `/release-notes` - Public changelog with version history (v1.0.0 - v1.3.0)

### Key NPM Packages

-   **UI Components:** `@radix-ui/*`, `cmdk`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`
-   **Forms & Validation:** `react-hook-form`, `@hookform/resolvers`, `zod`, `drizzle-zod`
-   **Data Fetching:** `@tanstack/react-query`
-   **Backend Core:** `express`, `drizzle-orm`, `passport`, `passport-local`, `express-session`, `connect-pg-simple`, `bcrypt`
-   **Build Tools:** `vite`, `esbuild`, `typescript`, `tsx`
-   **Utilities:** `date-fns`, `nanoid`, `ws`

### Authentication System

The platform uses username/password authentication:
-   **Backend:** `server/auth.ts` - Passport Local Strategy with bcrypt password hashing
-   **API Endpoints:**
    -   `POST /api/auth/register` - User registration with email/password
    -   `POST /api/auth/login` - User login
    -   `POST /api/auth/logout` - Session destruction and logout
    -   `GET /api/auth/user` - Get current authenticated user
-   **Frontend Pages:**
    -   `/login` - Login page
    -   `/register` - Registration page
-   **Hook:** `client/src/hooks/useAuth.ts` - React hook for auth state and logout function

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