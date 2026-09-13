-- SQLite needs a subject-first access path before joining 1.27M comp members.
CREATE INDEX comparable_sets_subject_lookup ON comparable_sets_v2(subject_type, subject_id, dataset_version_id);
CREATE INDEX sales_property_recent ON sales(property_id, sale_date DESC, sale_price);
CREATE INDEX sales_unit_recent ON sales(unit_bbl, sale_date DESC, sale_price);
CREATE INDEX properties_opportunity_order ON properties(opportunity_score DESC);
CREATE INDEX properties_state_opportunity_order ON properties(state, opportunity_score DESC);
