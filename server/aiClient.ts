import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY?.trim() || "not-configured";
const gatewayUrl = process.env.CLOUDFLARE_AI_GATEWAY_URL?.trim();
const gatewayToken = process.env.CLOUDFLARE_AI_GATEWAY_TOKEN?.trim();

/**
 * OpenAI-compatible client for both direct OpenAI calls and Cloudflare AI Gateway.
 * Set CLOUDFLARE_AI_GATEWAY_URL to route requests through AI Gateway without
 * coupling the application to a Replit-provided proxy.
 */
export const openai = new OpenAI({
  apiKey,
  baseURL: gatewayUrl || undefined,
  defaultHeaders: gatewayToken
    ? { "cf-aig-authorization": `Bearer ${gatewayToken}` }
    : undefined,
});
