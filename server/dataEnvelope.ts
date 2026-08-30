import { sql } from "drizzle-orm";
import type { DataCoverage, DataEnvelope, DataFreshness, DataMatchMode, GeographyDescriptor } from "../shared/dataEnvelope";
import { db } from "./db";

let freshnessCache: { value: DataFreshness; expiresAt: number } | null = null;

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getPublishedFreshness(): Promise<DataFreshness> {
  if (freshnessCache && freshnessCache.expiresAt > Date.now()) return freshnessCache.value;
  const current = await db.execute(sql`
    SELECT max(sale_date) AS source_date, max(created_at) AS ingested_at FROM sales
  `);
  const aggregate = await db.execute(sql`SELECT max(computed_at) AS published_at FROM market_aggregates`);
  let datasetVersion = "legacy-curated";
  let versionPublishedAt: string | null = null;
  try {
    const version = await db.execute(sql`
      SELECT id, published_at FROM published_dataset_versions
      WHERE environment = ${process.env.DATABASE_ENV || "production"} AND status = 'published'
      ORDER BY published_at DESC LIMIT 1
    `);
    const row = version.rows[0] as { id?: string; published_at?: unknown } | undefined;
    if (row?.id) datasetVersion = row.id;
    versionPublishedAt = iso(row?.published_at);
  } catch (error) {
    // Additive migration may not be installed yet. Preserve the existing public
    // dataset while clearly identifying it as the legacy curated version.
    if (!(error instanceof Error) || !/published_dataset_versions|does not exist/i.test(error.message)) throw error;
  }
  const row = current.rows[0] as { source_date?: unknown; ingested_at?: unknown } | undefined;
  const aggregateRow = aggregate.rows[0] as { published_at?: unknown } | undefined;
  const sourceDate = iso(row?.source_date);
  const stale = !sourceDate || Date.now() - new Date(sourceDate).getTime() > 45 * 86_400_000;
  const value: DataFreshness = {
    sourceDate,
    ingestedAt: iso(row?.ingested_at),
    publishedAt: versionPublishedAt || iso(aggregateRow?.published_at),
    datasetVersion,
    stale,
  };
  freshnessCache = { value, expiresAt: Date.now() + 5 * 60_000 };
  return value;
}

export async function dataEnvelope<T>(input: {
  requestedGeography: GeographyDescriptor;
  effectiveGeography?: GeographyDescriptor;
  matchMode?: DataMatchMode;
  records: T[];
  fallbackReason?: string | null;
  availableNearbyGeographies?: GeographyDescriptor[];
  supportedRecordTypes: string[];
  missingRecordTypes?: string[];
  minimumSampleSize?: number | null;
  warnings?: string[];
}): Promise<DataEnvelope<T>> {
  const freshness = await getPublishedFreshness();
  const coverage: DataCoverage = {
    supportedRecordTypes: input.supportedRecordTypes,
    missingRecordTypes: input.missingRecordTypes || [],
    minimumSampleSize: input.minimumSampleSize ?? null,
    observedSampleSize: input.records.length,
  };
  const warnings = [...(input.warnings || [])];
  if (freshness.stale) warnings.push("The latest source record is outside the expected freshness window.");
  return {
    requestedGeography: input.requestedGeography,
    effectiveGeography: input.effectiveGeography || input.requestedGeography,
    matchMode: input.matchMode || "exact",
    records: input.records,
    recordCount: input.records.length,
    fallbackReason: input.fallbackReason || null,
    availableNearbyGeographies: input.availableNearbyGeographies || [],
    freshness,
    coverage,
    warnings,
  };
}
