CREATE TABLE IF NOT EXISTS florida_releases (
  id TEXT PRIMARY KEY,
  source_updated_at TEXT NOT NULL,
  start_month TEXT NOT NULL,
  published_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS florida_single_active_release
  ON florida_releases((1)) WHERE published_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS florida_sales (
  release_id TEXT NOT NULL REFERENCES florida_releases(id) ON DELETE CASCADE,
  county_code INTEGER NOT NULL CHECK (county_code BETWEEN 11 AND 77),
  parcel_id TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  zip TEXT NOT NULL,
  property_use TEXT NOT NULL,
  sale_month TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price BETWEEN 50000 AND 100000000),
  PRIMARY KEY (release_id, county_code, parcel_id)
);

CREATE INDEX IF NOT EXISTS florida_sales_county_month
  ON florida_sales(release_id, county_code, sale_month DESC, parcel_id);
CREATE INDEX IF NOT EXISTS florida_sales_zip_month
  ON florida_sales(release_id, county_code, zip, sale_month DESC, parcel_id);

CREATE TABLE IF NOT EXISTS florida_coverage (
  release_id TEXT NOT NULL REFERENCES florida_releases(id) ON DELETE CASCADE,
  county_code INTEGER NOT NULL CHECK (county_code BETWEEN 11 AND 77),
  records INTEGER NOT NULL CHECK (records > 0),
  latest_month TEXT NOT NULL,
  PRIMARY KEY (release_id, county_code)
);
