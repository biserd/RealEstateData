-- P3-P7 additive migration: canonical identity, provenance, candidate datasets,
-- deterministic market snapshots, rankings, and atomic publication.
-- Apply only through the repository's production write gate after a verified
-- backup/Neon branch exists. This migration never removes active table data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS canonical_geographies (
  id varchar PRIMARY KEY,
  type varchar NOT NULL CHECK (type IN ('state','county','municipality','zip','neighborhood')),
  state varchar NOT NULL CHECK (state IN ('NY','NJ','CT')),
  county_fips varchar,
  county_name varchar,
  municipality varchar,
  zip_code varchar,
  canonical_name varchar NOT NULL,
  aliases text[],
  centroid_latitude real,
  centroid_longitude real,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (zip_code IS NULL OR zip_code ~ '^[0-9]{5}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_geographies_state_zip_unique
  ON canonical_geographies(state, zip_code) WHERE zip_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS canonical_geographies_county_idx
  ON canonical_geographies(state, county_fips);

CREATE TABLE IF NOT EXISTS source_catalog (
  id varchar PRIMARY KEY,
  owner varchar NOT NULL,
  name varchar NOT NULL,
  endpoint text,
  license text,
  redistribution_status varchar NOT NULL DEFAULT 'review_required'
    CHECK (redistribution_status IN ('approved','review_required','prohibited')),
  cadence varchar NOT NULL,
  expected_lag_days integer NOT NULL DEFAULT 30 CHECK (expected_lag_days >= 0),
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  adapter_version varchar NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS published_dataset_versions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  environment varchar NOT NULL CHECK (environment IN ('development','staging','production')),
  status varchar NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','validated','published','rejected','retired')),
  predecessor_id varchar REFERENCES published_dataset_versions(id),
  source_watermarks jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  retired_at timestamptz
);
CREATE INDEX IF NOT EXISTS published_dataset_status_idx
  ON published_dataset_versions(environment, status);
CREATE UNIQUE INDEX IF NOT EXISTS one_published_dataset_per_environment
  ON published_dataset_versions(environment) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS refresh_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  environment varchar NOT NULL CHECK (environment IN ('development','staging','production')),
  source_id varchar NOT NULL REFERENCES source_catalog(id),
  source_watermark varchar,
  status varchar NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered','acquiring','parsing','normalizing','resolving','validating','computing','candidate_ready','published','failed')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  timings jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  candidate_version_id varchar REFERENCES published_dataset_versions(id),
  published_version_id varchar REFERENCES published_dataset_versions(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (environment, source_id, source_watermark)
);
CREATE INDEX IF NOT EXISTS refresh_runs_source_started_idx ON refresh_runs(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS refresh_runs_status_idx ON refresh_runs(status);

CREATE TABLE IF NOT EXISTS raw_record_manifests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id varchar NOT NULL REFERENCES refresh_runs(id),
  source_id varchar NOT NULL REFERENCES source_catalog(id),
  object_key text NOT NULL,
  checksum_sha256 varchar NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  source_version varchar NOT NULL,
  row_count integer NOT NULL CHECK (row_count >= 0),
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, object_key)
);

CREATE TABLE IF NOT EXISTS source_entities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id varchar NOT NULL REFERENCES refresh_runs(id),
  source_id varchar NOT NULL REFERENCES source_catalog(id),
  source_record_id varchar NOT NULL,
  entity_type varchar NOT NULL,
  geography_id varchar REFERENCES canonical_geographies(id),
  normalized jsonb NOT NULL,
  raw_object_key text,
  raw_row_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, source_record_id)
);
CREATE INDEX IF NOT EXISTS source_entities_run_idx ON source_entities(run_id);

CREATE TABLE IF NOT EXISTS canonical_entity_crosswalk (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_entity_id varchar NOT NULL UNIQUE REFERENCES source_entities(id),
  canonical_entity_type varchar NOT NULL,
  canonical_entity_id varchar,
  geography_id varchar REFERENCES canonical_geographies(id),
  match_method varchar NOT NULL,
  confidence real NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  review_status varchar NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected','quarantined')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((review_status <> 'approved') OR (canonical_entity_id IS NOT NULL AND geography_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS data_quality_results (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id varchar NOT NULL REFERENCES refresh_runs(id),
  dataset_version_id varchar REFERENCES published_dataset_versions(id),
  rule_id varchar NOT NULL,
  severity varchar NOT NULL CHECK (severity IN ('info','warning','high','critical')),
  status varchar NOT NULL CHECK (status IN ('pass','fail','skipped')),
  observed_value double precision,
  threshold double precision,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, rule_id)
);
CREATE INDEX IF NOT EXISTS data_quality_result_version_idx ON data_quality_results(dataset_version_id);

CREATE TABLE IF NOT EXISTS data_quality_quarantine (
  source_table varchar NOT NULL,
  source_id varchar NOT NULL,
  run_id varchar REFERENCES refresh_runs(id),
  reason text NOT NULL,
  severity varchar NOT NULL DEFAULT 'high' CHECK (severity IN ('warning','high','critical')),
  record jsonb NOT NULL,
  review_status varchar NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','accepted','remediated','rejected')),
  quarantined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_table, source_id, reason)
);
ALTER TABLE data_quality_quarantine ADD COLUMN IF NOT EXISTS run_id varchar REFERENCES refresh_runs(id);
ALTER TABLE data_quality_quarantine ADD COLUMN IF NOT EXISTS severity varchar NOT NULL DEFAULT 'high';
ALTER TABLE data_quality_quarantine ADD COLUMN IF NOT EXISTS review_status varchar NOT NULL DEFAULT 'pending';

ALTER TABLE properties ADD COLUMN IF NOT EXISTS geography_id varchar REFERENCES canonical_geographies(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS published_dataset_version_id varchar REFERENCES published_dataset_versions(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS geography_id varchar REFERENCES canonical_geographies(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source_id varchar REFERENCES source_catalog(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source_record_id varchar;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS source_fingerprint varchar;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS published_dataset_version_id varchar REFERENCES published_dataset_versions(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS package_sale boolean NOT NULL DEFAULT false;
ALTER TABLE condo_units ADD COLUMN IF NOT EXISTS geography_id varchar REFERENCES canonical_geographies(id);
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS geography_id varchar REFERENCES canonical_geographies(id);
ALTER TABLE market_aggregates ADD COLUMN IF NOT EXISTS geography_id varchar REFERENCES canonical_geographies(id);
ALTER TABLE market_aggregates ADD COLUMN IF NOT EXISTS published_dataset_version_id varchar REFERENCES published_dataset_versions(id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_source_record_unique
  ON sales(source_id, source_record_id) WHERE source_id IS NOT NULL AND source_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_source_fingerprint_unique
  ON sales(source_id, source_fingerprint) WHERE source_id IS NOT NULL AND source_fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS properties_geography_idx ON properties(geography_id);
CREATE INDEX IF NOT EXISTS sales_geography_date_idx ON sales(geography_id, sale_date DESC);

CREATE TABLE IF NOT EXISTS market_snapshots_v2 (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dataset_version_id varchar NOT NULL REFERENCES published_dataset_versions(id),
  geography_id varchar NOT NULL REFERENCES canonical_geographies(id),
  segment_key varchar NOT NULL DEFAULT 'all',
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  transaction_count integer NOT NULL CHECK (transaction_count >= 0),
  median_price integer,
  p25_price integer,
  p75_price integer,
  median_price_per_sqft real,
  trend_percent real,
  source_coverage jsonb NOT NULL,
  confidence varchar NOT NULL CHECK (confidence IN ('insufficient','low','medium','high')),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dataset_version_id, geography_id, segment_key, period_start, period_end),
  CHECK (period_end > period_start),
  CHECK (p25_price IS NULL OR median_price IS NULL OR p25_price <= median_price),
  CHECK (p75_price IS NULL OR median_price IS NULL OR p75_price >= median_price)
);
CREATE INDEX IF NOT EXISTS market_snapshot_version_idx ON market_snapshots_v2(dataset_version_id);

CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dataset_version_id varchar NOT NULL REFERENCES published_dataset_versions(id),
  geography_id varchar NOT NULL REFERENCES canonical_geographies(id),
  score_version varchar NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  price_trend_score real NOT NULL,
  transaction_velocity_score real NOT NULL,
  liquidity_score real NOT NULL,
  comp_depth_score real NOT NULL,
  confidence_score real NOT NULL,
  total_score real NOT NULL,
  eligible boolean NOT NULL,
  exclusion_reasons text[],
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dataset_version_id, geography_id, score_version)
);
CREATE INDEX IF NOT EXISTS ranking_snapshot_version_rank_idx ON ranking_snapshots(dataset_version_id, rank);

CREATE TABLE IF NOT EXISTS comparable_sets_v2 (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dataset_version_id varchar NOT NULL REFERENCES published_dataset_versions(id),
  subject_type varchar NOT NULL CHECK (subject_type IN ('property','unit','building')),
  subject_id varchar NOT NULL,
  rule_version varchar NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  confidence varchar NOT NULL CHECK (confidence IN ('insufficient','low','medium','high')),
  broadening_steps text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dataset_version_id, subject_type, subject_id, rule_version)
);
CREATE TABLE IF NOT EXISTS comparable_members_v2 (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  comparable_set_id varchar NOT NULL REFERENCES comparable_sets_v2(id) ON DELETE CASCADE,
  sale_id varchar NOT NULL REFERENCES sales(id),
  weight real NOT NULL CHECK (weight > 0 AND weight <= 1),
  adjustment real NOT NULL DEFAULT 0,
  inclusion_reason text NOT NULL,
  UNIQUE(comparable_set_id, sale_id)
);

-- One atomic operation promotes a validated candidate and retires the previous
-- version. Critical failed checks, empty snapshots, or empty rankings block it.
CREATE OR REPLACE FUNCTION publish_validated_dataset(p_candidate_id varchar, p_environment varchar)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_status varchar;
  v_critical_failures integer;
  v_market_rows integer;
  v_ranking_rows integer;
BEGIN
  SELECT status INTO v_status
    FROM published_dataset_versions
    WHERE id = p_candidate_id AND environment = p_environment
    FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'candidate dataset does not exist'; END IF;
  IF v_status <> 'validated' THEN RAISE EXCEPTION 'candidate must be validated before publication'; END IF;

  SELECT count(*) INTO v_critical_failures
    FROM data_quality_results
    WHERE dataset_version_id = p_candidate_id AND severity = 'critical' AND status = 'fail';
  SELECT count(*) INTO v_market_rows FROM market_snapshots_v2 WHERE dataset_version_id = p_candidate_id;
  SELECT count(*) INTO v_ranking_rows FROM ranking_snapshots WHERE dataset_version_id = p_candidate_id AND eligible;
  IF v_critical_failures > 0 THEN RAISE EXCEPTION 'critical quality failures block publication'; END IF;
  IF v_market_rows = 0 THEN RAISE EXCEPTION 'candidate has no market snapshots'; END IF;
  IF v_ranking_rows = 0 THEN RAISE EXCEPTION 'candidate has no eligible rankings'; END IF;

  UPDATE published_dataset_versions
    SET status = 'retired', retired_at = now()
    WHERE environment = p_environment AND status = 'published';
  UPDATE published_dataset_versions
    SET status = 'published', published_at = now()
    WHERE id = p_candidate_id;
END;
$$;

CREATE OR REPLACE VIEW current_published_dataset AS
SELECT * FROM published_dataset_versions WHERE status = 'published';

CREATE OR REPLACE VIEW current_market_snapshots AS
SELECT snapshot.*
FROM market_snapshots_v2 snapshot
JOIN current_published_dataset version ON version.id = snapshot.dataset_version_id;

CREATE OR REPLACE VIEW current_ranking_snapshots AS
SELECT ranking.*
FROM ranking_snapshots ranking
JOIN current_published_dataset version ON version.id = ranking.dataset_version_id
WHERE ranking.eligible;
