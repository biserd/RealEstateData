# Tri-State Real Estate Intelligence Platform - Design Guidelines

## Design Approach

**System Foundation**: Linear-inspired modern data platform with Material Design component patterns
**Rationale**: Professional tool requiring clarity, speed, and trust. Users need to process complex data quickly and make confident decisions.

**Core Principles**:
- Data-first hierarchy: numbers and insights take precedence
- Instantaneous comprehension: critical metrics visible without scrolling
- Professional credibility: clean, trustworthy aesthetic
- Density with breathing room: information-rich but not cluttered

## Typography

**Font Stack**: Inter (primary), SF Pro (fallback)
- **Headlines (H1)**: text-4xl font-bold tracking-tight
- **Section Headers (H2)**: text-2xl font-semibold  
- **Subsections (H3)**: text-xl font-semibold
- **Data Labels**: text-sm font-medium uppercase tracking-wide
- **Metric Values**: text-3xl font-bold tabular-nums (for prices, scores)
- **Body Text**: text-base leading-relaxed
- **Supporting Text**: text-sm text-gray-600

## Layout System

**Spacing Primitives**: Use 2, 4, 6, 8, 12, 16, 20 units consistently
- **Card Padding**: p-6
- **Section Spacing**: space-y-8 or space-y-12
- **Component Gaps**: gap-4 or gap-6
- **Page Margins**: px-8 py-12

**Container Widths**:
- Dashboard pages: max-w-7xl mx-auto
- Property details: max-w-6xl mx-auto
- Forms/settings: max-w-3xl mx-auto

**Grid Patterns**:
- Market stats: 3-column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Property cards: 2-column grid (grid-cols-1 lg:grid-cols-2)
- Filters sidebar: 320px fixed width with main content flex-1

## Component Library

### Navigation
- **Top Nav**: Fixed header with logo left, search center, user menu right (h-16)
- **Secondary Nav**: Tabs for section switching (Market Explorer / Screener / Watchlist)
- **Breadcrumbs**: For drill-down paths (ZIP → Neighborhood → Property)

### Data Display Cards
- **Market Snapshot Card**: Elevated card with metric title, large value, percentile indicator, small trend sparkline
- **Property Card**: Thumbnail left (w-48), details right with opportunity score badge (top-right), price prominent, key specs below
- **Stat Card**: Icon/label top, large number center, small change indicator bottom

### Forms & Filters
- **Search Bar**: Prominent w-full max-w-2xl with autocomplete dropdown, search icon left
- **Filter Panel**: Collapsible sections with checkboxes, range sliders, radio groups
- **Segment Selector**: Horizontal pill buttons for property type, beds/baths (rounded-full px-4 py-2)

### Data Tables & Lists
- **Comp Table**: Sticky header, alternating row backgrounds, sortable columns, right-aligned numbers
- **Opportunity Feed**: List with score badges, 3-line preview, hover state showing quick actions
- **Coverage Matrix**: Color-coded cells showing data quality levels

### Interactive Elements
- **Opportunity Score**: Circular progress indicator (0-100) with confidence badge below
- **Price Distribution Chart**: Horizontal bar showing p25/p50/p75 with property position marker
- **Map Integration**: Full-height sidebar layout (map 60%, details 40% on desktop)

### Modals & Overlays
- **Property Deep Dive**: Slide-over panel (w-1/2) from right with close button, scrollable content
- **AI Assistant**: Bottom-right chat bubble expanding to modal (max-w-2xl)
- **Export Dialog**: Centered modal with format options and preview

### Alerts & Notifications
- **Toast Notifications**: Top-right, auto-dismiss, icon + message + action link
- **Alert Badges**: Pill-shaped counters on watchlist items
- **Confidence Indicators**: "High/Med/Low" with corresponding badge styles

### Empty States & Loading
- **No Results**: Icon, heading, suggestion text, primary action button
- **Skeleton Loaders**: Match component shapes during data fetch
- **Coverage Warning**: Alert banner when viewing thin-data areas

## Page Layouts

### Landing Page
- **Hero**: Full-width section (h-screen) with search bar overlay, subtle map background
- **Value Props**: 3-column feature cards with icons
- **Coverage Map**: Interactive tri-state map showing data depth
- **Pricing Tiers**: 3-column comparison table
- **CTA Section**: Centered heading, subtext, primary button

### Market Explorer
- **Search Header**: Prominent location search with filters button
- **Metric Cards Grid**: 3-4 key stats across top (median price, $/sqft, volume, trend)
- **Segment Selector**: Horizontal scrollable chips for filtering
- **Distribution Chart**: Full-width visualization below metrics
- **Recent Activity**: Table of recent sales/listings

### Opportunity Screener
- **Filters Sidebar**: Left 320px with collapsible sections
- **Results Header**: Count + sort dropdown + view toggle (list/grid)
- **Ranked Feed**: Scrollable list with infinite load
- **Quick View Panel**: Right slide-over on item click

### Property Detail
- **Hero Section**: Property image gallery + key facts (2-column split)
- **Tabs Navigation**: Pricing / Comps / Signals / AI Analysis
- **Pricing Tab**: Expected value range, segment comparison, score breakdown
- **Comps Tab**: Filterable table with similarity scores and adjustments
- **Signals Tab**: Alternative data cards (permits, violations, transit)
- **AI Tab**: Chat interface with grounded responses + citations

### Admin Console
- **Dashboard Grid**: Coverage matrix heatmap, ETL status cards, quality metrics
- **Data Catalog Table**: Sortable/filterable list of sources with metadata
- **Monitoring Graphs**: Time-series charts for freshness and completeness

## Images

**Hero Image**: Use abstract aerial city/suburban view (NYC skyline transitioning to residential) as background with overlay gradient for search bar legibility

**Property Cards**: Thumbnail images (aspect-ratio-4/3) with fallback to property type icon

**Empty States**: Simple illustration or icon representing the missing content (no properties, no data coverage)

**Coverage Map**: Interactive choropleth showing data depth by county/ZIP

## Animations

Use sparingly for feedback only:
- **Micro-interactions**: Button press (scale-95), card hover (shadow-lg transition)
- **Loading States**: Pulse animation on skeletons
- **Score Reveal**: Circular progress fills smoothly when property loads
- **Transitions**: Fade/slide for modal entrance/exit (200ms)

No scroll-triggered animations, parallax, or decorative motion.