import { db } from './db';
import { sql } from 'drizzle-orm';
import { GUIDES, getGuide, type Guide } from '@shared/guides';

interface PageMeta {
  title: string;
  description: string;
  ogType: string;
  canonicalPath: string;
  h1?: string;
  bodyHtml?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const SITE_NAME = 'Realtors Dashboard';
const SITE_URL = 'https://realtorsdashboard.com';

const SOFTWARE_APPLICATION_JSONLD: Record<string, any> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Real Estate Intelligence',
  operatingSystem: 'Web',
  url: SITE_URL,
  description:
    'Real estate market intelligence platform with proprietary opportunity scoring, AI-powered property analysis, and verified transaction data for NY, NJ, and CT.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: 0, priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro', price: 29, priceCurrency: 'USD' },
  ],
  aggregateRating: undefined,
};

const PRODUCT_PRICING_JSONLD: Record<string, any> = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: `${SITE_NAME} Subscription`,
  description:
    'Subscription tiers for Realtors Dashboard. Free for browsing, Pro for AI deal memos, exports, and developer API, Premium for portfolio tools.',
  brand: { '@type': 'Brand', name: SITE_NAME },
  url: `${SITE_URL}/pricing`,
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Pro Monthly',
      price: 29,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Premium Monthly',
      price: 99,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
  ],
};

const FAQ_JSONLD: Record<string, any> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Realtors Dashboard?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Realtors Dashboard is an AI-powered real estate market intelligence platform that helps buyers, investors, and agents find undervalued properties using verified public-record transactions, proprietary opportunity scoring, and AI analysis.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which areas do you cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'New York, New Jersey, and Connecticut today, including 300K+ verified NYC condo unit records. Nationwide expansion is in progress.',
      },
    },
    {
      '@type': 'Question',
      name: 'How accurate is your data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Data comes from authoritative public sources including NYC Open Data (PLUTO, rolling sales, ACRIS), Connecticut and New Jersey property records, Zillow Research, and FRED. Every page cites its sources.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the Opportunity Score?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A 0-100 rating that estimates how underpriced a property is relative to verified comparable sales. Higher scores indicate a better price-to-comp position. Each score has a confidence band based on the size and tightness of the comp pool.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Realtors Dashboard free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, we offer a free tier for browsing properties and basic market data. Pro at $59/month unlocks AI deal memos, full comp tables, exports, and developer API access. Premium adds portfolio tools.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I cancel anytime?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Subscriptions can be canceled anytime from account settings, and we offer a 14-day money-back guarantee on paid plans.',
      },
    },
  ],
};

const DATASET_JSONLD: Record<string, any> = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Realtors Dashboard Real Estate Dataset',
  description:
    'Property records, verified recorded sales, market aggregates, and opportunity scores for NY, NJ, and CT, including 300K+ NYC condo units. Available via the Realtors Dashboard Developer API.',
  url: `${SITE_URL}/developers`,
  creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  spatialCoverage: [
    { '@type': 'Place', name: 'New York' },
    { '@type': 'Place', name: 'New Jersey' },
    { '@type': 'Place', name: 'Connecticut' },
  ],
  isAccessibleForFree: false,
  license: `${SITE_URL}/terms`,
  keywords: [
    'real estate',
    'property records',
    'condo sales',
    'opportunity score',
    'market intelligence',
  ],
};

const HOMEPAGE_BODY_HTML = `
  <p><strong>Transparent opportunity scoring for NYC and tri-state real estate.</strong> Realtors Dashboard is verified sales intelligence for New York, New Jersey, and Connecticut. Every Opportunity Score is built from public-record transactions, shows its inputs, and links the verified comps behind it - no black-box AVMs, no blended estimates.</p>

  <p><em>Opportunity intelligence for investors, agents, analysts, and PropTech teams.</em></p>

  <h2>What you can do</h2>
  <ul>
    <li><strong>Search and screen properties:</strong> Filter 199,500+ properties across NY, NJ, and CT by price, opportunity score, ZIP, property type, and more. <a href="/investment-opportunities">Open the Opportunity Screener</a>.</li>
    <li><strong>Read the market:</strong> Pre-computed market statistics by state, county, city, ZIP, and neighborhood, including median price, $/sqft, sales volume, and trends. <a href="/market-intelligence">Open Market Intelligence</a>.</li>
    <li><strong>Spot trends early:</strong> ZIP-level momentum scoring identifies neighborhoods with rising values before they hit mainstream coverage. <a href="/up-and-coming">See up &amp; coming ZIP codes</a>.</li>
    <li><strong>Run the numbers:</strong> Side-by-side property comparison, neighborhood report cards, and a full investment calculator with cap rate, cash-on-cash, DSCR, and BRRRR scenarios. <a href="/calculator">Open the Investment Calculator</a>.</li>
    <li><strong>Build on our data:</strong> RESTful Developer API for properties, market stats, comps, and trending ZIPs. <a href="/developers">Read the API docs</a>.</li>
  </ul>

  <h2>Why people choose us</h2>
  <ul>
    <li><strong>Verified data, not blended estimates:</strong> Recorded sale prices are sourced from named public agencies (ACRIS, county records, NYC Open Data) and shown separately from any model-produced estimates.</li>
    <li><strong>Transparent methodology:</strong> The <a href="/methodology/opportunity-score">Opportunity Score</a> is explained in detail, including inputs, weighting, and confidence bands. Every score links the comps it was built from.</li>
    <li><strong>No agent funnel:</strong> We are not a brokerage. There is no sell-side conflict of interest in how properties are scored or surfaced. <a href="/comparisons">See how we compare to Zillow, Redfin, and PropStream</a>.</li>
    <li><strong>Honest, transparent pricing:</strong> Free tier for browsing, Pro at $59/month for AI deal memos and exports, Premium for portfolio tools. <a href="/pricing">See pricing</a>.</li>
  </ul>

  <h2>Data sources we cite</h2>
  <ul>
    <li>NYC Open Data: PLUTO, rolling sales, ACRIS recorded transactions, condo declarations</li>
    <li>Connecticut Open Data and New Jersey property records</li>
    <li>Zillow Research ZIP-level housing series</li>
    <li>FRED MORTGAGE30US for live 30-year mortgage rates</li>
    <li>NYC Geoclient API for parcel-level geocoding</li>
  </ul>
  <p><a href="/methodology/data-coverage">Read the full data coverage page</a> for source details and refresh cadence, or read about <a href="/methodology/verified-vs-estimates">how we separate verified sales from estimates</a>.</p>

  <h2>How teams use Realtors Dashboard</h2>
  <ul>
    <li><strong>Investor case study (Multi-family Investor, Northern NJ):</strong> "I filter the Opportunity Screener for Bronx and Hudson County multi-family scoring 75+ with verified comps in the last 12 months. Underwrote 6 deals in week one and closed on a 6-unit at $42K under the comp median. Recouped the annual Pro fee in two weeks."</li>
    <li><strong>Buyer-agent workflow (Buyer's Agent, NYC):</strong> "Every morning I run a saved screener over my buyer's target ZIPs in Brooklyn and Queens, export the top 20 to CSV, then pull the Neighborhood Report Card for each shortlist. Cuts what used to be a 3-hour comp pull down to 20 minutes per buyer."</li>
    <li><strong>API integration (Head of Data, PropTech startup, CT):</strong> "We pull /api/properties and /api/market/stats nightly into our internal valuation model and trace every verified sale back to ACRIS. The 10K req/day Pro quota covers our entire NJ/CT analyst team without a custom enterprise contract."</li>
  </ul>

  <h2>Guides and playbooks</h2>
  <p>Practical, NYC-focused guides on how to actually use this data:</p>
  <ul>
    <li><a href="/guides/how-to-find-underpriced-condos-nyc">How to Find Underpriced NYC Condos Before Anyone Else</a></li>
    <li><a href="/guides/what-is-an-opportunity-score">What Is an Opportunity Score in Real Estate?</a></li>
    <li><a href="/guides/nyc-condo-market-2026">NYC Condo Market 2026: Prices, Trends, and Where to Buy</a></li>
    <li><a href="/guides/verified-sales-vs-estimates-investors">Verified Sales vs Estimated Values: What Investors Should Trust</a></li>
    <li><a href="/guides/real-estate-api-for-developers">Real Estate API for Developers</a></li>
    <li><a href="/guides/nyc-comparable-sales-investor-guide">Understanding NYC Comparable Sales</a></li>
    <li><a href="/guides/up-and-coming-zip-codes-nj-ct">Up-and-Coming ZIP Codes in NJ and CT</a></li>
    <li><a href="/guides/price-per-square-foot-nyc">Price Per Square Foot in NYC: When It Misleads You</a></li>
  </ul>
  <p><a href="/guides">Browse all guides</a>.</p>

  <h2>Get started</h2>
  <p>Browse the platform free, or <a href="/pricing">start a Pro plan at $59/month</a> for AI deal memos, full comp exports, watchlist alerts, and developer API access. <a href="/faq">Read the FAQ</a> or <a href="/contact">contact us</a> with any questions.</p>
`;

const DEFAULT_META: PageMeta = {
  title: 'Realtors Dashboard - Real Estate Market Intelligence',
  description: 'Find underpriced properties and understand market pricing with AI-powered real estate intelligence. Currently covering NY, NJ, CT with more states coming soon.',
  ogType: 'website',
  canonicalPath: '/',
  h1: 'Real Estate Market Intelligence for NY, NJ, and CT',
  bodyHtml: HOMEPAGE_BODY_HTML,
  jsonLd: SOFTWARE_APPLICATION_JSONLD,
};

const GUIDES_INDEX_JSONLD: Record<string, any> = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Realtors Dashboard Guides',
  itemListElement: GUIDES.map((g, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${SITE_URL}/guides/${g.slug}`,
    name: g.title,
  })),
};

const STATIC_PAGES: Record<string, PageMeta> = {
  '/guides': {
    title: 'Guides - Realtors Dashboard',
    description:
      'Investor playbooks, concept explainers, market reports, and developer guides for NYC and tri-state real estate. Built on verified sales and the Opportunity Score methodology.',
    ogType: 'website',
    canonicalPath: '/guides',
    h1: 'Real estate guides for investors, agents, and developers',
    bodyHtml: `
      <p>Practical guides built on verified ACRIS sales, the Opportunity Score methodology, and the data we publish across NY, NJ, and CT.</p>
      <ul>
        ${GUIDES.map(
          (g) =>
            `<li><a href="/guides/${g.slug}"><strong>${escapeHtml(g.title)}</strong></a> - ${escapeHtml(g.metaDescription)}</li>`,
        ).join('')}
      </ul>
    `,
    jsonLd: GUIDES_INDEX_JSONLD,
  },
  '/market-intelligence': {
    title: 'Market Intelligence - Realtors Dashboard',
    description: 'Explore real estate market statistics by geography. Median prices, sales volume, price trends, and inventory data for NY, NJ, and CT.',
    ogType: 'website',
    canonicalPath: '/market-intelligence',
    h1: 'Market Intelligence',
    bodyHtml: '<p>Pre-computed market statistics by state, county, city, ZIP, and neighborhood. Median prices, $/sqft, sales volume, and trend data updated regularly.</p>',
  },
  '/investment-opportunities': {
    title: 'Investment Opportunities - Realtors Dashboard',
    description: 'Find underpriced properties with AI-powered opportunity scoring. Identify deals based on verified sale prices and market comparisons.',
    ogType: 'website',
    canonicalPath: '/investment-opportunities',
    h1: 'Investment Opportunities',
    bodyHtml: '<p>Filter underpriced properties by state, price, opportunity score, and property type. Each result is scored 0-100 against verified comparable sales.</p>',
  },
  '/up-and-coming': {
    title: 'Up & Coming ZIP Codes - Realtors Dashboard',
    description: 'Discover trending neighborhoods with rising property values. Data-driven analysis of emerging real estate markets in the Tri-State area.',
    ogType: 'website',
    canonicalPath: '/up-and-coming',
    h1: 'Up & Coming ZIP Codes',
    bodyHtml: '<p>Trending neighborhoods ranked by a momentum score that combines price appreciation, sales velocity, and new permit activity.</p>',
  },
  '/pricing': {
    title: 'Pricing - Realtors Dashboard',
    description: 'Choose the plan that fits your needs. Free, Pro, and Premium tiers with AI-powered property analysis, deal memos, and market intelligence.',
    ogType: 'website',
    canonicalPath: '/pricing',
    h1: 'Pricing',
    bodyHtml: `
      <p>Three transparent tiers. Cancel anytime. 14-day money-back guarantee on paid plans.</p>
      <ul>
        <li><strong>Free:</strong> Browse properties, view market data, and run basic searches. Limited daily search volume.</li>
        <li><strong>Pro - $59/month:</strong> Unlimited searches, AI deal memos with citations, full comparable-sales tables, CSV/JSON exports, watchlist alerts, and Developer API access (10K requests/day).</li>
        <li><strong>Premium - $149/month:</strong> Everything in Pro plus portfolio tracking, bulk CSV exports, branded client reports, and higher API quota.</li>
      </ul>
    `,
    jsonLd: PRODUCT_PRICING_JSONLD,
  },
  '/about': {
    title: 'About - Realtors Dashboard',
    description: 'Learn about Realtors Dashboard, a real estate intelligence platform providing transparent, data-backed insights for buyers, investors, and agents.',
    ogType: 'website',
    canonicalPath: '/about',
    h1: 'About Realtors Dashboard',
    bodyHtml: '<p>Realtors Dashboard is a real estate intelligence platform that turns public records, MLS-adjacent data, and verified transactions into transparent, actionable insights.</p>',
  },
  '/faq': {
    title: 'FAQ - Realtors Dashboard',
    description: 'Frequently asked questions about Realtors Dashboard, our data sources, scoring methodology, and subscription plans.',
    ogType: 'website',
    canonicalPath: '/faq',
    h1: 'Frequently Asked Questions',
    bodyHtml: `
      <p>Common questions about Realtors Dashboard, our data sources, the Opportunity Score, AI features, pricing, and billing. Browse the answers below or <a href="/contact">contact us</a>.</p>
      <h2>Coverage and data</h2>
      <p>We cover New York, New Jersey, and Connecticut today, including 300K+ verified NYC condo unit records. Data comes from named public sources and is refreshed on a regular ETL schedule. <a href="/methodology/data-coverage">See the full coverage page</a>.</p>
      <h2>Opportunity Score</h2>
      <p>The Opportunity Score is a 0-100 rating that estimates how underpriced a property is relative to verified comparable sales. <a href="/methodology/opportunity-score">Read how it is computed</a>.</p>
      <h2>Pricing</h2>
      <p>Free tier for browsing. Pro at $59/month for AI deal memos, exports, and the developer API. Premium for portfolio tools. <a href="/pricing">See pricing</a>.</p>
    `,
    jsonLd: FAQ_JSONLD,
  },
  '/contact': {
    title: 'Contact Us - Realtors Dashboard',
    description: 'Get in touch with the Realtors Dashboard team. Questions about our platform, data, or subscription plans.',
    ogType: 'website',
    canonicalPath: '/contact',
    h1: 'Contact Us',
  },
  '/terms': {
    title: 'Terms of Service - Realtors Dashboard',
    description: 'Terms of service for using the Realtors Dashboard platform.',
    ogType: 'website',
    canonicalPath: '/terms',
    h1: 'Terms of Service',
  },
  '/privacy': {
    title: 'Privacy Policy - Realtors Dashboard',
    description: 'Privacy policy for the Realtors Dashboard platform. How we collect, use, and protect your data.',
    ogType: 'website',
    canonicalPath: '/privacy',
    h1: 'Privacy Policy',
  },
  '/developers': {
    title: 'Developer API - Realtors Dashboard',
    description: 'Access real estate data programmatically with the Realtors Dashboard API. Properties, market stats, comps, and trending ZIP codes.',
    ogType: 'website',
    canonicalPath: '/developers',
    h1: 'Developer API',
    bodyHtml: '<p>RESTful JSON API with endpoints for properties, market statistics, comparable sales, and trending ZIP codes. Authenticated with x-api-key headers. 10 requests/second burst, 10,000 requests/day quota.</p>',
    jsonLd: DATASET_JSONLD,
  },
  '/api-access': {
    title: 'API Access - Manage Your Keys | Realtors Dashboard',
    description: 'Generate and manage API keys for the Realtors Dashboard Developer API. Pro and Premium subscribers only.',
    ogType: 'website',
    canonicalPath: '/api-access',
    h1: 'API Access',
  },
  '/release-notes': {
    title: 'Release Notes - Realtors Dashboard',
    description: 'Latest updates, new features, and improvements to the Realtors Dashboard real estate intelligence platform.',
    ogType: 'website',
    canonicalPath: '/release-notes',
    h1: 'Release Notes',
  },
  '/compare': {
    title: 'Property Comparison Tool - Realtors Dashboard',
    description: 'Compare up to 4 properties side-by-side. Analyze price, opportunity score, beds, baths, square footage, and more across NY, NJ, and CT listings.',
    ogType: 'website',
    canonicalPath: '/compare',
    h1: 'Property Comparison',
    bodyHtml: '<p>Compare up to 4 properties side-by-side on price, $/sqft, beds, baths, year built, opportunity score, and location.</p>',
  },
  '/calculator': {
    title: 'Investment Property Calculator - Realtors Dashboard',
    description: 'Free rental property analyzer. Calculate cap rate, cash-on-cash return, cash flow, GRM, DSCR, break-even occupancy, and 5-year ROI in seconds.',
    ogType: 'website',
    canonicalPath: '/calculator',
    h1: 'Investment Property Calculator',
    bodyHtml: '<p>Real-time rental property analyzer with Standard, Refinance, and BRRRR scenarios. Outputs cap rate, cash-on-cash, cash flow, GRM, DSCR, break-even occupancy, and a 30-year projection chart.</p>',
  },
  '/methodology/opportunity-score': {
    title: 'Opportunity Score Explained - How We Rate Properties | Realtors Dashboard',
    description: 'Inside our 0-100 Opportunity Score: the inputs, weights, comp methodology, and confidence bands we use to flag underpriced properties in NY, NJ, and CT.',
    ogType: 'article',
    canonicalPath: '/methodology/opportunity-score',
    h1: 'Opportunity Score Explained',
    bodyHtml: `
      <p>The Opportunity Score is a 0-100 rating that estimates how underpriced a property is relative to verified comparable sales and current market context. It is built from public records and verified transactions only - never from listing-derived estimates alone.</p>
      <h2>Inputs</h2>
      <ul>
        <li><strong>Price vs comps:</strong> median $/sqft and median price for tightly matched comparable transactions in the same ZIP and property type.</li>
        <li><strong>Recency:</strong> trades within the last 12 months are weighted more heavily than older transactions.</li>
        <li><strong>Property fit:</strong> square footage, bed/bath count, year built, and unit classification narrow the comp pool before pricing is computed.</li>
        <li><strong>Market trend:</strong> ZIP-level momentum (price appreciation, sales velocity) adjusts the expected price band for the current quarter.</li>
      </ul>
      <h2>Confidence bands</h2>
      <p>Every score is paired with a confidence band that reflects the size and tightness of the comp pool. A score from a thin comp pool is shown with a lower confidence weight so users can discount it appropriately.</p>
      <p>Related: <a href="/methodology/verified-vs-estimates">Verified Sales vs Estimates</a>, <a href="/methodology/data-coverage">Data Coverage</a>.</p>
    `,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Opportunity Score Explained',
      description: 'How the Realtors Dashboard 0-100 Opportunity Score is computed, including inputs, weighting, and confidence bands.',
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      url: `${SITE_URL}/methodology/opportunity-score`,
    },
  },
  '/methodology/data-coverage': {
    title: 'Data Coverage - States, Sources, and Refresh Cadence | Realtors Dashboard',
    description: 'What we cover, where the data comes from, and how often it refreshes. Verified NYC condo sales, statewide property records for NY, NJ, and CT, and ZIP-level market aggregates.',
    ogType: 'article',
    canonicalPath: '/methodology/data-coverage',
    h1: 'Data Coverage',
    bodyHtml: `
      <p>Realtors Dashboard combines verified public records, official open-data feeds, and reference market data to build a transparent view of every covered property.</p>
      <h2>Geographic coverage</h2>
      <ul>
        <li><strong>New York:</strong> NYC plus statewide coverage, including 300K+ verified condo unit records.</li>
        <li><strong>New Jersey:</strong> statewide property records with city, ZIP, and county aggregates.</li>
        <li><strong>Connecticut:</strong> statewide property records with city, ZIP, and county aggregates.</li>
        <li><strong>National expansion:</strong> additional states are being onboarded.</li>
      </ul>
      <h2>Source data</h2>
      <ul>
        <li>NYC Open Data: PLUTO, rolling sales, ACRIS recorded transactions, condo declarations.</li>
        <li>Connecticut Open Data and New Jersey property records.</li>
        <li>Zillow Research ZIP-level housing series.</li>
        <li>FRED MORTGAGE30US for live 30-year mortgage rates.</li>
        <li>NYC Geoclient API for parcel-level geocoding.</li>
      </ul>
      <p>Related: <a href="/methodology/opportunity-score">Opportunity Score Explained</a>, <a href="/methodology/verified-vs-estimates">Verified Sales vs Estimates</a>.</p>
    `,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Data Coverage',
      description: 'Geographic coverage, source datasets, and refresh cadence for the Realtors Dashboard real estate platform.',
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      url: `${SITE_URL}/methodology/data-coverage`,
    },
  },
  '/methodology/verified-vs-estimates': {
    title: 'Verified Sales vs Estimates - How We Show Both | Realtors Dashboard',
    description: 'We separate verified recorded transactions from automated valuation estimates so users can see the difference. Here is exactly how each is sourced, labeled, and used.',
    ogType: 'article',
    canonicalPath: '/methodology/verified-vs-estimates',
    h1: 'Verified Sales vs Estimates',
    bodyHtml: `
      <p>Most real estate sites blend recorded sale prices and algorithmic estimates into a single number. We do not. Verified sales and estimates serve different purposes, and on every page they are sourced, labeled, and presented separately.</p>
      <h2>What counts as a verified sale</h2>
      <p>A verified sale is a recorded property transfer drawn from official public records. For NYC that means ACRIS recorded deeds and the rolling sales file. For New Jersey and Connecticut that means county and statewide recorded sales feeds.</p>
      <h2>What counts as an estimate</h2>
      <p>An estimate is a model-produced value when a verified recent sale is not available. Estimates are clearly labeled and only used to provide a price band when verified sales are sparse.</p>
      <h2>Why this matters for scoring</h2>
      <p>The Opportunity Score is computed against verified comparable sales, not against estimates. This avoids the circular logic of comparing one estimate to another estimate.</p>
      <p>Related: <a href="/methodology/opportunity-score">Opportunity Score Explained</a>, <a href="/methodology/data-coverage">Data Coverage</a>.</p>
    `,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Verified Sales vs Estimates',
      description: 'How Realtors Dashboard separates verified recorded sales from automated valuation estimates.',
      author: { '@type': 'Organization', name: SITE_NAME },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      url: `${SITE_URL}/methodology/verified-vs-estimates`,
    },
  },
  '/comparisons': {
    title: 'Realtors Dashboard vs Zillow, Redfin, and PropStream - Honest Comparison',
    description: 'Side-by-side comparison of Realtors Dashboard with Zillow, Redfin, and PropStream. See where verified data, opportunity scoring, and transparent pricing make a difference.',
    ogType: 'website',
    canonicalPath: '/comparisons',
    h1: 'How Realtors Dashboard compares',
    bodyHtml: `
      <p>Honest, side-by-side comparison of Realtors Dashboard with the tools real estate buyers, investors, and agents most often ask about - including the things other tools do better than we do.</p>
      <h2>Realtors Dashboard vs Zillow</h2>
      <p>Zillow is a consumer search portal with the Zestimate as the headline price. We separate verified recorded sales from automated estimates, publish a proprietary Opportunity Score with confidence bands, and cover NYC at the unit level (300K+ condo units). Both have free consumer search.</p>
      <h2>Realtors Dashboard vs Redfin</h2>
      <p>Redfin is a brokerage with an in-house agent funnel. We are not a brokerage, so there is no sell-side conflict in how properties are scored. We publish neighborhood report cards (development, safety, transit, amenities, flood, building health) and a developer API.</p>
      <h2>Realtors Dashboard vs PropStream</h2>
      <p>PropStream focuses on owner skip tracing and direct-mail list pulling for wholesalers. We are a market intelligence and screening platform with transparent self-serve pricing (Free, Pro $59/month, Premium $149/month) and AI deal memos with citations. PropStream is stronger for cold-lead generation; we are stronger for finding and underwriting deals.</p>
      <p><a href="/pricing">See pricing</a> or <a href="/methodology/opportunity-score">read the methodology</a>.</p>
    `,
  },
};

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

const STATE_NAMES: Record<string, string> = {
  NY: 'New York',
  NJ: 'New Jersey',
  CT: 'Connecticut',
};

async function getUnitMeta(unitBbl: string): Promise<PageMeta | null> {
  try {
    const unitRes = await db.execute(sql`
      SELECT cu.unit_bbl, cu.base_bbl, cu.unit_designation, cu.unit_display_address,
             cu.building_display_address, cu.borough, cu.zip_code, cu.slug,
             cu.latitude, cu.longitude, cu.beds, cu.baths, cu.sqft, cu.unit_type_hint
      FROM condo_units cu
      WHERE cu.unit_bbl = ${unitBbl} OR cu.slug = ${unitBbl}
      LIMIT 1
    `);
    if (unitRes.rows.length === 0) return null;
    const row = unitRes.rows[0] as any;

    // Pull related context in parallel for a single round-trip-equivalent payload.
    const [unitSalesRes, buildingSalesRes, siblingUnitsRes, buildingStatsRes] = await Promise.all([
      db.execute(sql`
        SELECT sale_price, sale_date FROM sales
        WHERE unit_bbl = ${row.unit_bbl}
        ORDER BY sale_date DESC LIMIT 8
      `),
      db.execute(sql`
        SELECT s.sale_price, s.sale_date, s.raw_apt_number, s.unit_bbl,
               cu.slug, cu.unit_designation
        FROM sales s
        LEFT JOIN condo_units cu ON cu.unit_bbl = s.unit_bbl
        WHERE s.base_bbl = ${row.base_bbl}
          AND s.unit_bbl IS DISTINCT FROM ${row.unit_bbl}
          AND s.sale_price >= 100000
        ORDER BY s.sale_date DESC LIMIT 8
      `),
      db.execute(sql`
        SELECT cu.unit_bbl, cu.unit_designation, cu.slug, cu.beds, cu.baths, cu.sqft
        FROM condo_units cu
        WHERE cu.base_bbl = ${row.base_bbl}
          AND cu.unit_bbl != ${row.unit_bbl}
          AND cu.unit_type_hint = 'residential'
        ORDER BY cu.unit_designation NULLS LAST
        LIMIT 6
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE sale_price >= 100000)::int AS sale_count,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price)
            FILTER (WHERE sale_price >= 100000) AS median_price,
          MIN(sale_price) FILTER (WHERE sale_price >= 100000) AS min_price,
          MAX(sale_price) FILTER (WHERE sale_price >= 100000) AS max_price,
          MAX(sale_date) FILTER (WHERE sale_price >= 100000) AS last_sale
        FROM sales
        WHERE base_bbl = ${row.base_bbl}
          AND sale_date >= NOW() - INTERVAL '36 months'
      `),
    ]);

    const unitSales = unitSalesRes.rows as any[];
    const buildingSales = buildingSalesRes.rows as any[];
    const siblings = siblingUnitsRes.rows as any[];
    const stats = (buildingStatsRes.rows[0] || {}) as any;

    const lastSale = unitSales[0];
    const priceNum = lastSale?.sale_price ? Number(lastSale.sale_price) : null;
    const price = priceNum ? formatPrice(priceNum) : null;
    const borough = row.borough ? titleCase(row.borough) : '';
    const zip = row.zip_code || '';
    const buildingAddr = row.building_display_address ? titleCase(row.building_display_address) : 'Building';
    const displayAddress = row.unit_display_address
      ? titleCase(row.unit_display_address)
      : `${buildingAddr}${row.unit_designation ? `, ${row.unit_designation}` : ''}`;

    const locationParts = [borough, zip].filter(Boolean).join(' ');
    const title = `${displayAddress}${locationParts ? ` - ${locationParts}` : ''} | Realtors Dashboard`;

    const beds = row.beds ? Number(row.beds) : null;
    const baths = row.baths ? Number(row.baths) : null;
    const sqftNum = row.sqft ? Number(row.sqft) : null;
    const medianPrice = stats.median_price ? Number(stats.median_price) : null;
    const buildingSaleCount = stats.sale_count ? Number(stats.sale_count) : 0;

    const descParts: string[] = [];
    if (price) descParts.push(`last sold ${price}`);
    if (beds) descParts.push(`${beds} bed${beds === 1 ? '' : 's'}`);
    if (baths) descParts.push(`${baths} bath${baths === 1 ? '' : 's'}`);
    if (sqftNum) descParts.push(`${sqftNum.toLocaleString()} sqft`);
    if (medianPrice && buildingSaleCount >= 3) {
      descParts.push(`building median ${formatPrice(medianPrice)} (${buildingSaleCount} recent sales)`);
    }
    let description = `${displayAddress}${locationParts ? ` in ${locationParts}` : ''}. `;
    description += descParts.length
      ? descParts.join(', ') + '. '
      : '';
    description += 'Verified ACRIS sale history, opportunity score, building comps, and market context.';
    description = description.slice(0, 300);

    // Build the noscript body — this is what crawlers actually index.
    const factsList = [
      buildingAddr ? `<li><strong>Building:</strong> <a href="/building/${escapeHtml(row.base_bbl)}">${escapeHtml(buildingAddr)}</a></li>` : '',
      row.unit_designation ? `<li><strong>Unit:</strong> ${escapeHtml(row.unit_designation)}</li>` : '',
      borough ? `<li><strong>Borough:</strong> ${escapeHtml(borough)}</li>` : '',
      zip ? `<li><strong>ZIP code:</strong> <a href="/neighborhood/${escapeHtml(zip)}?geoType=zip">${escapeHtml(zip)}</a></li>` : '',
      beds ? `<li><strong>Bedrooms:</strong> ${beds}</li>` : '',
      baths ? `<li><strong>Bathrooms:</strong> ${baths}</li>` : '',
      sqftNum ? `<li><strong>Square feet:</strong> ${sqftNum.toLocaleString()}</li>` : '',
      `<li><strong>Unit BBL:</strong> ${escapeHtml(row.unit_bbl)}</li>`,
    ].filter(Boolean).join('');

    const unitSalesHtml = unitSales.length
      ? `<h2>Sale history for this unit</h2>
         <p>This condo unit has ${unitSales.length} recorded transaction${unitSales.length === 1 ? '' : 's'} in our verified ACRIS dataset.</p>
         <ul>${unitSales.map(s => `<li>${escapeHtml(formatPrice(Number(s.sale_price)))} on ${escapeHtml(String(s.sale_date).slice(0, 10))}</li>`).join('')}</ul>`
      : `<h2>Sale history for this unit</h2><p>No verified transactions are currently recorded for this specific unit in our dataset. See building-level activity below for context.</p>`;

    const buildingSalesHtml = buildingSales.length
      ? `<h2>Recent sales in the same building</h2>
         <p>${buildingSales.length} other recorded transactions at ${escapeHtml(buildingAddr)} help benchmark this unit.</p>
         <ul>${buildingSales.map(s => {
            const url = s.slug ? `/unit/${escapeHtml(s.slug)}` : (s.unit_bbl ? `/unit/${escapeHtml(s.unit_bbl)}` : null);
            const label = `${s.raw_apt_number || s.unit_designation || 'Unit'} — ${formatPrice(Number(s.sale_price))} on ${String(s.sale_date).slice(0, 10)}`;
            return `<li>${url ? `<a href="${url}">${escapeHtml(label)}</a>` : escapeHtml(label)}</li>`;
         }).join('')}</ul>`
      : '';

    const buildingStatsHtml = (medianPrice && buildingSaleCount >= 3) ? `
      <h2>Building market context</h2>
      <p>Across the past 36 months, ${escapeHtml(buildingAddr)} recorded ${buildingSaleCount} verified sale${buildingSaleCount === 1 ? '' : 's'}.
      Median price was ${escapeHtml(formatPrice(medianPrice))}, with a range of
      ${escapeHtml(formatPrice(Number(stats.min_price)))} to ${escapeHtml(formatPrice(Number(stats.max_price)))}.
      ${priceNum ? `This unit's last recorded sale of ${escapeHtml(price!)} ${priceNum < medianPrice ? 'sits below' : priceNum > medianPrice ? 'sits above' : 'matches'} the building median.` : ''}</p>
    ` : '';

    const siblingsHtml = siblings.length
      ? `<h2>Other units in this building</h2>
         <ul>${siblings.map(u => {
            const url = u.slug ? `/unit/${escapeHtml(u.slug)}` : `/unit/${escapeHtml(u.unit_bbl)}`;
            const label = `${u.unit_designation || 'Unit'}${u.beds ? ` · ${u.beds} bed` : ''}${u.baths ? ` · ${u.baths} bath` : ''}${u.sqft ? ` · ${Number(u.sqft).toLocaleString()} sqft` : ''}`;
            return `<li><a href="${url}">${escapeHtml(label)}</a></li>`;
         }).join('')}</ul>`
      : '';

    const relatedLinksHtml = `
      <h2>Explore related</h2>
      <ul>
        <li><a href="/building/${escapeHtml(row.base_bbl)}">All units at ${escapeHtml(buildingAddr)}</a></li>
        ${zip ? `<li><a href="/neighborhood/${escapeHtml(zip)}?geoType=zip">Neighborhood report for ${escapeHtml(zip)}</a></li>` : ''}
        ${borough ? `<li><a href="/browse/ny">Browse condos in New York</a></li>` : ''}
        <li><a href="/screener">Opportunity screener — find underpriced condos</a></li>
        <li><a href="/methodology/opportunity-score">How the opportunity score is calculated</a></li>
      </ul>
    `;

    const intro = `
      <p>${escapeHtml(displayAddress)}${locationParts ? ` is located in ${escapeHtml(locationParts)}` : ''}.
      This page combines verified ACRIS sale history, our proprietary opportunity score, building-level price trends, and
      comparable transactions${beds ? ` for similar ${beds}-bedroom units` : ''} to help buyers and investors evaluate this condo.</p>
      <ul>${factsList}</ul>
    `;

    const bodyHtml = `${intro}${unitSalesHtml}${buildingSalesHtml}${buildingStatsHtml}${siblingsHtml}${relatedLinksHtml}`;

    // Richer JSON-LD: Residence with floorSize/numberOfRooms + Place containedInPlace.
    const residenceJsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Residence',
      name: displayAddress,
      url: `${SITE_URL}/unit/${row.slug || row.unit_bbl}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: displayAddress,
        addressLocality: borough || 'New York',
        addressRegion: 'NY',
        postalCode: zip || undefined,
        addressCountry: 'US',
      },
    };
    if (sqftNum) residenceJsonLd.floorSize = { '@type': 'QuantitativeValue', value: sqftNum, unitCode: 'FTK' };
    if (beds) residenceJsonLd.numberOfRooms = beds;
    if (row.latitude && row.longitude) {
      residenceJsonLd.geo = {
        '@type': 'GeoCoordinates',
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      };
    }
    if (lastSale && priceNum) {
      residenceJsonLd.subjectOf = {
        '@type': 'Event',
        name: 'Last recorded sale',
        startDate: String(lastSale.sale_date).slice(0, 10),
        about: { '@type': 'PriceSpecification', price: priceNum, priceCurrency: 'USD' },
      };
    }

    return {
      title,
      description,
      ogType: 'website',
      canonicalPath: `/unit/${row.slug || row.unit_bbl}`,
      h1: displayAddress,
      bodyHtml,
      jsonLd: residenceJsonLd,
    };
  } catch (err) {
    console.error('[SEO] Error fetching unit meta:', err);
    return null;
  }
}

function extractPropertyId(slug: string): string {
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const match = slug.match(uuidRegex);
  if (match) return match[0];
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

async function getPropertyMeta(slug: string): Promise<PageMeta | null> {
  try {
    const propertyId = extractPropertyId(slug);
    const result = await db.execute(sql`
      SELECT id, address, city, state, zip_code, property_type, estimated_value,
             last_sale_price, last_sale_date, sqft, beds, baths, year_built,
             opportunity_score, latitude, longitude
      FROM properties WHERE id = ${propertyId} LIMIT 1
    `);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as any;

    // Pull related data in parallel.
    const [salesRes, compsRes, zipStatsRes] = await Promise.all([
      db.execute(sql`
        SELECT sale_price, sale_date FROM sales
        WHERE property_id = ${row.id}
        ORDER BY sale_date DESC LIMIT 8
      `),
      row.zip_code
        ? db.execute(sql`
            SELECT id, address, city, last_sale_price, last_sale_date,
                   beds, baths, sqft, opportunity_score
            FROM properties
            WHERE zip_code = ${row.zip_code}
              AND id != ${row.id}
              AND last_sale_price > 0
              AND latitude IS NOT NULL
            ORDER BY last_sale_date DESC NULLS LAST
            LIMIT 6
          `)
        : Promise.resolve({ rows: [] } as any),
      row.zip_code
        ? db.execute(sql`
            SELECT
              COUNT(*) FILTER (WHERE last_sale_price > 0)::int AS sale_count,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY last_sale_price)
                FILTER (WHERE last_sale_price > 0) AS median_price,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_value)
                FILTER (WHERE estimated_value > 0) AS median_estimate
            FROM properties WHERE zip_code = ${row.zip_code}
          `)
        : Promise.resolve({ rows: [{}] } as any),
    ]);

    const sales = (salesRes as any).rows as any[];
    const comps = (compsRes as any).rows as any[];
    const zipStats = ((zipStatsRes as any).rows[0] || {}) as any;

    const address = titleCase(row.address || 'Property');
    const city = row.city ? titleCase(row.city) : '';
    const state = row.state || '';
    const zip = row.zip_code || '';
    const priceNum = row.estimated_value ? Number(row.estimated_value) : null;
    const price = priceNum ? formatPrice(priceNum) : null;
    const lastSalePriceNum = row.last_sale_price ? Number(row.last_sale_price) : null;
    const type = row.property_type || '';
    const sqftNum = row.sqft ? Number(row.sqft) : null;
    const beds = row.beds ? Number(row.beds) : null;
    const baths = row.baths ? Number(row.baths) : null;
    const yearBuilt = row.year_built ? Number(row.year_built) : null;
    const score = row.opportunity_score ? Number(row.opportunity_score) : null;

    const locationParts = [city, state, zip].filter(Boolean).join(', ');
    const title = `${address}${locationParts ? `, ${locationParts}` : ''} | Realtors Dashboard`;

    const descParts: string[] = [];
    if (type) descParts.push(type);
    if (price) descParts.push(`est. ${price}`);
    if (lastSalePriceNum) descParts.push(`last sold ${formatPrice(lastSalePriceNum)}`);
    if (sqftNum) descParts.push(`${sqftNum.toLocaleString()} sqft`);
    if (score && score >= 60) descParts.push(`opportunity score ${score}/100`);

    let description = `${address}${locationParts ? `, ${locationParts}` : ''}`;
    if (descParts.length) description += ` — ${descParts.join(', ')}`;
    description += '. Verified sale history, comparable sales, neighborhood context, and AI insights.';
    description = description.slice(0, 300);

    const factsHtml = [
      type ? `<li><strong>Property type:</strong> ${escapeHtml(type)}</li>` : '',
      price ? `<li><strong>Estimated value:</strong> ${escapeHtml(price)}</li>` : '',
      lastSalePriceNum ? `<li><strong>Last sale:</strong> ${escapeHtml(formatPrice(lastSalePriceNum))}${row.last_sale_date ? ` on ${escapeHtml(String(row.last_sale_date).slice(0, 10))}` : ''}</li>` : '',
      sqftNum ? `<li><strong>Square footage:</strong> ${sqftNum.toLocaleString()} sqft</li>` : '',
      beds ? `<li><strong>Bedrooms:</strong> ${beds}</li>` : '',
      baths ? `<li><strong>Bathrooms:</strong> ${baths}</li>` : '',
      yearBuilt ? `<li><strong>Year built:</strong> ${yearBuilt}</li>` : '',
      score ? `<li><strong>Opportunity score:</strong> ${score}/100</li>` : '',
      zip ? `<li><strong>ZIP:</strong> <a href="/neighborhood/${escapeHtml(zip)}?geoType=zip">${escapeHtml(zip)}</a></li>` : '',
    ].filter(Boolean).join('');

    const salesHtml = sales.length
      ? `<h2>Sale history</h2>
         <p>${sales.length} verified transaction${sales.length === 1 ? '' : 's'} on record for this property.</p>
         <ul>${sales.map(s => `<li>${escapeHtml(formatPrice(Number(s.sale_price)))} on ${escapeHtml(String(s.sale_date).slice(0, 10))}</li>`).join('')}</ul>`
      : '';

    const compsHtml = comps.length
      ? `<h2>Comparable properties in ${escapeHtml(zip)}</h2>
         <ul>${comps.map(c => {
            const label = `${titleCase(c.address || '')}${c.last_sale_price ? ` — ${formatPrice(Number(c.last_sale_price))}` : ''}${c.beds ? `, ${c.beds} bd` : ''}${c.baths ? `/${c.baths} ba` : ''}${c.sqft ? `, ${Number(c.sqft).toLocaleString()} sqft` : ''}`;
            return `<li><a href="/properties/${escapeHtml(c.id)}">${escapeHtml(label)}</a></li>`;
         }).join('')}</ul>`
      : '';

    const zipMedian = zipStats.median_price ? Number(zipStats.median_price) : null;
    const zipEstMedian = zipStats.median_estimate ? Number(zipStats.median_estimate) : null;
    const zipCount = zipStats.sale_count ? Number(zipStats.sale_count) : 0;
    const neighborhoodHtml = (zipMedian || zipEstMedian) ? `
      <h2>Neighborhood context</h2>
      <p>${escapeHtml(zip)}${city ? ` (${escapeHtml(city)})` : ''} contains ${zipCount.toLocaleString()} tracked properties with sale history.
      ${zipMedian ? `Median recorded sale price: ${escapeHtml(formatPrice(zipMedian))}.` : ''}
      ${zipEstMedian ? ` Median estimated value: ${escapeHtml(formatPrice(zipEstMedian))}.` : ''}
      ${(lastSalePriceNum && zipMedian) ? ` This property's last sale ${lastSalePriceNum < zipMedian ? 'sits below' : lastSalePriceNum > zipMedian ? 'sits above' : 'matches'} the ZIP median.` : ''}</p>
    ` : '';

    const relatedLinksHtml = `
      <h2>Explore related</h2>
      <ul>
        ${zip ? `<li><a href="/neighborhood/${escapeHtml(zip)}?geoType=zip">Full neighborhood report for ${escapeHtml(zip)}</a></li>` : ''}
        ${state && city ? `<li><a href="/browse/${escapeHtml(state.toLowerCase())}/${escapeHtml(encodeURIComponent(city.toLowerCase()))}">More properties in ${escapeHtml(city)}, ${escapeHtml(state)}</a></li>` : ''}
        ${state ? `<li><a href="/browse/${escapeHtml(state.toLowerCase())}">Browse all ${escapeHtml(STATE_NAMES[state] || state)} listings</a></li>` : ''}
        <li><a href="/screener">Opportunity screener — find underpriced properties</a></li>
        <li><a href="/methodology/opportunity-score">How the opportunity score is calculated</a></li>
      </ul>
    `;

    const intro = `
      <p>${escapeHtml(address)}${locationParts ? ` is a ${type ? escapeHtml(type.toLowerCase()) + ' ' : ''}property located in ${escapeHtml(locationParts)}` : ''}.
      This page combines verified sale history, comparable transactions${zip ? ` in ZIP ${escapeHtml(zip)}` : ''},
      neighborhood market statistics, and our proprietary opportunity score to help buyers and investors evaluate the property.</p>
      ${factsHtml ? `<ul>${factsHtml}</ul>` : ''}
    `;

    const bodyHtml = `${intro}${salesHtml}${neighborhoodHtml}${compsHtml}${relatedLinksHtml}`;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'SingleFamilyResidence',
      name: address,
      url: `${SITE_URL}/properties/${slug}`,
      address: {
        '@type': 'PostalAddress',
        streetAddress: address,
        addressLocality: city || undefined,
        addressRegion: state || undefined,
        postalCode: zip || undefined,
        addressCountry: 'US',
      },
    };
    if (sqftNum) jsonLd.floorSize = { '@type': 'QuantitativeValue', value: sqftNum, unitCode: 'FTK' };
    if (beds) jsonLd.numberOfRooms = beds;
    if (yearBuilt) jsonLd.yearBuilt = yearBuilt;
    if (row.latitude && row.longitude) {
      jsonLd.geo = {
        '@type': 'GeoCoordinates',
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      };
    }
    if (lastSalePriceNum && row.last_sale_date) {
      jsonLd.subjectOf = {
        '@type': 'Event',
        name: 'Last recorded sale',
        startDate: String(row.last_sale_date).slice(0, 10),
        about: { '@type': 'PriceSpecification', price: lastSalePriceNum, priceCurrency: 'USD' },
      };
    }

    return {
      title,
      description,
      ogType: 'website',
      canonicalPath: `/properties/${slug}`,
      h1: address,
      bodyHtml,
      jsonLd,
    };
  } catch (err) {
    console.error('[SEO] Error fetching property meta:', err);
    return null;
  }
}

async function getBuildingMeta(rawBaseBbl: string): Promise<PageMeta | null> {
  try {
    const baseBbl = rawBaseBbl.match(/(\d{10})$/)?.[1] || rawBaseBbl;
    const result = await db.execute(sql`
      SELECT base_bbl, building_display_address, borough, zip_code, latitude, longitude,
        COUNT(*) FILTER (WHERE unit_classification = 'residential')::int AS res_units,
        COUNT(*)::int AS total_units
      FROM condo_units
      WHERE base_bbl = ${baseBbl}
      GROUP BY base_bbl, building_display_address, borough, zip_code, latitude, longitude
      LIMIT 1
    `);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as any;
    const address = row.building_display_address ? titleCase(row.building_display_address) : 'Building';
    const borough = row.borough ? titleCase(row.borough) : '';
    const zip = row.zip_code || '';
    const units = Number(row.res_units || 0);
    const total = Number(row.total_units || 0);
    const locParts = [borough, zip].filter(Boolean).join(' ');

    const bodyHtml = `
      <p><strong>Building:</strong> ${escapeHtml(address)}${locParts ? `, ${escapeHtml(locParts)}` : ''}</p>
      <ul>
        ${units ? `<li><strong>Residential units:</strong> ${units}</li>` : ''}
        ${total ? `<li><strong>Total units:</strong> ${total}</li>` : ''}
      </ul>
      <p>Browse units, sales history, building-level price trends, and detailed building information.</p>
    `;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'ApartmentComplex',
      name: address,
      numberOfAccommodationUnits: units || total || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: address,
        addressLocality: borough || 'New York',
        addressRegion: 'NY',
        postalCode: zip || undefined,
        addressCountry: 'US',
      },
    };
    if (row.latitude && row.longitude) {
      jsonLd.geo = {
        '@type': 'GeoCoordinates',
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      };
    }

    return {
      title: `${address}${locParts ? ` - ${locParts}` : ''} | Realtors Dashboard`,
      description: `View ${address}, a condo building${units ? ` with ${units} residential units` : ''}${borough ? ` in ${borough}` : ''}. Browse units, sales history, and detailed building information.`,
      ogType: 'website',
      canonicalPath: `/building/${baseBbl}`,
      h1: address,
      bodyHtml,
      jsonLd,
    };
  } catch {
    return null;
  }
}

async function getNeighborhoodMeta(geoId: string, geoType: string): Promise<PageMeta | null> {
  try {
    if (geoType === 'zip') {
      const result = await db.execute(sql`
        SELECT zip_code, COUNT(*)::int AS total,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_value)::int AS median,
          MAX(state) AS state, MAX(city) AS city
        FROM properties
        WHERE zip_code = ${geoId} AND estimated_value > 0
        GROUP BY zip_code
        LIMIT 1
      `);
      if (result.rows.length === 0) return null;
      const row = result.rows[0] as any;
      const total = Number(row?.total || 0);
      const medianNum = row?.median ? Number(row.median) : null;
      const median = medianNum ? formatPrice(medianNum) : '';
      const city = row?.city ? titleCase(row.city) : '';
      const state = row?.state || '';

      const bodyHtml = `
        <p><strong>ZIP code:</strong> ${escapeHtml(geoId)}${city ? ` (${escapeHtml(city)}${state ? `, ${escapeHtml(state)}` : ''})` : ''}</p>
        <ul>
          <li><strong>Total properties:</strong> ${total.toLocaleString()}</li>
          ${median ? `<li><strong>Median estimated value:</strong> ${escapeHtml(median)}</li>` : ''}
        </ul>
        <p>Letter grade plus six neighborhood indicators: development activity, safety, transit access, amenities, flood risk, and building health.</p>
      `;

      const jsonLd: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Place',
        name: `${geoId}${city ? ` - ${city}` : ''}`,
        address: {
          '@type': 'PostalAddress',
          postalCode: geoId,
          addressLocality: city || undefined,
          addressRegion: state || undefined,
          addressCountry: 'US',
        },
      };

      return {
        title: `${geoId} ZIP Code Report${city ? ` - ${city}` : ''} | Realtors Dashboard`,
        description: `Neighborhood report card for ZIP ${geoId}${city ? ` (${city})` : ''}. ${total.toLocaleString()} properties${median ? `, median price ${median}` : ''}. Indicators include development, safety, transit, amenities, flood risk, and building health.`,
        ogType: 'website',
        canonicalPath: `/neighborhood/${encodeURIComponent(geoId)}?geoType=zip`,
        h1: `${geoId} Neighborhood Report${city ? ` - ${city}` : ''}`,
        bodyHtml,
        jsonLd,
      };
    }
    return {
      title: `${geoId} Neighborhood Report | Realtors Dashboard`,
      description: `Neighborhood report card for ${geoId}. Letter grade, market stats, and six neighborhood indicators including development, safety, transit, amenities, flood risk, and building health.`,
      ogType: 'website',
      canonicalPath: `/neighborhood/${encodeURIComponent(geoId)}?geoType=${encodeURIComponent(geoType)}`,
      h1: `${geoId} Neighborhood Report`,
    };
  } catch {
    return null;
  }
}

async function getBrowseStateMeta(state: string): Promise<PageMeta | null> {
  try {
    const upperState = state.toUpperCase();
    const stateName = STATE_NAMES[upperState] || upperState;
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as total,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_value)::int as median
      FROM properties WHERE state = ${upperState} AND estimated_value > 0
    `);
    const row = result.rows[0] as any;
    const total = row?.total || 0;
    const medianNum = row?.median ? Number(row.median) : null;
    const median = medianNum ? formatPrice(medianNum) : '';

    const bodyHtml = `
      <p>${total.toLocaleString()} properties in ${escapeHtml(stateName)}${median ? `. Median estimated value: ${escapeHtml(median)}` : ''}.</p>
      <p>Browse by city, ZIP code, property type, and opportunity score. View market trends and trending neighborhoods.</p>
    `;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: `${stateName} Real Estate`,
      address: {
        '@type': 'PostalAddress',
        addressRegion: upperState,
        addressCountry: 'US',
      },
    };

    return {
      title: `${stateName} Real Estate - ${total.toLocaleString()} Properties | Realtors Dashboard`,
      description: `Browse ${total.toLocaleString()} properties in ${stateName}. ${median ? `Median price: ${median}. ` : ''}Explore cities, neighborhoods, and find investment opportunities.`,
      ogType: 'website',
      canonicalPath: `/browse/${state.toLowerCase()}`,
      h1: `${stateName} Real Estate`,
      bodyHtml,
      jsonLd,
    };
  } catch {
    return null;
  }
}

async function getBrowseCityMeta(state: string, city: string): Promise<PageMeta | null> {
  try {
    const upperState = state.toUpperCase();
    const stateName = STATE_NAMES[upperState] || upperState;
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as total,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_value)::int as median
      FROM properties WHERE state = ${upperState} AND city = ${city} AND estimated_value > 0
    `);
    const row = result.rows[0] as any;
    const total = row?.total || 0;
    const medianNum = row?.median ? Number(row.median) : null;
    const median = medianNum ? formatPrice(medianNum) : '';

    const bodyHtml = `
      <p>${total.toLocaleString()} properties in ${escapeHtml(city)}, ${escapeHtml(stateName)}${median ? `. Median estimated value: ${escapeHtml(median)}` : ''}.</p>
      <p>View ZIP codes, property types, market statistics, and investment opportunities.</p>
    `;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: `${city}, ${stateName} Real Estate`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressRegion: upperState,
        addressCountry: 'US',
      },
    };

    return {
      title: `${city}, ${stateName} Real Estate - ${total.toLocaleString()} Properties | Realtors Dashboard`,
      description: `Browse ${total.toLocaleString()} properties in ${city}, ${stateName}. ${median ? `Median price: ${median}. ` : ''}View ZIP codes, property types, and investment opportunities.`,
      ogType: 'website',
      canonicalPath: `/browse/${state.toLowerCase()}/${encodeURIComponent(city)}`,
      h1: `${city}, ${stateName} Real Estate`,
      bodyHtml,
      jsonLd,
    };
  } catch {
    return null;
  }
}

export async function getMetaForUrl(url: string): Promise<PageMeta> {
  const path = url.split('?')[0];

  if (STATIC_PAGES[path]) {
    return STATIC_PAGES[path];
  }

  const browseStateMatch = path.match(/^\/browse\/([a-zA-Z]{2})$/);
  if (browseStateMatch) {
    const meta = await getBrowseStateMeta(browseStateMatch[1]);
    if (meta) return meta;
  }

  const browseCityMatch = path.match(/^\/browse\/([a-zA-Z]{2})\/(.+)$/);
  if (browseCityMatch) {
    const meta = await getBrowseCityMeta(browseCityMatch[1], decodeURIComponent(browseCityMatch[2]));
    if (meta) return meta;
  }

  const unitMatch = path.match(/^\/unit\/(.+)$/);
  if (unitMatch) {
    const meta = await getUnitMeta(unitMatch[1]);
    if (meta) return meta;
  }

  const propertyMatch = path.match(/^\/properties\/(.+)$/);
  if (propertyMatch) {
    const meta = await getPropertyMeta(propertyMatch[1]);
    if (meta) return meta;
  }

  const buildingMatch = path.match(/^\/building\/(.+)$/);
  if (buildingMatch) {
    const meta = await getBuildingMeta(buildingMatch[1]);
    if (meta) return meta;
  }

  const neighborhoodMatch = path.match(/^\/neighborhood\/([^/]+)$/);
  if (neighborhoodMatch) {
    const queryStr = url.includes('?') ? url.split('?')[1] : '';
    const geoTypeMatch = queryStr.match(/(?:^|&)geoType=([^&]+)/);
    const geoType = geoTypeMatch ? decodeURIComponent(geoTypeMatch[1]) : 'zip';
    const meta = await getNeighborhoodMeta(decodeURIComponent(neighborhoodMatch[1]), geoType);
    if (meta) return meta;
  }

  const guideMatch = path.match(/^\/guides\/([a-z0-9-]+)$/);
  if (guideMatch) {
    const meta = getGuideMeta(guideMatch[1]);
    if (meta) return meta;
  }

  return DEFAULT_META;
}

function buildGuideBodyHtml(guide: Guide): string {
  const sectionsHtml = guide.sections
    .map((s) => {
      const bullets =
        s.bullets && s.bullets.length > 0
          ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
          : '';
      return `<h2>${escapeHtml(s.heading)}</h2><p>${s.body}</p>${bullets}`;
    })
    .join('');

  const faqsHtml =
    guide.faqs && guide.faqs.length > 0
      ? `<h2>Frequently asked</h2>${guide.faqs
          .map(
            (f) =>
              `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`,
          )
          .join('')}`
      : '';

  const relatedHtml = (() => {
    const rel = guide.relatedSlugs
      .map((s) => GUIDES.find((g) => g.slug === s))
      .filter((g): g is Guide => Boolean(g));
    if (rel.length === 0) return '';
    return `<h2>Related guides</h2><ul>${rel
      .map(
        (r) =>
          `<li><a href="/guides/${r.slug}">${escapeHtml(r.title)}</a></li>`,
      )
      .join('')}</ul>`;
  })();

  return `
    <p><em>${escapeHtml(guide.category)} · ${guide.readingMinutes} min read</em></p>
    <p>${escapeHtml(guide.intro)}</p>
    ${sectionsHtml}
    ${faqsHtml}
    <p><a href="${guide.productLink.href}">${escapeHtml(guide.productLink.label)}</a></p>
    ${relatedHtml}
  `;
}

function getGuideMeta(slug: string): PageMeta | null {
  const guide = getGuide(slug);
  if (!guide) return null;

  const canonicalPath = `/guides/${guide.slug}`;
  const articleJsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.metaDescription,
    keywords: guide.keyword,
    articleSection: guide.category,
    inLanguage: 'en-US',
    datePublished: guide.publishedDate,
    dateModified: guide.updatedDate,
    url: `${SITE_URL}${canonicalPath}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${canonicalPath}` },
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.png` },
    },
    image: `${SITE_URL}/og-image.png`,
  };

  const jsonLd: Record<string, any>[] = [articleJsonLd];

  if (guide.faqs && guide.faqs.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: guide.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    ogType: 'article',
    canonicalPath,
    h1: guide.title,
    bodyHtml: buildGuideBodyHtml(guide),
    jsonLd,
  };
}

function replaceOrAdd(html: string, regex: RegExp, newTag: string, checkStr: string): string {
  if (regex.test(html)) {
    return html.replace(regex, newTag);
  }
  if (!html.includes(checkStr)) {
    return html.replace('</head>', `    ${newTag}\n  </head>`);
  }
  return html;
}

export function injectMetaTags(html: string, meta: PageMeta, baseUrl: string): string {
  const canonicalUrl = `${baseUrl}${meta.canonicalPath}`;

  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>`
  );

  html = replaceOrAdd(html,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
    'name="description"'
  );

  html = replaceOrAdd(html,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
    'og:title'
  );

  html = replaceOrAdd(html,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
    'og:description'
  );

  html = replaceOrAdd(html,
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:type" content="${escapeAttr(meta.ogType)}" />`,
    'og:type'
  );

  html = replaceOrAdd(html,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${escapeAttr(canonicalUrl)}" />`,
    'og:url'
  );

  html = replaceOrAdd(html,
    /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}" />`,
    'og:site_name'
  );

  html = replaceOrAdd(html,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${escapeAttr(canonicalUrl)}" />`,
    'rel="canonical"'
  );

  html = replaceOrAdd(html,
    /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:card" content="summary_large_image" />`,
    'twitter:card'
  );

  html = replaceOrAdd(html,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
    'twitter:title'
  );

  html = replaceOrAdd(html,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
    'twitter:description'
  );

  if (meta.jsonLd) {
    const ldArray = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    const ldTags = ldArray
      .map(obj => `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(obj))}</script>`)
      .join('\n    ');
    html = html.replace('</head>', `    ${ldTags}\n  </head>`);
  }

  if (meta.h1 || meta.bodyHtml) {
    const h1Html = meta.h1 ? `<h1>${escapeHtml(meta.h1)}</h1>` : '';
    const noscript = `<noscript><main id="seo-content" style="max-width:760px;margin:2rem auto;padding:1rem;font-family:system-ui,sans-serif;line-height:1.5;">${h1Html}${meta.bodyHtml || ''}</main></noscript>`;
    html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
  }

  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeJsonLd(str: string): string {
  return str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
