export const aboutCoverageMeta = {
  title: "About Realtors Dashboard | U.S. Housing Data",
  description: "How Realtors Dashboard publishes U.S. housing market data, Florida residential sales, and verified NYC property and condo records.",
  h1: "About Realtors Dashboard",
} as const;

export const coverageFaqMeta = {
  title: "Housing Data and Product FAQ | Realtors Dashboard",
  description: "Find out where Realtors Dashboard has housing market and recorded sales data, how it is updated, and how the product and subscriptions work.",
  h1: "Realtors Dashboard FAQ",
} as const;

export const coverageQuestions = [
  {
    question: "What is Realtors Dashboard?",
    answer: "Realtors Dashboard publishes U.S. housing market data, Florida recorded residential sales, and NYC property and condo records with comparable sales where available.",
  },
  {
    question: "Which areas do you cover?",
    answer: "The housing market directory covers all 50 states and Washington, DC. Florida has qualifying recorded residential sales in all 67 counties. New York City has verified property and condo sale records, ZIP benchmarks, and comparable sales where published.",
  },
  {
    question: "How accurate is your data?",
    answer: "Each dataset has a source and reporting period. Florida sale dates are reported by month. National median values, asking prices, and price indexes measure different things. NYC comparable sales show the sample size where available.",
  },
];

export const dataCoverage = {
  title: "Real Estate Data Coverage",
  metaTitle: "Real Estate Data Coverage and Sources | Realtors Dashboard",
  metaDescription: "See which U.S. housing statistics, Florida recorded sales, and verified NYC property and condo records are available, with sources and refresh details.",
  reviewedOn: "2026-11-17",
  intro: "Realtors Dashboard publishes housing market data for all 50 states and Washington, DC, recorded residential sales across Florida, and verified property and condo sale records in New York City.",
  sections: [
    {
      heading: "Geographic coverage",
      body: "The level of detail depends on the dataset and location.",
      bullets: [
        "U.S. housing markets cover states, counties, Census places, and ZIP Code Tabulation Areas where data is available. New Jersey and Connecticut are included in the market directory.",
        "Florida recorded sales cover qualifying residential transfers across all 67 counties. Sale dates are published by month.",
        "New York City coverage includes eligible recorded sales, verified condo-unit matches, and published comparable sales and ZIP benchmarks.",
      ],
    },
    {
      heading: "Data sources",
      body: "Market pages identify the sources and reporting periods for their published figures.",
      bullets: [
        "U.S. market statistics draw from the Census Bureau’s American Community Survey, the FHFA House Price Index, and Realtor.com Economic Research asking-price statistics where available.",
        "Florida recorded prices and sale months come from the Florida Department of Revenue parcel roll.",
        "NYC records draw from the Department of Finance rolling sales and ACRIS, plus Department of City Planning parcel data.",
      ],
    },
    {
      heading: "Refresh policy",
      body: "We trigger refreshes manually and validate each update before publishing it. The reporting period tells you what dates the figures cover. The publication date tells you when the snapshot went live.",
    },
    {
      heading: "How to compare prices",
      body: "An asking price measures what sellers list, a recorded sale shows the reported price of a transfer, and a price index tracks movement over time. Our asking prices come from published summaries of listings. Check the metric, geography, and reporting period before comparing two markets.",
    },
  ],
};

export const opportunityScoreDescription = "See how the 0–100 NYC Opportunity Score uses recorded sales, comparable-property fit, recency, trends, and confidence.";
