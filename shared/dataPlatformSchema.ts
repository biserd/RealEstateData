import { timestamp } from "./sqliteTypes";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  real,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Versioned, source-backed data platform tables.
 *
 * These tables are additive during the migration. Existing public tables remain
 * readable until a reviewed candidate is published and the API is switched to
 * the corresponding dataset version.
 */
export const canonicalGeographies = sqliteTable("canonical_geographies", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  state: text("state").notNull(),
  countyFips: text("county_fips"),
  countyName: text("county_name"),
  municipality: text("municipality"),
  zipCode: text("zip_code"),
  canonicalName: text("canonical_name").notNull(),
  aliases: text("aliases", { mode: "json" }).$type<string[]>(),
  centroidLatitude: real("centroid_latitude"),
  centroidLongitude: real("centroid_longitude"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  updatedAt: timestamp("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [
  uniqueIndex("canonical_geographies_state_zip_unique").on(table.state, table.zipCode),
  index("canonical_geographies_county_idx").on(table.state, table.countyFips),
]);

export const sourceCatalog = sqliteTable("source_catalog", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  endpoint: text("endpoint"),
  license: text("license"),
  redistributionStatus: text("redistribution_status").notNull().default("review_required"),
  cadence: text("cadence").notNull(),
  expectedLagDays: integer("expected_lag_days").notNull().default(30),
  coverage: text("coverage", { mode: "json" }).notNull().default(sql`'{}'`),
  adapterVersion: text("adapter_version").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  updatedAt: timestamp("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
});

export const refreshRuns = sqliteTable("refresh_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  environment: text("environment").notNull(),
  sourceId: text("source_id").notNull(),
  sourceWatermark: text("source_watermark"),
  status: text("status").notNull().default("discovered"),
  counts: text("counts", { mode: "json" }).notNull().default(sql`'{}'`),
  timings: text("timings", { mode: "json" }).notNull().default(sql`'{}'`),
  error: text("error"),
  candidateVersionId: text("candidate_version_id"),
  publishedVersionId: text("published_version_id"),
  startedAt: timestamp("started_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("refresh_runs_source_started_idx").on(table.sourceId, table.startedAt),
  index("refresh_runs_status_idx").on(table.status),
]);

export const rawRecordManifests = sqliteTable("raw_record_manifests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull(),
  sourceId: text("source_id").notNull(),
  objectKey: text("object_key").notNull(),
  checksumSha256: text("checksum_sha256").notNull(),
  sourceVersion: text("source_version").notNull(),
  rowCount: integer("row_count").notNull(),
  byteSize: integer("byte_size"),
  downloadedAt: timestamp("downloaded_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [uniqueIndex("raw_record_manifest_object_unique").on(table.sourceId, table.objectKey)]);

export const sourceEntities = sqliteTable("source_entities", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull(),
  sourceId: text("source_id").notNull(),
  sourceRecordId: text("source_record_id").notNull(),
  entityType: text("entity_type").notNull(),
  geographyId: text("geography_id"),
  normalized: text("normalized", { mode: "json" }).notNull(),
  rawObjectKey: text("raw_object_key"),
  rawRowNumber: integer("raw_row_number"),
  createdAt: timestamp("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [
  uniqueIndex("source_entities_source_record_unique").on(table.sourceId, table.sourceRecordId),
  index("source_entities_run_idx").on(table.runId),
]);

export const canonicalEntityCrosswalk = sqliteTable("canonical_entity_crosswalk", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sourceEntityId: text("source_entity_id").notNull(),
  canonicalEntityType: text("canonical_entity_type").notNull(),
  canonicalEntityId: text("canonical_entity_id"),
  geographyId: text("geography_id"),
  matchMethod: text("match_method").notNull(),
  confidence: real("confidence").notNull(),
  reviewStatus: text("review_status").notNull().default("pending"),
  evidence: text("evidence", { mode: "json" }).notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  updatedAt: timestamp("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [uniqueIndex("canonical_crosswalk_source_unique").on(table.sourceEntityId)]);

export const publishedDatasetVersions = sqliteTable("published_dataset_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  environment: text("environment").notNull(),
  status: text("status").notNull().default("candidate"),
  predecessorId: text("predecessor_id"),
  sourceWatermarks: text("source_watermarks", { mode: "json" }).notNull().default(sql`'{}'`),
  qualitySummary: text("quality_summary", { mode: "json" }).notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  publishedAt: timestamp("published_at"),
  retiredAt: timestamp("retired_at"),
}, (table) => [
  index("published_dataset_status_idx").on(table.environment, table.status),
]);

export const dataQualityResults = sqliteTable("data_quality_results", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id").notNull(),
  datasetVersionId: text("dataset_version_id"),
  ruleId: text("rule_id").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  observedValue: real("observed_value"),
  threshold: real("threshold"),
  evidence: text("evidence", { mode: "json" }).notNull().default(sql`'{}'`),
  checkedAt: timestamp("checked_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [
  uniqueIndex("data_quality_result_run_rule_unique").on(table.runId, table.ruleId),
  index("data_quality_result_version_idx").on(table.datasetVersionId),
]);

export const dataQualityQuarantine = sqliteTable("data_quality_quarantine", {
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  runId: text("run_id"),
  reason: text("reason").notNull(),
  severity: text("severity").notNull().default("high"),
  record: text("record", { mode: "json" }).notNull(),
  reviewStatus: text("review_status").notNull().default("pending"),
  quarantinedAt: timestamp("quarantined_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [uniqueIndex("data_quality_quarantine_record_unique").on(table.sourceTable, table.sourceId, table.reason)]);

export const marketSnapshots = sqliteTable("market_snapshots_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  datasetVersionId: text("dataset_version_id").notNull(),
  geographyId: text("geography_id").notNull(),
  segmentKey: text("segment_key").notNull().default("all"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  transactionCount: integer("transaction_count").notNull(),
  medianPrice: integer("median_price"),
  p25Price: integer("p25_price"),
  p75Price: integer("p75_price"),
  medianPricePerSqft: real("median_price_per_sqft"),
  trendPercent: real("trend_percent"),
  sourceCoverage: text("source_coverage", { mode: "json" }).notNull(),
  confidence: text("confidence").notNull(),
  computedAt: timestamp("computed_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [
  uniqueIndex("market_snapshot_version_geo_segment_unique").on(table.datasetVersionId, table.geographyId, table.segmentKey, table.periodStart, table.periodEnd),
  index("market_snapshot_version_idx").on(table.datasetVersionId),
]);

export const rankingSnapshots = sqliteTable("ranking_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  datasetVersionId: text("dataset_version_id").notNull(),
  geographyId: text("geography_id").notNull(),
  scoreVersion: text("score_version").notNull(),
  rank: integer("rank").notNull(),
  priceTrendScore: real("price_trend_score").notNull(),
  transactionVelocityScore: real("transaction_velocity_score").notNull(),
  liquidityScore: real("liquidity_score").notNull(),
  compDepthScore: real("comp_depth_score").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  totalScore: real("total_score").notNull(),
  eligible: integer("eligible", { mode: "boolean" }).notNull(),
  exclusionReasons: text("exclusion_reasons", { mode: "json" }).$type<string[]>(),
  computedAt: timestamp("computed_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [
  uniqueIndex("ranking_snapshot_version_geo_unique").on(table.datasetVersionId, table.geographyId, table.scoreVersion),
  index("ranking_snapshot_version_rank_idx").on(table.datasetVersionId, table.rank),
]);

export const comparableSets = sqliteTable("comparable_sets_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  datasetVersionId: text("dataset_version_id").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  ruleVersion: text("rule_version").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  confidence: text("confidence").notNull(),
  broadeningSteps: text("broadening_steps", { mode: "json" }).$type<string[]>(),
  createdAt: timestamp("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
}, (table) => [uniqueIndex("comparable_set_version_subject_unique").on(table.datasetVersionId, table.subjectType, table.subjectId, table.ruleVersion)]);

export const comparableMembers = sqliteTable("comparable_members_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  comparableSetId: text("comparable_set_id").notNull(),
  saleId: text("sale_id").notNull(),
  weight: real("weight").notNull(),
  adjustment: real("adjustment").notNull().default(0),
  inclusionReason: text("inclusion_reason").notNull(),
}, (table) => [uniqueIndex("comparable_member_set_sale_unique").on(table.comparableSetId, table.saleId)]);

export type CanonicalGeography = typeof canonicalGeographies.$inferSelect;
export type MarketSnapshotV2 = typeof marketSnapshots.$inferSelect;
export type RankingSnapshot = typeof rankingSnapshots.$inferSelect;
