-- PostgreSQL catalog port: tables, constraints, indexes, views and update triggers.
CREATE TABLE "_system__replit_database_migrations_v1" (
  "id" INTEGER NOT NULL,
  "build_id" TEXT NOT NULL,
  "deployment_id" TEXT NOT NULL,
  "statement_count" INTEGER NOT NULL,
  "applied_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "replit_database_migrations_v1_pkey" PRIMARY KEY (id)
);

CREATE TABLE "acris_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "document_id" TEXT NOT NULL,
  "record_type" TEXT,
  "bbl" TEXT,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "doc_type" TEXT,
  "doc_date" TEXT,
  "recorded_date_time" TEXT,
  "doc_amount" REAL,
  "percent_transferred" REAL,
  "good_through_date" TEXT,
  "party_type" TEXT,
  "party_name" TEXT,
  "party_address" TEXT,
  "street_number" TEXT,
  "street_name" TEXT,
  "unit" TEXT,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "acris_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "ai_chats" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "property_id" TEXT,
  "geo_id" TEXT,
  "question" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "ai_chats_pkey" PRIMARY KEY (id),
  CONSTRAINT "ai_chats_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id),
  CONSTRAINT "ai_chats_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "ai_insights" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT,
  "bbl" TEXT,
  "insight_type" TEXT NOT NULL,
  "summary" TEXT,
  "key_findings" TEXT,
  "recommendations" TEXT,
  "citations" TEXT,
  "model_used" TEXT,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "confidence" REAL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "expires_at" TEXT,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY (id),
  CONSTRAINT "ai_insights_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "alerts" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "watchlist_id" TEXT,
  "property_id" TEXT,
  "alert_type" TEXT NOT NULL,
  "threshold" REAL,
  "is_active" INTEGER DEFAULT true,
  "last_triggered" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "alerts_pkey" PRIMARY KEY (id),
  CONSTRAINT "alerts_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id),
  CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id),
  CONSTRAINT "alerts_watchlist_id_watchlists_id_fk" FOREIGN KEY (watchlist_id) REFERENCES "watchlists"(id)
);

CREATE TABLE "amenities" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "subcategory" TEXT,
  "address" TEXT,
  "city" TEXT,
  "borough" TEXT,
  "zip_code" TEXT,
  "latitude" REAL NOT NULL,
  "longitude" REAL NOT NULL,
  "grid_lat" INTEGER,
  "grid_lng" INTEGER,
  "source_id" TEXT,
  "source_type" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "amenities_pkey" PRIMARY KEY (id)
);

CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "hashed_key" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "last_four" TEXT NOT NULL,
  "name" TEXT DEFAULT 'Default API Key',
  "status" TEXT DEFAULT 'active',
  "last_used_at" TEXT,
  "request_count" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "api_keys_pkey" PRIMARY KEY (id),
  CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "buildings" (
  "base_bbl" TEXT NOT NULL,
  "display_address" TEXT,
  "bin" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "borough" TEXT,
  "zip_code" TEXT,
  "unit_count" INTEGER DEFAULT 0,
  "residential_unit_count" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "geography_id" TEXT,
  CONSTRAINT "buildings_pkey" PRIMARY KEY (base_bbl),
  CONSTRAINT "buildings_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id)
);

CREATE TABLE "canonical_entity_crosswalk" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "source_entity_id" TEXT NOT NULL,
  "canonical_entity_type" TEXT NOT NULL,
  "canonical_entity_id" TEXT,
  "geography_id" TEXT,
  "match_method" TEXT NOT NULL,
  "confidence" REAL NOT NULL,
  "review_status" TEXT NOT NULL DEFAULT 'pending',
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "canonical_entity_crosswalk_confidence_check" CHECK (((confidence >= (0)) AND (confidence <= (1)))),
  CONSTRAINT "canonical_entity_crosswalk_review_status_check" CHECK (((review_status) IN ('pending', 'approved', 'rejected', 'quarantined'))),
  CONSTRAINT "canonical_entity_crosswalk_check" CHECK ((((review_status) <> 'approved') OR ((canonical_entity_id IS NOT NULL) AND (geography_id IS NOT NULL)))),
  CONSTRAINT "canonical_entity_crosswalk_pkey" PRIMARY KEY (id),
  CONSTRAINT "canonical_entity_crosswalk_source_entity_id_key" UNIQUE (source_entity_id),
  CONSTRAINT "canonical_entity_crosswalk_source_entity_id_fkey" FOREIGN KEY (source_entity_id) REFERENCES "source_entities"(id),
  CONSTRAINT "canonical_entity_crosswalk_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id)
);

CREATE TABLE "canonical_geographies" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "county_fips" TEXT,
  "county_name" TEXT,
  "municipality" TEXT,
  "zip_code" TEXT,
  "canonical_name" TEXT NOT NULL,
  "aliases" TEXT,
  "centroid_latitude" REAL,
  "centroid_longitude" REAL,
  "valid_from" TEXT,
  "valid_to" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "canonical_geographies_type_check" CHECK (((type) IN ('state', 'county', 'municipality', 'zip', 'neighborhood'))),
  CONSTRAINT "canonical_geographies_state_check" CHECK (((state) IN ('NY', 'NJ', 'CT'))),
  CONSTRAINT "canonical_geographies_zip_code_check" CHECK (((zip_code IS NULL) OR (zip_code GLOB '[0-9][0-9][0-9][0-9][0-9]'))),
  CONSTRAINT "canonical_geographies_pkey" PRIMARY KEY (id)
);

CREATE TABLE "comparable_members_v2" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "comparable_set_id" TEXT NOT NULL,
  "sale_id" TEXT NOT NULL,
  "weight" REAL NOT NULL,
  "adjustment" REAL NOT NULL DEFAULT 0,
  "inclusion_reason" TEXT NOT NULL,
  CONSTRAINT "comparable_members_v2_weight_check" CHECK (((weight > (0)) AND (weight <= (1)))),
  CONSTRAINT "comparable_members_v2_pkey" PRIMARY KEY (id),
  CONSTRAINT "comparable_members_v2_comparable_set_id_sale_id_key" UNIQUE (comparable_set_id, sale_id),
  CONSTRAINT "comparable_members_v2_comparable_set_id_fkey" FOREIGN KEY (comparable_set_id) REFERENCES "comparable_sets_v2"(id) ON DELETE CASCADE,
  CONSTRAINT "comparable_members_v2_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES "sales"(id)
);

CREATE TABLE "comparable_sets_v2" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "dataset_version_id" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "rule_version" TEXT NOT NULL,
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "broadening_steps" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "comparable_sets_v2_pkey" PRIMARY KEY (id),
  CONSTRAINT "comparable_sets_v2_dataset_version_id_subject_type_subject__key" UNIQUE (dataset_version_id, subject_type, subject_id, rule_version),
  CONSTRAINT "comparable_sets_v2_subject_type_check" CHECK (((subject_type) IN ('property', 'unit', 'building'))),
  CONSTRAINT "comparable_sets_v2_confidence_check" CHECK (((confidence) IN ('insufficient', 'low', 'medium', 'high'))),
  CONSTRAINT "comparable_sets_v2_dataset_version_id_fkey" FOREIGN KEY (dataset_version_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "complaints_311_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "unique_key" TEXT NOT NULL,
  "bbl" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "address" TEXT,
  "city" TEXT,
  "borough" TEXT,
  "zip_code" TEXT,
  "complaint_type" TEXT,
  "descriptor" TEXT,
  "location_type" TEXT,
  "status" TEXT,
  "resolution_description" TEXT,
  "created_date" TEXT,
  "closed_date" TEXT,
  "agency" TEXT,
  "agency_name" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "complaints_311_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "comps" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "subject_property_id" TEXT NOT NULL,
  "comp_property_id" TEXT NOT NULL,
  "similarity_score" REAL,
  "sqft_adjustment" REAL,
  "age_adjustment" REAL,
  "beds_adjustment" REAL,
  "adjusted_price" INTEGER,
  "computed_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "comps_pkey" PRIMARY KEY (id),
  CONSTRAINT "comps_comp_property_id_properties_id_fk" FOREIGN KEY (comp_property_id) REFERENCES "properties"(id),
  CONSTRAINT "comps_subject_property_id_properties_id_fk" FOREIGN KEY (subject_property_id) REFERENCES "properties"(id)
);

CREATE TABLE "condo_registry" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "unit_bbl" TEXT NOT NULL,
  "base_bbl" TEXT,
  "condo_number" TEXT,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "unit_designation" TEXT,
  "address" TEXT,
  "zip_code" TEXT,
  "metadata" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "condo_registry_pkey" PRIMARY KEY (id),
  CONSTRAINT "condo_registry_unit_bbl_unique" UNIQUE (unit_bbl)
);

CREATE TABLE "condo_units" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "unit_bbl" TEXT NOT NULL,
  "base_bbl" TEXT NOT NULL,
  "condo_number" TEXT,
  "unit_designation" TEXT,
  "building_property_id" TEXT,
  "building_display_address" TEXT,
  "unit_display_address" TEXT,
  "bin" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "borough" TEXT,
  "zip_code" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "unit_type_hint" TEXT DEFAULT 'residential',
  "slug" TEXT,
  "beds" INTEGER,
  "baths" REAL,
  "sqft" INTEGER,
  "geography_id" TEXT,
  CONSTRAINT "condo_units_pkey" PRIMARY KEY (id),
  CONSTRAINT "condo_units_slug_unique" UNIQUE (slug),
  CONSTRAINT "condo_units_unit_bbl_unique" UNIQUE (unit_bbl),
  CONSTRAINT "condo_units_building_property_id_properties_id_fk" FOREIGN KEY (building_property_id) REFERENCES "properties"(id),
  CONSTRAINT "condo_units_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id)
);

CREATE TABLE "coverage_matrix" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "state" TEXT NOT NULL,
  "county" TEXT,
  "zip_code" TEXT,
  "coverage_level" TEXT NOT NULL,
  "freshness_sla_days" INTEGER DEFAULT 30,
  "sqft_completeness" REAL,
  "year_built_completeness" REAL,
  "last_sale_completeness" REAL,
  "confidence_score" REAL,
  "allowed_ai_claims" TEXT,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "coverage_matrix_pkey" PRIMARY KEY (id)
);

CREATE TABLE "data_quality_quarantine" (
  "source_table" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "run_id" TEXT,
  "reason" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'high',
  "record" TEXT NOT NULL,
  "review_status" TEXT NOT NULL DEFAULT 'pending',
  "quarantined_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "data_quality_quarantine_severity_check" CHECK (((severity) IN ('warning', 'high', 'critical'))),
  CONSTRAINT "data_quality_quarantine_review_status_check" CHECK (((review_status) IN ('pending', 'accepted', 'remediated', 'rejected'))),
  CONSTRAINT "data_quality_quarantine_pkey" PRIMARY KEY (source_table, source_id, reason),
  CONSTRAINT "data_quality_quarantine_run_id_fkey" FOREIGN KEY (run_id) REFERENCES "refresh_runs"(id)
);

CREATE TABLE "data_quality_results" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "run_id" TEXT NOT NULL,
  "dataset_version_id" TEXT,
  "rule_id" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "observed_value" REAL,
  "threshold" REAL,
  "evidence" TEXT NOT NULL DEFAULT '{}',
  "checked_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "data_quality_results_pkey" PRIMARY KEY (id),
  CONSTRAINT "data_quality_results_run_id_rule_id_key" UNIQUE (run_id, rule_id),
  CONSTRAINT "data_quality_results_run_id_fkey" FOREIGN KEY (run_id) REFERENCES "refresh_runs"(id),
  CONSTRAINT "data_quality_results_severity_check" CHECK (((severity) IN ('info', 'warning', 'high', 'critical'))),
  CONSTRAINT "data_quality_results_status_check" CHECK (((status) IN ('pass', 'fail', 'skipped'))),
  CONSTRAINT "data_quality_results_dataset_version_id_fkey" FOREIGN KEY (dataset_version_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "data_sources" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "refresh_cadence" TEXT,
  "last_refresh" TEXT,
  "record_count" INTEGER,
  "licensing_notes" TEXT,
  "is_active" INTEGER DEFAULT true,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "data_sources_pkey" PRIMARY KEY (id)
);

CREATE TABLE "dob_complaints_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "complaint_number" TEXT NOT NULL,
  "bbl" TEXT,
  "bin" TEXT,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "house_number" TEXT,
  "street_name" TEXT,
  "zip_code" TEXT,
  "complaint_category" TEXT,
  "complaint_category_description" TEXT,
  "unit_or_apartment" TEXT,
  "status" TEXT,
  "disposition_code" TEXT,
  "disposition_date" TEXT,
  "date_entered" TEXT,
  "inspection_date" TEXT,
  "dob_run_date" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "dob_complaints_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "dob_permits_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "job_number" TEXT NOT NULL,
  "bbl" TEXT,
  "bin" TEXT,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "house_number" TEXT,
  "street_name" TEXT,
  "zip_code" TEXT,
  "job_type" TEXT,
  "job_description" TEXT,
  "work_type" TEXT,
  "permit_status" TEXT,
  "filing_date" TEXT,
  "issuance_date" TEXT,
  "expiration_date" TEXT,
  "estimated_cost" INTEGER,
  "owner_business_name" TEXT,
  "owner_name" TEXT,
  "applicant_name" TEXT,
  "professional_cert" INTEGER,
  "existing_stories" INTEGER,
  "proposed_stories" INTEGER,
  "existing_dwelling_units" INTEGER,
  "proposed_dwelling_units" INTEGER,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "dob_permits_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "entity_resolution_map" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "source_system" TEXT NOT NULL,
  "source_record_id" TEXT NOT NULL,
  "source_bbl" TEXT,
  "matched_property_id" TEXT,
  "match_type" TEXT NOT NULL,
  "match_confidence" REAL NOT NULL,
  "match_metadata" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "entity_resolution_map_pkey" PRIMARY KEY (id),
  CONSTRAINT "entity_resolution_map_matched_property_id_properties_id_fk" FOREIGN KEY (matched_property_id) REFERENCES "properties"(id)
);

CREATE TABLE "flood_zones" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "bbl" TEXT,
  "zip_code" TEXT,
  "flood_zone" TEXT NOT NULL,
  "flood_zone_subtype" TEXT,
  "fema_firm_panel_id" TEXT,
  "effective_date" TEXT,
  "is_high_risk" INTEGER DEFAULT false,
  "is_moderate_risk" INTEGER DEFAULT false,
  "base_flood_elevation" REAL,
  "special_flood_hazard_area" INTEGER DEFAULT false,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "flood_zones_pkey" PRIMARY KEY (id)
);

CREATE TABLE "hpd_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "bbl" TEXT,
  "building_id" TEXT,
  "registration_id" TEXT,
  "boro_id" TEXT,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "house_number" TEXT,
  "street_name" TEXT,
  "zip_code" TEXT,
  "registration_status" TEXT,
  "building_owner_name" TEXT,
  "building_owner_phone" TEXT,
  "building_owner_email" TEXT,
  "agent_name" TEXT,
  "agent_phone" TEXT,
  "agent_address" TEXT,
  "num_floors" INTEGER,
  "num_apartments" INTEGER,
  "num_legal_units" INTEGER,
  "total_violations" INTEGER,
  "open_violations" INTEGER,
  "total_complaints" INTEGER,
  "open_complaints" INTEGER,
  "last_inspection_date" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "hpd_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "market_aggregates" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "geo_type" TEXT NOT NULL,
  "geo_id" TEXT NOT NULL,
  "geo_name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "property_type" TEXT,
  "beds_band" TEXT,
  "baths_band" TEXT,
  "year_built_band" TEXT,
  "size_band" TEXT,
  "median_price" INTEGER,
  "median_price_per_sqft" REAL,
  "p25_price" INTEGER,
  "p75_price" INTEGER,
  "p25_price_per_sqft" REAL,
  "p75_price_per_sqft" REAL,
  "transaction_count" INTEGER,
  "turnover_rate" REAL,
  "volatility" REAL,
  "trend_3m" REAL,
  "trend_6m" REAL,
  "trend_12m" REAL,
  "computed_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "geography_id" TEXT,
  "published_dataset_version_id" TEXT,
  CONSTRAINT "market_aggregates_pkey" PRIMARY KEY (id),
  CONSTRAINT "market_aggregates_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id),
  CONSTRAINT "market_aggregates_published_dataset_version_id_fkey" FOREIGN KEY (published_dataset_version_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "market_snapshots_v2" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "dataset_version_id" TEXT NOT NULL,
  "geography_id" TEXT NOT NULL,
  "segment_key" TEXT NOT NULL DEFAULT 'all',
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "transaction_count" INTEGER NOT NULL,
  "median_price" INTEGER,
  "p25_price" INTEGER,
  "p75_price" INTEGER,
  "median_price_per_sqft" REAL,
  "trend_percent" REAL,
  "source_coverage" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "computed_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "market_snapshots_v2_transaction_count_check" CHECK ((transaction_count >= 0)),
  CONSTRAINT "market_snapshots_v2_confidence_check" CHECK (((confidence) IN ('insufficient', 'low', 'medium', 'high'))),
  CONSTRAINT "market_snapshots_v2_check" CHECK ((period_end > period_start)),
  CONSTRAINT "market_snapshots_v2_check1" CHECK (((p25_price IS NULL) OR (median_price IS NULL) OR (p25_price <= median_price))),
  CONSTRAINT "market_snapshots_v2_check2" CHECK (((p75_price IS NULL) OR (median_price IS NULL) OR (p75_price >= median_price))),
  CONSTRAINT "market_snapshots_v2_pkey" PRIMARY KEY (id),
  CONSTRAINT "market_snapshots_v2_dataset_version_id_geography_id_segment_key" UNIQUE (dataset_version_id, geography_id, segment_key, period_start, period_end),
  CONSTRAINT "market_snapshots_v2_dataset_version_id_fkey" FOREIGN KEY (dataset_version_id) REFERENCES "published_dataset_versions"(id),
  CONSTRAINT "market_snapshots_v2_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id)
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "alert_id" TEXT,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "is_read" INTEGER DEFAULT false,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "notifications_alert_id_alerts_id_fk" FOREIGN KEY (alert_id) REFERENCES "alerts"(id),
  CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "page_narratives" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "kind" TEXT NOT NULL,
  "ref_id" TEXT NOT NULL,
  "narrative" TEXT NOT NULL,
  "model" TEXT,
  "generated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "page_narratives_pkey" PRIMARY KEY (id)
);

CREATE TABLE "pluto_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "bbl" TEXT NOT NULL,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "address" TEXT,
  "zip_code" TEXT,
  "bldg_class" TEXT,
  "land_use" TEXT,
  "owner_name" TEXT,
  "num_floors" REAL,
  "units_res" INTEGER,
  "units_total" INTEGER,
  "lot_area" INTEGER,
  "bldg_area" INTEGER,
  "res_area" INTEGER,
  "office_area" INTEGER,
  "retail_area" INTEGER,
  "year_built" INTEGER,
  "year_altered_1" INTEGER,
  "year_altered_2" INTEGER,
  "condo_no" TEXT,
  "x_coord" REAL,
  "y_coord" REAL,
  "latitude" REAL,
  "longitude" REAL,
  "community_district" TEXT,
  "zone_dist_1" TEXT,
  "zone_dist_2" TEXT,
  "overlay_1" TEXT,
  "overlay_2" TEXT,
  "spdist_1" TEXT,
  "spdist_2" TEXT,
  "assess_land" INTEGER,
  "assess_tot" INTEGER,
  "exempt_land" INTEGER,
  "exempt_tot" INTEGER,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "pluto_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "properties" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip_code" TEXT NOT NULL,
  "county" TEXT,
  "neighborhood" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "property_type" TEXT NOT NULL,
  "beds" INTEGER,
  "baths" REAL,
  "sqft" INTEGER,
  "lot_size" INTEGER,
  "year_built" INTEGER,
  "last_sale_price" INTEGER,
  "last_sale_date" TEXT,
  "estimated_value" INTEGER,
  "price_per_sqft" REAL,
  "opportunity_score" INTEGER,
  "confidence_level" TEXT,
  "image_url" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "bbl" TEXT,
  "data_sources" TEXT,
  "grid_lat" INTEGER,
  "grid_lng" INTEGER,
  "unit" TEXT,
  "bbl_normalized" TEXT,
  "geography_id" TEXT,
  "published_dataset_version_id" TEXT,
  CONSTRAINT "properties_pkey" PRIMARY KEY (id),
  CONSTRAINT "properties_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id),
  CONSTRAINT "properties_published_dataset_version_id_fkey" FOREIGN KEY (published_dataset_version_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "property_changes" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT NOT NULL,
  "change_type" TEXT NOT NULL,
  "previous_value" TEXT,
  "new_value" TEXT,
  "change_summary" TEXT,
  "processed_for_digest" INTEGER DEFAULT false,
  "processed_for_instant" INTEGER DEFAULT false,
  "changed_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "property_changes_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_changes_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "property_compliance" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT,
  "bbl" TEXT NOT NULL,
  "registration_status" TEXT,
  "total_violations" INTEGER DEFAULT 0,
  "open_violations" INTEGER DEFAULT 0,
  "hazardous_violations" INTEGER DEFAULT 0,
  "total_complaints" INTEGER DEFAULT 0,
  "open_complaints" INTEGER DEFAULT 0,
  "last_inspection_date" TEXT,
  "compliance_score" INTEGER,
  "risk_level" TEXT,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "property_compliance_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_compliance_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "property_data_links" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT NOT NULL,
  "bbl" TEXT,
  "source_type" TEXT NOT NULL,
  "source_record_id" TEXT NOT NULL,
  "match_type" TEXT NOT NULL,
  "match_confidence" REAL,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "property_data_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_data_links_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "property_profiles" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT NOT NULL,
  "bbl" TEXT,
  "current_value" INTEGER,
  "value_confidence" REAL,
  "price_history" TEXT,
  "cap_rate" REAL,
  "cash_on_cash" REAL,
  "appreciation_rate" REAL,
  "tax_burden" REAL,
  "compliance_score" INTEGER,
  "market_volatility" REAL,
  "liquidity_score" INTEGER,
  "opportunity_score" INTEGER,
  "mispricing_indicator" REAL,
  "value_add_potential" REAL,
  "data_completeness" REAL,
  "sources_used" TEXT,
  "last_enriched_at" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "property_profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_profiles_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "property_signal_summary" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT NOT NULL,
  "bbl" TEXT,
  "permit_count_12m" INTEGER DEFAULT 0,
  "permit_count_24m" INTEGER DEFAULT 0,
  "active_permits" INTEGER DEFAULT 0,
  "major_alteration" INTEGER DEFAULT false,
  "new_construction" INTEGER DEFAULT false,
  "estimated_permit_value" INTEGER,
  "open_hpd_violations" INTEGER DEFAULT 0,
  "total_hpd_violations_12m" INTEGER DEFAULT 0,
  "hazardous_violations" INTEGER DEFAULT 0,
  "open_hpd_complaints" INTEGER DEFAULT 0,
  "total_hpd_complaints_12m" INTEGER DEFAULT 0,
  "dob_complaints_12m" INTEGER DEFAULT 0,
  "active_dob_complaints" INTEGER DEFAULT 0,
  "complaints_311_12m" INTEGER DEFAULT 0,
  "noise_complaints_12m" INTEGER DEFAULT 0,
  "building_health_score" INTEGER,
  "health_risk_level" TEXT,
  "nearest_subway_meters" INTEGER,
  "nearest_subway_station" TEXT,
  "nearest_subway_lines" TEXT,
  "has_accessible_transit" INTEGER DEFAULT false,
  "transit_score" INTEGER,
  "flood_zone" TEXT,
  "is_flood_high_risk" INTEGER DEFAULT false,
  "is_flood_moderate_risk" INTEGER DEFAULT false,
  "flood_risk_level" TEXT,
  "amenities_400m" INTEGER DEFAULT 0,
  "amenities_800m" INTEGER DEFAULT 0,
  "restaurants_400m" INTEGER DEFAULT 0,
  "parks_400m" INTEGER DEFAULT 0,
  "groceries_800m" INTEGER DEFAULT 0,
  "amenity_score" INTEGER,
  "has_deep_coverage" INTEGER DEFAULT false,
  "signal_data_sources" TEXT,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "signal_confidence" TEXT,
  "data_completeness" INTEGER,
  CONSTRAINT "property_signal_summary_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_signal_summary_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "property_transactions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT,
  "bbl" TEXT NOT NULL,
  "document_id" TEXT,
  "transaction_type" TEXT NOT NULL,
  "transaction_date" TEXT NOT NULL,
  "amount" REAL,
  "buyer_name" TEXT,
  "seller_name" TEXT,
  "lender_name" TEXT,
  "is_arms_length" INTEGER DEFAULT true,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "property_transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_transactions_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "property_valuations" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT,
  "bbl" TEXT NOT NULL,
  "assess_year" INTEGER NOT NULL,
  "tax_class" TEXT,
  "land_value" INTEGER,
  "total_value" INTEGER,
  "exemption_amount" INTEGER,
  "taxable_value" INTEGER,
  "annual_tax" INTEGER,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "property_valuations_pkey" PRIMARY KEY (id),
  CONSTRAINT "property_valuations_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id)
);

CREATE TABLE "published_dataset_versions" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'candidate',
  "predecessor_id" TEXT,
  "source_watermarks" TEXT NOT NULL DEFAULT '{}',
  "quality_summary" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "published_at" TEXT,
  "retired_at" TEXT,
  CONSTRAINT "published_dataset_versions_environment_check" CHECK (((environment) IN ('development', 'staging', 'production'))),
  CONSTRAINT "published_dataset_versions_status_check" CHECK (((status) IN ('candidate', 'validated', 'published', 'rejected', 'retired'))),
  CONSTRAINT "published_dataset_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "published_dataset_versions_predecessor_id_fkey" FOREIGN KEY (predecessor_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "ranking_snapshots" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "dataset_version_id" TEXT NOT NULL,
  "geography_id" TEXT NOT NULL,
  "score_version" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "price_trend_score" REAL NOT NULL,
  "transaction_velocity_score" REAL NOT NULL,
  "liquidity_score" REAL NOT NULL,
  "comp_depth_score" REAL NOT NULL,
  "confidence_score" REAL NOT NULL,
  "total_score" REAL NOT NULL,
  "eligible" INTEGER NOT NULL,
  "exclusion_reasons" TEXT,
  "computed_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "ranking_snapshots_rank_check" CHECK ((rank > 0)),
  CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY (id),
  CONSTRAINT "ranking_snapshots_dataset_version_id_geography_id_score_ver_key" UNIQUE (dataset_version_id, geography_id, score_version),
  CONSTRAINT "ranking_snapshots_dataset_version_id_fkey" FOREIGN KEY (dataset_version_id) REFERENCES "published_dataset_versions"(id),
  CONSTRAINT "ranking_snapshots_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id)
);

CREATE TABLE "raw_record_manifests" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "run_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "object_key" TEXT NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "source_version" TEXT NOT NULL,
  "row_count" INTEGER NOT NULL,
  "byte_size" INTEGER,
  "downloaded_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "raw_record_manifests_checksum_sha256_check" CHECK ((length(checksum_sha256) = 64 AND checksum_sha256 NOT GLOB '*[^a-f0-9]*')),
  CONSTRAINT "raw_record_manifests_row_count_check" CHECK ((row_count >= 0)),
  CONSTRAINT "raw_record_manifests_byte_size_check" CHECK (((byte_size IS NULL) OR (byte_size >= 0))),
  CONSTRAINT "raw_record_manifests_pkey" PRIMARY KEY (id),
  CONSTRAINT "raw_record_manifests_source_id_object_key_key" UNIQUE (source_id, object_key),
  CONSTRAINT "raw_record_manifests_run_id_fkey" FOREIGN KEY (run_id) REFERENCES "refresh_runs"(id),
  CONSTRAINT "raw_record_manifests_source_id_fkey" FOREIGN KEY (source_id) REFERENCES "source_catalog"(id)
);

CREATE TABLE "refresh_runs" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "environment" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_watermark" TEXT,
  "status" TEXT NOT NULL DEFAULT 'discovered',
  "counts" TEXT NOT NULL DEFAULT '{}',
  "timings" TEXT NOT NULL DEFAULT '{}',
  "error" TEXT,
  "candidate_version_id" TEXT,
  "published_version_id" TEXT,
  "started_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "completed_at" TEXT,
  CONSTRAINT "refresh_runs_environment_check" CHECK (((environment) IN ('development', 'staging', 'production'))),
  CONSTRAINT "refresh_runs_status_check" CHECK (((status) IN ('discovered', 'acquiring', 'parsing', 'normalizing', 'resolving', 'validating', 'computing', 'candidate_ready', 'published', 'failed'))),
  CONSTRAINT "refresh_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "refresh_runs_environment_source_id_source_watermark_key" UNIQUE (environment, source_id, source_watermark),
  CONSTRAINT "refresh_runs_source_id_fkey" FOREIGN KEY (source_id) REFERENCES "source_catalog"(id),
  CONSTRAINT "refresh_runs_candidate_version_id_fkey" FOREIGN KEY (candidate_version_id) REFERENCES "published_dataset_versions"(id),
  CONSTRAINT "refresh_runs_published_version_id_fkey" FOREIGN KEY (published_version_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "sales" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "property_id" TEXT,
  "sale_price" INTEGER NOT NULL,
  "sale_date" TEXT NOT NULL,
  "arms_length" INTEGER DEFAULT true,
  "deed_type" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "unit_bbl" TEXT,
  "base_bbl" TEXT,
  "match_method" TEXT,
  "raw_borough" TEXT,
  "raw_block" TEXT,
  "raw_lot" TEXT,
  "raw_address" TEXT,
  "raw_apt_number" TEXT,
  "unresolved_reason" TEXT,
  "geography_id" TEXT,
  "source_id" TEXT,
  "source_record_id" TEXT,
  "source_fingerprint" TEXT,
  "published_dataset_version_id" TEXT,
  "package_sale" INTEGER NOT NULL DEFAULT false,
  CONSTRAINT "sales_pkey" PRIMARY KEY (id),
  CONSTRAINT "sales_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id),
  CONSTRAINT "sales_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id),
  CONSTRAINT "sales_source_id_fkey" FOREIGN KEY (source_id) REFERENCES "source_catalog"(id),
  CONSTRAINT "sales_published_dataset_version_id_fkey" FOREIGN KEY (published_dataset_version_id) REFERENCES "published_dataset_versions"(id)
);

CREATE TABLE "saved_search_notifications" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "saved_search_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "matched_property_ids" TEXT,
  "change_ids" TEXT,
  "notification_type" TEXT NOT NULL,
  "email_sent" INTEGER DEFAULT false,
  "email_sent_at" TEXT,
  "email_id" TEXT,
  "subject" TEXT,
  "summary" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "saved_search_notifications_pkey" PRIMARY KEY (id),
  CONSTRAINT "saved_search_notifications_saved_search_id_saved_searches_id_fk" FOREIGN KEY (saved_search_id) REFERENCES "saved_searches"(id),
  CONSTRAINT "saved_search_notifications_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "saved_searches" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" TEXT NOT NULL,
  "state" TEXT,
  "cities" TEXT,
  "zip_codes" TEXT,
  "price_min" INTEGER,
  "price_max" INTEGER,
  "beds_min" INTEGER,
  "beds_max" INTEGER,
  "baths_min" REAL,
  "opportunity_score_min" INTEGER,
  "transit_score_min" INTEGER,
  "building_health_min" INTEGER,
  "flood_risk_max" TEXT,
  "frequency" TEXT NOT NULL DEFAULT 'daily',
  "email_enabled" INTEGER DEFAULT true,
  "push_enabled" INTEGER DEFAULT false,
  "is_active" INTEGER DEFAULT true,
  "match_count" INTEGER DEFAULT 0,
  "last_run_at" TEXT,
  "last_notified_at" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "saved_searches_pkey" PRIMARY KEY (id),
  CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "sessions" (
  "sid" TEXT NOT NULL,
  "sess" TEXT NOT NULL,
  "expire" TEXT NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY (sid)
);

CREATE TABLE "source_catalog" (
  "id" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "endpoint" TEXT,
  "license" TEXT,
  "redistribution_status" TEXT NOT NULL DEFAULT 'review_required',
  "cadence" TEXT NOT NULL,
  "expected_lag_days" INTEGER NOT NULL DEFAULT 30,
  "coverage" TEXT NOT NULL DEFAULT '{}',
  "adapter_version" TEXT NOT NULL,
  "active" INTEGER NOT NULL DEFAULT false,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "source_catalog_redistribution_status_check" CHECK (((redistribution_status) IN ('approved', 'review_required', 'prohibited'))),
  CONSTRAINT "source_catalog_expected_lag_days_check" CHECK ((expected_lag_days >= 0)),
  CONSTRAINT "source_catalog_pkey" PRIMARY KEY (id)
);

CREATE TABLE "source_entities" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "run_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_record_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "geography_id" TEXT,
  "normalized" TEXT NOT NULL,
  "raw_object_key" TEXT,
  "raw_row_number" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "source_entities_pkey" PRIMARY KEY (id),
  CONSTRAINT "source_entities_source_id_source_record_id_key" UNIQUE (source_id, source_record_id),
  CONSTRAINT "source_entities_run_id_fkey" FOREIGN KEY (run_id) REFERENCES "refresh_runs"(id),
  CONSTRAINT "source_entities_source_id_fkey" FOREIGN KEY (source_id) REFERENCES "source_catalog"(id),
  CONSTRAINT "source_entities_geography_id_fkey" FOREIGN KEY (geography_id) REFERENCES "canonical_geographies"(id)
);

CREATE TABLE "subway_entrances" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "station_name" TEXT NOT NULL,
  "line_name" TEXT,
  "division" TEXT,
  "routes_served" TEXT,
  "entrance_type" TEXT,
  "is_accessible" INTEGER DEFAULT false,
  "latitude" REAL NOT NULL,
  "longitude" REAL NOT NULL,
  "grid_lat" INTEGER,
  "grid_lng" INTEGER,
  "corner" TEXT,
  "north_south_street" TEXT,
  "east_west_street" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "subway_entrances_pkey" PRIMARY KEY (id)
);

CREATE TABLE "usage_tracking" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "action_date" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "property_id" TEXT,
  "metadata" TEXT,
  CONSTRAINT "usage_tracking_pkey" PRIMARY KEY (id),
  CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "email" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "profile_image_url" TEXT,
  "role" TEXT DEFAULT 'user',
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "password_hash" TEXT,
  "subscription_tier" TEXT DEFAULT 'free',
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "subscription_status" TEXT,
  "status" TEXT DEFAULT 'active',
  "activation_token_hash" TEXT,
  "activation_token_expires_at" TEXT,
  "reset_token_hash" TEXT,
  "reset_token_expires_at" TEXT,
  "trial_notification_sent_at" TEXT,
  CONSTRAINT "users_email_unique" UNIQUE (email),
  CONSTRAINT "users_pkey" PRIMARY KEY (id)
);

CREATE TABLE "valuations_raw" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "bbl" TEXT NOT NULL,
  "borough" TEXT,
  "block" TEXT,
  "lot" TEXT,
  "tax_class" TEXT,
  "building_class" TEXT,
  "owner_name" TEXT,
  "address" TEXT,
  "apt_no" TEXT,
  "zip_code" TEXT,
  "assess_year" INTEGER,
  "land_value" INTEGER,
  "total_value" INTEGER,
  "transitional_land" INTEGER,
  "transitional_total" INTEGER,
  "new_land_value" INTEGER,
  "new_total_value" INTEGER,
  "exemption_code_one" TEXT,
  "exemption_code_two" TEXT,
  "exemption_code_three" TEXT,
  "exemption_code_four" TEXT,
  "raw_data" TEXT,
  "imported_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "valuations_raw_pkey" PRIMARY KEY (id)
);

CREATE TABLE "watchlist_properties" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "watchlist_id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "added_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "notes" TEXT,
  CONSTRAINT "watchlist_properties_pkey" PRIMARY KEY (id),
  CONSTRAINT "watchlist_properties_property_id_properties_id_fk" FOREIGN KEY (property_id) REFERENCES "properties"(id),
  CONSTRAINT "watchlist_properties_watchlist_id_watchlists_id_fk" FOREIGN KEY (watchlist_id) REFERENCES "watchlists"(id)
);

CREATE TABLE "watchlists" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "geo_type" TEXT,
  "geo_id" TEXT,
  "filters" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "watchlists_pkey" PRIMARY KEY (id),
  CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES "users"(id)
);

CREATE TABLE "stripe___managed_webhooks" (
  "id" TEXT NOT NULL,
  "object" TEXT,
  "uuid" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "enabled_events" TEXT NOT NULL,
  "description" TEXT,
  "enabled" INTEGER,
  "livemode" INTEGER,
  "metadata" TEXT,
  "secret" TEXT NOT NULL,
  "status" TEXT,
  "api_version" TEXT,
  "created" INTEGER,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "last_synced_at" TEXT,
  "account_id" TEXT NOT NULL,
  CONSTRAINT "managed_webhooks_pkey" PRIMARY KEY (id),
  CONSTRAINT "managed_webhooks_uuid_key" UNIQUE (uuid),
  CONSTRAINT "fk_managed_webhooks_account" FOREIGN KEY (account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe___migrations" (
  "id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "executed_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  CONSTRAINT "_migrations_name_key" UNIQUE (name),
  CONSTRAINT "_migrations_pkey" PRIMARY KEY (id)
);

CREATE TABLE "stripe___sync_status" (
  "id" INTEGER NOT NULL,
  "resource" TEXT NOT NULL,
  "status" TEXT DEFAULT 'idle',
  "last_synced_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "last_incremental_cursor" TEXT,
  "error_message" TEXT,
  "updated_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "account_id" TEXT NOT NULL,
  CONSTRAINT "_sync_status_status_check" CHECK ((status IN ('idle', 'running', 'complete', 'error'))),
  CONSTRAINT "_sync_status_pkey" PRIMARY KEY (id),
  CONSTRAINT "_sync_status_resource_account_key" UNIQUE (resource, account_id),
  CONSTRAINT "fk_sync_status_account" FOREIGN KEY (account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__accounts" (
  "_raw_data" TEXT NOT NULL,
  "first_synced_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "business_name" TEXT,
  "email" TEXT,
  "type" TEXT,
  "charges_enabled" INTEGER,
  "payouts_enabled" INTEGER,
  "details_submitted" INTEGER,
  "country" TEXT,
  "default_currency" TEXT,
  "created" INTEGER,
  "api_key_hashes" TEXT DEFAULT '[]',
  "id" TEXT NOT NULL,
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id)
);

CREATE TABLE "stripe__active_entitlements" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "livemode" INTEGER,
  "feature" TEXT,
  "customer" TEXT,
  "lookup_key" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "active_entitlements_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_active_entitlements_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__charges" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "paid" INTEGER,
  "order" TEXT,
  "amount" INTEGER,
  "review" TEXT,
  "source" TEXT,
  "status" TEXT,
  "created" INTEGER,
  "dispute" TEXT,
  "invoice" TEXT,
  "outcome" TEXT,
  "refunds" TEXT,
  "updated" INTEGER,
  "captured" INTEGER,
  "currency" TEXT,
  "customer" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "refunded" INTEGER,
  "shipping" TEXT,
  "application" TEXT,
  "description" TEXT,
  "destination" TEXT,
  "failure_code" TEXT,
  "on_behalf_of" TEXT,
  "fraud_details" TEXT,
  "receipt_email" TEXT,
  "payment_intent" TEXT,
  "receipt_number" TEXT,
  "transfer_group" TEXT,
  "amount_refunded" INTEGER,
  "application_fee" TEXT,
  "failure_message" TEXT,
  "source_transfer" TEXT,
  "balance_transaction" TEXT,
  "statement_descriptor" TEXT,
  "payment_method_details" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "charges_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_charges_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__checkout_session_line_items" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "amount_discount" INTEGER,
  "amount_subtotal" INTEGER,
  "amount_tax" INTEGER,
  "amount_total" INTEGER,
  "currency" TEXT,
  "description" TEXT,
  "price" TEXT,
  "quantity" INTEGER,
  "checkout_session" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "checkout_session_line_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_checkout_session_line_items_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__checkout_sessions" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "adaptive_pricing" TEXT,
  "after_expiration" TEXT,
  "allow_promotion_codes" INTEGER,
  "amount_subtotal" INTEGER,
  "amount_total" INTEGER,
  "automatic_tax" TEXT,
  "billing_address_collection" TEXT,
  "cancel_url" TEXT,
  "client_reference_id" TEXT,
  "client_secret" TEXT,
  "collected_information" TEXT,
  "consent" TEXT,
  "consent_collection" TEXT,
  "created" INTEGER,
  "currency" TEXT,
  "currency_conversion" TEXT,
  "custom_fields" TEXT,
  "custom_text" TEXT,
  "customer" TEXT,
  "customer_creation" TEXT,
  "customer_details" TEXT,
  "customer_email" TEXT,
  "discounts" TEXT,
  "expires_at" INTEGER,
  "invoice" TEXT,
  "invoice_creation" TEXT,
  "livemode" INTEGER,
  "locale" TEXT,
  "metadata" TEXT,
  "mode" TEXT,
  "optional_items" TEXT,
  "payment_intent" TEXT,
  "payment_link" TEXT,
  "payment_method_collection" TEXT,
  "payment_method_configuration_details" TEXT,
  "payment_method_options" TEXT,
  "payment_method_types" TEXT,
  "payment_status" TEXT,
  "permissions" TEXT,
  "phone_number_collection" TEXT,
  "presentment_details" TEXT,
  "recovered_from" TEXT,
  "redirect_on_completion" TEXT,
  "return_url" TEXT,
  "saved_payment_method_options" TEXT,
  "setup_intent" TEXT,
  "shipping_address_collection" TEXT,
  "shipping_cost" TEXT,
  "shipping_details" TEXT,
  "shipping_options" TEXT,
  "status" TEXT,
  "submit_type" TEXT,
  "subscription" TEXT,
  "success_url" TEXT,
  "tax_id_collection" TEXT,
  "total_details" TEXT,
  "ui_mode" TEXT,
  "url" TEXT,
  "wallet_options" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_checkout_sessions_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__coupons" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "object" TEXT,
  "name" TEXT,
  "valid" INTEGER,
  "created" INTEGER,
  "updated" INTEGER,
  "currency" TEXT,
  "duration" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "redeem_by" INTEGER,
  "amount_off" INTEGER,
  "percent_off" REAL,
  "times_redeemed" INTEGER,
  "max_redemptions" INTEGER,
  "duration_in_months" INTEGER,
  "percent_off_precise" REAL,
  "id" TEXT NOT NULL,
  CONSTRAINT "coupons_pkey" PRIMARY KEY (id)
);

CREATE TABLE "stripe__credit_notes" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "amount" INTEGER,
  "amount_shipping" INTEGER,
  "created" INTEGER,
  "currency" TEXT,
  "customer" TEXT,
  "customer_balance_transaction" TEXT,
  "discount_amount" INTEGER,
  "discount_amounts" TEXT,
  "invoice" TEXT,
  "lines" TEXT,
  "livemode" INTEGER,
  "memo" TEXT,
  "metadata" TEXT,
  "number" TEXT,
  "out_of_band_amount" INTEGER,
  "pdf" TEXT,
  "reason" TEXT,
  "refund" TEXT,
  "shipping_cost" TEXT,
  "status" TEXT,
  "subtotal" INTEGER,
  "subtotal_excluding_tax" INTEGER,
  "tax_amounts" TEXT,
  "total" INTEGER,
  "total_excluding_tax" INTEGER,
  "type" TEXT,
  "voided_at" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "credit_notes_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_credit_notes_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__customers" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "address" TEXT,
  "description" TEXT,
  "email" TEXT,
  "metadata" TEXT,
  "name" TEXT,
  "phone" TEXT,
  "shipping" TEXT,
  "balance" INTEGER,
  "created" INTEGER,
  "currency" TEXT,
  "default_source" TEXT,
  "delinquent" INTEGER,
  "discount" TEXT,
  "invoice_prefix" TEXT,
  "invoice_settings" TEXT,
  "livemode" INTEGER,
  "next_invoice_sequence" INTEGER,
  "preferred_locales" TEXT,
  "tax_exempt" TEXT,
  "deleted" INTEGER,
  "id" TEXT NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_customers_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__disputes" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "amount" INTEGER,
  "charge" TEXT,
  "reason" TEXT,
  "status" TEXT,
  "created" INTEGER,
  "updated" INTEGER,
  "currency" TEXT,
  "evidence" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "evidence_details" TEXT,
  "balance_transactions" TEXT,
  "is_charge_refundable" INTEGER,
  "payment_intent" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "disputes_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_disputes_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__early_fraud_warnings" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "actionable" INTEGER,
  "charge" TEXT,
  "created" INTEGER,
  "fraud_type" TEXT,
  "livemode" INTEGER,
  "payment_intent" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "early_fraud_warnings_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_early_fraud_warnings_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__events" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "object" TEXT,
  "data" TEXT,
  "type" TEXT,
  "created" INTEGER,
  "request" TEXT,
  "updated" INTEGER,
  "livemode" INTEGER,
  "api_version" TEXT,
  "pending_webhooks" INTEGER,
  "id" TEXT NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY (id)
);

CREATE TABLE "stripe__features" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "livemode" INTEGER,
  "name" TEXT,
  "lookup_key" TEXT,
  "active" INTEGER,
  "metadata" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "features_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_features_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__invoices" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "auto_advance" INTEGER,
  "collection_method" TEXT,
  "currency" TEXT,
  "description" TEXT,
  "hosted_invoice_url" TEXT,
  "lines" TEXT,
  "period_end" INTEGER,
  "period_start" INTEGER,
  "status" TEXT,
  "total" INTEGER,
  "account_country" TEXT,
  "account_name" TEXT,
  "account_tax_ids" TEXT,
  "amount_due" INTEGER,
  "amount_paid" INTEGER,
  "amount_remaining" INTEGER,
  "application_fee_amount" INTEGER,
  "attempt_count" INTEGER,
  "attempted" INTEGER,
  "billing_reason" TEXT,
  "created" INTEGER,
  "custom_fields" TEXT,
  "customer_address" TEXT,
  "customer_email" TEXT,
  "customer_name" TEXT,
  "customer_phone" TEXT,
  "customer_shipping" TEXT,
  "customer_tax_exempt" TEXT,
  "customer_tax_ids" TEXT,
  "default_tax_rates" TEXT,
  "discount" TEXT,
  "discounts" TEXT,
  "due_date" INTEGER,
  "ending_balance" INTEGER,
  "footer" TEXT,
  "invoice_pdf" TEXT,
  "last_finalization_error" TEXT,
  "livemode" INTEGER,
  "next_payment_attempt" INTEGER,
  "number" TEXT,
  "paid" INTEGER,
  "payment_settings" TEXT,
  "post_payment_credit_notes_amount" INTEGER,
  "pre_payment_credit_notes_amount" INTEGER,
  "receipt_number" TEXT,
  "starting_balance" INTEGER,
  "statement_descriptor" TEXT,
  "status_transitions" TEXT,
  "subtotal" INTEGER,
  "tax" INTEGER,
  "total_discount_amounts" TEXT,
  "total_tax_amounts" TEXT,
  "transfer_data" TEXT,
  "webhooks_delivered_at" INTEGER,
  "customer" TEXT,
  "subscription" TEXT,
  "payment_intent" TEXT,
  "default_payment_method" TEXT,
  "default_source" TEXT,
  "on_behalf_of" TEXT,
  "charge" TEXT,
  "metadata" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_invoices_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__payment_intents" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "amount" INTEGER,
  "amount_capturable" INTEGER,
  "amount_details" TEXT,
  "amount_received" INTEGER,
  "application" TEXT,
  "application_fee_amount" INTEGER,
  "automatic_payment_methods" TEXT,
  "canceled_at" INTEGER,
  "cancellation_reason" TEXT,
  "capture_method" TEXT,
  "client_secret" TEXT,
  "confirmation_method" TEXT,
  "created" INTEGER,
  "currency" TEXT,
  "customer" TEXT,
  "description" TEXT,
  "invoice" TEXT,
  "last_payment_error" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "next_action" TEXT,
  "on_behalf_of" TEXT,
  "payment_method" TEXT,
  "payment_method_options" TEXT,
  "payment_method_types" TEXT,
  "processing" TEXT,
  "receipt_email" TEXT,
  "review" TEXT,
  "setup_future_usage" TEXT,
  "shipping" TEXT,
  "statement_descriptor" TEXT,
  "statement_descriptor_suffix" TEXT,
  "status" TEXT,
  "transfer_data" TEXT,
  "transfer_group" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "payment_intents_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_payment_intents_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__payment_methods" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "created" INTEGER,
  "customer" TEXT,
  "type" TEXT,
  "billing_details" TEXT,
  "metadata" TEXT,
  "card" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "payment_methods_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_payment_methods_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__payouts" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "object" TEXT,
  "date" TEXT,
  "type" TEXT,
  "amount" INTEGER,
  "method" TEXT,
  "status" TEXT,
  "created" INTEGER,
  "updated" INTEGER,
  "currency" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "automatic" INTEGER,
  "recipient" TEXT,
  "description" TEXT,
  "destination" TEXT,
  "source_type" TEXT,
  "arrival_date" TEXT,
  "bank_account" TEXT,
  "failure_code" TEXT,
  "transfer_group" TEXT,
  "amount_reversed" INTEGER,
  "failure_message" TEXT,
  "source_transaction" TEXT,
  "balance_transaction" TEXT,
  "statement_descriptor" TEXT,
  "statement_description" TEXT,
  "failure_balance_transaction" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "payouts_pkey" PRIMARY KEY (id)
);

CREATE TABLE "stripe__plans" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "name" TEXT,
  "tiers" TEXT,
  "active" INTEGER,
  "amount" INTEGER,
  "created" INTEGER,
  "product" TEXT,
  "updated" INTEGER,
  "currency" TEXT,
  "interval" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "nickname" TEXT,
  "tiers_mode" TEXT,
  "usage_type" TEXT,
  "billing_scheme" TEXT,
  "interval_count" INTEGER,
  "aggregate_usage" TEXT,
  "transform_usage" TEXT,
  "trial_period_days" INTEGER,
  "statement_descriptor" TEXT,
  "statement_description" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_plans_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__prices" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "active" INTEGER,
  "currency" TEXT,
  "metadata" TEXT,
  "nickname" TEXT,
  "recurring" TEXT,
  "type" TEXT,
  "unit_amount" INTEGER,
  "billing_scheme" TEXT,
  "created" INTEGER,
  "livemode" INTEGER,
  "lookup_key" TEXT,
  "tiers_mode" TEXT,
  "transform_quantity" TEXT,
  "unit_amount_decimal" TEXT,
  "product" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "prices_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_prices_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__products" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "active" INTEGER,
  "default_price" TEXT,
  "description" TEXT,
  "metadata" TEXT,
  "name" TEXT,
  "created" INTEGER,
  "images" TEXT,
  "marketing_features" TEXT,
  "livemode" INTEGER,
  "package_dimensions" TEXT,
  "shippable" INTEGER,
  "statement_descriptor" TEXT,
  "unit_label" TEXT,
  "updated" INTEGER,
  "url" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_products_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__refunds" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "amount" INTEGER,
  "balance_transaction" TEXT,
  "charge" TEXT,
  "created" INTEGER,
  "currency" TEXT,
  "destination_details" TEXT,
  "metadata" TEXT,
  "payment_intent" TEXT,
  "reason" TEXT,
  "receipt_number" TEXT,
  "source_transfer_reversal" TEXT,
  "status" TEXT,
  "transfer_reversal" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_refunds_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__reviews" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "billing_zip" TEXT,
  "charge" TEXT,
  "created" INTEGER,
  "closed_reason" TEXT,
  "livemode" INTEGER,
  "ip_address" TEXT,
  "ip_address_location" TEXT,
  "open" INTEGER,
  "opened_reason" TEXT,
  "payment_intent" TEXT,
  "reason" TEXT,
  "session" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "reviews_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_reviews_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__setup_intents" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "created" INTEGER,
  "customer" TEXT,
  "description" TEXT,
  "payment_method" TEXT,
  "status" TEXT,
  "usage" TEXT,
  "cancellation_reason" TEXT,
  "latest_attempt" TEXT,
  "mandate" TEXT,
  "single_use_mandate" TEXT,
  "on_behalf_of" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "setup_intents_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_setup_intents_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__subscription_items" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "billing_thresholds" TEXT,
  "created" INTEGER,
  "deleted" INTEGER,
  "metadata" TEXT,
  "quantity" INTEGER,
  "price" TEXT,
  "subscription" TEXT,
  "tax_rates" TEXT,
  "current_period_end" INTEGER,
  "current_period_start" INTEGER,
  "id" TEXT NOT NULL,
  CONSTRAINT "subscription_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_subscription_items_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__subscription_schedules" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "application" TEXT,
  "canceled_at" INTEGER,
  "completed_at" INTEGER,
  "created" INTEGER,
  "current_phase" TEXT,
  "customer" TEXT,
  "default_settings" TEXT,
  "end_behavior" TEXT,
  "livemode" INTEGER,
  "metadata" TEXT,
  "phases" TEXT,
  "released_at" INTEGER,
  "released_subscription" TEXT,
  "status" TEXT,
  "subscription" TEXT,
  "test_clock" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "subscription_schedules_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_subscription_schedules_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__subscriptions" (
  "_updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z'),
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "cancel_at_period_end" INTEGER,
  "current_period_end" INTEGER,
  "current_period_start" INTEGER,
  "default_payment_method" TEXT,
  "items" TEXT,
  "metadata" TEXT,
  "pending_setup_intent" TEXT,
  "pending_update" TEXT,
  "status" TEXT,
  "application_fee_percent" REAL,
  "billing_cycle_anchor" INTEGER,
  "billing_thresholds" TEXT,
  "cancel_at" INTEGER,
  "canceled_at" INTEGER,
  "collection_method" TEXT,
  "created" INTEGER,
  "days_until_due" INTEGER,
  "default_source" TEXT,
  "default_tax_rates" TEXT,
  "discount" TEXT,
  "ended_at" INTEGER,
  "livemode" INTEGER,
  "next_pending_invoice_item_invoice" INTEGER,
  "pause_collection" TEXT,
  "pending_invoice_item_interval" TEXT,
  "start_date" INTEGER,
  "transfer_data" TEXT,
  "trial_end" TEXT,
  "trial_start" TEXT,
  "schedule" TEXT,
  "customer" TEXT,
  "latest_invoice" TEXT,
  "plan" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_subscriptions_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE TABLE "stripe__tax_ids" (
  "_last_synced_at" TEXT,
  "_raw_data" TEXT,
  "_account_id" TEXT NOT NULL,
  "object" TEXT,
  "country" TEXT,
  "customer" TEXT,
  "type" TEXT,
  "value" TEXT,
  "created" INTEGER,
  "livemode" INTEGER,
  "owner" TEXT,
  "id" TEXT NOT NULL,
  CONSTRAINT "tax_ids_pkey" PRIMARY KEY (id),
  CONSTRAINT "fk_tax_ids_account" FOREIGN KEY (_account_id) REFERENCES "stripe__accounts"(id)
);

CREATE UNIQUE INDEX "_system__idx_replit_database_migrations_v1_build_id" ON "_system__replit_database_migrations_v1" (build_id);

CREATE INDEX "idx_acris_bbl" ON "acris_raw" (bbl);

CREATE INDEX "idx_acris_date" ON "acris_raw" (recorded_date_time);

CREATE INDEX "idx_acris_doc" ON "acris_raw" (document_id);

CREATE INDEX "idx_ai_chats_user" ON "ai_chats" (user_id);

CREATE INDEX "idx_insights_bbl" ON "ai_insights" (bbl);

CREATE INDEX "idx_insights_property" ON "ai_insights" (property_id);

CREATE INDEX "idx_insights_type" ON "ai_insights" (insight_type);

CREATE INDEX "idx_alerts_user" ON "alerts" (user_id);

CREATE INDEX "idx_amenities_category" ON "amenities" (category);

CREATE INDEX "idx_amenities_grid" ON "amenities" (grid_lat, grid_lng);

CREATE INDEX "idx_amenities_zip" ON "amenities" (zip_code);

CREATE INDEX "idx_api_keys_prefix" ON "api_keys" (prefix);

CREATE INDEX "idx_api_keys_user" ON "api_keys" (user_id);

CREATE INDEX "idx_buildings_address" ON "buildings" (display_address);

CREATE INDEX "idx_buildings_borough" ON "buildings" (borough);

CREATE INDEX "idx_buildings_zip" ON "buildings" (zip_code);

CREATE UNIQUE INDEX "canonical_geographies_state_zip_unique" ON "canonical_geographies" (state, zip_code) WHERE (zip_code IS NOT NULL);

CREATE INDEX "canonical_geographies_county_idx" ON "canonical_geographies" (state, county_fips);

CREATE INDEX "idx_311_bbl" ON "complaints_311_raw" (bbl);

CREATE INDEX "idx_311_created" ON "complaints_311_raw" (created_date);

CREATE INDEX "idx_311_type" ON "complaints_311_raw" (complaint_type);

CREATE INDEX "idx_311_unique_key" ON "complaints_311_raw" (unique_key);

CREATE INDEX "idx_comps_subject" ON "comps" (subject_property_id);

CREATE INDEX "idx_condo_address" ON "condo_registry" (address);

CREATE INDEX "idx_condo_base_bbl" ON "condo_registry" (base_bbl);

CREATE INDEX "idx_condo_unit_bbl" ON "condo_registry" (unit_bbl);

CREATE INDEX "idx_condo_units_address" ON "condo_units" (unit_display_address);

CREATE INDEX "idx_condo_units_base_bbl" ON "condo_units" (base_bbl);

CREATE INDEX "idx_condo_units_building" ON "condo_units" (building_property_id);

CREATE INDEX "idx_condo_units_slug" ON "condo_units" (slug);

CREATE INDEX "idx_condo_units_type_hint" ON "condo_units" (unit_type_hint);

CREATE INDEX "idx_condo_units_unit_bbl" ON "condo_units" (unit_bbl);

CREATE INDEX "idx_coverage_state" ON "coverage_matrix" (state);

CREATE INDEX "data_quality_result_version_idx" ON "data_quality_results" (dataset_version_id);

CREATE INDEX "idx_dob_complaints_bbl" ON "dob_complaints_raw" (bbl);

CREATE INDEX "idx_dob_complaints_date" ON "dob_complaints_raw" (date_entered);

CREATE INDEX "idx_dob_complaints_number" ON "dob_complaints_raw" (complaint_number);

CREATE INDEX "idx_dob_permits_bbl" ON "dob_permits_raw" (bbl);

CREATE INDEX "idx_dob_permits_filing" ON "dob_permits_raw" (filing_date);

CREATE INDEX "idx_dob_permits_job" ON "dob_permits_raw" (job_number);

CREATE INDEX "idx_erm_bbl" ON "entity_resolution_map" (source_bbl);

CREATE INDEX "idx_erm_property" ON "entity_resolution_map" (matched_property_id);

CREATE INDEX "idx_erm_source" ON "entity_resolution_map" (source_system, source_record_id);

CREATE UNIQUE INDEX "idx_erm_unique_match" ON "entity_resolution_map" (source_system, source_record_id);

CREATE INDEX "idx_flood_bbl" ON "flood_zones" (bbl);

CREATE INDEX "idx_flood_zip" ON "flood_zones" (zip_code);

CREATE INDEX "idx_flood_zone" ON "flood_zones" (flood_zone);

CREATE INDEX "idx_hpd_bbl" ON "hpd_raw" (bbl);

CREATE INDEX "idx_hpd_building" ON "hpd_raw" (building_id);

CREATE INDEX "idx_aggregates_geo" ON "market_aggregates" (geo_type, geo_id);

CREATE INDEX "idx_aggregates_state" ON "market_aggregates" (state);

CREATE INDEX "market_snapshot_version_idx" ON "market_snapshots_v2" (dataset_version_id);

CREATE INDEX "idx_notifications_user" ON "notifications" (user_id);

CREATE UNIQUE INDEX "page_narratives_kind_ref" ON "page_narratives" (kind, ref_id);

CREATE INDEX "idx_pluto_bbl" ON "pluto_raw" (bbl);

CREATE INDEX "idx_pluto_zip" ON "pluto_raw" (zip_code);

CREATE INDEX "idx_properties_bbl" ON "properties" (bbl);

CREATE INDEX "idx_properties_city" ON "properties" (city);

CREATE INDEX "idx_properties_grid" ON "properties" (grid_lat, grid_lng);

CREATE INDEX "idx_properties_state" ON "properties" (state);

CREATE INDEX "idx_properties_zip" ON "properties" (zip_code);

CREATE INDEX "properties_geography_idx" ON "properties" (geography_id);

CREATE INDEX "idx_property_changes_date" ON "property_changes" (changed_at);

CREATE INDEX "idx_property_changes_property" ON "property_changes" (property_id);

CREATE INDEX "idx_property_changes_type" ON "property_changes" (change_type);

CREATE INDEX "idx_property_changes_unprocessed_digest" ON "property_changes" (processed_for_digest, changed_at);

CREATE INDEX "idx_property_changes_unprocessed_instant" ON "property_changes" (processed_for_instant, changed_at);

CREATE INDEX "idx_compliance_bbl" ON "property_compliance" (bbl);

CREATE INDEX "idx_compliance_property" ON "property_compliance" (property_id);

CREATE INDEX "idx_data_links_bbl" ON "property_data_links" (bbl);

CREATE INDEX "idx_data_links_property" ON "property_data_links" (property_id);

CREATE INDEX "idx_data_links_source" ON "property_data_links" (source_type);

CREATE INDEX "idx_profile_bbl" ON "property_profiles" (bbl);

CREATE INDEX "idx_profile_opportunity" ON "property_profiles" (opportunity_score);

CREATE INDEX "idx_profile_property" ON "property_profiles" (property_id);

CREATE INDEX "idx_signal_bbl" ON "property_signal_summary" (bbl);

CREATE INDEX "idx_signal_health" ON "property_signal_summary" (building_health_score);

CREATE UNIQUE INDEX "idx_signal_property_unique" ON "property_signal_summary" (property_id);

CREATE INDEX "idx_signal_transit" ON "property_signal_summary" (transit_score);

CREATE INDEX "idx_prop_tx_bbl" ON "property_transactions" (bbl);

CREATE INDEX "idx_prop_tx_date" ON "property_transactions" (transaction_date);

CREATE INDEX "idx_prop_tx_property" ON "property_transactions" (property_id);

CREATE INDEX "idx_prop_val_bbl" ON "property_valuations" (bbl);

CREATE INDEX "idx_prop_val_property" ON "property_valuations" (property_id);

CREATE INDEX "idx_prop_val_year" ON "property_valuations" (assess_year);

CREATE INDEX "published_dataset_status_idx" ON "published_dataset_versions" (environment, status);

CREATE UNIQUE INDEX "one_published_dataset_per_environment" ON "published_dataset_versions" (environment) WHERE ((status) = 'published');

CREATE INDEX "ranking_snapshot_version_rank_idx" ON "ranking_snapshots" (dataset_version_id, rank);

CREATE INDEX "refresh_runs_source_started_idx" ON "refresh_runs" (source_id, started_at DESC);

CREATE INDEX "refresh_runs_status_idx" ON "refresh_runs" (status);

CREATE INDEX "idx_sales_base_bbl" ON "sales" (base_bbl);

CREATE INDEX "idx_sales_match_method" ON "sales" (match_method);

CREATE INDEX "idx_sales_property" ON "sales" (property_id);

CREATE INDEX "idx_sales_unit_bbl" ON "sales" (unit_bbl);

CREATE UNIQUE INDEX "sales_source_record_unique" ON "sales" (source_id, source_record_id) WHERE ((source_id IS NOT NULL) AND (source_record_id IS NOT NULL));

CREATE UNIQUE INDEX "sales_source_fingerprint_unique" ON "sales" (source_id, source_fingerprint) WHERE ((source_id IS NOT NULL) AND (source_fingerprint IS NOT NULL));

CREATE INDEX "sales_geography_date_idx" ON "sales" (geography_id, sale_date DESC);

CREATE INDEX "idx_ss_notifications_date" ON "saved_search_notifications" (created_at);

CREATE INDEX "idx_ss_notifications_search" ON "saved_search_notifications" (saved_search_id);

CREATE INDEX "idx_ss_notifications_user" ON "saved_search_notifications" (user_id);

CREATE INDEX "idx_saved_searches_active" ON "saved_searches" (is_active);

CREATE INDEX "idx_saved_searches_frequency" ON "saved_searches" (frequency);

CREATE INDEX "idx_saved_searches_user" ON "saved_searches" (user_id);

CREATE INDEX "IDX_session_expire" ON "sessions" (expire);

CREATE INDEX "source_entities_run_idx" ON "source_entities" (run_id);

CREATE INDEX "idx_subway_accessible" ON "subway_entrances" (is_accessible);

CREATE INDEX "idx_subway_grid" ON "subway_entrances" (grid_lat, grid_lng);

CREATE INDEX "idx_subway_station" ON "subway_entrances" (station_name);

CREATE INDEX "idx_usage_user_type_date" ON "usage_tracking" (user_id, action_type, action_date);

CREATE INDEX "idx_valuations_bbl" ON "valuations_raw" (bbl);

CREATE INDEX "idx_valuations_year" ON "valuations_raw" (assess_year);

CREATE INDEX "idx_watchlist_props" ON "watchlist_properties" (watchlist_id);

CREATE INDEX "idx_watchlists_user" ON "watchlists" (user_id);

CREATE INDEX "stripe__stripe_managed_webhooks_enabled_idx" ON "stripe___managed_webhooks" (enabled);

CREATE INDEX "stripe__stripe_managed_webhooks_status_idx" ON "stripe___managed_webhooks" (status);

CREATE INDEX "stripe__stripe_managed_webhooks_uuid_idx" ON "stripe___managed_webhooks" (uuid);

CREATE INDEX "stripe__idx_sync_status_resource_account" ON "stripe___sync_status" (resource, account_id);

CREATE INDEX "stripe__idx_accounts_business_name" ON "stripe__accounts" (business_name);

CREATE UNIQUE INDEX "stripe__active_entitlements_lookup_key_key" ON "stripe__active_entitlements" (lookup_key) WHERE (lookup_key IS NOT NULL);

CREATE INDEX "stripe__stripe_active_entitlements_customer_idx" ON "stripe__active_entitlements" (customer);

CREATE INDEX "stripe__stripe_active_entitlements_feature_idx" ON "stripe__active_entitlements" (feature);

CREATE INDEX "stripe__stripe_checkout_session_line_items_price_idx" ON "stripe__checkout_session_line_items" (price);

CREATE INDEX "stripe__stripe_checkout_session_line_items_session_idx" ON "stripe__checkout_session_line_items" (checkout_session);

CREATE INDEX "stripe__stripe_checkout_sessions_customer_idx" ON "stripe__checkout_sessions" (customer);

CREATE INDEX "stripe__stripe_checkout_sessions_invoice_idx" ON "stripe__checkout_sessions" (invoice);

CREATE INDEX "stripe__stripe_checkout_sessions_payment_intent_idx" ON "stripe__checkout_sessions" (payment_intent);

CREATE INDEX "stripe__stripe_checkout_sessions_subscription_idx" ON "stripe__checkout_sessions" (subscription);

CREATE INDEX "stripe__stripe_credit_notes_customer_idx" ON "stripe__credit_notes" (customer);

CREATE INDEX "stripe__stripe_credit_notes_invoice_idx" ON "stripe__credit_notes" (invoice);

CREATE INDEX "stripe__stripe_dispute_created_idx" ON "stripe__disputes" (created);

CREATE INDEX "stripe__stripe_early_fraud_warnings_charge_idx" ON "stripe__early_fraud_warnings" (charge);

CREATE INDEX "stripe__stripe_early_fraud_warnings_payment_intent_idx" ON "stripe__early_fraud_warnings" (payment_intent);

CREATE UNIQUE INDEX "stripe__features_lookup_key_key" ON "stripe__features" (lookup_key) WHERE (lookup_key IS NOT NULL);

CREATE INDEX "stripe__stripe_invoices_customer_idx" ON "stripe__invoices" (customer);

CREATE INDEX "stripe__stripe_invoices_subscription_idx" ON "stripe__invoices" (subscription);

CREATE INDEX "stripe__stripe_payment_intents_customer_idx" ON "stripe__payment_intents" (customer);

CREATE INDEX "stripe__stripe_payment_intents_invoice_idx" ON "stripe__payment_intents" (invoice);

CREATE INDEX "stripe__stripe_payment_methods_customer_idx" ON "stripe__payment_methods" (customer);

CREATE INDEX "stripe__stripe_refunds_charge_idx" ON "stripe__refunds" (charge);

CREATE INDEX "stripe__stripe_refunds_payment_intent_idx" ON "stripe__refunds" (payment_intent);

CREATE INDEX "stripe__stripe_reviews_charge_idx" ON "stripe__reviews" (charge);

CREATE INDEX "stripe__stripe_reviews_payment_intent_idx" ON "stripe__reviews" (payment_intent);

CREATE INDEX "stripe__stripe_setup_intents_customer_idx" ON "stripe__setup_intents" (customer);

CREATE INDEX "stripe__stripe_tax_ids_customer_idx" ON "stripe__tax_ids" (customer);

CREATE VIEW "current_published_dataset" AS  SELECT id,
    environment,
    status,
    predecessor_id,
    source_watermarks,
    quality_summary,
    created_at,
    published_at,
    retired_at
   FROM published_dataset_versions
  WHERE ((status) = 'published');

CREATE VIEW "current_market_snapshots" AS  SELECT snapshot.id,
    snapshot.dataset_version_id,
    snapshot.geography_id,
    snapshot.segment_key,
    snapshot.period_start,
    snapshot.period_end,
    snapshot.transaction_count,
    snapshot.median_price,
    snapshot.p25_price,
    snapshot.p75_price,
    snapshot.median_price_per_sqft,
    snapshot.trend_percent,
    snapshot.source_coverage,
    snapshot.confidence,
    snapshot.computed_at
   FROM (market_snapshots_v2 snapshot
     JOIN current_published_dataset version ON (((version.id) = (snapshot.dataset_version_id))));

CREATE VIEW "current_ranking_snapshots" AS  SELECT ranking.id,
    ranking.dataset_version_id,
    ranking.geography_id,
    ranking.score_version,
    ranking.rank,
    ranking.price_trend_score,
    ranking.transaction_velocity_score,
    ranking.liquidity_score,
    ranking.comp_depth_score,
    ranking.confidence_score,
    ranking.total_score,
    ranking.eligible,
    ranking.exclusion_reasons,
    ranking.computed_at
   FROM (ranking_snapshots ranking
     JOIN current_published_dataset version ON (((version.id) = (ranking.dataset_version_id))))
  WHERE ranking.eligible;

CREATE TRIGGER "stripe___managed_webhooks__handle_updated_at" AFTER UPDATE ON "stripe___managed_webhooks" WHEN NEW."updated_at" IS OLD."updated_at" BEGIN UPDATE "stripe___managed_webhooks" SET "updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe___sync_status__handle_updated_at" AFTER UPDATE ON "stripe___sync_status" WHEN NEW."updated_at" IS OLD."updated_at" BEGIN UPDATE "stripe___sync_status" SET "updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__accounts__handle_updated_at" AFTER UPDATE ON "stripe__accounts" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__accounts" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__active_entitlements__handle_updated_at" AFTER UPDATE ON "stripe__active_entitlements" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__active_entitlements" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__charges__handle_updated_at" AFTER UPDATE ON "stripe__charges" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__charges" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__checkout_session_line_items__handle_updated_at" AFTER UPDATE ON "stripe__checkout_session_line_items" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__checkout_session_line_items" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__checkout_sessions__handle_updated_at" AFTER UPDATE ON "stripe__checkout_sessions" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__checkout_sessions" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__coupons__handle_updated_at" AFTER UPDATE ON "stripe__coupons" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__coupons" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__customers__handle_updated_at" AFTER UPDATE ON "stripe__customers" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__customers" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__disputes__handle_updated_at" AFTER UPDATE ON "stripe__disputes" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__disputes" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__early_fraud_warnings__handle_updated_at" AFTER UPDATE ON "stripe__early_fraud_warnings" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__early_fraud_warnings" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__events__handle_updated_at" AFTER UPDATE ON "stripe__events" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__events" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__features__handle_updated_at" AFTER UPDATE ON "stripe__features" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__features" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__invoices__handle_updated_at" AFTER UPDATE ON "stripe__invoices" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__invoices" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__payouts__handle_updated_at" AFTER UPDATE ON "stripe__payouts" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__payouts" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__plans__handle_updated_at" AFTER UPDATE ON "stripe__plans" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__plans" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__prices__handle_updated_at" AFTER UPDATE ON "stripe__prices" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__prices" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__products__handle_updated_at" AFTER UPDATE ON "stripe__products" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__products" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__refunds__handle_updated_at" AFTER UPDATE ON "stripe__refunds" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__refunds" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__reviews__handle_updated_at" AFTER UPDATE ON "stripe__reviews" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__reviews" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;

CREATE TRIGGER "stripe__subscriptions__handle_updated_at" AFTER UPDATE ON "stripe__subscriptions" WHEN NEW."_updated_at" IS OLD."_updated_at" BEGIN UPDATE "stripe__subscriptions" SET "_updated_at" = (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z') WHERE rowid = NEW.rowid; END;
