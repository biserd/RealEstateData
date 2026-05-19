import { db } from "./db";
import { sql } from "drizzle-orm";
import OpenAI from "openai";

const MODEL = "gpt-5-mini";
const STALE_AFTER_DAYS = 365;
const MAX_NARRATIVE_TOKENS = 400;

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const inFlight = new Set<string>();

export interface CachedNarrative {
  narrative: string;
  generatedAt: Date;
  fresh: boolean;
}

export async function getCachedNarrative(
  kind: "unit" | "property",
  refId: string,
): Promise<CachedNarrative | null> {
  try {
    const res: any = await db.execute(sql`
      SELECT narrative, generated_at FROM page_narratives
      WHERE kind = ${kind} AND ref_id = ${refId}
      LIMIT 1
    `);
    const row = res.rows?.[0];
    if (!row) return null;
    const generatedAt = new Date(row.generated_at);
    const ageDays = (Date.now() - generatedAt.getTime()) / 86_400_000;
    return {
      narrative: row.narrative as string,
      generatedAt,
      fresh: ageDays < STALE_AFTER_DAYS,
    };
  } catch (err) {
    console.error("[narratives] read error:", err);
    return null;
  }
}

async function upsertNarrative(
  kind: string,
  refId: string,
  narrative: string,
  model: string,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO page_narratives (kind, ref_id, narrative, model, generated_at)
    VALUES (${kind}, ${refId}, ${narrative}, ${model}, NOW())
    ON CONFLICT (kind, ref_id) DO UPDATE
    SET narrative = EXCLUDED.narrative,
        model = EXCLUDED.model,
        generated_at = NOW()
  `);
}

interface UnitContext {
  displayAddress: string;
  buildingAddress: string | null;
  borough: string | null;
  zip: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  unitSaleHistory: Array<{ price: number; date: string }>;
  buildingSaleCount: number;
  buildingMedian: number | null;
  buildingMin: number | null;
  buildingMax: number | null;
  zipMedian: number | null;
}

async function buildUnitContext(unitBbl: string): Promise<UnitContext | null> {
  const u: any = await db.execute(sql`
    SELECT cu.unit_bbl, cu.base_bbl, cu.unit_designation, cu.unit_display_address,
           cu.building_display_address, cu.borough, cu.zip_code,
           cu.beds, cu.baths, cu.sqft
    FROM condo_units cu
    WHERE cu.unit_bbl = ${unitBbl}
    LIMIT 1
  `);
  const unit = u.rows?.[0];
  if (!unit) return null;

  const [salesRes, statsRes, zipRes] = await Promise.all([
    db.execute(sql`
      SELECT sale_price, sale_date FROM sales
      WHERE unit_bbl = ${unit.unit_bbl}
      ORDER BY sale_date DESC LIMIT 5
    `),
    db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE sale_price >= 100000)::int AS c,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price)
          FILTER (WHERE sale_price >= 100000) AS med,
        MIN(sale_price) FILTER (WHERE sale_price >= 100000) AS lo,
        MAX(sale_price) FILTER (WHERE sale_price >= 100000) AS hi
      FROM sales
      WHERE base_bbl = ${unit.base_bbl}
        AND sale_date >= NOW() - INTERVAL '36 months'
    `),
    unit.zip_code
      ? db.execute(sql`
          SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sale_price)
            FILTER (WHERE sale_price >= 100000) AS med
          FROM sales s
          JOIN condo_units cu ON cu.base_bbl = s.base_bbl
          WHERE cu.zip_code = ${unit.zip_code}
            AND s.sale_date >= NOW() - INTERVAL '24 months'
        `)
      : Promise.resolve({ rows: [{}] } as any),
  ]);

  const sales = (salesRes as any).rows as any[];
  const stats = ((statsRes as any).rows[0] || {}) as any;
  const zip = ((zipRes as any).rows[0] || {}) as any;

  const buildingAddr = unit.building_display_address || null;
  const displayAddress =
    unit.unit_display_address ||
    `${buildingAddr || "Building"}${unit.unit_designation ? `, ${unit.unit_designation}` : ""}`;

  return {
    displayAddress,
    buildingAddress: buildingAddr,
    borough: unit.borough || null,
    zip: unit.zip_code || null,
    beds: unit.beds ? Number(unit.beds) : null,
    baths: unit.baths ? Number(unit.baths) : null,
    sqft: unit.sqft ? Number(unit.sqft) : null,
    lastSalePrice: sales[0]?.sale_price ? Number(sales[0].sale_price) : null,
    lastSaleDate: sales[0]?.sale_date ? String(sales[0].sale_date).slice(0, 10) : null,
    unitSaleHistory: sales.map((s) => ({
      price: Number(s.sale_price),
      date: String(s.sale_date).slice(0, 10),
    })),
    buildingSaleCount: stats.c ? Number(stats.c) : 0,
    buildingMedian: stats.med ? Number(stats.med) : null,
    buildingMin: stats.lo ? Number(stats.lo) : null,
    buildingMax: stats.hi ? Number(stats.hi) : null,
    zipMedian: zip.med ? Number(zip.med) : null,
  };
}

interface PropertyContext {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  type: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  opportunityScore: number | null;
  saleHistory: Array<{ price: number; date: string }>;
  zipMedianSale: number | null;
  zipPropertyCount: number;
}

async function buildPropertyContext(propertyId: string): Promise<PropertyContext | null> {
  const p: any = await db.execute(sql`
    SELECT id, address, city, state, zip_code, property_type, estimated_value,
           last_sale_price, last_sale_date, sqft, beds, baths, year_built,
           opportunity_score
    FROM properties WHERE id = ${propertyId} LIMIT 1
  `);
  const prop = p.rows?.[0];
  if (!prop) return null;

  const [salesRes, zipRes] = await Promise.all([
    db.execute(sql`
      SELECT sale_price, sale_date FROM sales
      WHERE property_id = ${prop.id}
      ORDER BY sale_date DESC LIMIT 5
    `),
    prop.zip_code
      ? db.execute(sql`
          SELECT COUNT(*) FILTER (WHERE last_sale_price > 0)::int AS c,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY last_sale_price)
              FILTER (WHERE last_sale_price > 0) AS med
          FROM properties WHERE zip_code = ${prop.zip_code}
        `)
      : Promise.resolve({ rows: [{}] } as any),
  ]);

  const sales = (salesRes as any).rows as any[];
  const zip = ((zipRes as any).rows[0] || {}) as any;

  return {
    address: prop.address || "Property",
    city: prop.city || null,
    state: prop.state || null,
    zip: prop.zip_code || null,
    type: prop.property_type || null,
    beds: prop.beds ? Number(prop.beds) : null,
    baths: prop.baths ? Number(prop.baths) : null,
    sqft: prop.sqft ? Number(prop.sqft) : null,
    yearBuilt: prop.year_built ? Number(prop.year_built) : null,
    estimatedValue: prop.estimated_value ? Number(prop.estimated_value) : null,
    lastSalePrice: prop.last_sale_price ? Number(prop.last_sale_price) : null,
    lastSaleDate: prop.last_sale_date ? String(prop.last_sale_date).slice(0, 10) : null,
    opportunityScore: prop.opportunity_score ? Number(prop.opportunity_score) : null,
    saleHistory: sales.map((s) => ({
      price: Number(s.sale_price),
      date: String(s.sale_date).slice(0, 10),
    })),
    zipMedianSale: zip.med ? Number(zip.med) : null,
    zipPropertyCount: zip.c ? Number(zip.c) : 0,
  };
}

const SYSTEM_PROMPT = `You are a real estate market analyst writing a short, factual summary of a single property page.
Write 2 short paragraphs (about 120-180 words total) for buyers and investors.
Ground every claim in the structured data provided — do NOT invent prices, dates, or facts not present.
Use plain natural prose, no bullets, no headings, no markdown. Be concrete and avoid filler. End with a 1-sentence neutral assessment of value vs. comparable benchmarks (e.g. building median or ZIP median) when those numbers are present.`;

async function callOpenAI(userPrompt: string, label: string): Promise<string | null> {
  try {
    const resp = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: MAX_NARRATIVE_TOKENS,
    });
    const choice = resp.choices[0];
    const text = choice?.message?.content?.trim();
    if (!text || text.length < 50) {
      console.error(
        `[narratives] ${label} empty/short content. finish_reason=${choice?.finish_reason} len=${text?.length ?? 0}`,
      );
      return null;
    }
    return text;
  } catch (err) {
    console.error(`[narratives] ${label} generation error:`, err);
    return null;
  }
}

async function generateUnitNarrative(unitBbl: string): Promise<string | null> {
  const ctx = await buildUnitContext(unitBbl);
  if (!ctx) {
    console.error(`[narratives] unit context not found for ${unitBbl}`);
    return null;
  }
  const userPrompt = `Write the narrative for this NYC condo unit page.

Unit data:
${JSON.stringify(ctx, null, 2)}

Write 2 short paragraphs grounded in the above data only.`;
  return callOpenAI(userPrompt, `unit ${unitBbl}`);
}

async function generatePropertyNarrative(propertyId: string): Promise<string | null> {
  const ctx = await buildPropertyContext(propertyId);
  if (!ctx) {
    console.error(`[narratives] property context not found for ${propertyId}`);
    return null;
  }
  const userPrompt = `Write the narrative for this property page.

Property data:
${JSON.stringify(ctx, null, 2)}

Write 2 short paragraphs grounded in the above data only.`;
  return callOpenAI(userPrompt, `property ${propertyId}`);
}

// Fire-and-forget: triggers generation if no fresh cache exists. Safe to call
// from SSR paths because it never awaits and dedupes per refId.
export function maybeGenerateNarrative(
  kind: "unit" | "property",
  refId: string,
): void {
  const key = `${kind}:${refId}`;
  if (inFlight.has(key)) return;

  (async () => {
    try {
      const cached = await getCachedNarrative(kind, refId);
      if (cached?.fresh) return;
      inFlight.add(key);
      const text =
        kind === "unit"
          ? await generateUnitNarrative(refId)
          : await generatePropertyNarrative(refId);
      if (text) {
        await upsertNarrative(kind, refId, text, MODEL);
      }
    } catch (err) {
      console.error("[narratives] background generation error:", err);
    } finally {
      inFlight.delete(key);
    }
  })();
}

// Synchronous-style fetcher for the public API: returns cached if fresh,
// otherwise generates inline (with timeout-style guard via OpenAI itself).
export async function getOrGenerateNarrative(
  kind: "unit" | "property",
  refId: string,
  opts: { allowGenerate?: boolean } = {},
): Promise<{ narrative: string; generatedAt: string } | null> {
  const cached = await getCachedNarrative(kind, refId);
  if (cached?.fresh) {
    return { narrative: cached.narrative, generatedAt: cached.generatedAt.toISOString() };
  }
  // For anonymous traffic / bots we never trigger a paid generation; return
  // whatever we have (possibly stale) or null. Generation only happens when
  // an authenticated user views the page.
  if (!opts.allowGenerate) {
    if (cached) {
      return { narrative: cached.narrative, generatedAt: cached.generatedAt.toISOString() };
    }
    return null;
  }
  const text =
    kind === "unit"
      ? await generateUnitNarrative(refId)
      : await generatePropertyNarrative(refId);
  if (!text) {
    if (cached) {
      return { narrative: cached.narrative, generatedAt: cached.generatedAt.toISOString() };
    }
    return null;
  }
  await upsertNarrative(kind, refId, text, MODEL);
  return { narrative: text, generatedAt: new Date().toISOString() };
}
