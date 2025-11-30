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

// Deal Memo Types
export interface DealMemo {
  propertyOverview: {
    address: string;
    propertyType: string;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    yearBuilt: number | null;
    estimatedValue: number | null;
  };
  executiveSummary: string;
  pricingAnalysis: {
    estimatedValue: number | null;
    pricePerSqft: number | null;
    marketMedian: number | null;
    marketP25: number | null;
    marketP75: number | null;
    percentilePosition: string;
    valueAssessment: string;
  };
  opportunityAssessment: {
    score: number | null;
    confidence: ConfidenceLevel;
    keyStrengths: string[];
    keyRisks: string[];
    recommendation: string;
  };
  comparablesSummary: {
    totalComps: number;
    avgSalePrice: number | null;
    avgPricePerSqft: number | null;
    topComps: { address: string; price: number; similarity: number }[];
  };
  marketContext: {
    areaName: string;
    trend3m: number | null;
    trend12m: number | null;
    transactionVolume: number | null;
    marketOutlook: string;
  };
  investmentConsiderations: string[];
  generatedAt: string;
}

export async function generateDealMemo(
  property: Property,
  marketData: MarketAggregate | null,
  compsData: any[]
): Promise<DealMemo> {
  const systemPrompt = `You are an expert real estate investment analyst creating a professional deal memo.
Your goal is to provide a comprehensive, data-driven analysis that helps investors make informed decisions.

CRITICAL RULES:
1. Only make claims supported by the provided data
2. Be specific with numbers and comparisons
3. Clearly state confidence levels and data limitations
4. Provide balanced analysis - highlight both opportunities and risks
5. Use professional, institutional-quality language

RESPONSE FORMAT:
Respond with valid JSON matching this structure:
{
  "executiveSummary": "2-3 sentence overview of the investment opportunity",
  "percentilePosition": "Description like 'Below median' or 'Top quartile'",
  "valueAssessment": "Analysis of whether property is fairly priced (2-3 sentences)",
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "keyRisks": ["risk1", "risk2", "risk3"],
  "recommendation": "Clear buy/hold/pass recommendation with reasoning (2-3 sentences)",
  "marketOutlook": "Brief market trend assessment (1-2 sentences)",
  "investmentConsiderations": ["consideration1", "consideration2", "consideration3", "consideration4"]
}`;

  let dataSection = "PROPERTY DATA:\n\n";
  
  dataSection += `ADDRESS: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
TYPE: ${property.propertyType}
BEDS/BATHS: ${property.beds ?? "N/A"} / ${property.baths ?? "N/A"}
SQFT: ${property.sqft?.toLocaleString() ?? "N/A"}
YEAR BUILT: ${property.yearBuilt ?? "N/A"}
ESTIMATED VALUE: ${property.estimatedValue ? `$${property.estimatedValue.toLocaleString()}` : "N/A"}
PRICE PER SQFT: ${property.pricePerSqft ? `$${property.pricePerSqft.toFixed(0)}` : "N/A"}
OPPORTUNITY SCORE: ${property.opportunityScore ?? "N/A"}/100
CONFIDENCE: ${property.confidenceLevel ?? "N/A"}
LAST SALE: ${property.lastSalePrice ? `$${property.lastSalePrice.toLocaleString()}` : "N/A"} on ${property.lastSaleDate ? new Date(property.lastSaleDate).toLocaleDateString() : "N/A"}

`;

  if (marketData) {
    dataSection += `MARKET DATA (${marketData.geoName}):
MEDIAN PRICE: ${marketData.medianPrice ? `$${marketData.medianPrice.toLocaleString()}` : "N/A"}
P25 PRICE: ${marketData.p25Price ? `$${marketData.p25Price.toLocaleString()}` : "N/A"}
P75 PRICE: ${marketData.p75Price ? `$${marketData.p75Price.toLocaleString()}` : "N/A"}
MEDIAN $/SQFT: ${marketData.medianPricePerSqft ? `$${marketData.medianPricePerSqft.toFixed(0)}` : "N/A"}
3-MONTH TREND: ${marketData.trend3m !== null ? `${marketData.trend3m >= 0 ? '+' : ''}${marketData.trend3m.toFixed(1)}%` : "N/A"}
12-MONTH TREND: ${marketData.trend12m !== null ? `${marketData.trend12m >= 0 ? '+' : ''}${marketData.trend12m.toFixed(1)}%` : "N/A"}
TRANSACTION COUNT: ${marketData.transactionCount ?? "N/A"}

`;
  }

  if (compsData && compsData.length > 0) {
    dataSection += `COMPARABLE SALES (${compsData.length} total):\n`;
    compsData.slice(0, 5).forEach((comp, i) => {
      const p = comp.property;
      dataSection += `${i + 1}. ${p.address} - $${p.lastSalePrice?.toLocaleString() ?? "N/A"} (${p.beds}BR/${p.baths}BA, ${p.sqft?.toLocaleString() ?? "N/A"} sqft, Similarity: ${comp.similarityScore?.toFixed(0)}%)\n`;
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataSection + "\n\nGenerate a professional deal memo analysis for this property." }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : {};

    // Calculate comp averages
    let avgSalePrice: number | null = null;
    let avgPricePerSqft: number | null = null;
    if (compsData && compsData.length > 0) {
      const prices = compsData.map(c => c.property.lastSalePrice).filter(Boolean);
      const pricesPerSqft = compsData.map(c => c.property.pricePerSqft).filter(Boolean);
      if (prices.length > 0) avgSalePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      if (pricesPerSqft.length > 0) avgPricePerSqft = Math.round(pricesPerSqft.reduce((a, b) => a + b, 0) / pricesPerSqft.length);
    }

    return {
      propertyOverview: {
        address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
        propertyType: property.propertyType,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        yearBuilt: property.yearBuilt,
        estimatedValue: property.estimatedValue,
      },
      executiveSummary: parsed.executiveSummary || "Unable to generate summary.",
      pricingAnalysis: {
        estimatedValue: property.estimatedValue,
        pricePerSqft: property.pricePerSqft,
        marketMedian: marketData?.medianPrice || null,
        marketP25: marketData?.p25Price || null,
        marketP75: marketData?.p75Price || null,
        percentilePosition: parsed.percentilePosition || "Unknown",
        valueAssessment: parsed.valueAssessment || "Unable to assess value.",
      },
      opportunityAssessment: {
        score: property.opportunityScore,
        confidence: (property.confidenceLevel as ConfidenceLevel) || "Medium",
        keyStrengths: parsed.keyStrengths || [],
        keyRisks: parsed.keyRisks || [],
        recommendation: parsed.recommendation || "Unable to provide recommendation.",
      },
      comparablesSummary: {
        totalComps: compsData?.length || 0,
        avgSalePrice,
        avgPricePerSqft,
        topComps: compsData?.slice(0, 3).map(c => ({
          address: c.property.address,
          price: c.property.lastSalePrice || 0,
          similarity: c.similarityScore || 0,
        })) || [],
      },
      marketContext: {
        areaName: marketData?.geoName || property.zipCode,
        trend3m: marketData?.trend3m || null,
        trend12m: marketData?.trend12m || null,
        transactionVolume: marketData?.transactionCount || null,
        marketOutlook: parsed.marketOutlook || "Market data limited.",
      },
      investmentConsiderations: parsed.investmentConsiderations || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Deal memo generation error:", error);
    throw new Error("Failed to generate deal memo");
  }
}

// Scenario Analysis Types
export interface ScenarioInputs {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  monthlyRent: number;
  vacancyRate: number;
  propertyTaxRate: number;
  insuranceAnnual: number;
  maintenancePercent: number;
  managementPercent: number;
  appreciationRate: number;
}

export interface ScenarioResults {
  loanAmount: number;
  monthlyMortgage: number;
  monthlyExpenses: number;
  monthlyNetCashFlow: number;
  annualNetCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  totalCashRequired: number;
  breakEvenOccupancy: number;
  year5Equity: number;
  year5TotalReturn: number;
}

export interface ScenarioAnalysis {
  inputs: ScenarioInputs;
  results: ScenarioResults;
  aiAssessment: {
    dealQuality: "Excellent" | "Good" | "Fair" | "Poor";
    summary: string;
    pros: string[];
    cons: string[];
    recommendation: string;
  };
}

export function calculateScenario(inputs: ScenarioInputs): ScenarioResults {
  const downPayment = inputs.purchasePrice * (inputs.downPaymentPercent / 100);
  const loanAmount = inputs.purchasePrice - downPayment;
  
  // Monthly mortgage payment (P&I)
  const monthlyRate = inputs.interestRate / 100 / 12;
  const numPayments = inputs.loanTermYears * 12;
  const monthlyMortgage = loanAmount > 0 
    ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : 0;
  
  // Monthly expenses
  const monthlyPropertyTax = (inputs.purchasePrice * (inputs.propertyTaxRate / 100)) / 12;
  const monthlyInsurance = inputs.insuranceAnnual / 12;
  const monthlyMaintenance = inputs.monthlyRent * (inputs.maintenancePercent / 100);
  const monthlyManagement = inputs.monthlyRent * (inputs.managementPercent / 100);
  const monthlyVacancyLoss = inputs.monthlyRent * (inputs.vacancyRate / 100);
  
  const monthlyExpenses = monthlyPropertyTax + monthlyInsurance + monthlyMaintenance + monthlyManagement;
  const effectiveRent = inputs.monthlyRent - monthlyVacancyLoss;
  const monthlyNetCashFlow = effectiveRent - monthlyMortgage - monthlyExpenses;
  const annualNetCashFlow = monthlyNetCashFlow * 12;
  
  // Cash on cash return
  const totalCashRequired = downPayment + (inputs.purchasePrice * 0.03); // 3% closing costs
  const cashOnCashReturn = totalCashRequired > 0 ? (annualNetCashFlow / totalCashRequired) * 100 : 0;
  
  // Cap rate (NOI / Purchase Price)
  const annualNOI = (effectiveRent * 12) - (monthlyExpenses * 12);
  const capRate = inputs.purchasePrice > 0 ? (annualNOI / inputs.purchasePrice) * 100 : 0;
  
  // Break-even occupancy
  const totalMonthlyFixedCosts = monthlyMortgage + monthlyPropertyTax + monthlyInsurance;
  const breakEvenOccupancy = inputs.monthlyRent > 0 
    ? ((totalMonthlyFixedCosts + monthlyMaintenance) / inputs.monthlyRent) * 100 
    : 100;
  
  // 5-year projections
  const year5PropertyValue = inputs.purchasePrice * Math.pow(1 + inputs.appreciationRate / 100, 5);
  const year5LoanBalance = calculateRemainingBalance(loanAmount, monthlyRate, numPayments, 60);
  const year5Equity = year5PropertyValue - year5LoanBalance;
  const totalCashFlow5Years = annualNetCashFlow * 5;
  const year5TotalReturn = totalCashRequired > 0 
    ? ((year5Equity - downPayment + totalCashFlow5Years) / totalCashRequired) * 100 
    : 0;
  
  return {
    loanAmount: Math.round(loanAmount),
    monthlyMortgage: Math.round(monthlyMortgage),
    monthlyExpenses: Math.round(monthlyExpenses),
    monthlyNetCashFlow: Math.round(monthlyNetCashFlow),
    annualNetCashFlow: Math.round(annualNetCashFlow),
    cashOnCashReturn: Math.round(cashOnCashReturn * 10) / 10,
    capRate: Math.round(capRate * 10) / 10,
    totalCashRequired: Math.round(totalCashRequired),
    breakEvenOccupancy: Math.round(breakEvenOccupancy * 10) / 10,
    year5Equity: Math.round(year5Equity),
    year5TotalReturn: Math.round(year5TotalReturn * 10) / 10,
  };
}

function calculateRemainingBalance(principal: number, monthlyRate: number, totalPayments: number, paymentsMade: number): number {
  if (monthlyRate === 0) return principal - (principal / totalPayments * paymentsMade);
  const balance = principal * (Math.pow(1 + monthlyRate, totalPayments) - Math.pow(1 + monthlyRate, paymentsMade)) 
    / (Math.pow(1 + monthlyRate, totalPayments) - 1);
  return Math.max(0, balance);
}

export async function analyzeScenario(
  property: Property,
  inputs: ScenarioInputs,
  results: ScenarioResults
): Promise<ScenarioAnalysis["aiAssessment"]> {
  const systemPrompt = `You are an expert real estate investment analyst evaluating a rental property scenario.
Provide a balanced, data-driven assessment based on the financial metrics.

RESPONSE FORMAT (JSON):
{
  "dealQuality": "Excellent|Good|Fair|Poor",
  "summary": "2-3 sentence overall assessment",
  "pros": ["pro1", "pro2", "pro3"],
  "cons": ["con1", "con2", "con3"],
  "recommendation": "Clear actionable advice (2-3 sentences)"
}

ASSESSMENT CRITERIA:
- Cash-on-cash return: >12% excellent, 8-12% good, 5-8% fair, <5% poor
- Cap rate: >8% excellent, 6-8% good, 4-6% fair, <4% poor
- Break-even occupancy: <70% excellent, 70-80% good, 80-90% fair, >90% risky
- Monthly cash flow: Positive is good, negative is concerning`;

  const dataSection = `PROPERTY: ${property.address}, ${property.city}, ${property.state}
TYPE: ${property.propertyType} | ${property.beds}BR/${property.baths}BA | ${property.sqft?.toLocaleString() || "N/A"} sqft

SCENARIO INPUTS:
- Purchase Price: $${inputs.purchasePrice.toLocaleString()}
- Down Payment: ${inputs.downPaymentPercent}% ($${(inputs.purchasePrice * inputs.downPaymentPercent / 100).toLocaleString()})
- Interest Rate: ${inputs.interestRate}%
- Loan Term: ${inputs.loanTermYears} years
- Monthly Rent: $${inputs.monthlyRent.toLocaleString()}
- Vacancy Rate: ${inputs.vacancyRate}%

CALCULATED RESULTS:
- Monthly Mortgage (P&I): $${results.monthlyMortgage.toLocaleString()}
- Monthly Net Cash Flow: $${results.monthlyNetCashFlow.toLocaleString()}
- Annual Net Cash Flow: $${results.annualNetCashFlow.toLocaleString()}
- Cash-on-Cash Return: ${results.cashOnCashReturn}%
- Cap Rate: ${results.capRate}%
- Break-Even Occupancy: ${results.breakEvenOccupancy}%
- Total Cash Required: $${results.totalCashRequired.toLocaleString()}
- 5-Year Projected Equity: $${results.year5Equity.toLocaleString()}
- 5-Year Total Return: ${results.year5TotalReturn}%`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: dataSection + "\n\nAnalyze this investment scenario." }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : {};

    const validQualities = ["Excellent", "Good", "Fair", "Poor"];
    
    return {
      dealQuality: validQualities.includes(parsed.dealQuality) ? parsed.dealQuality : "Fair",
      summary: parsed.summary || "Unable to generate assessment.",
      pros: Array.isArray(parsed.pros) ? parsed.pros.slice(0, 4) : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons.slice(0, 4) : [],
      recommendation: parsed.recommendation || "Review the numbers carefully before proceeding.",
    };
  } catch (error) {
    console.error("Scenario analysis error:", error);
    return {
      dealQuality: "Fair",
      summary: "Unable to generate AI assessment. Please review the financial metrics manually.",
      pros: [],
      cons: [],
      recommendation: "AI analysis unavailable. Consult with a financial advisor.",
    };
  }
}
