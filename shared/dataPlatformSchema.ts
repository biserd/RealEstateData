import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Versioned, source-backed data platform tables.
 *
 * These tables are additive during the migration. Existing public tables remain
 * readable until a reviewed candidate is published and the API is switched to
 * the corresponding dataset version.
 */
export const canonicalGeographies = pgTable("canonical_geographies", {
  id: varchar("id").primaryKey(),
  type: varchar("type").notNull(),
  state: varchar("state").notNull(),
  countyFips: varchar("county_fips"),
  countyName: varchar("county_name"),
  municipality: varchar("municipality"),
  zipCode: varchar("zip_code"),
  canonicalName: varchar("canonical_name").notNull(),
  aliases: text("aliases").array(),
  centroidLatitude: real("centroid_latitude"),
  centroidLongitude: real("centroid_longitude"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("canonical_geographies_state_zip_unique").on(table.state, table.zipCode),
  index("canonical_geographies_county_idx").on(table.state, table.countyFips),
]);

export const sourceCatalog = pgTable("source_catalog", {
  id: varchar("id").primaryKey(),
  owner: varchar("owner").notNull(),
  name: varchar("name").notNull(),
  endpoint: text("endpoint"),
  license: text("license"),
  redistributionStatus: varchar("redistribution_status").notNull().default("review_required"),
  cadence: varchar("cadence").notNull(),
  expectedLagDays: integer("expected_lag_days").notNull().default(30),
  coverage: jsonb("coverage").notNull().default(sql`'{}'::jsonb`),
  adapterVersion: varchar("adapter_version").notNull(),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refreshRuns = pgTable("refresh_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environment: varchar("environment").notNull(),
  sourceId: varchar("source_id").notNull(),
  sourceWatermark: varchar("source_watermark"),
  status: varchar("status").notNull().default("discovered"),
  counts: jsonb("counts").notNull().default(sql`'{}'::jsonb`),
  timings: jsonb("timings").notNull().default(sql`'{}'::jsonb`),
  error: text("error"),
  candidateVersionId: varchar("candidate_version_id"),
  publishedVersionId: varchar("published_version_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("refresh_runs_source_started_idx").on(table.sourceId, table.startedAt),
  index("refresh_runs_status_idx").on(table.status),
]);

export const rawRecordManifests = pgTable("raw_record_manifests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull(),
  sourceId: varchar("source_id").notNull(),
  objectKey: text("object_key").notNull(),
  checksumSha256: varchar("checksum_sha256").notNull(),
  sourceVersion: varchar("source_version").notNull(),
  rowCount: integer("row_count").notNull(),
  byteSize: integer("byte_size"),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("raw_record_manifest_object_unique").on(table.sourceId, table.objectKey)]);

export const sourceEntities = pgTable("source_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull(),
  sourceId: varchar("source_id").notNull(),
  sourceRecordId: varchar("source_record_id").notNull(),
  entityType: varchar("entity_type").notNull(),
  geographyId: varchar("geography_id"),
  normalized: jsonb("normalized").notNull(),
  rawObjectKey: text("raw_object_key"),
  rawRowNumber: integer("raw_row_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("source_entities_source_record_unique").on(table.sourceId, table.sourceRecordId),
  index("source_entities_run_idx").on(table.runId),
]);

export const canonicalEntityCrosswalk = pgTable("canonical_entity_crosswalk", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceEntityId: varchar("source_entity_id").notNull(),
  canonicalEntityType: varchar("canonical_entity_type").notNull(),
  canonicalEntityId: varchar("canonical_entity_id"),
  geographyId: varchar("geography_id"),
  matchMethod: varchar("match_method").notNull(),
  confidence: real("confidence").notNull(),
  reviewStatus: varchar("review_status").notNull().default("pending"),
  evidence: jsonb("evidence").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("canonical_crosswalk_source_unique").on(table.sourceEntityId)]);

export const publishedDatasetVersions = pgTable("published_dataset_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environment: varchar("environment").notNull(),
  status: varchar("status").notNull().default("candidate"),
  predecessorId: varchar("predecessor_id"),
  sourceWatermarks: jsonb("source_watermarks").notNull().default(sql`'{}'::jsonb`),
  qualitySummary: jsonb("quality_summary").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
}, (table) => [
  index("published_dataset_status_idx").on(table.environment, table.status),
]);

export const dataQualityResults = pgTable("data_quality_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull(),
  datasetVersionId: varchar("dataset_version_id"),
  ruleId: varchar("rule_id").notNull(),
  severity: varchar("severity").notNull(),
  status: varchar("status").notNull(),
  observedValue: real("observed_value"),
  threshold: real("threshold"),
  evidence: jsonb("evidence").notNull().default(sql`'{}'::jsonb`),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("data_quality_result_run_rule_unique").on(table.runId, table.ruleId),
  index("data_quality_result_version_idx").on(table.datasetVersionId),
]);

export const dataQualityQuarantine = pgTable("data_quality_quarantine", {
  sourceTable: varchar("source_table").notNull(),
  sourceId: varchar("source_id").notNull(),
  runId: varchar("run_id"),
  reason: text("reason").notNull(),
  severity: varchar("severity").notNull().default("high"),
  record: jsonb("record").notNull(),
  reviewStatus: varchar("review_status").notNull().default("pending"),
  quarantinedAt: timestamp("quarantined_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("data_quality_quarantine_record_unique").on(table.sourceTable, table.sourceId, table.reason)]);

export const marketSnapshots = pgTable("market_snapshots_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetVersionId: varchar("dataset_version_id").notNull(),
  geographyId: varchar("geography_id").notNull(),
  segmentKey: varchar("segment_key").notNull().default("all"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  transactionCount: integer("transaction_count").notNull(),
  medianPrice: integer("median_price"),
  p25Price: integer("p25_price"),
  p75Price: integer("p75_price"),
  medianPricePerSqft: real("median_price_per_sqft"),
  trendPercent: real("trend_percent"),
  sourceCoverage: jsonb("source_coverage").notNull(),
  confidence: varchar("confidence").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("market_snapshot_version_geo_segment_unique").on(table.datasetVersionId, table.geographyId, table.segmentKey, table.periodStart, table.periodEnd),
  index("market_snapshot_version_idx").on(table.datasetVersionId),
]);

export const rankingSnapshots = pgTable("ranking_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetVersionId: varchar("dataset_version_id").notNull(),
  geographyId: varchar("geography_id").notNull(),
  scoreVersion: varchar("score_version").notNull(),
  rank: integer("rank").notNull(),
  priceTrendScore: real("price_trend_score").notNull(),
  transactionVelocityScore: real("transaction_velocity_score").notNull(),
  liquidityScore: real("liquidity_score").notNull(),
  compDepthScore: real("comp_depth_score").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  totalScore: real("total_score").notNull(),
  eligible: boolean("eligible").notNull(),
  exclusionReasons: text("exclusion_reasons").array(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ranking_snapshot_version_geo_unique").on(table.datasetVersionId, table.geographyId, table.scoreVersion),
  index("ranking_snapshot_version_rank_idx").on(table.datasetVersionId, table.rank),
]);

export const comparableSets = pgTable("comparable_sets_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetVersionId: varchar("dataset_version_id").notNull(),
  subjectType: varchar("subject_type").notNull(),
  subjectId: varchar("subject_id").notNull(),
  ruleVersion: varchar("rule_version").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  confidence: varchar("confidence").notNull(),
  broadeningSteps: text("broadening_steps").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("comparable_set_version_subject_unique").on(table.datasetVersionId, table.subjectType, table.subjectId, table.ruleVersion)]);

export const comparableMembers = pgTable("comparable_members_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  comparableSetId: varchar("comparable_set_id").notNull(),
  saleId: varchar("sale_id").notNull(),
  weight: real("weight").notNull(),
  adjustment: real("adjustment").notNull().default(0),
  inclusionReason: text("inclusion_reason").notNull(),
}, (table) => [uniqueIndex("comparable_member_set_sale_unique").on(table.comparableSetId, table.saleId)]);

export type CanonicalGeography = typeof canonicalGeographies.$inferSelect;
export type MarketSnapshotV2 = typeof marketSnapshots.$inferSelect;
export type RankingSnapshot = typeof rankingSnapshots.$inferSelect;
