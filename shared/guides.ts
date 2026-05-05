export interface GuideSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface Guide {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keyword: string;
  intent: string;
  category: string;
  productLink: { href: string; label: string };
  intro: string;
  publishedDate: string;
  updatedDate: string;
  readingMinutes: number;
  sections: GuideSection[];
  faqs?: GuideFaq[];
  relatedSlugs: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "how-to-find-underpriced-condos-nyc",
    title: "How to Find Underpriced NYC Condos Before Anyone Else",
    metaTitle:
      "How to Find Underpriced Condos in NYC (2026 Investor Guide) | Realtors Dashboard",
    metaDescription:
      "A repeatable workflow for finding underpriced NYC condos using verified ACRIS sales, $/sqft comp bands, and a 0-100 Opportunity Score. Used by buyers and investors across Manhattan, Brooklyn, and Queens.",
    keyword: "how to find underpriced condos NYC",
    intent: "Commercial / investor",
    category: "Investor playbooks",
    productLink: {
      href: "/investment-opportunities",
      label: "Open the Opportunity Screener",
    },
    intro:
      "Underpriced NYC condos do not stay underpriced for long. The window between a unit hitting the market and serious offers closing is usually a few days. Beating that window is not luck - it is a workflow built on verified sales data, tight comp pools, and a scoring system that ranks new inventory faster than you can read it. This guide walks through the exact steps used by buyers and investors on Realtors Dashboard to surface underpriced Manhattan, Brooklyn, and Queens condos before the rest of the market reacts.",
    publishedDate: "2026-04-08",
    updatedDate: "2026-05-05",
    readingMinutes: 9,
    sections: [
      {
        heading: "Define what 'underpriced' means in NYC",
        body: "Underpriced is a relative term. In NYC condo markets, it almost always means a unit priced meaningfully below the median price per square foot for tightly comparable recent sales in the same building or sub-neighborhood. The benchmark is verified ACRIS recorded sales, not other listings. If you compare a listing to other listings, you are comparing one estimate to another and the math collapses.",
        bullets: [
          "Pull the median $/sqft for verified sales in the same ZIP and property type from the last 12 months.",
          "Tighten the comp pool to the same building or one block radius when liquidity allows it.",
          "Treat anything more than 8-12 percent below that band as a candidate worth a deeper read, not as an automatic deal.",
        ],
      },
      {
        heading: "Set up a saved screener for new inventory",
        body: 'In the <a href="/investment-opportunities">Opportunity Screener</a>, filter on borough or ZIP, condo property type, your target unit size, and an Opportunity Score floor of 75. Save the search. Anything new that hits the screener with a score above your floor is a verified candidate, sorted by price-to-comp position.',
        bullets: [
          "Filter by Manhattan, Brooklyn, Queens, or specific ZIP groups.",
          "Restrict by bedrooms, sqft band, and price ceiling.",
          "Set Opportunity Score >= 75 to skip the noise.",
        ],
      },
      {
        heading: "Verify the comps before you act",
        body: 'Open the unit detail page and read the comps table. Every comp listed is a recorded ACRIS transaction - sale price, sale date, parcel ID, and the source. If a comp looks off (a $1 transfer, a bulk portfolio sale), it is filtered automatically, but you can also exclude individual comps and re-score on the fly. This is the step most buyers skip and most winners do not.',
      },
      {
        heading: "Read the building, not just the unit",
        body: 'NYC condos live inside buildings with their own history. Pull the building page, scan the recent sales in the building, and check the unit mix. A unit priced 12 percent under the building median when other units in the same line have been trading flat is a very different signal than the same discount in a building where the line has been falling for two quarters. The <a href="/methodology/opportunity-score">Opportunity Score methodology page</a> has the full breakdown of how building-level signals factor in.',
      },
      {
        heading: "Move fast on the verified candidates",
        body: 'Once you have one to three candidates that pass comp verification and building context, go fast. Run the numbers in the <a href="/calculator">Investment Calculator</a> with current FRED-sourced 30-year mortgage rates, decide on a max bid, and reach out same day. The investors who consistently win underpriced NYC condos do four things in under twenty-four hours: screen, verify comps, run financials, and make contact.',
      },
      {
        heading: "Common mistakes that cost deals",
        body: "Three patterns repeat in losing offers on underpriced units.",
        bullets: [
          "Trusting an automated estimate over the recorded sale: the recorded ACRIS price is the only price that actually changed hands.",
          "Comping across building lines: a low-floor B-line studio is not a comp for a high-floor A-line studio in the same building.",
          "Waiting a week to verify: by then the unit either has multiple offers or is already in contract.",
        ],
      },
    ],
    faqs: [
      {
        question: "What counts as 'underpriced' for an NYC condo?",
        answer:
          "Pricing meaningfully below the median $/sqft for verified ACRIS sales in the same ZIP, property type, and 12-month window - typically 8 percent or more below the comp median, with the size of the gap weighted by how tight the comp pool is.",
      },
      {
        question: "Are listing-portal estimates good enough to use as comps?",
        answer:
          "No. Listing portal estimates are model outputs, not transactions. Comping a listing against another estimate compares one model to another model. Only verified recorded sales should be used to anchor a comp.",
      },
    ],
    relatedSlugs: [
      "what-is-an-opportunity-score",
      "nyc-comparable-sales-investor-guide",
      "price-per-square-foot-nyc",
    ],
  },

  {
    slug: "what-is-an-opportunity-score",
    title: "What Is an Opportunity Score in Real Estate?",
    metaTitle:
      "What Is an Opportunity Score in Real Estate? (Plain-English Guide) | Realtors Dashboard",
    metaDescription:
      "An Opportunity Score is a 0-100 rating of how underpriced a property looks against verified comparable sales. Here is what goes into it, what it does not measure, and how to read the confidence band.",
    keyword: "real estate opportunity score explained",
    intent: "Education / category creation",
    category: "Concept explainers",
    productLink: {
      href: "/methodology/opportunity-score",
      label: "Read the full Opportunity Score methodology",
    },
    intro:
      "If you have seen a 0-100 number labeled 'Opportunity Score' on a real estate listing or screener, you are looking at a price-position indicator. It tries to answer a single question: how does this property's price compare to verified recent sales of similar properties? This guide explains in plain English what an Opportunity Score is, what goes into it, what it does not claim to measure, and how to use it without overweighting it.",
    publishedDate: "2026-04-10",
    updatedDate: "2026-05-05",
    readingMinutes: 7,
    sections: [
      {
        heading: "The one-sentence definition",
        body: "An Opportunity Score is a 0-100 rating of how underpriced a property is relative to verified comparable sales and current market context. Higher scores mean a better price-to-comp position. That is the whole job of the score.",
      },
      {
        heading: "What goes into the score",
        body: 'Opportunity scoring blends four signal families. The exact weights depend on data density in the local market, but the families are the same everywhere we score.',
        bullets: [
          "Price vs comps: median $/sqft and median price for tightly matched comparable sales in the same ZIP and property type.",
          "Recency: trades within the last twelve months are weighted more heavily than older transactions.",
          "Property fit: square footage, bed/bath count, year built, and unit class narrow the comp pool before pricing is computed.",
          "Market trend: ZIP-level momentum (price appreciation, sales velocity) adjusts the expected price band for the current quarter.",
        ],
      },
      {
        heading: "Why every score has a confidence band",
        body: "A score from a deep, recent comp pool is more reliable than a score from a thin one. That is why every Opportunity Score on the platform is paired with a confidence band that reflects pool size and recency. A score of 88 with high confidence and a score of 88 with low confidence are not the same finding - the second one is a hypothesis, the first is a verified position.",
      },
      {
        heading: "What an Opportunity Score is not",
        body: "Three things the score deliberately does not claim:",
        bullets: [
          "It is not an appraisal. Appraisals require a licensed appraiser and an in-person inspection.",
          "It is not a yield or cash-flow forecast. Use the Investment Calculator for income math.",
          "It is not a buy recommendation. It is a prioritization signal so you read the right comps first.",
        ],
      },
      {
        heading: "How to actually use it",
        body: 'Start by sorting your screener results by score, then read the comps before doing anything else. A high score is an invitation to verify, not a conclusion. <a href="/methodology/verified-vs-estimates">Verified sales vs estimates</a> covers the data provenance behind every comp the score uses.',
      },
      {
        heading: "Where you will see it on the platform",
        body: 'Opportunity Scores appear on every property and unit detail page, in the <a href="/investment-opportunities">Opportunity Screener</a>, in saved watchlist alerts, and in API responses on the <a href="/developers">developer endpoints</a>.',
      },
    ],
    faqs: [
      {
        question: "Is the Opportunity Score the same as a Zestimate?",
        answer:
          "No. A Zestimate is a model-produced price prediction. An Opportunity Score is a price-position rating that compares the listed or estimated price to verified recent comparable sales. They answer different questions.",
      },
      {
        question: "Can a low Opportunity Score still be a good investment?",
        answer:
          "Yes. The score only measures price relative to comps. A property at fair market price might still be a good investment for cash flow, location, or strategic reasons that the price-position score does not measure.",
      },
    ],
    relatedSlugs: [
      "verified-sales-vs-estimates-investors",
      "nyc-comparable-sales-investor-guide",
      "how-to-find-underpriced-condos-nyc",
    ],
  },

  {
    slug: "nyc-condo-market-2026",
    title: "NYC Condo Market 2026: Prices, Trends, and Where to Buy",
    metaTitle:
      "NYC Condo Market 2026: Prices, Trends, and Where to Buy | Realtors Dashboard",
    metaDescription:
      "A 2026 view of the NYC condo market by borough and ZIP: median prices, $/sqft trends, sales velocity, and where buyers are finding the strongest opportunity-score inventory.",
    keyword: "NYC condo market 2026",
    intent: "Market research",
    category: "Market reports",
    productLink: {
      href: "/market-intelligence",
      label: "Open the Market Explorer",
    },
    intro:
      "The 2026 NYC condo market is not a single market - it is a stack of borough and ZIP-level markets moving at different speeds. This guide breaks down what the verified sales data is showing across Manhattan, Brooklyn, Queens, and the Bronx in 2026, where median prices and $/sqft are settling, and which ZIP groups are producing the most high-Opportunity-Score inventory.",
    publishedDate: "2026-04-12",
    updatedDate: "2026-05-05",
    readingMinutes: 10,
    sections: [
      {
        heading: "How to read borough-level numbers in 2026",
        body: "Borough averages hide everything that matters. A Manhattan median price tells you almost nothing about Inwood vs Tribeca. The right unit of analysis for condos in 2026 is ZIP, sub-neighborhood, or building - not borough. Use borough numbers for context only.",
      },
      {
        heading: "Manhattan: priced for selectivity",
        body: 'Manhattan condo $/sqft remains the highest in the city, with sub-neighborhood spreads wider than they have been in years. The strongest opportunity-score inventory is concentrated in pockets where new supply caught up to demand and motivated sellers are taking visible markdowns. Use the <a href="/market-intelligence">Market Explorer</a> to compare ZIP-level $/sqft and stay anchored to verified ACRIS sales rather than asking-price medians.',
      },
      {
        heading: "Brooklyn: the broadest opportunity surface",
        body: "Brooklyn has the largest spread between low-Opportunity-Score and high-Opportunity-Score inventory in 2026. That is a market structure clue. It means there are many condos priced near comp medians and a meaningful subset priced visibly below, often in newer buildings, transitional sub-neighborhoods, or specific lines within larger condo developments. Set screener filters by ZIP groups and let the score surface the candidates.",
      },
      {
        heading: "Queens: rising inventory, tightening comps",
        body: "Queens condo inventory has expanded notably and 12-month sales velocity has held up. That combination produces tighter comp pools, which raises the reliability of Opportunity Scores in the borough. ZIPs in Long Island City, Astoria, and Forest Hills produced the largest verified-sale comp pools in the platform during the last refresh window.",
      },
      {
        heading: "Bronx and the boundary ZIPs",
        body: "The Bronx and ZIPs along the Brooklyn-Queens boundary continue to produce the highest-volume of high-score multi-family and small condo opportunities. Comp pools are sometimes thinner here, so confidence bands matter more. Read the band, not just the score.",
      },
      {
        heading: "What to do with this in your workflow",
        body: 'Set borough-level expectations once at the start of the quarter. Make every actual decision at the ZIP, sub-neighborhood, or building level. Use saved screeners for the ZIPs you actually buy in, and revisit borough-level data only when you are deciding where to shift the screener focus. The <a href="/up-and-coming">Up and Coming ZIPs</a> page is built for exactly that quarterly recalibration.',
      },
    ],
    relatedSlugs: [
      "up-and-coming-zip-codes-nj-ct",
      "price-per-square-foot-nyc",
      "how-to-find-underpriced-condos-nyc",
    ],
  },

  {
    slug: "verified-sales-vs-estimates-investors",
    title: "Verified Sales vs Estimated Values: What Real Estate Investors Should Trust",
    metaTitle:
      "Verified Sales vs Estimates: What Investors Should Trust | Realtors Dashboard",
    metaDescription:
      "Verified sales are recorded transactions. Estimates are model outputs. Here is exactly how each is sourced, when each is useful, and why investors should never blend them.",
    keyword: "verified real estate sales vs estimates",
    intent: "Trust building / data provenance",
    category: "Data and trust",
    productLink: {
      href: "/methodology/verified-vs-estimates",
      label: "Read the full Verified vs Estimates methodology",
    },
    intro:
      "Most real estate sites blend recorded sale prices and algorithmic estimates into a single number. Investors should not. Verified sales and estimates serve different purposes, are sourced from different places, and have very different reliability profiles. This guide explains exactly how they differ, when each is useful, and why blending them quietly destroys investor decision quality.",
    publishedDate: "2026-04-15",
    updatedDate: "2026-05-05",
    readingMinutes: 8,
    sections: [
      {
        heading: "What counts as a verified sale",
        body: "A verified sale is a recorded property transfer drawn from official public records. For NYC that means ACRIS recorded deeds and the rolling sales file. For New Jersey and Connecticut that means county and statewide recorded sales feeds.",
        bullets: [
          "Sourced from named public agencies, never from listing portals.",
          "Includes the recorded sale price, sale date, and parcel identifier.",
          "Filtered to remove obvious non-arms-length transfers (nominal $1 transfers, intra-family quitclaims) before being used as a comp.",
        ],
      },
      {
        heading: "What an estimate actually is",
        body: "An estimate is a model output. A model takes property features (size, location, bed/bath count, sometimes recent sales nearby) and produces a price prediction. Estimates are useful when there is no recent verified sale, or when you want a model's view alongside the recorded data. They are not transactions and they should never be treated as ground truth.",
      },
      {
        heading: "Why blending them hurts investors",
        body: "When a platform blends a recorded sale and a model estimate into a single 'value' number, the user loses two things at once: they lose the ability to know which signal is doing the work, and they lose the confidence band that should come with the model. That is why we display verified sale prices and estimates in separate fields on every detail page.",
      },
      {
        heading: "How verified sales drive the Opportunity Score",
        body: 'The Opportunity Score is computed against verified comparable sales, not against estimates. This avoids the circular logic of comparing one estimate to another estimate. When the verified comp pool is too thin to support a score, we lower the confidence band rather than falling back to estimate-vs-estimate math. Read the full <a href="/methodology/opportunity-score">Opportunity Score methodology</a> for how the verified comps are weighted.',
      },
      {
        heading: "When estimates are the right tool",
        body: "Estimates are appropriate when no recent verified sale exists for the subject property and you need a directional value to start a conversation. They are also useful for portfolio-level snapshots where order-of-magnitude is what matters. They are the wrong tool for individual deal underwriting.",
      },
      {
        heading: "How we present both on the platform",
        body: 'Property and unit pages show the most recent verified sale prominently with date and source. Any model-produced estimate appears in a separate field with the word "estimate" and a confidence indicator. Comparable sales tables list verified transactions only.',
      },
    ],
    relatedSlugs: [
      "what-is-an-opportunity-score",
      "nyc-comparable-sales-investor-guide",
      "real-estate-api-for-developers",
    ],
  },

  {
    slug: "real-estate-api-for-developers",
    title: "Real Estate API for Developers: Build Property Analytics Without Starting From Scratch",
    metaTitle:
      "Real Estate Data API for Developers (NYC, NJ, CT) | Realtors Dashboard",
    metaDescription:
      "A developer-focused walkthrough of the Realtors Dashboard API: properties, market stats, verified sales, and the Opportunity Score. Build property analytics in days, not quarters.",
    keyword: "real estate data API developers",
    intent: "Developer evaluation",
    category: "Developer guides",
    productLink: {
      href: "/api-access",
      label: "View API access and quotas",
    },
    intro:
      "If you are building a property analytics product, an internal underwriting model, or any tool that needs verified real estate data for NY, NJ, or CT, you have two options. Build the ETL stack yourself, manage the parcel ID joins, write the comp logic, and keep up with public-record schema drift - or call an API that has already done it. This guide is a developer-focused walkthrough of the Realtors Dashboard API: what it covers, how the endpoints fit together, and where it saves you the most time.",
    publishedDate: "2026-04-18",
    updatedDate: "2026-05-05",
    readingMinutes: 9,
    sections: [
      {
        heading: "What the API covers",
        body: "Three core resources, plus the proprietary scoring layer.",
        bullets: [
          "Properties: parcel-level records for NY, NJ, and CT, with 300K+ verified NYC condo unit records.",
          "Sales: verified ACRIS and county-recorded transactions with parcel and unit identifiers.",
          "Market stats: pre-computed median price, $/sqft, sales volume, and trend series at ZIP, city, and county levels.",
          "Opportunity Score: the 0-100 score and confidence band on every scored property, computed from verified comps.",
        ],
      },
      {
        heading: "The endpoints you will use most",
        body: 'Most integrations land on three endpoints in the first week. Pull property records by ZIP or parcel, pull verified sales for comp pulls, and pull market stats for dashboards. Full reference lives on the <a href="/developers">Developers page</a>.',
        bullets: [
          "GET /api/properties - filterable property list (state, ZIP, property type, score band).",
          "GET /api/properties/:id - detailed property record with verified sales history.",
          "GET /api/market/stats - pre-computed aggregates by geography.",
        ],
      },
      {
        heading: "How the scoring saves you the most time",
        body: 'Building an Opportunity-Score-equivalent in-house means writing a comp engine, a parcel/unit matching layer, a non-arms-length filter, a recency-weighted price model, and a confidence framework. That is a quarter of engineering work, minimum. The API returns the score and the underlying verified comps in a single response. <a href="/methodology/opportunity-score">The methodology page</a> documents what the score includes so you can decide whether to use it directly or as one input to your own model.',
      },
      {
        heading: "Quotas, auth, and rate limits",
        body: "The Pro plan ships with 10K requests per day, which covers most analyst-team use cases without a custom enterprise contract. Auth is API-key based with per-key quotas. Premium and enterprise quotas are available when nightly batch loads exceed Pro limits.",
      },
      {
        heading: "Common integration patterns",
        body: "Three patterns we see most often.",
        bullets: [
          "Nightly batch into an internal warehouse: pull /api/properties for target ZIPs, join to /api/sales, store with our parcel IDs.",
          "On-demand underwriting: pull a single property + comps + score at the moment a user opens an underwriting case.",
          "Dashboarding: pull /api/market/stats nightly and serve cached aggregates to internal users.",
        ],
      },
      {
        heading: "What you do not have to build",
        body: 'Schema drift handling for NYC Open Data, ACRIS deduplication, condo unit BBL matching, non-arms-length transaction filtering, ZIP-level aggregation, and the Opportunity Score itself. All of that is on our side. Pricing on the <a href="/pricing">Pricing page</a>.',
      },
    ],
    relatedSlugs: [
      "verified-sales-vs-estimates-investors",
      "what-is-an-opportunity-score",
      "nyc-comparable-sales-investor-guide",
    ],
  },

  {
    slug: "nyc-comparable-sales-investor-guide",
    title: "Understanding Real Estate Comparable Sales: The NYC Investor Guide",
    metaTitle:
      "NYC Real Estate Comparable Sales: The Investor Guide | Realtors Dashboard",
    metaDescription:
      "A practical guide to NYC comparable sales (comps) for investors and agents: what makes a real comp, how to filter ACRIS data, and how comp quality drives every valuation decision.",
    keyword: "real estate comparable sales NYC",
    intent: "Agent / investor education",
    category: "Investor playbooks",
    productLink: {
      href: "/compare",
      label: "Open the Property Comparison tool",
    },
    intro:
      "Comparable sales (comps) are the foundation of every valuation conversation in NYC real estate. They are also the part of the workflow most likely to be done badly. A bad comp pool produces a bad number, which produces a bad bid, which produces either a missed deal or an overpaid one. This guide is a practical, NYC-specific walkthrough of how to build a comp pool you can actually defend.",
    publishedDate: "2026-04-22",
    updatedDate: "2026-05-05",
    readingMinutes: 10,
    sections: [
      {
        heading: "What makes a real comp",
        body: "A real comp is a recently recorded arms-length sale of a property that is genuinely similar to the subject. 'Similar' in NYC means same ZIP, same property type, same broad size band, ideally same building or same line, and ideally within the last 12 months.",
        bullets: [
          "Recorded in public records (ACRIS for NYC), not pulled from a listing portal.",
          "Arms-length: not a $1 transfer, not an intra-family quitclaim, not a portfolio bulk sale.",
          "Similar in size, type, and class: a 1,200 sqft 2BR is not a comp for a 600 sqft studio in the same building.",
          "Recent: ideally inside 12 months, with the most recent six months weighted highest.",
        ],
      },
      {
        heading: "Why ACRIS is the right starting point",
        body: 'ACRIS is the NYC Department of Finance recorded-document system. Every property transfer that legally closed in NYC is in ACRIS. That is why our verified comp pool starts there and never starts from listing portals. Read more about the source mix on the <a href="/methodology/data-coverage">Data Coverage page</a>.',
      },
      {
        heading: "The comp filters that matter most in NYC",
        body: "Three filters do most of the work.",
        bullets: [
          "Building or line filter: same building first, same line within building when liquidity allows.",
          "Time filter: 12 months, then 18 months as a fallback, then stop. Older sales are reference, not comps.",
          "Property class filter: condo vs co-op vs single-family vs small multi - never mix classes in a single comp pool.",
        ],
      },
      {
        heading: "How comp quality drives the Opportunity Score",
        body: 'The Opportunity Score is computed against verified comps that pass these filters. When the comp pool is deep and recent, the score is paired with a high confidence band. When the pool is thin, the band is wider and the score should be treated as a prompt, not a conclusion. <a href="/methodology/opportunity-score">Inside the Opportunity Score methodology</a> shows the exact weighting.',
      },
      {
        heading: "Reading a comp table the right way",
        body: 'Open the comps table on any unit page and look for three things first: number of comps, recency distribution, and dispersion. A comp pool of fifteen recent sales clustered tightly around a $/sqft median is a different kind of finding than three comps spread across two years. The <a href="/compare">Property Comparison tool</a> lets you stack candidate units side-by-side with their comp tables.',
      },
      {
        heading: "Mistakes that quietly inflate comp counts",
        body: "Two patterns to watch for.",
        bullets: [
          "Counting non-arms-length transfers as comps. They look like sales in the raw data but should be filtered out.",
          "Counting bulk portfolio sales as comps for individual units. The per-unit price in a bulk transfer is almost never a useful comp.",
        ],
      },
    ],
    relatedSlugs: [
      "verified-sales-vs-estimates-investors",
      "how-to-find-underpriced-condos-nyc",
      "price-per-square-foot-nyc",
    ],
  },

  {
    slug: "up-and-coming-zip-codes-nj-ct",
    title: "Up-and-Coming ZIP Codes in New Jersey and Connecticut",
    metaTitle:
      "Up-and-Coming ZIP Codes in NJ and CT (2026 Edition) | Realtors Dashboard",
    metaDescription:
      "Trending NJ and CT ZIP codes ranked by price appreciation, sales velocity, and verified-sale momentum. Where buyers and investors are positioning ahead of the next leg of growth.",
    keyword: "up and coming NJ CT neighborhoods real estate",
    intent: "Market discovery",
    category: "Market reports",
    productLink: {
      href: "/up-and-coming",
      label: "Open Up and Coming ZIPs",
    },
    intro:
      "An up-and-coming ZIP is one where verified-sale prices are rising faster than the surrounding county, sales velocity is holding up, and the comp pool keeps tightening as more transactions stack into the recent window. In New Jersey and Connecticut in 2026, that pattern is showing up in a specific set of ZIPs - some predictable, some less so. Here is how to read the signals and where the platform is currently flagging momentum.",
    publishedDate: "2026-04-25",
    updatedDate: "2026-05-05",
    readingMinutes: 9,
    sections: [
      {
        heading: "How we score 'up and coming'",
        body: "Three signals stacked together.",
        bullets: [
          "Price appreciation: trailing 12-month change in median verified-sale $/sqft, normalized against the county.",
          "Sales velocity: number of verified arms-length sales per quarter relative to the trailing baseline.",
          "Comp tightness: dispersion of $/sqft within the ZIP, falling dispersion is a maturation signal.",
        ],
      },
      {
        heading: "New Jersey: the corridor effect",
        body: 'NJ ZIPs producing the strongest up-and-coming momentum in 2026 cluster along transit corridors and city-edge submarkets - Hudson County continues to show steady appreciation, while parts of Essex, Union, and Middlesex are catching up. Use the <a href="/up-and-coming">Up and Coming ZIPs</a> page filtered by NJ to pull the current ranked list.',
      },
      {
        heading: "Connecticut: city cores and rail-adjacent towns",
        body: "CT ZIPs producing momentum in 2026 split between city cores (Hartford, New Haven, Bridgeport) and a set of rail-adjacent suburban ZIPs that benefit from continued NYC commuter demand. The verified-sale velocity in CT is more variable quarter-to-quarter than NJ, so confidence bands matter more here.",
      },
      {
        heading: "How to use this in a screener workflow",
        body: 'Pull the up-and-coming list, pick five ZIPs that match your strategy, and set those as the geography filter on a saved <a href="/investment-opportunities">Opportunity Screener</a>. New high-score inventory in those ZIPs is exactly the intersection you want: rising market plus underpriced individual property.',
      },
      {
        heading: "Why momentum is not the same as 'good'",
        body: 'A high-momentum ZIP is a market signal, not a deal signal. Inside any momentum ZIP you still want to sort properties by Opportunity Score and verify comps before acting. <a href="/methodology/opportunity-score">The Opportunity Score methodology</a> covers how the per-property score interacts with ZIP-level momentum in the model.',
      },
      {
        heading: "Tracking the list over time",
        body: "Up-and-coming ZIPs are not static. The ranking refreshes with every ETL cycle and the composition shifts as transactions accumulate. Subscribe a saved screener on a momentum ZIP and you will see new high-score inventory there as it appears, without re-running the analysis manually.",
      },
    ],
    relatedSlugs: [
      "nyc-condo-market-2026",
      "how-to-find-underpriced-condos-nyc",
      "what-is-an-opportunity-score",
    ],
  },

  {
    slug: "price-per-square-foot-nyc",
    title: "Price Per Square Foot in NYC: How to Use It and When It Misleads You",
    metaTitle:
      "Price Per Square Foot NYC: How to Use It (and When It Misleads) | Realtors Dashboard",
    metaDescription:
      "Price per square foot is the most-used and most-misused metric in NYC real estate. Here is how to use it correctly, when to ignore it, and how to combine it with verified comps.",
    keyword: "price per square foot NYC condo",
    intent: "Buyer / investor education",
    category: "Concept explainers",
    productLink: {
      href: "/market-intelligence",
      label: "View NYC market stats",
    },
    intro:
      "Price per square foot ($/sqft) is the most quoted number in NYC real estate. It is also one of the most misused. Used correctly, it is a fast benchmark for whether a unit's price is in the neighborhood of the market. Used incorrectly, it produces confidently wrong conclusions. This guide explains exactly when to trust $/sqft, when to throw it out, and how to combine it with verified comps to actually make a decision.",
    publishedDate: "2026-04-29",
    updatedDate: "2026-05-05",
    readingMinutes: 8,
    sections: [
      {
        heading: "What price per square foot actually measures",
        body: "$/sqft is exactly one ratio: the sale price divided by the interior square footage. It is useful because it normalizes for size when comparing units of different absolute prices. It does not normalize for floor, view, condition, line, building amenities, common-charges level, or any of the other factors that move NYC condo prices significantly.",
      },
      {
        heading: "When $/sqft is a fair benchmark",
        body: "When you are comparing same-building units in similar lines and similar conditions, $/sqft is a reasonable first filter. When you are comparing same-ZIP, same-property-type, same-class units within a tight comp pool, it is also reasonable. Outside those situations, treat it as directional only.",
      },
      {
        heading: "When $/sqft misleads",
        body: "Three common traps.",
        bullets: [
          "Mixing studios and large units: $/sqft tends to be higher for smaller units. Comparing a 450 sqft studio to a 1,400 sqft 2BR by $/sqft is meaningless.",
          "Mixing condo and co-op: co-op pricing has different cost structure (maintenance vs common charges + taxes); $/sqft alone hides the gap.",
          "Mixing high-floor and low-floor in the same building: floor and view often move price more than another 50 sqft.",
        ],
      },
      {
        heading: "How to use $/sqft inside a comp workflow",
        body: 'Use it as the second pass, not the first. Build a clean verified comp pool first using the rules in <a href="/guides/nyc-comparable-sales-investor-guide">the NYC comparable sales guide</a>. Then compute the median and dispersion of $/sqft inside that pool. The median tells you the band; the dispersion tells you how much weight to put on the $/sqft signal at all.',
      },
      {
        heading: "Where price-per-sqft fits in the Opportunity Score",
        body: 'The Opportunity Score uses $/sqft as one of several inputs, weighted by comp pool tightness and recency. It is not the score, just one ingredient. The full breakdown is in the <a href="/methodology/opportunity-score">Opportunity Score methodology</a>.',
      },
      {
        heading: "What to actually do",
        body: 'Pull $/sqft from verified ZIP-level data, not from listing aggregators. Compare it against the verified comp pool for the specific unit you care about. If the unit is significantly below the comp-pool median, run the rest of the underwriting. If it is at or above the median, $/sqft has done its job and you should look elsewhere. <a href="/market-intelligence">Market Explorer</a> ZIP pages show the verified $/sqft series.',
      },
    ],
    relatedSlugs: [
      "nyc-comparable-sales-investor-guide",
      "how-to-find-underpriced-condos-nyc",
      "nyc-condo-market-2026",
    ],
  },
];

export const GUIDES_BY_SLUG: Record<string, Guide> = Object.fromEntries(
  GUIDES.map((g) => [g.slug, g]),
);

export function getGuide(slug: string): Guide | undefined {
  return GUIDES_BY_SLUG[slug];
}
