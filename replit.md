# Tri-State Real Estate Intelligence Platform

## Overview

This is a subscription SaaS platform that helps buyers, investors, and agents identify real estate opportunities across New York, New Jersey, and Connecticut. The platform provides market intelligence, opportunity scoring, and AI-powered property analysis with a focus on transparent, data-backed insights.

**Core Value Propositions:**
- Market pricing intelligence by ZIP code, city, and neighborhood with percentile distributions (p25/p50/p75)
- Proprietary opportunity scoring (0-100) that identifies underpriced properties with confidence metrics
- AI analysis grounded in real data with citations (no hallucinations)
- Coverage across three states with deep data in NYC and Long Island

**Target Users:**
- Retail buyers/sellers (power users)
- Small/medium investors (1-50 properties)
- Real estate agents and agent-investors
- Market analysts and researchers

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework Stack:**
- React 18+ with TypeScript
- Vite for build tooling and development server
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management and caching

**UI Component System:**
- Shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Theme system supporting light/dark modes with persistent preferences
- Design philosophy inspired by Linear (data-first, modern, professional)

**Key Design Decisions:**
- **Component Library Choice**: Shadcn/ui provides unstyled, accessible components that can be customized to match the Linear-inspired aesthetic while maintaining accessibility
- **State Management**: React Query handles all server state, eliminating need for Redux/Zustand. Local UI state uses React hooks
- **Routing Strategy**: Wouter chosen for minimal bundle size while providing all necessary routing features
- **CSS Approach**: Tailwind utility-first approach with CSS variables for theming enables rapid development while maintaining design consistency

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- HTTP server using Node's built-in `http` module
- Session-based authentication using express-session

**Authentication System:**
- Replit Auth integration (OpenID Connect)
- Passport.js with custom OpenID strategy
- PostgreSQL-backed session storage using connect-pg-simple
- Session cookies with 7-day TTL

**API Design:**
- RESTful endpoints organized by resource type
- Protected routes require authentication middleware
- Response format: JSON with consistent error handling
- Query parameters for filtering and pagination

**Export Functionality:**
The platform provides comprehensive data export capabilities:
- **Market Reports** - CSV/JSON export of market statistics by geography (`/api/export/market-report`)
- **Property Dossiers** - Full property details with comps in CSV or JSON format (`/api/export/property-dossier/:id`)
- **Opportunity Lists** - Filtered property lists for analysis (`/api/export/opportunities`)
- **Admin Data** - Coverage matrix and data source status (admin-only, `/api/export/admin-data`)

All exports include:
- Proper Content-Disposition headers for file downloads
- Loading states and success/error toast notifications
- Format selection (CSV for spreadsheet use, JSON for data integration)

**Key Design Decisions:**
- **Monorepo Structure**: Client and server code in single repository with shared schema definitions in `/shared` directory
- **Session Storage**: Database-backed sessions chosen over JWT for better security and ability to revoke sessions
- **Build Process**: Custom esbuild configuration bundles server dependencies (allowlist approach) to optimize cold start times
- **Development vs Production**: Vite dev server in development with middleware mode; static file serving in production

### Database Architecture

**ORM and Database:**
- Drizzle ORM for type-safe database operations
- PostgreSQL via Neon serverless driver with WebSocket support
- Schema-first approach with TypeScript types generated from Drizzle schemas

**Core Data Models:**

1. **Users** - Authentication and profile information
2. **Properties** - Core property data with geographic segmentation
   - Includes: address, property type, beds/baths, sqft, year built
   - Segmentation: state, ZIP, city, neighborhood
   - Scoring: opportunity score, confidence level, mispricing indicators
   
3. **Sales** - Historical transaction data linked to properties
4. **Market Aggregates** - Pre-computed statistics by geographic segment
   - Pricing percentiles (p25, p50, p75) by property segment
   - Sample counts and statistical confidence measures
   
5. **Coverage Matrix** - Tracks data quality/availability by geography
   - Levels: MarketOnly, PropertyFacts, SalesHistory, Listings, Comps
   
6. **Watchlists** - User-created property collections with alerts
7. **Comps** - Comparable properties with similarity scores and adjustments
8. **Data Sources** - ETL tracking and data lineage
9. **AI Chats** - Conversation history for AI analysis features

**Key Design Decisions:**
- **Segmentation Strategy**: Properties indexed by multiple geographic levels (state/ZIP/city/neighborhood) for flexible querying
- **Pre-aggregation**: Market statistics computed and cached to achieve <2s query times
- **Coverage Tracking**: Explicit coverage levels allow UI to set appropriate user expectations
- **Composite Types**: Enums for property types, bed/bath/year/size bands enable consistent segmentation

### AI Integration

**Provider:**
- OpenAI API via Replit AI Integrations service
- GPT-5 model (latest as of August 2025)
- JSON response format for structured outputs

**AI Features:**
1. **Property Analysis** - Context-aware analysis with market comparisons
2. **Market Intelligence** - Geographic area insights and trends
3. **Grounded Responses** - All insights backed by data citations

**Key Design Decisions:**
- **Structured Output**: JSON response format ensures parseable, consistent AI responses
- **Context Injection**: System prompts include property details, market data, and comps for grounded analysis
- **Confidence Scoring**: AI provides confidence levels (High/Medium/Low) with explanations
- **Citation Requirements**: Responses must reference specific data points to prevent hallucinations

## External Dependencies

### Third-Party Services

**Authentication:**
- Replit Auth (OpenID Connect provider)
- Used for user authentication without managing credentials

**AI Services:**
- Replit AI Integrations (OpenAI-compatible API)
- Provides GPT-5 access without separate API key management

**Database:**
- Neon Serverless PostgreSQL
- Serverless PostgreSQL with WebSocket support for connection pooling
- Accessed via `@neondatabase/serverless` driver

### Key NPM Packages

**UI Components:**
- `@radix-ui/*` - Headless UI component primitives (19 packages)
- `cmdk` - Command palette component
- `lucide-react` - Icon library
- `class-variance-authority` - Component variant styling
- `tailwind-merge` / `clsx` - Conditional className utilities

**Forms & Validation:**
- `react-hook-form` - Form state management
- `@hookform/resolvers` - Form validation resolvers
- `zod` - Schema validation
- `drizzle-zod` - Drizzle schema to Zod conversion

**Data Fetching:**
- `@tanstack/react-query` - Server state management and caching

**Backend Core:**
- `express` - Web framework
- `drizzle-orm` - Type-safe ORM
- `passport` / `passport-local` - Authentication middleware
- `express-session` - Session management
- `connect-pg-simple` - PostgreSQL session store

**Build Tools:**
- `vite` - Frontend build tool and dev server
- `esbuild` - Server bundler
- `typescript` - Type system
- `tsx` - TypeScript execution for dev/scripts

**Utilities:**
- `date-fns` - Date manipulation
- `nanoid` - ID generation
- `ws` - WebSocket support for Neon

### Development Tools

- Replit Vite plugins for runtime error overlay and dev banner
- Drizzle Kit for database migrations and schema push
- Custom build script using esbuild with dependency bundling optimization

## Real Data & ETL Pipeline

The database is populated with **real data** from public sources:

**Data Sources:**
1. **Zillow Research** - Zillow Home Value Index (ZHVI) data for NY/NJ/CT
2. **NYC Open Data PLUTO** - Property Land Use Tax lot Output for NYC
3. **NYC Open Data Sales** - Rolling property sales records

**Current Data Counts:**
- 3,881 market aggregates (2,367 ZIP codes + 1,514 cities across NY/NJ/CT)
- 2,962 properties (NYC PLUTO residential properties with real addresses)
- 19 sales records (matched via BBL codes)
- 14,436 comparable relationships
- 3 data sources tracked
- Coverage matrix: NY (full property data), NJ/CT (market aggregates only)

**ETL Scripts:**
- `server/etl/zillow-data.ts` - Downloads and parses Zillow ZHVI CSV data
- `server/etl/nyc-opendata.ts` - Fetches PLUTO and Sales data from NYC Open Data API
- `server/etl/import-real-data.ts` - Orchestrates full import pipeline

**Data Quality Notes:**
- BBL (Borough-Block-Lot) matching used for accurate sales linking
- Borough-to-county mapping: Manhattan→New York, Brooklyn→Kings, Queens→Queens, Bronx→Bronx, Staten Island→Richmond
- Conservative property attribute estimation (null for multi-unit buildings)
- Estimated values capped at $50M to prevent outliers

**To reimport real data:**
```bash
npx tsx server/etl/import-real-data.ts
```

**To use sample/mock data instead:**
```bash
npx tsx server/seed.ts
```

## Recent Fixes

**Query Parameter Fixes (Frontend):**
- Market Explorer geo search now correctly uses query parameter format (`/api/search/geo?q=query`)
- Market aggregates now correctly passes geoType and geoId as query parameters
- Opportunity Screener now correctly calls `/api/properties/screener` endpoint with proper query parameters
- Query keys use stable array format for proper React Query cache invalidation

**User Authentication:**
- Fixed upsertUser to handle unique email constraint violations gracefully
- Existing users with same email are updated instead of causing errors