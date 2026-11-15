import { floridaCounties, floridaSource, floridaUses, floridaZip } from "../shared/floridaSales";
import { generatedDocumentResponse } from "./documentResponse";
import {
  countyComparisonDirectory, countyDetails, countySummary, floridaAmount, floridaCount,
  getFloridaInsights, labelFloridaMonth, statewideSummary,
} from "./floridaInsights";
import { escapeSitemapXml, SITEMAP_ORIGIN } from "./sitemapSnapshot";

import { activeFloridaRelease, floridaCountyBySlug as countyBySlug, floridaCoverage, type ActiveFloridaRelease, type FloridaSaleRow } from "./floridaDataset";

const escape = escapeSitemapXml;
const pageSize = 50;
const root = "/florida";
const insightsPublishedOn = "2026-11-15";
export const floridaSitemapPath = "/sitemap-florida.xml";

export function isFloridaDocument(pathname: string): boolean {
  return pathname === root || pathname.startsWith(root + "/");
}

export async function floridaSitemap(db: D1Database) {
  const release = await activeFloridaRelease(db);
  if (!release) return null;
  const areas = await floridaCoverage(db, release.id);
  const dataDate = release.published_at.slice(0, 10);
  const lastmod = getFloridaInsights(release.id, areas) && insightsPublishedOn > dataDate ? insightsPublishedOn : dataDate;
  const paths = [root, ...floridaCounties.map(county => root + "/" + county.slug)];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map(path => "<url><loc>" + escape(SITEMAP_ORIGIN + path) + "</loc><lastmod>" + lastmod + "</lastmod></url>").join("\n") +
    "\n</urlset>\n";
}

function breadcrumbs(canonical: string) {
  const county = countyBySlug.get(canonical.slice(root.length + 1));
  return [{ name: "Home", path: "/" }, { name: "Florida property sales", path: root }].concat(
    county ? [{ name: county.name + " County", path: canonical }] : [],
  );
}

function html(request: Request, title: string, description: string, body: string, status: number, canonical: string, indexable: boolean) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": status === 200 && indexable ? "public, max-age=300, no-transform" : "no-store, no-transform",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  });
  if (!indexable) headers.set("x-robots-tag", "noindex, follow");
  if (status === 503) headers.set("retry-after", "120");
  const trail = status === 200 ? breadcrumbs(canonical) : [];
  const countySlug = canonical.slice(root.length + 1);
  const marketPath = "/housing-markets/florida" + (countyBySlug.has(countySlug) ? "/" + countySlug : "");
  const breadcrumbNavigation = trail.length ? '<nav class="crumbs" aria-label="Breadcrumb"><ol>' +
    trail.map((item, index) => index === trail.length - 1
      ? '<li aria-current="page">' + escape(item.name) + '</li>'
      : '<li><a href="' + item.path + '">' + escape(item.name) + '</a></li>').join("") + '</ol></nav>' : "";
  const breadcrumbSchema = indexable ? '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem", position: index + 1, name: item.name, item: SITEMAP_ORIGIN + item.path,
    })),
  }).replace(/</g, "\\u003c") + '</script>' : "";
  return generatedDocumentResponse(request, '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escape(title + " | Realtors Dashboard") + "</title>" +
    '<meta name="description" content="' + escape(description) + '">' +
    '<link rel="canonical" href="' + escape(SITEMAP_ORIGIN + canonical) + '">' + breadcrumbSchema +
    "<style>" +
    ":root{color-scheme:light dark;--bg:#f8fafc;--card:white;--ink:#162235;--muted:#455873;--line:#d5dfe9;--link:#1259b5}" +
    "@media(prefers-color-scheme:dark){:root{--bg:#0e1724;--card:#162235;--ink:#f1f5f9;--muted:#b6c6dd;--line:#38465a;--link:#91c3ff}}" +
    "*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--bg);font:1rem/1.55 system-ui,sans-serif}" +
    "header,footer{background:var(--card);border-block-end:1px solid var(--line)}nav,main,footer p{max-width:72rem;margin:auto;padding:1rem}" +
    "nav{display:flex;gap:1.25rem;align-items:baseline;flex-wrap:wrap}a{color:var(--link);text-underline-offset:.17em}" +
    "main{padding-block:2rem}h1{font-size:clamp(2rem,5vw,3rem);line-height:1.1;margin:0 0 .7rem}p{max-width:70ch}.muted{color:var(--muted)}" +
    ".counties{display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));gap:.75rem;padding:0;list-style:none}" +
    ".counties a{display:block;padding:.85rem 1rem;background:var(--card);border:1px solid var(--line);border-radius:.4rem}" +
    "form{display:flex;gap:.75rem;flex-wrap:wrap;align-items:end;margin-block:1.4rem}label{display:grid;gap:.25rem}" +
    "input,button{font:inherit;padding:.5rem .65rem;border:1px solid var(--line);border-radius:.35rem;background:var(--card);color:var(--ink)}" +
    "button{cursor:pointer;background:#1259b5;color:#fff}input{max-width:100%}.results{overflow:auto;background:var(--card);border:1px solid var(--line)}" +
    "table{width:100%;border-collapse:collapse;text-align:left;min-width:37rem}td,th{padding:.65rem .75rem;border-bottom:1px solid var(--line)}" +
    "th{font-size:.9rem}.amount{white-space:nowrap;text-align:right}.pages{display:flex;gap:1.2rem;flex-wrap:wrap;padding:0;margin-block:1rem}" +
    "th[scope=row]{font-weight:550}.comparison{min-width:20rem}.results+.results{margin-top:1rem}section+section{margin-top:2rem}" +
    ".crumbs{padding:0;margin-bottom:1rem}.crumbs ol,.jump{display:flex;flex-wrap:wrap;gap:.65rem 1rem;padding:0;list-style:none;margin:0}" +
    ".crumbs li+li:before{content:'›';margin-right:.65rem;color:var(--muted)}" +
    ".facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.75rem}.facts div{padding:.75rem 1rem;border:1px solid var(--line);background:var(--card);border-radius:.35rem}.facts dd{margin:0;font-size:1.25rem;font-weight:650}.facts dt{color:var(--muted)}" +
    "select{font:inherit;padding:.5rem .65rem;border:1px solid var(--line);border-radius:.35rem;background:var(--card);color:var(--ink)}" +
    "footer{border-block-start:1px solid var(--line);border-block-end:0}</style></head><body>" +
    '<header><nav aria-label="Main"><strong><a href="/">Realtors Dashboard</a></strong><a href="/browse/ny">New York</a>' +
    '<a href="/florida">Florida</a><a href="' + marketPath + '">Florida housing market data</a><a href="/housing-markets">U.S. housing markets</a><a href="/methodology/data-coverage">Data coverage</a></nav></header><main>' + breadcrumbNavigation + body +
    '</main><footer><p>Source <a href="' + floridaSource + '">Florida Geospatial Open Data Portal</a> and Florida Department of Revenue.</p></footer></body></html>',
    status, headers);
}

const notFound = (request: Request) => html(request, "Florida page not found", "Find published Florida county sales.",
  '<h1>Florida page not found</h1><p><a href="/florida">Browse Florida counties</a></p>', 404, root, false);

function sourceNote(release: ActiveFloridaRelease) {
  return '<p class="muted">Published ' + escape(release.published_at.slice(0, 10)) +
    ' from the Florida Department of Revenue parcel roll, updated ' + escape(release.source_updated_at.slice(0, 10)) +
    '. The snapshot includes properties whose most recent reported sale qualified and occurred since ' + escape(labelFloridaMonth(release.start_month)) +
    '. Sale dates are reported by month. See <a href="/methodology/data-coverage">data sources and coverage</a>.</p>';
}

export async function floridaDocument(request: Request, db: D1Database | undefined): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "");
  const countySlug = pathname === root ? undefined : pathname.slice(root.length + 1);
  const county = countySlug && countyBySlug.get(countySlug.toLowerCase());
  if (countySlug && !county) return notFound(request);
  const canonical = county ? root + "/" + county.slug : root;
  if (url.hostname === "www.realtorsdashboard.com" || url.pathname !== canonical) {
    return Response.redirect(SITEMAP_ORIGIN + canonical + url.search, 301);
  }
  if (!db) return notFound(request);
  try {
    const release = await activeFloridaRelease(db);
    if (!release) return notFound(request);
    const areas = await floridaCoverage(db, release.id);
    const insights = getFloridaInsights(release.id, areas);
    if (!county) {
      const total = [...areas.values()].reduce((sum, area) => sum + area.records, 0);
      const links = floridaCounties.map(area => '<li><a href="' + root + "/" + area.slug + '">' + escape(area.name) +
        ' County <span class="muted">· ' + areas.get(area.code)!.records.toLocaleString("en-US") + "</span></a></li>").join("");
      return html(request, "Florida Property Sales by County",
        "Compare recorded property sale prices across all 67 Florida counties. Browse county sales and filter by ZIP, city, address, or property type.",
        "<h1>Florida property sales</h1><p>Browse " + total.toLocaleString("en-US") +
        " sale-backed residential properties across all 67 counties.</p>" + sourceNote(release) +
        (insights ? '<p class="jump"><a href="#county-comparison">Compare counties</a></p>' +
          statewideSummary(insights) + countyComparisonDirectory(insights) : '<ul class="counties">' + links + "</ul>"),
        200, canonical, !url.search);
    }
    const area = areas.get(county.code)!;
    const zip = (url.searchParams.get("zip") ?? "").trim();
    const search = (url.searchParams.get("q") ?? "").trim();
    const city = (url.searchParams.get("city") ?? "").trim();
    const use = (url.searchParams.get("type") ?? "").trim();
    const rawPage = url.searchParams.get("page") ?? "1";
    const page = Number(rawPage);
    if ((zip && !floridaZip.test(zip)) || search.length > 80 || city.length > 46 ||
        (use && !Object.hasOwn(floridaUses, use)) || !/^[1-9]\d{0,5}$/.test(rawPage) ||
        page > Math.ceil(area.records / pageSize)) return notFound(request);
    const where = ["release_id = ?", "county_code = ?"];
    const bindings: Array<string | number> = [release.id, county.code];
    if (zip) { where.push("zip = ?"); bindings.push(zip); }
    if (search) { where.push("instr(lower(address || ' ' || city), lower(?)) > 0"); bindings.push(search); }
    if (city) { where.push("upper(city) = upper(?)"); bindings.push(city); }
    if (use) { where.push("property_use = ?"); bindings.push(use); }
    const result = await db.prepare("SELECT address, city, zip, property_use, sale_month, price FROM florida_sales WHERE " +
      where.join(" AND ") + " ORDER BY sale_month DESC, parcel_id ASC LIMIT ? OFFSET ?")
      .bind(...bindings, pageSize + 1, (page - 1) * pageSize).all<Omit<FloridaSaleRow, "parcel_id">>();
    if (!result.results.length && (page > 1 || (!zip && !search && !city && !use))) return notFound(request);
    const rows = result.results.slice(0, pageSize).map(row => "<tr><td>" + escape(row.address) + "<br><small>" +
      escape(row.city + ", FL " + row.zip) + "</small></td><td>" + escape(floridaUses[row.property_use]) + "</td><td>" +
      escape(labelFloridaMonth(row.sale_month)) + '</td><td class="amount">' + floridaAmount(row.price) + "</td></tr>").join("");
    const link = (number: number, label: string) => {
      const params = new URLSearchParams();
      if (zip) params.set("zip", zip);
      if (search) params.set("q", search);
      if (city) params.set("city", city);
      if (use) params.set("type", use);
      if (number > 1) params.set("page", String(number));
      return '<a href="' + escape(canonical + (params.size ? "?" + params : "")) + '">' + label + "</a>";
    };
    const options = Object.entries(floridaUses).map(([code, label]) => '<option value="' + code + '"' +
      (code === use ? " selected" : "") + ">" + escape(label) + "</option>").join("");
    const form = '<form action="' + canonical + '">' + (city ? '<input type="hidden" name="city" value="' + escape(city) + '">' : "") +
      '<label>ZIP<input name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" value="' +
      escape(zip) + '"></label><label>Address or city<input name="q" maxlength="80" value="' + escape(search) +
      '"></label><label>Property type<select name="type"><option value="">All property types</option>' + options +
      '</select></label><button type="submit">Search sales</button></form>';
    const resultArea = rows ? '<div class="results"><table aria-label="Published sales"><thead><tr><th>Property</th><th>Type</th>' +
      '<th>Sale month</th><th class="amount">Recorded price</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<nav class="pages" aria-label="Sales pages">' + (page > 1 ? link(page - 1, "Previous page") : "") +
      (page > 1 || result.results.length > pageSize ? "<span>Page " + page + "</span>" : "") +
      (result.results.length > pageSize ? link(page + 1, "Next page") : "") + "</nav>"
      : '<p>No published sales match these filters. Try another address or ZIP, or <a href="' + canonical + '">clear the filters</a>.</p>';
    const title = county.name + " County, FL Property Sales";
    const profile = insights?.counties[county.code];
    const description = profile
      ? "Explore " + county.name + " County, Florida property sales. See the " + floridaAmount(profile.median) +
        " median, ZIP and property type breakdowns, and " + floridaCount(profile.records) + " sale records."
      : "Browse " + floridaCount(area.records) + " sale-backed properties in " + county.name +
        " County, Florida, with recorded prices and sale months by ZIP and address.";
    const filters = zip || search || city || use;
    const searchSection = '<section aria-labelledby="search-sales"><h2 id="search-sales">Search published sales</h2>' +
      (city ? '<p>Postal city: ' + escape(city) + '. <a href="' + canonical + '#search-sales">Clear filters</a>.</p>' : "") +
      form + resultArea + '</section>';
    return html(request, title, description, '<h1>' + escape(title) + "</h1><p>" +
      floridaCount(area.records) + " sale-backed properties. Latest sale month " + escape(labelFloridaMonth(area.latest_month)) +
      ".</p>" + sourceNote(release) + (profile && !filters && page === 1 ? countySummary(profile, county.name) : "") +
      searchSection + (insights && !filters && page === 1 ? countyDetails(county, insights) : ""),
      200, canonical, !url.search);
  } catch (error) {
    console.error("Florida sales publication", error instanceof Error ? error.message : String(error));
    return html(request, "Florida sales temporarily unavailable", "Retry the Florida sales report shortly.",
      '<h1>Florida sales temporarily unavailable</h1><p>Please try again shortly.</p>', 503, canonical, false);
  }
}
