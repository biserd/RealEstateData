import { sql } from "drizzle-orm";
import { db } from "../server/db";
import {
  dataQualityResults,
  comparableMembers,
  comparableSets,
  marketSnapshots,
  publishedDatasetVersions,
  rankingSnapshots,
  refreshRuns,
  sourceCatalog,
} from "../shared/schema";
import {
  buildMarketSnapshots,
  buildRankings,
  candidatePasses,
  MARKET_RULE_VERSION,
  RANKING_RULE_VERSION,
  COMP_RULE_VERSION,
  selectComparableSales,
  validateCandidate,
  type PublicPropertyFact,
  type VerifiedSaleFact,
} from "../pipeline/analytics";
import { sourceById } from "../pipeline/sourceCatalog";
import { assertDatabaseWriteAllowed, databaseIdentity } from "./lib/database-safety";

const apply = process.argv.includes("--apply");
const publish = process.argv.includes("--publish");
const environment = (process.env.DATABASE_ENV || "development") as "development" | "staging" | "production";
const periodEndArg = process.argv.find((argument) => argument.startsWith("--period-end="));
const periodEnd = periodEndArg ? new Date(periodEndArg.split("=")[1]) : new Date();
const source = sourceById("nyc-rolling-sales");

if (Number.isNaN(periodEnd.getTime())) throw new Error("--period-end must be an ISO date");
if (publish && !apply) throw new Error("--publish requires --apply");
if (publish && process.env.CONFIRM_DATASET_PUBLISH !== "YES") {
  throw new Error("Dataset publication blocked. Set CONFIRM_DATASET_PUBLISH=YES after reviewing the candidate quality report.");
}

type RawSale = {
  id: string;
  geography_id: string;
  property_id: string;
  sale_price: number | string;
  sale_date: Date | string;
  sqft: number | string | null;
  property_type: string | null;
  beds: number | string | null;
  arms_length: boolean | null;
  package_sale: boolean | null;
  match_method: string | null;
  source_id: string | null;
};

type RawProperty = {
  id: string;
  geography_id: string;
  property_type: string | null;
  beds: number | string | null;
  sqft: number | string | null;
  year_built: number | string | null;
};

async function loadFacts(): Promise<{ sales: VerifiedSaleFact[]; properties: PublicPropertyFact[] }> {
  const [salesResult, propertiesResult] = await Promise.all([
    db.execute(sql`
      SELECT sale.id, sale.geography_id, sale.property_id, sale.sale_price, sale.sale_date,
        property.sqft, property.property_type, property.beds, sale.arms_length,
        COALESCE(sale.package_sale, false) AS package_sale, sale.match_method, sale.source_id
      FROM sales sale
      JOIN properties property ON property.id = sale.property_id
      LEFT JOIN data_quality_quarantine quarantine
        ON quarantine.source_table = 'sales' AND quarantine.source_id = sale.id
      WHERE sale.geography_id IS NOT NULL
        AND quarantine.source_id IS NULL
        AND sale.sale_price BETWEEN 50000 AND 100000000
        AND sale.sale_date >= ${new Date(Date.UTC(periodEnd.getUTCFullYear() - 3, periodEnd.getUTCMonth(), periodEnd.getUTCDate()))}
        AND sale.match_method IS NOT NULL
    `),
    db.execute(sql`
      SELECT property.id, property.geography_id, property.property_type, property.beds, property.sqft, property.year_built
      FROM properties property
      LEFT JOIN data_quality_quarantine quarantine
        ON quarantine.source_table = 'properties' AND quarantine.source_id = property.id
      WHERE property.geography_id IS NOT NULL
        AND quarantine.source_id IS NULL
        AND NULLIF(BTRIM(property.address), '') IS NOT NULL
        AND property.state IN ('NY','NJ','CT')
        AND property.zip_code ~ '^[0-9]{5}$'
        AND COALESCE(property.estimated_value, property.last_sale_price, 0) BETWEEN 50000 AND 100000000
        AND (NULLIF(BTRIM(property.bbl), '') IS NOT NULL OR EXISTS (
          SELECT 1 FROM entity_resolution_map map
          WHERE map.matched_property_id = property.id AND map.match_confidence >= 0.90
        ))
    `),
  ]);
  const sales = (salesResult.rows as RawSale[]).map((row) => ({
    id: row.id,
    geographyId: row.geography_id,
    propertyId: row.property_id,
    salePrice: Number(row.sale_price),
    saleDate: new Date(row.sale_date),
    sqft: row.sqft === null ? null : Number(row.sqft),
    propertyType: row.property_type,
    beds: row.beds === null ? null : Number(row.beds),
    armsLength: row.arms_length !== false,
    packageSale: Boolean(row.package_sale),
    identityResolved: Boolean(row.match_method),
    sourceId: row.source_id || source.id,
  }));
  const properties = (propertiesResult.rows as RawProperty[]).map((row) => ({
    id: row.id,
    geographyId: row.geography_id,
    propertyType: row.property_type,
    beds: row.beds === null ? null : Number(row.beds),
    sqft: row.sqft === null ? null : Number(row.sqft),
    yearBuilt: row.year_built === null ? null : Number(row.year_built),
  }));
  return { sales, properties };
}

async function main() {
  assertDatabaseWriteAllowed(apply);
  const { sales, properties } = await loadFacts();
  const snapshots = buildMarketSnapshots(sales, periodEnd);
  const publicPropertyCounts = new Map<string, number>();
  for (const property of properties) publicPropertyCounts.set(property.geographyId, (publicPropertyCounts.get(property.geographyId) || 0) + 1);
  const rankings = buildRankings(snapshots, publicPropertyCounts);
  const salesByGeography = new Map<string, VerifiedSaleFact[]>();
  for (const sale of sales) {
    const group = salesByGeography.get(sale.geographyId) || [];
    group.push(sale);
    salesByGeography.set(sale.geographyId, group);
  }
  const compCandidates = properties.map((property) => ({
    property,
    members: selectComparableSales(property, salesByGeography.get(property.geographyId) || [], periodEnd),
  })).filter((candidate) => candidate.members.length >= 3);
  const latestSourceDate = sales.reduce<Date | null>((latest, sale) => !latest || sale.saleDate > latest ? sale.saleDate : latest, null);
  const sourceAgeDays = latestSourceDate ? Math.max(0, (periodEnd.getTime() - latestSourceDate.getTime()) / 86_400_000) : Number.POSITIVE_INFINITY;
  let previousTransactionCount = 0;
  try {
    const previous = await db.execute(sql`SELECT COALESCE(sum(transaction_count), 0)::int AS count FROM current_market_snapshots`);
    previousTransactionCount = Number((previous.rows[0] as { count?: number | string } | undefined)?.count || 0);
  } catch (error) {
    if (!(error instanceof Error) || !/current_market_snapshots|does not exist/i.test(error.message)) throw error;
  }
  const contradictionResult = await db.execute(sql`
    SELECT count(*)::int AS count
    FROM properties property
    JOIN canonical_geographies geography ON geography.id = property.geography_id
    WHERE property.state IS DISTINCT FROM geography.state OR property.zip_code IS DISTINCT FROM geography.zip_code
  `);
  const duplicateResult = await db.execute(sql`
    SELECT count(*)::int AS count FROM (
      SELECT source_id, source_record_id FROM sales
      WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL
      GROUP BY source_id, source_record_id HAVING count(*) > 1
    ) duplicates
  `);
  const quality = validateCandidate({
    snapshots,
    rankings,
    contradictoryGeographyCount: Number((contradictionResult.rows[0] as { count?: number | string } | undefined)?.count || 0),
    duplicateSourceRecordCount: Number((duplicateResult.rows[0] as { count?: number | string } | undefined)?.count || 0),
    comparableSetCount: compCandidates.length,
    sourceAgeDays,
    previousTransactionCount,
  });
  const report = {
    database: databaseIdentity(),
    mode: apply ? publish ? "publish" : "candidate" : "dry-run",
    periodEnd: periodEnd.toISOString(),
    input: { verifiedSales: sales.length, publicProperties: properties.length },
    output: { marketSnapshots: snapshots.length, eligibleRankings: rankings.filter((ranking) => ranking.eligible).length, comparableSets: compCandidates.length },
    quality,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!candidatePasses(quality)) throw new Error("Candidate failed critical quality gates; nothing will be published");
  if (!apply) return;

  const candidateId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  await db.insert(sourceCatalog).values({
    id: source.id,
    owner: source.owner,
    name: source.name,
    endpoint: source.endpoint,
    license: "Official public-record source; retain source attribution and re-check terms before redistribution changes.",
    redistributionStatus: source.redistributionStatus,
    cadence: source.cadence,
    expectedLagDays: source.expectedLagDays,
    coverage: source.coverage,
    adapterVersion: source.adapterVersion,
    active: source.active,
  }).onConflictDoUpdate({ target: sourceCatalog.id, set: { adapterVersion: source.adapterVersion, updatedAt: new Date() } });
  await db.insert(publishedDatasetVersions).values({
    id: candidateId,
    environment,
    status: "candidate",
    sourceWatermarks: { [source.id]: periodEnd.toISOString() },
    qualitySummary: { rules: quality, marketRuleVersion: MARKET_RULE_VERSION, rankingRuleVersion: RANKING_RULE_VERSION },
  });
  await db.insert(refreshRuns).values({
    id: runId,
    environment,
    sourceId: source.id,
    sourceWatermark: periodEnd.toISOString(),
    status: "computing",
    counts: report.input,
    candidateVersionId: candidateId,
  });
  for (let index = 0; index < snapshots.length; index += 250) {
    await db.insert(marketSnapshots).values(snapshots.slice(index, index + 250).map((snapshot) => ({
      datasetVersionId: candidateId,
      geographyId: snapshot.geographyId,
      segmentKey: snapshot.segmentKey,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      transactionCount: snapshot.transactionCount,
      medianPrice: snapshot.medianPrice,
      p25Price: snapshot.p25Price,
      p75Price: snapshot.p75Price,
      medianPricePerSqft: snapshot.medianPricePerSqft,
      trendPercent: snapshot.trendPercent,
      sourceCoverage: snapshot.sourceCoverage,
      confidence: snapshot.confidence,
    })));
  }
  for (let index = 0; index < rankings.length; index += 250) {
    await db.insert(rankingSnapshots).values(rankings.slice(index, index + 250).map((ranking) => ({
      datasetVersionId: candidateId,
      geographyId: ranking.geographyId,
      scoreVersion: RANKING_RULE_VERSION,
      rank: ranking.rank,
      priceTrendScore: ranking.priceTrendScore,
      transactionVelocityScore: ranking.transactionVelocityScore,
      liquidityScore: ranking.liquidityScore,
      compDepthScore: ranking.compDepthScore,
      confidenceScore: ranking.confidenceScore,
      totalScore: ranking.totalScore,
      eligible: ranking.eligible,
      exclusionReasons: ranking.exclusionReasons,
    })));
  }
  await db.insert(dataQualityResults).values(quality.map((result) => ({
    runId,
    datasetVersionId: candidateId,
    ruleId: result.ruleId,
    severity: result.severity,
    status: result.status,
    observedValue: result.observedValue,
    threshold: result.threshold,
    evidence: result.evidence,
  })));
  const compPeriodStart = new Date(periodEnd);
  compPeriodStart.setUTCMonth(compPeriodStart.getUTCMonth() - 18);
  const compRows = compCandidates.map((candidate) => ({ candidate, comparableSetId: crypto.randomUUID() }));
  for (let index = 0; index < compRows.length; index += 250) {
    await db.insert(comparableSets).values(compRows.slice(index, index + 250).map(({ candidate, comparableSetId }) => ({
      id: comparableSetId,
      datasetVersionId: candidateId,
      subjectType: "property",
      subjectId: candidate.property.id,
      ruleVersion: COMP_RULE_VERSION,
      periodStart: compPeriodStart,
      periodEnd,
      confidence: candidate.members.length >= 8 ? "high" : candidate.members.length >= 5 ? "medium" : "low",
      broadeningSteps: ["same_geography", "same_property_type", "bedroom_plus_or_minus_one", "size_plus_or_minus_35_percent", "18_month_window"],
    })));
  }
  const memberRows = compRows.flatMap(({ candidate, comparableSetId }) => candidate.members.map((member) => ({
    comparableSetId,
    saleId: member.saleId,
    weight: member.weight,
    adjustment: member.adjustment,
    inclusionReason: member.inclusionReason,
  })));
  for (let index = 0; index < memberRows.length; index += 500) {
    await db.insert(comparableMembers).values(memberRows.slice(index, index + 500));
  }
  await db.execute(sql`UPDATE published_dataset_versions SET status = 'validated' WHERE id = ${candidateId}`);
  await db.execute(sql`UPDATE refresh_runs SET status = 'candidate_ready', counts = ${JSON.stringify({ ...report.input, ...report.output })}::jsonb, completed_at = now() WHERE id = ${runId}`);

  if (publish) {
    await db.execute(sql`SELECT publish_validated_dataset(${candidateId}, ${environment})`);
    await db.execute(sql`UPDATE refresh_runs SET status = 'published', published_version_id = ${candidateId} WHERE id = ${runId}`);
  }
  console.log(JSON.stringify({ candidateId, runId, published: publish }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
