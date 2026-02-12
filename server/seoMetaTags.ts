import { db } from './db';
import { sql } from 'drizzle-orm';

interface PageMeta {
  title: string;
  description: string;
  ogType: string;
  canonicalPath: string;
}

const DEFAULT_META: PageMeta = {
  title: 'Realtors Dashboard - Real Estate Market Intelligence',
  description: 'Find underpriced properties and understand market pricing with AI-powered real estate intelligence. Currently covering NY, NJ, CT with more states coming soon.',
  ogType: 'website',
  canonicalPath: '/',
};

const STATIC_PAGES: Record<string, PageMeta> = {
  '/market-intelligence': {
    title: 'Market Intelligence - Realtors Dashboard',
    description: 'Explore real estate market statistics by geography. Median prices, sales volume, price trends, and inventory data for NY, NJ, and CT.',
    ogType: 'website',
    canonicalPath: '/market-intelligence',
  },
  '/investment-opportunities': {
    title: 'Investment Opportunities - Realtors Dashboard',
    description: 'Find underpriced properties with AI-powered opportunity scoring. Identify deals based on verified sale prices and market comparisons.',
    ogType: 'website',
    canonicalPath: '/investment-opportunities',
  },
  '/up-and-coming': {
    title: 'Up & Coming ZIP Codes - Realtors Dashboard',
    description: 'Discover trending neighborhoods with rising property values. Data-driven analysis of emerging real estate markets in the Tri-State area.',
    ogType: 'website',
    canonicalPath: '/up-and-coming',
  },
  '/pricing': {
    title: 'Pricing - Realtors Dashboard',
    description: 'Choose the plan that fits your needs. Free, Pro, and Premium tiers with AI-powered property analysis, deal memos, and market intelligence.',
    ogType: 'website',
    canonicalPath: '/pricing',
  },
  '/about': {
    title: 'About - Realtors Dashboard',
    description: 'Learn about Realtors Dashboard, a real estate intelligence platform providing transparent, data-backed insights for buyers, investors, and agents.',
    ogType: 'website',
    canonicalPath: '/about',
  },
  '/faq': {
    title: 'FAQ - Realtors Dashboard',
    description: 'Frequently asked questions about Realtors Dashboard, our data sources, scoring methodology, and subscription plans.',
    ogType: 'website',
    canonicalPath: '/faq',
  },
  '/contact': {
    title: 'Contact Us - Realtors Dashboard',
    description: 'Get in touch with the Realtors Dashboard team. Questions about our platform, data, or subscription plans.',
    ogType: 'website',
    canonicalPath: '/contact',
  },
  '/terms': {
    title: 'Terms of Service - Realtors Dashboard',
    description: 'Terms of service for using the Realtors Dashboard platform.',
    ogType: 'website',
    canonicalPath: '/terms',
  },
  '/privacy': {
    title: 'Privacy Policy - Realtors Dashboard',
    description: 'Privacy policy for the Realtors Dashboard platform. How we collect, use, and protect your data.',
    ogType: 'website',
    canonicalPath: '/privacy',
  },
  '/developers': {
    title: 'Developer API - Realtors Dashboard',
    description: 'Access real estate data programmatically with the Realtors Dashboard API. Properties, market stats, comps, and trending ZIP codes.',
    ogType: 'website',
    canonicalPath: '/developers',
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

async function getUnitMeta(unitBbl: string): Promise<PageMeta | null> {
  try {
    const result = await db.execute(sql`
      SELECT 
        cu.unit_bbl,
        cu.unit_designation,
        cu.unit_display_address,
        cu.building_display_address,
        cu.borough,
        cu.zip_code,
        cu.slug,
        s.sale_price,
        s.sale_date
      FROM condo_units cu
      LEFT JOIN LATERAL (
        SELECT sale_price, sale_date 
        FROM sales 
        WHERE unit_bbl = cu.unit_bbl 
        ORDER BY sale_date DESC 
        LIMIT 1
      ) s ON true
      WHERE cu.unit_bbl = ${unitBbl} OR cu.slug = ${unitBbl}
      LIMIT 1
    `);

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as any;
    const borough = row.borough ? titleCase(row.borough) : '';
    const zip = row.zip_code || '';
    const price = row.sale_price ? formatPrice(Number(row.sale_price)) : null;

    const displayAddress = row.unit_display_address
      ? titleCase(row.unit_display_address)
      : row.building_display_address
        ? `${titleCase(row.building_display_address)}${row.unit_designation ? `, ${row.unit_designation}` : ''}`
        : 'Property';

    const locationParts = [borough, zip].filter(Boolean).join(' ');
    const title = `${displayAddress}${locationParts ? ` - ${locationParts}` : ''} | Realtors Dashboard`;

    let description = `View details for ${displayAddress}`;
    if (locationParts) description += ` in ${locationParts}`;
    description += '.';
    if (price) description += ` Last sale: ${price}.`;
    description += ' Verified transaction data, opportunity scoring, and market comparisons.';

    return {
      title,
      description,
      ogType: 'website',
      canonicalPath: `/unit/${row.slug || row.unit_bbl}`,
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
      SELECT 
        address,
        city,
        state,
        zip_code,
        property_type,
        estimated_value,
        sqft,
        year_built,
        opportunity_score
      FROM properties
      WHERE id = ${propertyId}
      LIMIT 1
    `);

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as any;
    const address = titleCase(row.address || 'Property');
    const city = row.city ? titleCase(row.city) : '';
    const state = row.state || '';
    const zip = row.zip_code || '';
    const price = row.estimated_value ? formatPrice(Number(row.estimated_value)) : null;
    const type = row.property_type || '';
    const sqft = row.sqft ? Number(row.sqft).toLocaleString() : null;
    const score = row.opportunity_score ? Number(row.opportunity_score) : null;

    const locationParts = [city, state, zip].filter(Boolean).join(', ');
    const title = `${address}${locationParts ? `, ${locationParts}` : ''} | Realtors Dashboard`;

    let descParts = [];
    if (type) descParts.push(type);
    if (price) descParts.push(`estimated at ${price}`);
    if (sqft) descParts.push(`${sqft} sqft`);
    if (score && score >= 60) descParts.push(`opportunity score ${score}/100`);

    let description = `${address}`;
    if (locationParts) description += `, ${locationParts}`;
    if (descParts.length > 0) description += ` - ${descParts.join(', ')}`;
    description += '. View detailed analysis, market comparisons, and AI insights on Realtors Dashboard.';

    return {
      title,
      description: description.slice(0, 300),
      ogType: 'website',
      canonicalPath: `/properties/${slug}`,
    };
  } catch (err) {
    console.error('[SEO] Error fetching property meta:', err);
    return null;
  }
}

const STATE_NAMES: Record<string, string> = {
  NY: 'New York',
  NJ: 'New Jersey',
  CT: 'Connecticut',
};

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
    const median = row?.median ? formatPrice(row.median) : '';
    return {
      title: `${stateName} Real Estate - ${total.toLocaleString()} Properties | Realtors Dashboard`,
      description: `Browse ${total.toLocaleString()} properties in ${stateName}. ${median ? `Median price: ${median}. ` : ''}Explore cities, neighborhoods, and find investment opportunities.`,
      ogType: 'website',
      canonicalPath: `/browse/${state.toLowerCase()}`,
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
    const median = row?.median ? formatPrice(row.median) : '';
    return {
      title: `${city}, ${stateName} Real Estate - ${total.toLocaleString()} Properties | Realtors Dashboard`,
      description: `Browse ${total.toLocaleString()} properties in ${city}, ${stateName}. ${median ? `Median price: ${median}. ` : ''}View ZIP codes, property types, and investment opportunities.`,
      ogType: 'website',
      canonicalPath: `/browse/${state.toLowerCase()}/${encodeURIComponent(city)}`,
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

  return DEFAULT_META;
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

  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
