export type DataMatchMode = "exact" | "broadened" | "coverage_gap" | "stale_snapshot";

export interface GeographyDescriptor {
  type: string;
  id?: string;
  ids?: string[];
  name?: string;
  state?: string;
}

export interface DataFreshness {
  sourceDate: string | null;
  ingestedAt: string | null;
  publishedAt: string | null;
  datasetVersion: string;
  stale: boolean;
}

export interface DataCoverage {
  supportedRecordTypes: string[];
  missingRecordTypes: string[];
  minimumSampleSize: number | null;
  observedSampleSize: number;
}

export interface DataEnvelope<T> {
  requestedGeography: GeographyDescriptor;
  effectiveGeography: GeographyDescriptor;
  matchMode: DataMatchMode;
  records: T[];
  recordCount: number;
  fallbackReason: string | null;
  availableNearbyGeographies: GeographyDescriptor[];
  freshness: DataFreshness;
  coverage: DataCoverage;
  warnings: string[];
}
