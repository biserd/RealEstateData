export type PipelineEnvironment = "development" | "staging" | "production";
export type SourceRedistributionStatus = "approved" | "review_required" | "prohibited";

export interface SourceDefinition {
  id: string;
  owner: string;
  name: string;
  endpoint: string;
  cadence: "daily" | "weekly" | "monthly" | "annual" | "licensed_incremental";
  expectedLagDays: number;
  coverage: { states: string[]; recordTypes: string[]; notes?: string };
  redistributionStatus: SourceRedistributionStatus;
  adapterVersion: string;
  active: boolean;
}

export interface SourceDiscovery {
  sourceId: string;
  watermark: string;
  sourceDate: string | null;
  schemaVersion: string;
}

export interface AcquiredArtifact {
  sourceId: string;
  watermark: string;
  bytes: Uint8Array;
  mediaType: string;
  rowCount?: number;
}

export interface NormalizedSourceRecord {
  sourceId: string;
  sourceRecordId: string;
  entityType: "property" | "unit" | "building" | "transaction" | "reference";
  state: "NY" | "NJ" | "CT";
  zipCode: string | null;
  recordedAt: string | null;
  normalized: Record<string, unknown>;
  rawRowNumber: number;
}

export interface SourceAdapter {
  readonly definition: SourceDefinition;
  discover(signal?: AbortSignal): Promise<SourceDiscovery>;
  acquire(discovery: SourceDiscovery, signal?: AbortSignal): Promise<AcquiredArtifact[]>;
  normalize(artifact: AcquiredArtifact): AsyncIterable<NormalizedSourceRecord>;
}

export function assertSourceMayPublish(definition: SourceDefinition): void {
  if (!definition.active) throw new Error(`${definition.id} is not active`);
  if (definition.redistributionStatus !== "approved") {
    throw new Error(`${definition.id} cannot publish until redistribution status is approved`);
  }
}

export function stableObjectKey(sourceId: string, watermark: string, part: number, extension: string): string {
  const safeWatermark = watermark.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `raw/${sourceId}/${safeWatermark}/part-${String(part).padStart(5, "0")}.${extension}`;
}
