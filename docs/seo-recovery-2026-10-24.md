# Search recovery status — 2026-10-24

## Evidence and scope

The supplied Search Console export reports 149 indexed and 216,068 not-indexed **all-known** URLs as of October 15. The latter includes 121,208 historical 404s, 21,644 soft 404s, and 10,424 5xx responses; it is not a count of current sitemap defects. The currently submitted sitemap index listed 10,780 discovered URLs when Search Console last read it on October 18. A live regression sampled 10 sitemap entity URLs and found no duplicates or failures; this sample does not prove every listed URL is healthy.

Production database spot checks show that some old property IDs still exist but are not publishable: one Connecticut address has a New York ZIP, and another lacks a linked sale. Those must not be restored to the public sitemap merely to reduce a historical 404 count.

## Changes prepared in this release

- Keep invalid entity URLs as 404/noindex, but distinguish temporary database/SEO failures with a non-cacheable 503 and `Retry-After` instead of a false 404 or generic 200 shell.
- Serve crawlable HTML metadata and text when a crawler uses `Accept: */*` or omits `Accept`, not just when it sends `text/html`.
- Normalize document canonicals to `https://realtorsdashboard.com`; combine `www`, trailing-slash, and entity-slug normalization into one redirect where the application controls the request.
- Make robots.txt and all sitemap URLs point to the apex domain. Googlebot is explicitly allowed; the separate Google-Extended AI-use restriction remains.
- Expand live regression checks for one H1, nonempty title/description, matching canonical, indexability, and sampled sitemap entity documents.
- Remove a stale 300K+ published-unit claim and a SearchAction markup target not backed by the current site search.

The site already has a generated sitemap index, static/entity metadata, some server-rendered page text, FAQ content/schema on relevant pages, breadcrumbs on selected entity pages, and internal links in its footer. Do not describe these as newly implemented across every page.

## Still required

1. Re-submit the already hosted sitemap index in Search Console after production deployment, then check the next download and error count. A submission requests a fetch; it does not force indexing.
2. Compare **submitted** rather than all-known coverage, inspect samples from the 5xx and soft-404 buckets, and reconcile old URLs by ID against current publication eligibility. Redirect only an exact legacy URL with a verified replacement.
3. Run a full internal-link/content crawl, assess guide and comparison claims with a human editor, and build richer server-rendered market/entity directories if thin-content or orphaning persists. The current implementation provides crawler HTML but does not server-render the complete interactive React application.
4. Measure mobile and desktop LCP, INP, and CLS in field data. No defensible under-two-second guarantee can be made from a successful build or a single synthetic test. The current public imagery is limited to favicon/social PNG assets; converting those to WebP is not automatically an improvement in compatibility or ranking.
5. A named author bio was skipped at the owner's request. Earned citations/backlinks require genuine sources and outreach, not purchased or automated link schemes.

## Useful services

- [Google Search Console](https://search.google.com/search-console/) — primary, free evidence for sitemap reads, indexing, URL Inspection, Core Web Vitals, and search performance.
- [PageSpeed Insights](https://pagespeed.web.dev/) — lab diagnostics plus CrUX field data where traffic is sufficient; assess representative home, market, ZIP, unit, and tool pages.
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/) — crawl titles, canonicals, status codes, redirects, internal links, and orphan candidates; its free crawl limit is 500 URLs, below this site's current sitemap size.
- Cloudflare request analytics/Worker logs — correlate Googlebot response status, redirects, D1 failures, and TTFB after release. Avoid using bot user-agent text alone as proof of Google's identity.

Google's [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) does not promise indexing. Its [Indexing API](https://developers.google.com/search/apis/indexing-api/v3/using-api) is limited to eligible job-posting and livestreaming pages, not real-estate records. Google says [FAQ rich results are no longer displayed](https://developers.google.com/search/updates), so FAQ schema is not a ranking shortcut. Google also [does not guarantee #1 rankings](https://developers.google.com/search/docs/fundamentals/do-i-need-seo) and treats purchased or automated ranking links as [link spam](https://developers.google.com/search/docs/essentials/spam-policies).
