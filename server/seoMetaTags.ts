import { db } from './db';
import { sql } from 'drizzle-orm';

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

const DEFAULT_META: PageMeta = {
  title: 'Realtors Dashboard - Real Estate Market Intelligence',
  description: 'Find underpriced properties and understand market pricing with AI-powered real estate intelligence. Currently covering NY, NJ, CT with more states coming soon.',
  ogType: 'website',
  canonicalPath: '/',
  h1: 'Real Estate Market Intelligence',
  bodyHtml: `
    <p>Realtors Dashboard helps buyers, investors, and agents in New York, New Jersey, and Connecticut find underpriced properties using verified transaction data, proprietary opportunity scoring, and AI-powered analysis.</p>
    <ul>
      <li>Search 199,500+ properties across NY, NJ, and CT</li>
      <li>Pre-computed market statistics by ZIP, city, and county</li>
      <li>Up &amp; coming neighborhoods with momentum scoring</li>
      <li>Property comparison, neighborhood report cards, and an investment calculator</li>
    </ul>
  `,
};

const STATIC_PAGES: Record<string, PageMeta> = {
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
    bodyHtml: '<p>Free plan with limited daily searches. Pro at $29/month unlocks unlimited searches, AI deal memos, comps, exports, and the developer API. Premium adds portfolio tools.</p>',
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
    const result = await db.execute(sql`
      SELECT 
        cu.unit_bbl,
        cu.unit_designation,
        cu.unit_display_address,
        cu.building_display_address,
        cu.borough,
        cu.zip_code,
        cu.slug,
        cu.latitude,
        cu.longitude,
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
    const priceNum = row.sale_price ? Number(row.sale_price) : null;
    const price = priceNum ? formatPrice(priceNum) : null;

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

    const bodyHtml = `
      <p><strong>Address:</strong> ${escapeHtml(displayAddress)}${borough ? `, ${escapeHtml(borough)}` : ''}${zip ? ` ${escapeHtml(zip)}` : ', NY'}</p>
      ${price ? `<p><strong>Last recorded sale:</strong> ${escapeHtml(price)}${row.sale_date ? ` on ${escapeHtml(String(row.sale_date).slice(0, 10))}` : ''}</p>` : ''}
      <p>This page shows verified transaction history, opportunity scoring, building-level price trends, and comparable sales for this condo unit.</p>
    `;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'Residence',
      name: displayAddress,
      address: {
        '@type': 'PostalAddress',
        streetAddress: displayAddress,
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
      title,
      description,
      ogType: 'website',
      canonicalPath: `/unit/${row.slug || row.unit_bbl}`,
      h1: displayAddress,
      bodyHtml,
      jsonLd,
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
        beds,
        baths,
        year_built,
        opportunity_score,
        latitude,
        longitude
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
    const priceNum = row.estimated_value ? Number(row.estimated_value) : null;
    const price = priceNum ? formatPrice(priceNum) : null;
    const type = row.property_type || '';
    const sqftNum = row.sqft ? Number(row.sqft) : null;
    const sqft = sqftNum ? sqftNum.toLocaleString() : null;
    const beds = row.beds ? Number(row.beds) : null;
    const baths = row.baths ? Number(row.baths) : null;
    const yearBuilt = row.year_built ? Number(row.year_built) : null;
    const score = row.opportunity_score ? Number(row.opportunity_score) : null;

    const locationParts = [city, state, zip].filter(Boolean).join(', ');
    const title = `${address}${locationParts ? `, ${locationParts}` : ''} | Realtors Dashboard`;

    const descParts: string[] = [];
    if (type) descParts.push(type);
    if (price) descParts.push(`estimated at ${price}`);
    if (sqft) descParts.push(`${sqft} sqft`);
    if (score && score >= 60) descParts.push(`opportunity score ${score}/100`);

    let description = `${address}`;
    if (locationParts) description += `, ${locationParts}`;
    if (descParts.length > 0) description += ` - ${descParts.join(', ')}`;
    description += '. View detailed analysis, market comparisons, and AI insights on Realtors Dashboard.';

    const factsHtml = [
      type ? `<li><strong>Property type:</strong> ${escapeHtml(type)}</li>` : '',
      price ? `<li><strong>Estimated value:</strong> ${escapeHtml(price)}</li>` : '',
      sqft ? `<li><strong>Square footage:</strong> ${escapeHtml(sqft)} sqft</li>` : '',
      beds ? `<li><strong>Bedrooms:</strong> ${beds}</li>` : '',
      baths ? `<li><strong>Bathrooms:</strong> ${baths}</li>` : '',
      yearBuilt ? `<li><strong>Year built:</strong> ${yearBuilt}</li>` : '',
      score ? `<li><strong>Opportunity score:</strong> ${score}/100</li>` : '',
    ].filter(Boolean).join('');

    const bodyHtml = `
      <p><strong>Address:</strong> ${escapeHtml(address)}${locationParts ? `, ${escapeHtml(locationParts)}` : ''}</p>
      ${factsHtml ? `<ul>${factsHtml}</ul>` : ''}
      <p>This page shows property details, opportunity scoring, comparable sales, market context, and AI-generated insights.</p>
    `;

    const jsonLd: Record<string, any> = {
      '@context': 'https://schema.org',
      '@type': 'SingleFamilyResidence',
      name: address,
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

    return {
      title,
      description: description.slice(0, 300),
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
