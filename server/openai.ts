import OpenAI from "openai";
import type { Property, MarketAggregate, AIResponse, ConfidenceLevel } from "@shared/schema";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const MODEL = "gpt-5";

interface ChatContext {
  property?: Property;
  marketData?: MarketAggregate;
  compsData?: any[];
}

export async function analyzeProperty(
  question: string,
  context: ChatContext
): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(question, context);

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return createErrorResponse("No response received from AI");
    }

    const parsed = JSON.parse(content);
    return validateAndFormatResponse(parsed, context);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return createErrorResponse("Failed to analyze property data");
  }
}

function buildSystemPrompt(context: ChatContext): string {
  return `You are a real estate market intelligence analyst for the Tri-State area (NY, NJ, CT). 
Your role is to provide grounded, evidence-based insights about properties and markets.

CRITICAL RULES:
1. Only make claims that can be directly supported by the provided data
2. Always cite specific data points as evidence
3. Express uncertainty when data is incomplete
4. Never hallucinate prices, dates, or statistics
5. For pricing assessments, compare to segment medians
6. Distinguish between facts (from data) and estimates (from analysis)

RESPONSE FORMAT:
You must respond with valid JSON in this exact structure:
{
  "answerSummary": "A clear, concise answer to the user's question (2-4 sentences)",
  "keyNumbers": [
    {"label": "Metric name", "value": "formatted value", "unit": "optional unit"}
  ],
  "evidence": [
    {"type": "comp|market|property", "id": "reference id", "description": "what this proves"}
  ],
  "confidence": "High|Medium|Low",
  "limitations": ["Any data gaps or caveats"]
}

CONFIDENCE LEVELS:
- High: 5+ recent comps, complete property data, stable market
- Medium: 3-4 comps or some data gaps
- Low: <3 comps, significant data gaps, or volatile market`;
}

function buildUserPrompt(question: string, context: ChatContext): string {
  let dataSection = "AVAILABLE DATA:\n\n";

  if (context.property) {
    const p = context.property;
    dataSection += `SUBJECT PROPERTY:
- Address: ${p.address}, ${p.city}, ${p.state} ${p.zipCode}
- Type: ${p.propertyType}
- Beds: ${p.beds ?? "N/A"}, Baths: ${p.baths ?? "N/A"}
- Sqft: ${p.sqft?.toLocaleString() ?? "N/A"}
- Year Built: ${p.yearBuilt ?? "N/A"}
- Last Sale: ${p.lastSalePrice ? `$${p.lastSalePrice.toLocaleString()}` : "N/A"} on ${p.lastSaleDate ? new Date(p.lastSaleDate).toLocaleDateString() : "N/A"}
- Estimated Value: ${p.estimatedValue ? `$${p.estimatedValue.toLocaleString()}` : "N/A"}
- Price/sqft: ${p.pricePerSqft ? `$${p.pricePerSqft.toFixed(0)}` : "N/A"}
- Opportunity Score: ${p.opportunityScore ?? "N/A"}/100
- Confidence Level: ${p.confidenceLevel ?? "N/A"}

`;
  }

  if (context.marketData) {
    const m = context.marketData;
    dataSection += `MARKET DATA (${m.geoName}):
- Geo Type: ${m.geoType}
- Segment: ${m.propertyType || "All"} | ${m.bedsBand || "Any"} beds | ${m.yearBuiltBand || "Any"} year
- Median Price: ${m.medianPrice ? `$${m.medianPrice.toLocaleString()}` : "N/A"}
- P25 Price: ${m.p25Price ? `$${m.p25Price.toLocaleString()}` : "N/A"}
- P75 Price: ${m.p75Price ? `$${m.p75Price.toLocaleString()}` : "N/A"}
- Median $/sqft: ${m.medianPricePerSqft ? `$${m.medianPricePerSqft.toFixed(0)}` : "N/A"}
- Transaction Count (12mo): ${m.transactionCount ?? "N/A"}
- 3-Month Trend: ${m.trend3m !== null ? `${m.trend3m >= 0 ? '+' : ''}${m.trend3m.toFixed(1)}%` : "N/A"}
- 6-Month Trend: ${m.trend6m !== null ? `${m.trend6m >= 0 ? '+' : ''}${m.trend6m.toFixed(1)}%` : "N/A"}
- 12-Month Trend: ${m.trend12m !== null ? `${m.trend12m >= 0 ? '+' : ''}${m.trend12m.toFixed(1)}%` : "N/A"}

`;
  }

  if (context.compsData && context.compsData.length > 0) {
    dataSection += `COMPARABLE SALES:\n`;
    context.compsData.slice(0, 5).forEach((comp, i) => {
      const p = comp.property;
      dataSection += `${i + 1}. ${p.address} - $${p.lastSalePrice?.toLocaleString() ?? "N/A"} (${p.beds}BR/${p.baths}BA, ${p.sqft?.toLocaleString() ?? "N/A"} sqft) - Similarity: ${comp.similarityScore?.toFixed(0)}%
`;
    });
    dataSection += "\n";
  }

  return `${dataSection}USER QUESTION: ${question}

Analyze the above data and answer the question. Remember to provide evidence for all claims and express uncertainty when appropriate.`;
}

function validateAndFormatResponse(parsed: any, context: ChatContext): AIResponse {
  const keyNumbers = Array.isArray(parsed.keyNumbers) 
    ? parsed.keyNumbers.filter((n: any) => n.label && n.value).slice(0, 5)
    : [];

  const evidence = Array.isArray(parsed.evidence)
    ? parsed.evidence.filter((e: any) => e.type && e.description).slice(0, 5)
    : [];

  const validConfidence = ["High", "Medium", "Low"];
  const confidence: ConfidenceLevel = validConfidence.includes(parsed.confidence) 
    ? parsed.confidence 
    : "Medium";

  const limitations = Array.isArray(parsed.limitations)
    ? parsed.limitations.filter((l: any) => typeof l === "string").slice(0, 3)
    : [];

  // Add default limitations based on data availability
  if (!context.property && !context.marketData) {
    limitations.push("Limited data context provided");
  }
  if (!context.compsData || context.compsData.length < 3) {
    limitations.push("Fewer than 3 comparable sales available");
  }

  return {
    answerSummary: parsed.answerSummary || "Unable to generate analysis.",
    keyNumbers,
    evidence,
    confidence,
    limitations,
  };
}

function createErrorResponse(message: string): AIResponse {
  return {
    answerSummary: message,
    keyNumbers: [],
    evidence: [],
    confidence: "Low",
    limitations: ["AI service error - please try again"],
  };
}

export async function analyzeMarket(
  question: string,
  geoId: string,
  marketData: MarketAggregate | null
): Promise<AIResponse> {
  return analyzeProperty(question, { 
    marketData: marketData || undefined 
  });
}
