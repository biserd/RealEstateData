import { db } from './db';
import { sql } from 'drizzle-orm';
import { GUIDES, getGuide, type Guide } from '@shared/guides';
import { getCachedNarrative } from './narratives';
import { isDatabaseBackedPagePath, isPrivatePagePath } from './entityPagePolicy';
import { publicPropertyPageSql, publicUnitPageSql } from './publicPageEligibility';
export { isDatabaseBackedPagePath, isPrivatePagePath } from './entityPagePolicy';

export interface PageMeta {
  title: string;
  description: string;
  ogType: string;
  canonicalPath: string;
  h1?: string;
  bodyHtml?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
  robots?: string;
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
    'Source-backed real estate market intelligence with verified recorded sales, reproducible comps, and explicit coverage and freshness.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: 0, priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro', price: 59, priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Premium', price: 149, priceCurrency: 'USD' },
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
      price: 59,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/pricing`,
    },
    {
      '@type': 'Offer',
      name: 'Premium Monthly',
      price: 149,
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
        text: 'Realtors Dashboard is a source-backed NYC recorded-sales research platform. It publishes reproducible market snapshots, comparable-sale context, and deterministic opportunity scores with explicit coverage and freshness.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which areas do you cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Current verified public-record coverage is limited to the NYC datasets identified on each result page. Other regions remain unavailable until source rights and quality checks are approved.',
      },
    },
    {
      '@type': 'Question',
      name: 'How accurate is your data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Published records come from the approved sources identified on each result page. The current productionized source catalog is limited to NYC public-record datasets, with freshness and coverage reported explicitly.',
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
        text: 'Yes. Pro and Premium subscriptions start with a 14-day free trial. Cancel from account settings during the trial to avoid a charge.',
      },
    },
  ],
};

const DATASET_JSONLD: Record<string, any> = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Realtors Dashboard Real Estate Dataset',
  description:
    'Published property records, verified recorded sales, market snapshots, and opportunity scores with explicit coverage, provenance, and freshness. Available via the Realtors Dashboard Developer API.',
  url: `${SITE_URL}/developers`,
  creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  spatialCoverage: [{ '@type': 'City', name: 'New York City' }],
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
  <p><strong>Source-backed NYC recorded-sales intelligence.</strong> Public pages are limited to canonical geographies and records that pass the current published dataset's provenance, completeness, price, and quarantine checks.</p>
  <p>The platform does not represent live listings. New source data is imported, audited, and published manually so a partial refresh cannot silently change public market results.</p>
  <h2>Research the current publication</h2>
  <ul>
    <li><a href="/tools">Free NYC data tools</a> turn exact published ZIP snapshots into focused market answers without maps or misleading geographic fallbacks.</li>
    <li><a href="/market-intelligence">Market Intelligence</a> shows recorded-price statistics, sample sizes, publication freshness, and explicit fallback scope.</li>
    <li><a href="/investment-opportunities">Opportunity Candidates</a> applies deterministic scoring to source-backed published records.</li>
    <li><a href="/up-and-coming">Published ZIP rankings</a> use price trend, transaction velocity, liquidity, and comparable-sale depth.</li>
    <li><a href="/calculator">The Investment Calculator</a> lets users test their own assumptions independently of the data publication.</li>
  </ul>
  <h2>Sources and limitations</h2>
  <p>Primary sources include NYC rolling sales, ACRIS recorded transactions, PLUTO, and official condo-unit identity data. Recorded sales, estimates, and scores are labeled separately. NJ and CT detail pages remain unpublished until their source adapters and identity checks pass the same quality contract.</p>
  <p>Every market result should show its source-through date, publication date, methodology version, record count, and limitations. Read <a href="/methodology/data-coverage">data coverage</a> and <a href="/methodology/verified-vs-estimates">verified sales versus estimates</a>.</p>
  <h2>Use the data responsibly</h2>
  <p>Scores and estimates are research inputs, not appraisals, offers, or financial advice. Verify material facts with the official record and qualified professionals. To report an issue, <a href="/contact">contact the data editorial team</a>.</p>
`;

const DEFAULT_META: PageMeta = {
  title: 'Realtors Dashboard - Real Estate Market Intelligence',
  description: 'Source-backed property and market intelligence with verified recorded sales, reproducible comps, and visible coverage and freshness.',
  ogType: 'website',
  canonicalPath: '/',
  h1: 'Source-Backed Real Estate Market Intelligence',
  bodyHtml: HOMEPAGE_BODY_HTML,
  jsonLd: SOFTWARE_APPLICATION_JSONLD,
};

export const SEO_CONTENT_LAST_MODIFIED = '2026-08-30';

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
      'NYC recorded-sales research guides with named public sources, visible review dates, coverage limits, and Opportunity Score methodology.',
    ogType: 'website',
    canonicalPath: '/guides',
    h1: 'Real estate guides for investors, agents, and developers',
    bodyHtml: `
      <p>Practical guides built on the current manually published NYC recorded-sales dataset. Unsupported market and live-listing drafts are excluded until revalidated.</p>
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
    description: 'Explore published recorded-sales market statistics by geography with sample size, dataset version, source date, and truthful geographic fallbacks.',
    ogType: 'website',
    canonicalPath: '/market-intelligence',
    h1: 'Market Intelligence',
    bodyHtml: '<p>Pre-computed NYC recorded-sales statistics with sample size, source period, publication date, and methodology version. Updates are manually validated and published.</p>',
  },
  '/investment-opportunities': {
    title: 'Investment Opportunities - Realtors Dashboard',
    description: 'Screen source-backed NYC recorded-sale records with a deterministic Opportunity Score and reproducible comparable-sale context.',
    ogType: 'website',
    canonicalPath: '/investment-opportunities',
    h1: 'Investment Opportunities',
    bodyHtml: '<p>Filter underpriced properties by state, price, opportunity score, and property type. Each result is scored 0-100 against verified comparable sales.</p>',
  },
  '/up-and-coming': {
    title: 'Up & Coming ZIP Codes - Realtors Dashboard',
    description: 'Compare eligible published NYC ZIPs using recorded-price trends, transaction velocity, liquidity, comp depth, and visible confidence.',
    ogType: 'website',
    canonicalPath: '/up-and-coming',
    h1: 'Up & Coming ZIP Codes',
    bodyHtml: '<p>Eligible published NYC ZIPs ranked by recorded-price trend, transaction velocity, liquidity, comparable-sale depth, and confidence. Rankings do not use live listings or permit activity.</p>',
  },
  '/tools': {
    title: 'Free NYC Real Estate Data Tools - Realtors Dashboard',
    description: 'Free text-first tools for NYC ZIP recorded-sale snapshots, price-per-square-foot benchmarks, and neighborhood momentum checks.',
    ogType: 'website',
    canonicalPath: '/tools',
    h1: 'Free NYC real estate data tools',
    bodyHtml: `
      <p>Answer focused market questions with the current manually published NYC recorded-sales dataset. These tools use no maps, reject misleading geographic fallbacks, and require no signup.</p>
      <ul>
        <li><a href="/tools/nyc-zip-market-snapshot"><strong>NYC ZIP Market Snapshot</strong></a> - recorded pricing, transaction count, price range, trend, and recent verified transfers.</li>
        <li><a href="/tools/nyc-price-per-square-foot"><strong>NYC Price per Square Foot Benchmark</strong></a> - compare a subject property's calculated price per square foot with an exact-ZIP recorded-sale benchmark.</li>
        <li><a href="/tools/nyc-neighborhood-momentum"><strong>NYC Neighborhood Momentum Checker</strong></a> - see an eligible ZIP's current rank, score, transaction depth, and momentum classification.</li>
      </ul>
    `,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Free NYC Real Estate Data Tools',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'NYC ZIP Market Snapshot', url: `${SITE_URL}/tools/nyc-zip-market-snapshot` },
        { '@type': 'ListItem', position: 2, name: 'NYC Price per Square Foot Benchmark', url: `${SITE_URL}/tools/nyc-price-per-square-foot` },
        { '@type': 'ListItem', position: 3, name: 'NYC Neighborhood Momentum Checker', url: `${SITE_URL}/tools/nyc-neighborhood-momentum` },
      ],
    },
  },
  '/tools/nyc-zip-market-snapshot': {
    title: 'NYC ZIP Market Snapshot Tool - Realtors Dashboard',
    description: 'Check exact published NYC ZIP recorded-sale prices, price per square foot, transaction count, range, and data freshness.',
    ogType: 'website',
    canonicalPath: '/tools/nyc-zip-market-snapshot',
    h1: 'NYC ZIP Market Snapshot',
    bodyHtml: '<p>Enter an NYC ZIP to inspect its exact published recorded-sale benchmark, sample depth, price distribution, trend, and recent verified transfers. The tool never labels a state or broader-market fallback as ZIP-specific.</p>',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'NYC ZIP Market Snapshot', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: `${SITE_URL}/tools/nyc-zip-market-snapshot`, isAccessibleForFree: true },
  },
  '/tools/nyc-price-per-square-foot': {
    title: 'NYC Price per Square Foot Benchmark - Realtors Dashboard',
    description: "Calculate a property's price per square foot and compare it with an exact published NYC ZIP recorded-sale benchmark.",
    ogType: 'website',
    canonicalPath: '/tools/nyc-price-per-square-foot',
    h1: 'NYC Price per Square Foot Benchmark',
    bodyHtml: '<p>Calculate a subject property price per square foot and compare it with the median and interquartile range for an exact eligible ZIP. The result is a recorded-sale research benchmark, not an appraisal or valuation.</p>',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'NYC Price per Square Foot Benchmark', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: `${SITE_URL}/tools/nyc-price-per-square-foot`, isAccessibleForFree: true },
  },
  '/tools/nyc-neighborhood-momentum': {
    title: 'NYC Neighborhood Momentum Checker - Realtors Dashboard',
    description: "Check an eligible NYC ZIP's current recorded-sale trend score, rank, transaction depth, and momentum classification.",
    ogType: 'website',
    canonicalPath: '/tools/nyc-neighborhood-momentum',
    h1: 'NYC Neighborhood Momentum Checker',
    bodyHtml: '<p>Check an eligible ZIP against the current published ranking using recorded-price trend, transaction velocity, liquidity, comparable-sale depth, and confidence. Momentum describes the current snapshot and is not a forecast.</p>',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'NYC Neighborhood Momentum Checker', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: `${SITE_URL}/tools/nyc-neighborhood-momentum`, isAccessibleForFree: true },
  },
  '/pricing': {
    title: 'Pricing - Realtors Dashboard',
    description: 'Choose the plan that fits your needs. Free, Pro, and Premium tiers with AI-powered property analysis, deal memos, and market intelligence.',
    ogType: 'website',
    canonicalPath: '/pricing',
    h1: 'Pricing',
    bodyHtml: `
      <p>Three transparent tiers. Paid subscriptions start with a 14-day free trial. Cancel anytime.</p>
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
    bodyHtml: '<p>Realtors Dashboard is an independent NYC recorded-sales research platform. It turns named public records and manually published analytical snapshots into transparent, reproducible research while labeling estimates and coverage limits.</p>',
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
      <p>Current verified detail coverage is NYC recorded sales and exact matched condo units. Data comes from named official sources and changes only after a manual refresh passes quality gates and is published. NJ and CT remain pending validation. <a href="/methodology/data-coverage">See the full coverage page</a>.</p>
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
    description: 'Compare up to four published NYC property records by recorded price, estimated value, score, beds, baths, and square footage.',
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
    bodyHtml: '<p>Real-time rental property analyzer with Standard, Refinance, and BRRRR scenarios. Outputs cap rate, cash-on-cash, cash flow, GRM, DSCR, break-even occupancy, and a 30-year projection table.</p>',
  },
  '/methodology/opportunity-score': {
    title: 'Opportunity Score Explained - How We Rate Properties | Realtors Dashboard',
    description: 'How the deterministic 0-100 Opportunity Score uses recorded sales, comparable-property fit, recency, trends, and confidence.',
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
    description: 'Current verified NYC recorded-sale coverage, official sources, manual publication workflow, freshness fields, and known limitations.',
    ogType: 'article',
    canonicalPath: '/methodology/data-coverage',
    h1: 'Data Coverage',
    bodyHtml: `
      <p>Realtors Dashboard publishes a manually validated snapshot of official NYC property identities and recorded-sale data. Public pages are created only when identity, canonical geography, price, source, and completeness gates pass.</p>
      <h2>Geographic coverage</h2>
      <ul>
        <li><strong>New York City:</strong> verified recorded sales and official condo-unit identities; only exact source-backed sale matches are indexable.</li>
        <li><strong>New Jersey and Connecticut:</strong> not part of the current verified public detail publication; validation remains pending.</li>
        <li><strong>Live listings:</strong> unavailable. Pages describe recorded transactions and published analytical snapshots.</li>
      </ul>
      <h2>Source data</h2>
      <ul>
        <li>NYC Open Data: PLUTO, rolling sales, ACRIS recorded transactions, condo declarations.</li>
        <li>NYC Department of Finance rolling sales and ACRIS recorded transactions.</li>
        <li>NYC Department of City Planning PLUTO and official condo-unit identity records.</li>
        <li>Canonical geography and quarantine tables produced by the publication quality pipeline.</li>
      </ul>
      <h2>Refresh policy</h2>
      <p>Refreshes are manually triggered. Candidate data is audited before publication; failed quality gates leave the prior published snapshot in place. Market pages expose their source period and publication date.</p>
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
      <p>A verified sale is a recorded property transfer drawn from official public records. In the current publication, that means NYC ACRIS records and Department of Finance rolling-sales data.</p>
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
      <p>Redfin combines brokerage and listing search. Realtors Dashboard is not a brokerage and currently focuses on published recorded-sale research rather than live-listing discovery.</p>
      <h2>Realtors Dashboard vs PropStream</h2>
      <p>PropStream focuses on owner-data and lead-generation workflows. Realtors Dashboard focuses on NYC recorded-sale screening, transparent methodology, and reproducible comparisons. Product scope and third-party features change, so verify each vendor's current documentation before purchasing.</p>
      <p><a href="/pricing">See pricing</a> or <a href="/methodology/opportunity-score">read the methodology</a>.</p>
    `,
  },
};

export function getStaticSitemapEntries(): Array<{ path: string; lastmod: string }> {
  return ['/', ...Object.keys(STATIC_PAGES), ...GUIDES.map((guide) => `/guides/${guide.slug}`)]
    .filter((path) => path !== '/api-access')
    .map((path) => {
      const guide = path.startsWith('/guides/') ? getGuide(path.slice('/guides/'.length)) : undefined;
      return { path, lastmod: guide?.updatedDate || SEO_CONTENT_LAST_MODIFIED };
    });
}

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
             cu.latitude, cu.longitude, cu.beds, cu.baths, cu.sqft, cu.unit_type_hint,
             (SELECT published_at FROM current_published_dataset ORDER BY published_at DESC NULLS LAST LIMIT 1) AS published_at
      FROM condo_units cu
      WHERE (cu.unit_bbl = ${unitBbl} OR cu.slug = ${unitBbl})
        AND ${publicUnitPageSql('cu')}
      LIMIT 1
    `);
    if (unitRes.rows.length === 0) return null;
    const row = unitRes.rows[0] as any;

    // Pull related context in parallel for a single round-trip-equivalent payload.
    const [unitSalesRes, buildingSalesRes, siblingUnitsRes, buildingStatsRes] = await Promise.all([
      db.execute(sql`
        SELECT sale_price, sale_date FROM sales
        WHERE unit_bbl = ${row.unit_bbl}
          AND sale_price BETWEEN 100000 AND 100000000
        ORDER BY sale_date DESC LIMIT 8
      `),
      db.execute(sql`
        SELECT s.sale_price, s.sale_date, s.raw_apt_number, s.unit_bbl,
               cu.slug, cu.unit_designation
        FROM sales s
        JOIN condo_units cu ON cu.unit_bbl = s.unit_bbl
          AND ${publicUnitPageSql('cu')}
        WHERE s.base_bbl = ${row.base_bbl}
          AND s.unit_bbl IS DISTINCT FROM ${row.unit_bbl}
          AND s.sale_price BETWEEN 100000 AND 100000000
        ORDER BY s.sale_date DESC LIMIT 8
      `),
      db.execute(sql`
        SELECT cu.unit_bbl, cu.unit_designation, cu.slug, cu.beds, cu.baths, cu.sqft
        FROM condo_units cu
        WHERE cu.base_bbl = ${row.base_bbl}
          AND cu.unit_bbl != ${row.unit_bbl}
          AND cu.unit_type_hint = 'residential'
          AND EXISTS (
            SELECT 1 FROM sales sibling_sale
            WHERE sibling_sale.unit_bbl = cu.unit_bbl
              AND sibling_sale.sale_price BETWEEN 100000 AND 100000000
              AND sibling_sale.sale_date >= NOW() - INTERVAL '120 months'
          )
        ORDER BY cu.unit_designation NULLS LAST
        LIMIT 6
      `),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE sale_price BETWEEN 100000 AND 100000000)::int AS sale_count,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price)
            FILTER (WHERE sale_price BETWEEN 100000 AND 100000000) AS median_price,
          MIN(sale_price) FILTER (WHERE sale_price BETWEEN 100000 AND 100000000) AS min_price,
          MAX(sale_price) FILTER (WHERE sale_price BETWEEN 100000 AND 100000000) AS max_price,
          MAX(sale_date) FILTER (WHERE sale_price BETWEEN 100000 AND 100000000) AS last_sale
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
    const title = `${displayAddress}${zip ? ` · ${zip}` : ''} | RD`;

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
    description += 'Recorded sale history, building comps, and source-backed market context.';
    description = description.slice(0, 158);

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
      `<li><strong>Dataset publication:</strong> ${row.published_at ? escapeHtml(String(row.published_at).slice(0, 10)) : 'current validated snapshot'}; recorded sales, not a live listing</li>`,
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
        <li><a href="/investment-opportunities">Opportunity screener — review published candidates</a></li>
        <li><a href="/methodology/opportunity-score">How the opportunity score is calculated</a></li>
      </ul>
    `;

    const intro = `
      <p>${escapeHtml(displayAddress)}${locationParts ? ` is located in ${escapeHtml(locationParts)}` : ''}.
      This page combines verified ACRIS sale history, our proprietary opportunity score, building-level price trends, and
      comparable transactions${beds ? ` for similar ${beds}-bedroom units` : ''} to help buyers and investors evaluate this condo.</p>
      <ul>${factsList}</ul>
    `;

    // Crawls never trigger model spend. Render only a fresh, cached narrative.
    const cachedNarrative = await getCachedNarrative('unit', row.unit_bbl);
    const narrativeHtml = cachedNarrative?.narrative
      ? `<h2>Property analysis</h2>${cachedNarrative.narrative
          .split(/\n\n+/)
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join('')}`
      : '';

    // Build a small set of grounded FAQs from the same data. These render as
    // a definition list in the noscript body AND as FAQPage JSON-LD so Google
    // can show them as rich results.
    const faqs: Array<{ q: string; a: string }> = [];
    if (lastSale && priceNum) {
      faqs.push({
        q: `When did ${displayAddress} last sell?`,
        a: `On ${String(lastSale.sale_date).slice(0, 10)} for ${formatPrice(priceNum)} (verified ACRIS record).`,
      });
    }
    if (priceNum && medianPrice && buildingSaleCount >= 3) {
      const diffPct = Math.round(((priceNum - medianPrice) / medianPrice) * 100);
      const direction = diffPct < 0 ? `${Math.abs(diffPct)}% below` : diffPct > 0 ? `${diffPct}% above` : 'in line with';
      faqs.push({
        q: `How does this unit compare to other sales in ${buildingAddr || 'the building'}?`,
        a: `The last recorded sale of ${formatPrice(priceNum)} sits ${direction} the building median of ${formatPrice(medianPrice)} across ${buildingSaleCount} sales in the past 36 months.`,
      });
    }
    if (medianPrice && buildingSaleCount >= 3) {
      faqs.push({
        q: `How active is the sales market at ${buildingAddr || 'this building'}?`,
        a: `${buildingSaleCount} verified condo sales recorded in the past 36 months, with a median price of ${formatPrice(medianPrice)} and a range of ${formatPrice(Number(stats.min_price))} to ${formatPrice(Number(stats.max_price))}.`,
      });
    }
    if (beds || baths || sqftNum) {
      const parts = [
        beds ? `${beds} bedroom${beds === 1 ? '' : 's'}` : null,
        baths ? `${baths} bathroom${baths === 1 ? '' : 's'}` : null,
        sqftNum ? `${sqftNum.toLocaleString()} square feet` : null,
      ].filter(Boolean).join(', ');
      faqs.push({
        q: `What is the floor plan of ${displayAddress}?`,
        a: `Public records list this unit as ${parts}.`,
      });
    }
    if (zip) {
      faqs.push({
        q: `What ZIP code is ${displayAddress} in?`,
        a: `${zip}${borough ? `, in ${borough}` : ''}. See the full neighborhood report for ${zip} for market trends and comparable sales.`,
      });
    }

    const faqHtml = faqs.length
      ? `<h2>Frequently asked questions</h2><dl>${faqs
          .map((f) => `<dt><strong>${escapeHtml(f.q)}</strong></dt><dd>${escapeHtml(f.a)}</dd>`)
          .join('')}</dl>`
      : '';

    const bodyHtml = `${intro}${narrativeHtml}${unitSalesHtml}${buildingSalesHtml}${buildingStatsHtml}${siblingsHtml}${faqHtml}${relatedLinksHtml}`;

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

    const canonicalUnitPath = `/unit/${row.slug || row.unit_bbl}`;

    const breadcrumbJsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        ...(borough ? [{ '@type': 'ListItem', position: 2, name: borough, item: `${SITE_URL}/browse/ny` }] : []),
        ...(buildingAddr ? [{ '@type': 'ListItem', position: borough ? 3 : 2, name: buildingAddr, item: `${SITE_URL}/building/${row.base_bbl}` }] : []),
        { '@type': 'ListItem', position: (borough ? 1 : 0) + (buildingAddr ? 1 : 0) + 2, name: row.unit_designation || displayAddress, item: `${SITE_URL}${canonicalUnitPath}` },
      ],
    };

    const jsonLdArr: Record<string, any>[] = [residenceJsonLd, breadcrumbJsonLd];
    if (faqs.length) {
      jsonLdArr.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }

    return {
      title,
      description,
      ogType: 'website',
      canonicalPath: canonicalUnitPath,
      h1: displayAddress,
      bodyHtml,
      jsonLd: jsonLdArr,
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

function propertySlug(row: { id: string; address?: string | null; city?: string | null; zip_code?: string | null }): string {
  const clean = (value: string, max = 80) => value.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, max);
  return [row.address ? clean(row.address, 50) : '', row.city ? clean(row.city) : '', row.zip_code || '', row.id]
    .filter(Boolean)
    .join('-');
}

function residenceSchemaType(propertyType: string): 'Apartment' | 'House' | 'Residence' {
  const type = propertyType.toLowerCase();
  if (type.includes('condo') || type.includes('coop') || type.includes('co-op') || type.includes('apartment')) return 'Apartment';
  if (type.includes('single') || type.includes('townhouse')) return 'House';
  return 'Residence';
}

async function getPropertyMeta(slug: string): Promise<PageMeta | null> {
  try {
    const propertyId = extractPropertyId(slug);
    const result = await db.execute(sql`
      SELECT id, address, city, state, zip_code, property_type, estimated_value,
             last_sale_price, last_sale_date, sqft, beds, baths, year_built,
             opportunity_score, latitude, longitude,
             (SELECT published_at FROM current_published_dataset ORDER BY published_at DESC NULLS LAST LIMIT 1) AS published_at
      FROM properties p
      WHERE p.id = ${propertyId}
        AND ${publicPropertyPageSql('p')}
      LIMIT 1
    `);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as any;

    // Pull related data in parallel.
    const [salesRes, compsRes, zipStatsRes] = await Promise.all([
      db.execute(sql`
        SELECT sale_price, sale_date FROM sales
        WHERE property_id = ${row.id}
          AND sale_price BETWEEN 50000 AND 100000000
        ORDER BY sale_date DESC LIMIT 8
      `),
      row.zip_code
        ? db.execute(sql`
            SELECT id, address, city, zip_code, last_sale_price, last_sale_date,
                   beds, baths, sqft, opportunity_score
            FROM properties
            WHERE zip_code = ${row.zip_code}
              AND id != ${row.id}
              AND ${publicPropertyPageSql('properties')}
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
              AND ${publicPropertyPageSql('properties')}
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
    const title = `${address}${zip ? ` · ${zip}` : ''} | RD`;

    const descParts: string[] = [];
    if (type) descParts.push(type);
    if (price) descParts.push(`est. ${price}`);
    if (lastSalePriceNum) descParts.push(`last sold ${formatPrice(lastSalePriceNum)}`);
    if (sqftNum) descParts.push(`${sqftNum.toLocaleString()} sqft`);
    if (score && score >= 60) descParts.push(`opportunity score ${score}/100`);

    let description = `${address}${locationParts ? `, ${locationParts}` : ''}`;
    if (descParts.length) description += ` — ${descParts.join(', ')}`;
    description += '. Recorded sale history, comparable sales, and source-backed neighborhood context.';
    description = description.slice(0, 158);

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
      `<li><strong>Dataset publication:</strong> ${row.published_at ? escapeHtml(String(row.published_at).slice(0, 10)) : 'current validated snapshot'}; recorded sales and estimates, not a live listing or appraisal</li>`,
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
            return `<li><a href="/properties/${escapeHtml(propertySlug(c))}">${escapeHtml(label)}</a></li>`;
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
        <li><a href="/investment-opportunities">Opportunity screener — review published candidates</a></li>
        <li><a href="/methodology/opportunity-score">How the opportunity score is calculated</a></li>
      </ul>
    `;

    const intro = `
      <p>${escapeHtml(address)}${locationParts ? ` is a ${type ? escapeHtml(type.toLowerCase()) + ' ' : ''}property located in ${escapeHtml(locationParts)}` : ''}.
      This page combines verified sale history, comparable transactions${zip ? ` in ZIP ${escapeHtml(zip)}` : ''},
      neighborhood market statistics, and our proprietary opportunity score to help buyers and investors evaluate the property.</p>
      ${factsHtml ? `<ul>${factsHtml}</ul>` : ''}
    `;

    const cachedNarrative = await getCachedNarrative('property', row.id);
    const narrativeHtml = cachedNarrative?.narrative
      ? `<h2>Property analysis</h2>${cachedNarrative.narrative
          .split(/\n\n+/)
          .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
          .join('')}`
      : '';

    const propFaqs: Array<{ q: string; a: string }> = [];
    if (lastSalePriceNum && row.last_sale_date) {
      propFaqs.push({
        q: `When did ${address} last sell?`,
        a: `On ${String(row.last_sale_date).slice(0, 10)} for ${formatPrice(lastSalePriceNum)} (verified public record).`,
      });
    }
    if (lastSalePriceNum && zipMedian) {
      const diffPct = Math.round(((lastSalePriceNum - zipMedian) / zipMedian) * 100);
      const direction = diffPct < 0 ? `${Math.abs(diffPct)}% below` : diffPct > 0 ? `${diffPct}% above` : 'in line with';
      propFaqs.push({
        q: `How does this property compare to other sales in ZIP ${zip}?`,
        a: `The last recorded sale of ${formatPrice(lastSalePriceNum)} sits ${direction} the ZIP median of ${formatPrice(zipMedian)} across ${zipCount.toLocaleString()} tracked properties.`,
      });
    }
    if (priceNum) {
      propFaqs.push({
        q: `What is ${address} worth?`,
        a: `Our model estimates ${formatPrice(priceNum)}${score ? `, with an opportunity score of ${score}/100` : ''}. See the methodology page for how this is calculated.`,
      });
    }
    if (beds || baths || sqftNum || yearBuilt) {
      const parts = [
        beds ? `${beds} bedroom${beds === 1 ? '' : 's'}` : null,
        baths ? `${baths} bathroom${baths === 1 ? '' : 's'}` : null,
        sqftNum ? `${sqftNum.toLocaleString()} square feet` : null,
        yearBuilt ? `built in ${yearBuilt}` : null,
      ].filter(Boolean).join(', ');
      propFaqs.push({
        q: `What are the basic details of ${address}?`,
        a: `Public records list this ${(type || 'property').toLowerCase()} as ${parts}.`,
      });
    }
    if (zip) {
      propFaqs.push({
        q: `What neighborhood is ${address} in?`,
        a: `${city ? `${city}, ` : ''}${state} (ZIP ${zip}). See the full neighborhood report for ${zip} for market trends and comparable sales.`,
      });
    }

    const propFaqHtml = propFaqs.length
      ? `<h2>Frequently asked questions</h2><dl>${propFaqs
          .map((f) => `<dt><strong>${escapeHtml(f.q)}</strong></dt><dd>${escapeHtml(f.a)}</dd>`)
          .join('')}</dl>`
      : '';

    const bodyHtml = `${intro}${narrativeHtml}${salesHtml}${neighborhoodHtml}${compsHtml}${propFaqHtml}${relatedLinksHtml}`;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': residenceSchemaType(type),
      name: address,
      url: `${SITE_URL}/properties/${propertySlug(row)}`,
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
    const canonicalPropertyPath = `/properties/${propertySlug(row)}`;

    const propBreadcrumb: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        ...(state ? [{ '@type': 'ListItem', position: 2, name: STATE_NAMES[state] || state, item: `${SITE_URL}/browse/${state.toLowerCase()}` }] : []),
        ...(state && city ? [{ '@type': 'ListItem', position: 3, name: city, item: `${SITE_URL}/browse/${state.toLowerCase()}/${encodeURIComponent(city.toLowerCase())}` }] : []),
        { '@type': 'ListItem', position: (state ? 1 : 0) + (state && city ? 1 : 0) + 2, name: address, item: `${SITE_URL}${canonicalPropertyPath}` },
      ],
    };

    const propJsonLdArr: Record<string, any>[] = [jsonLd, propBreadcrumb];
    if (propFaqs.length) {
      propJsonLdArr.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: propFaqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }

    return {
      title,
      description,
      ogType: 'website',
      canonicalPath: canonicalPropertyPath,
      h1: address,
      bodyHtml,
      jsonLd: propJsonLdArr,
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
        AND ${publicUnitPageSql('condo_units')}
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
    if (geoType !== 'zip' || !/^[0-9]{5}$/.test(geoId)) return null;
    const result = await db.execute(sql`
      SELECT geography.zip_code, geography.canonical_name, geography.state,
        snapshot.median_price, snapshot.median_price_per_sqft, snapshot.transaction_count,
        snapshot.period_start, snapshot.period_end, version.published_at,
        COUNT(property.id)::int AS public_property_count
      FROM current_market_snapshots snapshot
      JOIN canonical_geographies geography ON geography.id = snapshot.geography_id
      JOIN current_published_dataset version ON version.id = snapshot.dataset_version_id
      JOIN properties property ON property.geography_id = geography.id
        AND ${publicPropertyPageSql('property')}
      WHERE geography.type = 'zip'
        AND geography.zip_code = ${geoId}
        AND snapshot.transaction_count >= 5
      GROUP BY geography.zip_code, geography.canonical_name, geography.state,
        snapshot.median_price, snapshot.median_price_per_sqft, snapshot.transaction_count,
        snapshot.period_start, snapshot.period_end, version.published_at
      LIMIT 1
    `);
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as any;
    const city = titleCase(row.canonical_name || 'New York');
    const state = row.state || 'NY';
    const median = row.median_price ? formatPrice(Number(row.median_price)) : null;
    const transactions = Number(row.transaction_count || 0);
    const total = Number(row.public_property_count || 0);
    const period = row.period_end ? String(row.period_end).slice(0, 10) : 'the current publication';
    const bodyHtml = `<p><strong>ZIP ${escapeHtml(geoId)}</strong> is the published ${escapeHtml(city)}, ${escapeHtml(state)} market area.</p>
      <ul><li><strong>Recorded transactions in sample:</strong> ${transactions.toLocaleString()}</li>
      <li><strong>Public property pages:</strong> ${total.toLocaleString()}</li>
      ${median ? `<li><strong>Median recorded price:</strong> ${escapeHtml(median)}</li>` : ''}</ul>
      <p>Data period through ${escapeHtml(period)}. This report is based on recorded transactions, not live listings. Dataset updates are manually validated and published.</p>`;
    return {
      title: `${geoId} Real Estate Data · ${city} | RD`,
      description: `ZIP ${geoId}, ${city}: ${transactions.toLocaleString()} recorded sales${median ? `, median ${median}` : ''}. Published source-backed market data through ${period}.`.slice(0, 158),
      ogType: 'website',
      canonicalPath: `/neighborhood/${encodeURIComponent(geoId)}?geoType=zip`,
      h1: `ZIP ${geoId} Market Report — ${city}`,
      bodyHtml,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'Place', name: `ZIP ${geoId} — ${city}`,
        address: { '@type': 'PostalAddress', postalCode: geoId, addressLocality: city, addressRegion: state, addressCountry: 'US' },
      },
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
      FROM properties WHERE state = ${upperState} AND ${publicPropertyPageSql('properties')}
    `);
    const row = result.rows[0] as any;
    const total = Number(row?.total || 0);
    if (total === 0) return null;
    const medianNum = row?.median ? Number(row.median) : null;
    const median = medianNum ? formatPrice(medianNum) : '';

    const bodyHtml = `
      <p>${total.toLocaleString()} properties in ${escapeHtml(stateName)}${median ? `. Median estimated value: ${escapeHtml(median)}` : ''}.</p>
      <p>Browse published, source-backed records by city, ZIP code, and property type. Live listings are not included.</p>
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
      description: `Browse ${total.toLocaleString()} published, source-backed property records in ${stateName}.${median ? ` Median recorded price: ${median}.` : ''}`.slice(0, 158),
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
      FROM properties WHERE state = ${upperState} AND LOWER(city) = LOWER(${city})
        AND ${publicPropertyPageSql('properties')}
    `);
    const row = result.rows[0] as any;
    const total = Number(row?.total || 0);
    if (total === 0) return null;
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
      description: `Browse ${total.toLocaleString()} published, source-backed property records in ${city}, ${stateName}.${median ? ` Median recorded price: ${median}.` : ''}`.slice(0, 158),
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

export async function getDatabaseBackedMetaForUrl(url: string): Promise<PageMeta | null> {
  const path = url.split('?')[0];

  const unitMatch = path.match(/^\/unit\/(.+)$/);
  if (unitMatch) return getUnitMeta(unitMatch[1]);

  const propertyMatch = path.match(/^\/properties\/(.+)$/);
  if (propertyMatch) return getPropertyMeta(propertyMatch[1]);

  const legacyPropertyMatch = path.match(/^\/property\/(.+)$/);
  if (legacyPropertyMatch) return getPropertyMeta(legacyPropertyMatch[1]);

  const buildingMatch = path.match(/^\/building\/(.+)$/);
  if (buildingMatch) return getBuildingMeta(buildingMatch[1]);

  return null;
}

export async function getMetaForUrl(url: string): Promise<PageMeta | null> {
  const path = url.split('?')[0];

  if (path === '/') return DEFAULT_META;

  if (isPrivatePagePath(path)) {
    return {
      title: 'Account | Realtors Dashboard',
      description: 'Secure account and subscription management for Realtors Dashboard.',
      ogType: 'website',
      canonicalPath: path,
      robots: 'noindex, follow',
    };
  }

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

  if (isDatabaseBackedPagePath(path)) {
    const meta = await getDatabaseBackedMetaForUrl(url);
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

  return null;
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
    <p><em>${escapeHtml(guide.category)} · ${guide.readingMinutes} min read · By the Realtors Dashboard Data Editorial Team</em></p>
    <p>Published ${escapeHtml(guide.publishedDate)} · Last reviewed ${escapeHtml(guide.updatedDate)} · Methodology text-first-market-v1.1.0</p>
    <p>${escapeHtml(guide.intro)}</p>
    ${sectionsHtml}
    ${faqsHtml}
    <p><a href="${guide.productLink.href}">${escapeHtml(guide.productLink.label)}</a></p>
    ${relatedHtml}
    <h2>Sources, scope, and corrections</h2>
    <p>Current verified detail coverage is NYC recorded sales; live listings are not included. Sources: <a href="https://www.nyc.gov/site/finance/property/property-rolling-sales-update.page">NYC rolling sales</a>, <a href="https://a836-acris.nyc.gov/CP/">ACRIS</a>, and <a href="https://www.nyc.gov/site/planning/data-maps/open-data/dwn-pluto-mappluto.page">PLUTO</a>. This material is educational, not financial, legal, appraisal, or investment advice. <a href="mailto:hello@realtorsdashboard.com?subject=Data%20correction">Request a correction</a>.</p>
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
    description: guide.metaDescription.slice(0, 158),
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
    description: guide.metaDescription.slice(0, 158),
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

  const socialImageUrl = `${baseUrl}/og-image.png`;
  html = replaceOrAdd(html,
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:image" content="${escapeAttr(socialImageUrl)}" />`,
    'og:image'
  );
  html = replaceOrAdd(html,
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:image" content="${escapeAttr(socialImageUrl)}" />`,
    'twitter:image'
  );

  if (meta.robots) {
    html = replaceOrAdd(html,
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/,
      `<meta name="robots" content="${escapeAttr(meta.robots)}" />`,
      'name="robots"'
    );
  }

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
    const initialContent = `<main id="seo-content" style="max-width:760px;margin:2rem auto;padding:1rem;font-family:system-ui,sans-serif;line-height:1.5;">${h1Html}${meta.bodyHtml || ''}</main>`;
    html = html.replace('<div id="root"></div>', `<div id="root">${initialContent}</div>`);
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
