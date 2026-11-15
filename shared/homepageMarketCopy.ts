export const homepageMarketCopy = {
  title: "U.S. Housing Market Data & Recorded Sales | Realtors Dashboard",
  headline: ["U.S. housing market data", "and recorded sales"],
  description: "Compare U.S. housing markets across all 50 states and Washington, DC. Explore Florida recorded sales and verified NYC property and condo records.",
  intro: "Compare home values, rents, asking prices, and price trends across all 50 states and Washington, DC. Explore recorded residential sales in Florida and verified property and condo sales in New York City.",
  markets: [
    {
      id: "united-states", label: "U.S. housing markets", href: "/housing-markets",
      detail: "Compare housing data by state, county, Census place, and ZIP. See Census home values and rents, monthly asking-price statistics, and FHFA price trends where available.",
    },
    {
      id: "florida", label: "Florida recorded sales", href: "/florida",
      detail: "Browse qualifying residential sales across all 67 counties. Filter by address, city, ZIP, property type, or sale month.",
    },
    {
      id: "new-york", label: "NYC sales and comps", href: "/browse/ny",
      detail: "Look up eligible property and condo records, review day-level recorded sales, and use comparable sales and ZIP benchmarks where published.",
    },
  ],
  access: [
    { href: "/real-estate-api", title: "Real Estate API", description: "Build market comparisons and recorded-sale lookups into your application." },
    { href: "/real-estate-mcp", title: "Real Estate MCP", description: "Connect an AI assistant to published data with sources and reporting periods." },
    { href: "/business", title: "For Business", description: "See how brokerages and proptech teams use the data in research and products." },
  ],
} as const;
