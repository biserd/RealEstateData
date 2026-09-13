-- One INSERT publishes a validated dataset atomically. D1 runs trigger actions
-- within the same transaction; any validation failure leaves publication intact.
CREATE TABLE dataset_publication_requests (
  candidate_id TEXT NOT NULL PRIMARY KEY REFERENCES published_dataset_versions(id),
  environment TEXT NOT NULL CHECK (environment IN ('development','staging','production')),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')
);

CREATE TRIGGER validate_dataset_publication BEFORE INSERT ON dataset_publication_requests
BEGIN
  SELECT RAISE(ABORT, 'candidate must exist in this environment and be validated')
  WHERE NOT EXISTS (
    SELECT 1 FROM published_dataset_versions
    WHERE id=NEW.candidate_id AND environment=NEW.environment AND status='validated'
  );
  SELECT RAISE(ABORT, 'critical quality failures block publication')
  WHERE EXISTS (
    SELECT 1 FROM data_quality_results WHERE dataset_version_id=NEW.candidate_id
    AND severity='critical' AND status='fail'
  );
  SELECT RAISE(ABORT, 'candidate has no market snapshots')
  WHERE NOT EXISTS (SELECT 1 FROM market_snapshots_v2 WHERE dataset_version_id=NEW.candidate_id);
  SELECT RAISE(ABORT, 'candidate has no eligible rankings')
  WHERE NOT EXISTS (SELECT 1 FROM ranking_snapshots WHERE dataset_version_id=NEW.candidate_id AND eligible=1);
END;

CREATE TRIGGER publish_dataset AFTER INSERT ON dataset_publication_requests
BEGIN
  UPDATE published_dataset_versions SET status='retired', retired_at=NEW.requested_at
  WHERE environment=NEW.environment AND status='published';
  UPDATE published_dataset_versions SET status='published', published_at=NEW.requested_at
  WHERE id=NEW.candidate_id AND environment=NEW.environment;
END;
