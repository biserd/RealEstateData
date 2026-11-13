import { createMcpHandler, fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { getPublishedFreshness } from "./dataEnvelope";
import { consumeQuota, type SubscriptionTier } from "./quota";
import { publishedMarketAggregates, publishedUpAndComing } from "./storage";
import manifest from "../server.json";

const validator = new CfWorkerJsonSchemaValidator();
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const zip = { type: "string", pattern: "^[0-9]{5}$", description: "Five-digit NYC ZIP code" } as const;
const zipInput = fromJsonSchema<{ zip: string }>({
  type: "object", properties: { zip }, required: ["zip"], additionalProperties: false,
}, validator);
const benchmarkInput = fromJsonSchema<{ zip: string; price: number; squareFeet: number }>({
  type: "object",
  properties: {
    zip,
    price: { type: "number", exclusiveMinimum: 0, maximum: 1_000_000_000, description: "Property price in US dollars" },
    squareFeet: { type: "number", minimum: 1, maximum: 10_000_000, description: "Interior area in square feet" },
  },
  required: ["zip", "price", "squareFeet"],
  additionalProperties: false,
}, validator);
const momentumInput = fromJsonSchema<{ limit?: number }>({
  type: "object",
  properties: { limit: { type: "integer", minimum: 1, maximum: 20, description: "Number of ZIPs to return. Default 10." } },
  additionalProperties: false,
}, validator);

export type McpAccount = { id: string; tier: SubscriptionTier };

async function exactZip(zipCode: string) {
  const [row] = await publishedMarketAggregates("zip", zipCode) ?? [];
  if (!row || row.state !== "NY" || row.geoId !== zipCode || (row.transactionCount ?? 0) < 5) return null;
  return row;
}

function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function createRealtorsMcp(account?: McpAccount) {
  return createMcpHandler(() => {
    const server = new McpServer({
      name: "realtors-dashboard",
      title: manifest.title,
      version: manifest.version,
      websiteUrl: manifest.websiteUrl,
      icons: manifest.icons,
    }, {
      jsonSchemaValidator: validator,
      instructions: "Use these tools for NYC recorded-sale research. Results use manually published data and never broaden an exact ZIP request. Sign in to run tools.",
    });

    async function run(read: () => Promise<Record<string, unknown>>) {
      if (!account) return toolError("Sign in to Realtors Dashboard to run tools.");
      try {
        const quota = await consumeQuota({ action: "search", tier: account.tier, subjectId: `user:${account.id}` });
        if (!quota) return toolError("Usage limits are temporarily unavailable. Try again shortly.");
        if (!quota.allowed) return toolError(`Daily search allowance used. Resets at ${new Date(quota.resetAt).toISOString()}.`);
        const data = await read();
        return { structuredContent: data, content: [{ type: "text" as const, text: JSON.stringify(data) }] };
      } catch {
        console.error("Realtors Dashboard MCP published data read failed");
        return toolError("Published data is temporarily unavailable. Try again shortly.");
      }
    }

    server.registerTool("get_nyc_zip_market_snapshot", {
      title: "NYC ZIP Market Snapshot",
      description: "Get sale price quartiles, median price per square foot, sample size, and trend for an exact NYC ZIP.",
      inputSchema: zipInput,
      annotations,
    }, ({ zip }) => run(async () => {
      const row = await exactZip(zip);
      if (!row) return { status: "coverage_gap", zip, message: "No qualifying published market snapshot for this ZIP." };
      return {
        status: "exact", zip, market: row.geoName, medianPriceUsd: row.medianPrice,
        p25PriceUsd: row.p25Price, p75PriceUsd: row.p75Price,
        medianPricePerSqFtUsd: row.medianPricePerSqft, recordedSaleCount: row.transactionCount,
        sixMonthPriceChangePercent: row.trend6m, computedAt: row.computedAt,
        datasetVersion: row.publishedDatasetVersionId, currency: "USD",
        source: "NYC recorded sales", url: `https://realtorsdashboard.com/tools/nyc-zip-market-snapshot?zip=${zip}`,
      };
    }));

    server.registerTool("compare_nyc_price_per_square_foot", {
      title: "NYC Price per Square Foot Benchmark",
      description: "Calculate a property's price per square foot and compare it with its exact NYC ZIP's recorded-sale median.",
      inputSchema: benchmarkInput,
      annotations,
    }, ({ zip, price, squareFeet }) => run(async () => {
      const subjectPricePerSqFtUsd = Math.round(price / squareFeet * 100) / 100;
      const row = await exactZip(zip);
      const median = row?.medianPricePerSqft;
      if (!row || !median || median <= 0) {
        return { status: "coverage_gap", zip, subjectPricePerSqFtUsd, message: "No qualifying price per square foot benchmark for this ZIP." };
      }
      return {
        status: "exact", zip, subjectPricePerSqFtUsd, medianPricePerSqFtUsd: median,
        differencePercent: Math.round(((price / squareFeet / median) - 1) * 10_000) / 100,
        recordedSaleCount: row.transactionCount, computedAt: row.computedAt,
        datasetVersion: row.publishedDatasetVersionId, currency: "USD",
        source: "NYC recorded sales", url: `https://realtorsdashboard.com/tools/nyc-price-per-square-foot?zip=${zip}`,
      };
    }));

    server.registerTool("list_nyc_market_momentum", {
      title: "NYC Market Momentum Rankings",
      description: "List the top published NYC ZIPs by recorded-price momentum, transaction velocity, liquidity, and comp depth.",
      inputSchema: momentumInput,
      annotations,
    }, ({ limit = 10 }) => run(async () => {
      const rows = await publishedUpAndComing("NY", limit);
      if (!rows?.length) return { status: "coverage_gap", message: "No qualifying NYC momentum rankings are currently published." };
      return {
        status: "exact", freshness: await getPublishedFreshness(), currency: "USD",
        source: "NYC recorded sales", url: "https://realtorsdashboard.com/up-and-coming",
        markets: rows.map((row) => ({
          zip: row.zipCode, market: row.city, momentumScore: row.trendScore,
          medianPriceUsd: row.medianPrice, recordedSaleCount: row.transactionCount,
          sixMonthPriceChangePercent: row.trend6m,
        })),
      };
    }));
    return server;
  });
}
