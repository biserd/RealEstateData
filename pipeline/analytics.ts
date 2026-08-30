export const MARKET_RULE_VERSION = "market-v1.1.0";
export const RANKING_RULE_VERSION = "up-and-coming-v1.1.0";
export const COMP_RULE_VERSION = "comps-v1.0.0";

export interface VerifiedSaleFact {
  id: string;
  geographyId: string;
  propertyId: string;
  salePrice: number;
  saleDate: Date;
  sqft: number | null;
  propertyType: string | null;
  beds: number | null;
  armsLength: boolean;
  packageSale: boolean;
  identityResolved: boolean;
  sourceId: string;
}

export interface PublicPropertyFact {
  id: string;
  geographyId: string;
  propertyType: string | null;
  beds: number | null;
  sqft: number | null;
  yearBuilt: number | null;
}

export interface MarketSnapshotCandidate {
  geographyId: string;
  segmentKey: string;
  periodStart: Date;
  periodEnd: Date;
  transactionCount: number;
  priorTransactionCount: number;
  medianPrice: number;
  p25Price: number;
  p75Price: number;
  medianPricePerSqft: number | null;
  trendPercent: number | null;
  sourceCoverage: Record<string, number>;
  confidence: "low" | "medium" | "high";
}

export interface RankingCandidate {
  geographyId: string;
  rank: number;
  eligible: boolean;
  exclusionReasons: string[];
  priceTrendScore: number;
  transactionVelocityScore: number;
  liquidityScore: number;
  compDepthScore: number;
  confidenceScore: number;
  totalScore: number;
}

export interface ComparableMemberCandidate {
  saleId: string;
  weight: number;
  adjustment: number;
  inclusionReason: string;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) throw new Error("Cannot compute a percentile for an empty collection");
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * Math.max(0, Math.min(1, fraction));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function isVerifiedCompSale(sale: VerifiedSaleFact, periodStart: Date, periodEnd: Date): boolean {
  return sale.identityResolved
    && sale.armsLength
    && !sale.packageSale
    && sale.salePrice >= 50_000
    && sale.salePrice <= 100_000_000
    && sale.saleDate >= periodStart
    && sale.saleDate < periodEnd;
}

export function buildMarketSnapshots(
  sales: VerifiedSaleFact[],
  periodEnd: Date,
  months = 6,
  minimumTransactions = 5,
): MarketSnapshotCandidate[] {
  const periodStart = new Date(periodEnd);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - months);
  const priorStart = new Date(periodStart);
  priorStart.setUTCMonth(priorStart.getUTCMonth() - months);
  const eligible = sales.filter((sale) => isVerifiedCompSale(sale, priorStart, periodEnd));
  const byGeography = new Map<string, VerifiedSaleFact[]>();
  for (const sale of eligible) {
    const group = byGeography.get(sale.geographyId) || [];
    group.push(sale);
    byGeography.set(sale.geographyId, group);
  }

  const snapshots: MarketSnapshotCandidate[] = [];
  for (const [geographyId, group] of byGeography) {
    const current = group.filter((sale) => sale.saleDate >= periodStart);
    const prior = group.filter((sale) => sale.saleDate < periodStart);
    if (current.length < minimumTransactions || prior.length < minimumTransactions) continue;
    const prices = current.map((sale) => sale.salePrice);
    const priorMedian = percentile(prior.map((sale) => sale.salePrice), 0.5);
    const medianPrice = percentile(prices, 0.5);
    const ppsf = current
      .filter((sale) => sale.sqft !== null && sale.sqft >= 100)
      .map((sale) => sale.salePrice / (sale.sqft as number))
      .filter((value) => value >= 50 && value <= 20_000);
    const sourceCoverage: Record<string, number> = {};
    for (const sale of current) sourceCoverage[sale.sourceId] = (sourceCoverage[sale.sourceId] || 0) + 1;
    snapshots.push({
      geographyId,
      segmentKey: "all",
      periodStart,
      periodEnd,
      transactionCount: current.length,
      priorTransactionCount: prior.length,
      medianPrice: Math.round(medianPrice),
      p25Price: Math.round(percentile(prices, 0.25)),
      p75Price: Math.round(percentile(prices, 0.75)),
      medianPricePerSqft: ppsf.length >= minimumTransactions ? round(percentile(ppsf, 0.5), 2) : null,
      trendPercent: priorMedian > 0 ? round(((medianPrice - priorMedian) / priorMedian) * 100, 2) : null,
      sourceCoverage,
      confidence: current.length >= 30 && prior.length >= 30 ? "high" : current.length >= 15 && prior.length >= 15 ? "medium" : "low",
    });
  }
  return snapshots.sort((a, b) => a.geographyId.localeCompare(b.geographyId));
}

function clampScore(value: number): number {
  return round(Math.max(0, Math.min(100, value)), 2);
}

export function buildRankings(
  snapshots: MarketSnapshotCandidate[],
  publicPropertyCounts: Map<string, number>,
): RankingCandidate[] {
  const ranked = snapshots.map((snapshot) => {
    const publicProperties = publicPropertyCounts.get(snapshot.geographyId) || 0;
    const exclusionReasons: string[] = [];
    if (publicProperties < 1) exclusionReasons.push("no_public_destination_properties");
    if (snapshot.transactionCount < 5 || snapshot.priorTransactionCount < 5) exclusionReasons.push("insufficient_transaction_history");
    if (snapshot.trendPercent === null) exclusionReasons.push("trend_unavailable");
    const priceTrendScore = clampScore(50 + (snapshot.trendPercent || 0) * 2.5);
    const transactionVelocityScore = clampScore((snapshot.transactionCount / Math.max(1, snapshot.priorTransactionCount)) * 50);
    const liquidityScore = clampScore(Math.log10(snapshot.transactionCount + 1) * 35);
    const compDepthScore = clampScore(Math.min(snapshot.transactionCount, 40) * 2.5);
    const confidenceScore = snapshot.confidence === "high" ? 100 : snapshot.confidence === "medium" ? 70 : 40;
    const totalScore = round(
      priceTrendScore * 0.30
      + transactionVelocityScore * 0.25
      + liquidityScore * 0.20
      + compDepthScore * 0.15
      + confidenceScore * 0.10,
      2,
    );
    return {
      geographyId: snapshot.geographyId,
      rank: 0,
      eligible: exclusionReasons.length === 0,
      exclusionReasons,
      priceTrendScore,
      transactionVelocityScore,
      liquidityScore,
      compDepthScore,
      confidenceScore,
      totalScore,
    };
  });
  const eligible = ranked.filter((row) => row.eligible).sort((a, b) => b.totalScore - a.totalScore || a.geographyId.localeCompare(b.geographyId));
  eligible.forEach((row, index) => { row.rank = index + 1; });
  const ineligible = ranked.filter((row) => !row.eligible).sort((a, b) => a.geographyId.localeCompare(b.geographyId));
  ineligible.forEach((row, index) => { row.rank = eligible.length + index + 1; });
  return [...eligible, ...ineligible];
}

export function selectComparableSales(
  subject: PublicPropertyFact,
  sales: VerifiedSaleFact[],
  periodEnd: Date,
  maximum = 10,
): ComparableMemberCandidate[] {
  const periodStart = new Date(periodEnd);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - 18);
  return sales
    .filter((sale) => sale.propertyId !== subject.id)
    .filter((sale) => sale.geographyId === subject.geographyId)
    .filter((sale) => isVerifiedCompSale(sale, periodStart, periodEnd))
    .filter((sale) => !subject.propertyType || !sale.propertyType || sale.propertyType === subject.propertyType)
    .filter((sale) => subject.beds === null || sale.beds === null || Math.abs(subject.beds - sale.beds) <= 1)
    .filter((sale) => subject.sqft === null || sale.sqft === null || Math.abs(subject.sqft - sale.sqft) / subject.sqft <= 0.35)
    .map((sale) => {
      const ageDays = Math.max(0, (periodEnd.getTime() - sale.saleDate.getTime()) / 86_400_000);
      const sizeDistance = subject.sqft && sale.sqft ? Math.abs(subject.sqft - sale.sqft) / subject.sqft : 0.25;
      const bedDistance = subject.beds !== null && sale.beds !== null ? Math.abs(subject.beds - sale.beds) : 0.5;
      const weight = Math.max(0.05, 1 - Math.min(0.8, ageDays / 900 + sizeDistance * 0.4 + bedDistance * 0.08));
      return {
        saleId: sale.id,
        weight: round(weight, 4),
        adjustment: subject.sqft && sale.sqft ? round((subject.sqft - sale.sqft) / subject.sqft, 4) : 0,
        inclusionReason: "same_geography; verified_arms_length; same_property_type; size_and_bedroom_band",
        order: ageDays + sizeDistance * 365 + bedDistance * 30,
      };
    })
    .sort((a, b) => a.order - b.order || a.saleId.localeCompare(b.saleId))
    .slice(0, maximum)
    .map(({ order: _order, ...member }) => member);
}

export interface CandidateQualityResult {
  ruleId: string;
  severity: "warning" | "high" | "critical";
  status: "pass" | "fail";
  observedValue: number;
  threshold: number;
  evidence: Record<string, unknown>;
}

export function validateCandidate(input: {
  snapshots: MarketSnapshotCandidate[];
  rankings: RankingCandidate[];
  contradictoryGeographyCount: number;
  duplicateSourceRecordCount: number;
  comparableSetCount?: number;
  sourceAgeDays?: number;
  previousTransactionCount?: number;
}): CandidateQualityResult[] {
  const eligibleRankings = input.rankings.filter((ranking) => ranking.eligible).length;
  const currentTransactionCount = input.snapshots.reduce((sum, snapshot) => sum + snapshot.transactionCount, 0);
  const volumeRatio = input.previousTransactionCount && input.previousTransactionCount > 0
    ? currentTransactionCount / input.previousTransactionCount
    : 1;
  const implausibleMedians = input.snapshots.filter((snapshot) => snapshot.medianPrice < 50_000 || snapshot.medianPrice > 20_000_000).length;
  return [
    { ruleId: "market_snapshots_nonempty", severity: "critical", status: input.snapshots.length > 0 ? "pass" : "fail", observedValue: input.snapshots.length, threshold: 1, evidence: {} },
    { ruleId: "eligible_rankings_nonempty", severity: "critical", status: eligibleRankings > 0 ? "pass" : "fail", observedValue: eligibleRankings, threshold: 1, evidence: {} },
    { ruleId: "cross_geography_contradictions", severity: "critical", status: input.contradictoryGeographyCount === 0 ? "pass" : "fail", observedValue: input.contradictoryGeographyCount, threshold: 0, evidence: {} },
    { ruleId: "duplicate_source_records", severity: "critical", status: input.duplicateSourceRecordCount === 0 ? "pass" : "fail", observedValue: input.duplicateSourceRecordCount, threshold: 0, evidence: {} },
    { ruleId: "comparable_sets_nonempty", severity: "critical", status: (input.comparableSetCount ?? 1) > 0 ? "pass" : "fail", observedValue: input.comparableSetCount ?? 1, threshold: 1, evidence: {} },
    { ruleId: "source_freshness_days", severity: "critical", status: (input.sourceAgeDays ?? 0) <= 45 ? "pass" : "fail", observedValue: input.sourceAgeDays ?? 0, threshold: 45, evidence: {} },
    { ruleId: "market_median_plausibility", severity: "critical", status: implausibleMedians === 0 ? "pass" : "fail", observedValue: implausibleMedians, threshold: 0, evidence: {} },
    { ruleId: "published_volume_drift_ratio", severity: "high", status: volumeRatio >= 0.5 && volumeRatio <= 2 ? "pass" : "fail", observedValue: volumeRatio, threshold: 0.5, evidence: { allowedMaximum: 2, previousTransactionCount: input.previousTransactionCount || 0, currentTransactionCount } },
  ];
}

export function candidatePasses(results: CandidateQualityResult[]): boolean {
  return !results.some((result) => result.severity === "critical" && result.status === "fail");
}
