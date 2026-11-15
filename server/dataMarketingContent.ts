import { datasetOperations } from "../shared/datasetOperations";
import { developerDocs } from "../shared/developerDocs";

type Link = { href: string; label: string };
type Card = { title: string; text: string; link?: Link };
type Section = { id?: string; title: string; intro?: string; cards: Card[]; ordered?: boolean };
type Example = { title: string; code?: string; rows?: [string, string][]; note?: string };

export type MarketingPage = {
  path: string;
  name: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  primary: Link;
  secondary: Link;
  example: Example;
  sections: Section[];
  related: string[];
};

export const marketingUpdatedOn = "2026-11-15";
const docs = { href: "/developers", label: "Developer guide" };
const coverage = { href: "/methodology/data-coverage", label: "Read the data coverage policy" };
const ask = { href: "/contact", label: "Discuss your workflow" };
const spec = { href: "/openapi.json", label: "Read the OpenAPI spec" };
const national = { href: "/housing-markets", label: "Browse U.S. housing markets" };
const florida = { href: "/florida/miami-dade", label: "See Miami-Dade recorded sales" };
const nyc = { href: "/browse/ny", label: "See verified NYC records" };

export const pricingSources: Card[] = [
  {
    title: "U.S. housing markets",
    text: "Compare all 50 states and Washington, DC. Census home values and rents, monthly asking prices where available, and FHFA house price trends are labeled separately.",
    link: national,
  },
  {
    title: "Florida recorded sales",
    text: "Read qualifying residential sale records from all 67 counties. Filter the published release by county, ZIP, city, address, property type, or sale month.",
    link: florida,
  },
  {
    title: "New York City records",
    text: "Search eligible properties and condo units, check verified sale histories, and retrieve comparable sales and ZIP benchmarks where available.",
    link: nyc,
  },
];

export const marketingPages: MarketingPage[] = [
  {
    path: "/real-estate-api",
    name: "Real Estate Data API",
    title: "Real Estate Data API for U.S. Housing Markets | Realtors Dashboard",
    description: "Build with a REST API for all 50 states and DC, Florida recorded sales, and verified NYC properties, condo units, and comparable sales.",
    heading: "Real estate data you can build into your product",
    intro: "Give your application a way to compare housing markets, look up Florida recorded sales, and retrieve verified NYC property records. Responses include the source and publication period so you can show where each figure came from.",
    primary: { href: "#setup", label: "Get API access" },
    secondary: spec,
    example: {
      title: "Look up Harris County, Texas",
      code: [
        'curl "https://realtorsdashboard.com' + datasetOperations.get_housing_market.path.replace(":level/:id", "county/48201") + '" \\',
        '  -H "x-api-key: YOUR_API_KEY"',
      ].join("\n"),
      rows: [
        ["Census", "Median home value, gross rent, and housing stock"],
        ["Listing snapshot", "Median asking price and active listing count, where published"],
        ["FHFA", "Annual price-index change, where published"],
      ],
    },
    sections: [
      {
        id: "endpoints", title: "Start with the endpoint that matches your task",
        cards: [
          { title: "Find available datasets", text: "Read " + datasetOperations.list_published_datasets.path + " for the current dataset inventory, source dates, and available operations.", link: spec },
          { title: "Search or compare markets", text: "Use " + datasetOperations.search_housing_markets.path + " to search by place or ZIP and filter by asking price or Census value. Use exact county FIPS or state codes for repeatable profile lookups.", link: national },
          { title: "Read verified transactions", text: "Page through Florida sales by county or query verified NYC sale histories by ZIP, property, condo unit, or building. Florida dates are reported by month and NYC dates by day.", link: docs },
        ],
      },
      {
        id: "setup", title: "Make your first request", ordered: true,
        cards: [
          { title: "Choose Pro", text: "An active Pro subscription can create a REST API key.", link: { href: "/pricing", label: "View plans" } },
          { title: "Create your API key", text: "Sign in, open Settings, and go to API Access. Store the key on your backend and send it in the x-api-key request header.", link: { href: "/settings", label: "Open Settings" } },
          { title: "Check the response and limits", text: "Start with dataset discovery, then choose an exact geography or follow the pagination fields. Use the rate-limit headers to manage request volume.", link: docs },
        ],
      },
    ],
    related: ["/real-estate-mcp", "/business/proptech", "/business"],
  },
  {
    path: "/real-estate-mcp",
    name: "Real Estate MCP",
    title: "Real Estate MCP Server for AI Market Research | Realtors Dashboard",
    description: "Connect an MCP client to search U.S. housing markets, find Florida recorded sales, and look up verified NYC properties and ZIP benchmarks.",
    heading: "Give your AI assistant real estate data it can cite",
    intro: "Ask for a county comparison, find recent recorded sales, or benchmark a NYC condo’s price per square foot from a compatible MCP client. The tools return source details and coverage alongside the figures.",
    primary: { href: "#setup", label: "Connect an MCP client" },
    secondary: { href: "/developers#mcp", label: "Read the MCP guide" },
    example: {
      title: "Try a market-research question",
      rows: [
        ["Ask", "What does the Harris County housing profile report for asking prices and price trends? Include the reporting periods."],
        ["Tool", "get_housing_market"],
      ],
      code: '{ "level": "county", "id": "48201" }',
      note: "The tool returns the Census, asking-price, and FHFA measures in separate fields.",
    },
    sections: [
      {
        id: "tools", title: "What you can look up",
        cards: [
          { title: "Housing market comparisons", text: "Find markets by state, county, city, or ZIP. Ask your assistant to report the geography and source period with each number.", link: national },
          { title: "Florida transfers", text: "Use a county, ZIP, and sale-month range to look up published transactions. Ask for the reported month and recorded price for each result.", link: florida },
          { title: "NYC pricing benchmarks", text: "Look up a verified condo transaction, retrieve comparable sales, or compare a subject property’s price per square foot with an exact NYC ZIP benchmark.", link: { href: "/tools/nyc-price-per-square-foot", label: "Try the public NYC benchmark tool" } },
        ],
      },
      {
        id: "setup", title: "Connect in three steps", ordered: true,
        cards: [
          { title: "Add the server URL", text: "In a client that supports Streamable HTTP and OAuth, add " + developerDocs.mcpEndpoint + " as the remote MCP server.", link: { href: "/server.json", label: "View the server manifest" } },
          { title: "Review the available tools", text: "Clients can initialize and list tools before sign-in. Look up the tool names and input fields to see what fits your workflow.", link: { href: "/developers#mcp", label: "Open the developer guide" } },
          { title: "Sign in and run a tool", text: "Sign in to Realtors Dashboard through your MCP client and approve the connection. Tool calls use your account’s search allowance.", link: { href: "/register", label: "Create an account" } },
        ],
      },
    ],
    related: ["/real-estate-api", "/business/brokerages", "/business"],
  },
  {
    path: "/business",
    name: "For Business",
    title: "Real Estate Data for Business Teams | Realtors Dashboard",
    description: "Use published real estate data in brokerage research, market reports, and proptech products. Compare REST API and MCP access for your team.",
    heading: "A shared source for your team’s real estate research",
    intro: "Give your team a repeatable way to compare markets, document recorded sales, and cite each source. Use REST in your product or reporting pipeline, or connect MCP for research from an AI assistant.",
    primary: ask,
    secondary: { href: "#solutions", label: "Explore business use cases" },
    example: {
      title: "What goes into a market brief",
      rows: [
        ["Market context", "County and ZIP housing measures with the source period"],
        ["Property evidence", "Published Florida transfers or verified NYC sales"],
        ["Method", "Reporting precision, source links, and coverage limits"],
      ],
    },
    sections: [
      {
        id: "solutions", title: "Start with the workflow your team needs",
        cards: [
          { title: "Brokerages and research desks", text: "Prepare market briefs and listing research with dated pricing context and identifiable comparable sales.", link: { href: "/business/brokerages", label: "Explore brokerage workflows" } },
          { title: "Proptech and data product teams", text: "Build a search, comparison, or reporting feature around documented geography identifiers and versioned responses.", link: { href: "/business/proptech", label: "Explore proptech workflows" } },
        ],
      },
      {
        id: "access", title: "Choose REST or MCP",
        cards: [
          { title: "REST for repeatable requests", text: "Use an API key for scheduled internal reporting, saved market views, and product integrations that need predictable response fields.", link: { href: "/real-estate-api", label: "Explore the REST API" } },
          { title: "MCP for interactive research", text: "Connect a compatible AI assistant so analysts can ask for specific markets or published sale records and refer back to the source.", link: { href: "/real-estate-mcp", label: "Explore MCP access" } },
        ],
      },
    ],
    related: ["/business/brokerages", "/business/proptech", "/real-estate-api", "/real-estate-mcp"],
  },
  {
    path: "/business/brokerages",
    name: "For Brokerages",
    title: "Real Estate Data for Brokerages and Research Teams | Realtors Dashboard",
    description: "Build market briefs and research packets with U.S. market benchmarks, Florida recorded sales, and verified NYC comparable sales.",
    heading: "Give your market brief numbers you can explain",
    intro: "When an agent or client asks where a price came from, have the geography, source, and reporting period ready. Use published market data to set the context, then check recorded transfers where property-level coverage is available.",
    primary: ask,
    secondary: { href: "#workflow", label: "See a briefing workflow" },
    example: {
      title: "Example briefing for a Miami-Dade ZIP",
      rows: [
        ["Local context", "Check the county or ZIP housing profile for published price and rent measures"],
        ["Nearby transfers", "Filter the county’s residential sales by ZIP, property use, and sale month"],
        ["Client handoff", "Include the source release and show sale months as reported"],
      ],
    },
    sections: [
      {
        id: "workflow", title: "Build a briefing your team can repeat", ordered: true,
        cards: [
          { title: "Set the geography", text: "Pull the county or ZIP profile. Use the same Census geography and time period when comparing estimates across markets.", link: national },
          { title: "Review recorded sales", text: "For Florida research, scope to a county and narrow by ZIP, month, and property use. For NYC, look up a verified property or condo unit and check whether its comparable set is published.", link: florida },
          { title: "Document the evidence", text: "Include the date, source, and scope for each number in the memo. Add the relevant property or market link so another team member can check it.", link: coverage },
        ],
      },
      {
        id: "access", title: "Put the data where your team works",
        cards: [
          { title: "Standardize recurring briefs", text: "Use REST to request the same geography and metrics for each reporting cycle. Preserve source metadata alongside the figures.", link: { href: "/real-estate-api", label: "See the REST API" } },
          { title: "Answer an ad hoc market question", text: "Use an MCP client to look up an exact market or a recorded-sale sample while preparing a note or reviewing a deal.", link: { href: "/real-estate-mcp", label: "See the MCP setup" } },
        ],
      },
    ],
    related: ["/business", "/business/proptech", "/real-estate-mcp"],
  },
  {
    path: "/business/proptech",
    name: "For Proptech",
    title: "Real Estate Data Integrations for Proptech | Realtors Dashboard",
    description: "Build market comparisons, property research, and sale-history features with source-labeled real estate data through a REST API or MCP.",
    heading: "Build a market-data feature your users can trace",
    intro: "Ship county research, market comparison, and eligible property sale lookups with a documented API. Keep the source definitions and release information attached as records move through your product.",
    primary: ask,
    secondary: spec,
    example: {
      title: "Example integration contract",
      rows: [
        ["Market key", "State code, exact county FIPS, or five-digit ZIP"],
        ["Display fields", "Price type, source period, geography, USD value"],
        ["Import fields", "Publication ID and pagination information where supplied"],
      ],
    },
    sections: [
      {
        id: "build", title: "Three features you can build",
        cards: [
          { title: "Market comparisons", text: "Let users compare counties by Census value, gross rent, asking price, or FHFA trend. Give each field its own source label and period.", link: national },
          { title: "Recorded-sale research", text: "Follow Florida’s release-aware cursor to populate a county sales view, or look up NYC sale histories and comparable sets for eligible properties.", link: docs },
          { title: "AI-assisted lookup", text: "Connect a compatible assistant so team members can retrieve precise market or sales data with the same geographic boundaries and source definitions.", link: { href: "/real-estate-mcp", label: "Review MCP access" } },
        ],
      },
      {
        id: "integrate", title: "Handle missing data and refreshes in your product",
        cards: [
          { title: "Use stable identifiers", text: "Store county FIPS codes and preserve leading zeroes in ZIP codes. Keep Census ZIP areas and postal listing regions labeled so users understand the boundaries.", link: spec },
          { title: "Check publication metadata", text: "Request the dataset inventory before a refresh. Show a coverage gap when a source suppresses an estimate and restart Florida pagination if the release changes.", link: { href: "/real-estate-api#endpoints", label: "Review the API endpoints" } },
        ],
      },
    ],
    related: ["/business", "/business/brokerages", "/real-estate-api"],
  },
];
