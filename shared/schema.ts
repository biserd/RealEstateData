import { timestamp } from "./sqliteTypes";
import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = sqliteTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: text("sess", { mode: "json" }).notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Subscription tiers
export const subscriptionTiers = ["free", "pro", "premium"] as const;
export type SubscriptionTier = typeof subscriptionTiers[number];

// User account status
export const userStatuses = ["active", "pending_activation"] as const;
export type UserStatus = typeof userStatuses[number];

// User storage table for username/password authentication
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash"), // Nullable for pending_activation users
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").default("user"), // user, admin
  status: text("status").default("active"), // active, pending_activation
  activationTokenHash: text("activation_token_hash"),
  activationTokenExpiresAt: timestamp("activation_token_expires_at"),
  resetTokenHash: text("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  subscriptionTier: text("subscription_tier").default("free"), // free, pro, premium
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, canceled, past_due, etc.
  trialNotificationSentAt: timestamp("trial_notification_sent_at"), // When admin was notified of this user's trial start
  createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
});

export const insertUserSchema = createInsertSchema(users, { activationTokenExpiresAt: () => z.date().optional(), resetTokenExpiresAt: () => z.date().optional(), trialNotificationSentAt: () => z.date().optional(), createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// API Key status
export const apiKeyStatuses = ["active", "revoked"] as const;
export type ApiKeyStatus = typeof apiKeyStatuses[number];

// API Keys table for developer access
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id),
    hashedKey: text("hashed_key").notNull(),
    prefix: text("prefix").notNull(), // First 8 chars for quick lookup (e.g., "rd_live_")
    lastFour: text("last_four").notNull(), // Last 4 chars for display
    name: text("name").default("Default API Key"),
    status: text("status").default("active"), // active, revoked
    lastUsedAt: timestamp("last_used_at"),
    requestCount: integer("request_count").default(0),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_api_keys_user").on(table.userId),
    index("idx_api_keys_prefix").on(table.prefix),
  ]
);

export const insertApiKeySchema = createInsertSchema(apiKeys, { lastUsedAt: () => z.date().optional(), createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Data Source Types for tagging
export const dataSourceTypes = ["PLUTO", "Valuations", "ACRIS", "HPD", "Zillow", "Manual"] as const;
export type DataSourceType = typeof dataSourceTypes[number];

// Property Types Enum
export const propertyTypes = ["SFH", "Condo", "Townhome", "Multi-family 2-4", "Multi-family 5+", "Co-op", "Commercial", "Mixed-Use", "Vacant Land"] as const;
export type PropertyType = typeof propertyTypes[number];

// Property segmentation bands
export const bedsBands = ["0-1", "2", "3", "4", "5+"] as const;
export const bathsBands = ["1", "2", "3+"] as const;
export const yearBuiltBands = ["pre-1940", "1940-69", "1970-89", "1990-2009", "2010+"] as const;
export const sizeBands = ["<1000", "1000-1499", "1500-1999", "2000-2999", "3000+"] as const;

// Coverage levels
export const coverageLevels = ["MarketOnly", "PropertyFacts", "SalesHistory", "Listings", "Comps", "AltSignals"] as const;
export type CoverageLevel = typeof coverageLevels[number];

// Confidence levels
export const confidenceLevels = ["Low", "Medium", "High"] as const;
export type ConfidenceLevel = typeof confidenceLevels[number];

// States covered
export const states = ["NY", "NJ", "CT"] as const;
export type State = typeof states[number];

// Properties table - core property data linked via BBL
export const properties = sqliteTable(
  "properties",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bbl: text("bbl"), // Borough-Block-Lot: master key for NYC properties
    bblNormalized: text("bbl_normalized"), // 10-char normalized BBL for joins
    address: text("address").notNull(),
    unit: text("unit"), // Apartment/unit number (e.g., "4B", "PH1", "Unit 5")
    city: text("city").notNull(),
    state: text("state").notNull(),
    zipCode: text("zip_code").notNull(),
    county: text("county"),
    neighborhood: text("neighborhood"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    gridLat: integer("grid_lat"), // floor(lat * 1000) for fast spatial lookup (~100m precision)
    gridLng: integer("grid_lng"), // floor(lng * 1000) for fast spatial lookup
    propertyType: text("property_type").notNull(),
    beds: integer("beds"),
    baths: real("baths"),
    sqft: integer("sqft"),
    lotSize: integer("lot_size"),
    yearBuilt: integer("year_built"),
    lastSalePrice: integer("last_sale_price"),
    lastSaleDate: timestamp("last_sale_date"),
    estimatedValue: integer("estimated_value"),
    pricePerSqft: real("price_per_sqft"),
    opportunityScore: integer("opportunity_score"),
    confidenceLevel: text("confidence_level"),
    imageUrl: text("image_url"),
    dataSources: text("data_sources", { mode: "json" }).$type<string[]>(), // Track which datasets contributed
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_properties_bbl").on(table.bbl),
    index("idx_properties_zip").on(table.zipCode),
    index("idx_properties_city").on(table.city),
    index("idx_properties_state").on(table.state),
    index("idx_properties_grid").on(table.gridLat, table.gridLng),
  ]
);

export const insertPropertySchema = createInsertSchema(properties, { lastSaleDate: () => z.date(), dataSources: () => z.array(z.string()), createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Sales/Transactions table
export const sales = sqliteTable(
  "sales",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id),
    salePrice: integer("sale_price").notNull(),
    saleDate: timestamp("sale_date").notNull(),
    armsLength: integer("arms_length", { mode: "boolean" }).default(true),
    deedType: text("deed_type"),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    // Entity matching fields
    unitBbl: text("unit_bbl"),
    baseBbl: text("base_bbl"),
    matchMethod: text("match_method"), // 'unit_bbl', 'geoclient', 'block_lot', 'unresolved'
    rawBorough: text("raw_borough"),
    rawBlock: text("raw_block"),
    rawLot: text("raw_lot"),
    rawAddress: text("raw_address"),
    rawAptNumber: text("raw_apt_number"),
    unresolvedReason: text("unresolved_reason"),
  },
  (table) => [
    index("idx_sales_property").on(table.propertyId),
    index("idx_sales_unit_bbl").on(table.unitBbl),
    index("idx_sales_base_bbl").on(table.baseBbl),
    index("idx_sales_match_method").on(table.matchMethod),
  ]
);

export const insertSaleSchema = createInsertSchema(sales, { saleDate: () => z.date(), createdAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
});
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

// Market Aggregates table - precomputed stats per geography and segment
export const marketAggregates = sqliteTable(
  "market_aggregates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    geoType: text("geo_type").notNull(), // zip, city, county, neighborhood
    geoId: text("geo_id").notNull(),
    geoName: text("geo_name").notNull(),
    state: text("state").notNull(),
    propertyType: text("property_type"),
    bedsBand: text("beds_band"),
    bathsBand: text("baths_band"),
    yearBuiltBand: text("year_built_band"),
    sizeBand: text("size_band"),
    medianPrice: integer("median_price"),
    medianPricePerSqft: real("median_price_per_sqft"),
    p25Price: integer("p25_price"),
    p75Price: integer("p75_price"),
    p25PricePerSqft: real("p25_price_per_sqft"),
    p75PricePerSqft: real("p75_price_per_sqft"),
    transactionCount: integer("transaction_count"),
    turnoverRate: real("turnover_rate"),
    volatility: real("volatility"),
    trend3m: real("trend_3m"),
    trend6m: real("trend_6m"),
    trend12m: real("trend_12m"),
    computedAt: timestamp("computed_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_aggregates_geo").on(table.geoType, table.geoId),
    index("idx_aggregates_state").on(table.state),
  ]
);

export const insertMarketAggregateSchema = createInsertSchema(marketAggregates, { computedAt: () => z.date() }).omit({
  id: true,
  computedAt: true,
});
export type InsertMarketAggregate = z.infer<typeof insertMarketAggregateSchema>;
export type MarketAggregate = typeof marketAggregates.$inferSelect;

// Coverage Matrix - data quality by geography
export const coverageMatrix = sqliteTable(
  "coverage_matrix",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    state: text("state").notNull(),
    county: text("county"),
    zipCode: text("zip_code"),
    coverageLevel: text("coverage_level").notNull(),
    freshnessSla: integer("freshness_sla_days").default(30),
    sqftCompleteness: real("sqft_completeness"),
    yearBuiltCompleteness: real("year_built_completeness"),
    lastSaleCompleteness: real("last_sale_completeness"),
    confidenceScore: real("confidence_score"),
    allowedAiClaims: text("allowed_ai_claims", { mode: "json" }).$type<string[]>(),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [index("idx_coverage_state").on(table.state)]
);

export const insertCoverageMatrixSchema = createInsertSchema(coverageMatrix, { allowedAiClaims: () => z.array(z.string()), updatedAt: () => z.date() }).omit({
  id: true,
  updatedAt: true,
});
export type InsertCoverageMatrix = z.infer<typeof insertCoverageMatrixSchema>;
export type CoverageMatrix = typeof coverageMatrix.$inferSelect;

// Watchlists
export const watchlists = sqliteTable(
  "watchlists",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    geoType: text("geo_type"), // zip, city, neighborhood
    geoId: text("geo_id"),
    filters: text("filters", { mode: "json" }), // stored filter criteria
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [index("idx_watchlists_user").on(table.userId)]
);

export const insertWatchlistSchema = createInsertSchema(watchlists, { createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;

// Watchlist Properties (saved properties)
export const watchlistProperties = sqliteTable(
  "watchlist_properties",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    watchlistId: text("watchlist_id").references(() => watchlists.id).notNull(),
    propertyId: text("property_id").references(() => properties.id).notNull(),
    addedAt: timestamp("added_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    notes: text("notes"),
  },
  (table) => [index("idx_watchlist_props").on(table.watchlistId)]
);

export const insertWatchlistPropertySchema = createInsertSchema(watchlistProperties, { addedAt: () => z.date() }).omit({
  id: true,
  addedAt: true,
});
export type InsertWatchlistProperty = z.infer<typeof insertWatchlistPropertySchema>;
export type WatchlistProperty = typeof watchlistProperties.$inferSelect;

// Alerts
export const alerts = sqliteTable(
  "alerts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    watchlistId: text("watchlist_id").references(() => watchlists.id),
    propertyId: text("property_id").references(() => properties.id),
    alertType: text("alert_type").notNull(), // score_threshold, price_cut, new_comp, market_shift
    threshold: real("threshold"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    lastTriggered: timestamp("last_triggered"),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [index("idx_alerts_user").on(table.userId)]
);

export const insertAlertSchema = createInsertSchema(alerts, { lastTriggered: () => z.date(), createdAt: () => z.date() }).omit({
  id: true,
  lastTriggered: true,
  createdAt: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Notifications
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    alertId: text("alert_id").references(() => alerts.id),
    title: text("title").notNull(),
    message: text("message").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).default(false),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [index("idx_notifications_user").on(table.userId)]
);

export const insertNotificationSchema = createInsertSchema(notifications, { createdAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Comps (comparable properties)
export const comps = sqliteTable(
  "comps",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    subjectPropertyId: text("subject_property_id").references(() => properties.id).notNull(),
    compPropertyId: text("comp_property_id").references(() => properties.id).notNull(),
    similarityScore: real("similarity_score"),
    sqftAdjustment: real("sqft_adjustment"),
    ageAdjustment: real("age_adjustment"),
    bedsAdjustment: real("beds_adjustment"),
    adjustedPrice: integer("adjusted_price"),
    computedAt: timestamp("computed_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [index("idx_comps_subject").on(table.subjectPropertyId)]
);

export const insertCompSchema = createInsertSchema(comps, { computedAt: () => z.date() }).omit({
  id: true,
  computedAt: true,
});
export type InsertComp = z.infer<typeof insertCompSchema>;
export type Comp = typeof comps.$inferSelect;

// Data Sources (for admin catalog)
export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type").notNull(), // public, paid, internal
  description: text("description"),
  refreshCadence: text("refresh_cadence"), // daily, weekly, monthly
  lastRefresh: timestamp("last_refresh"),
  recordCount: integer("record_count"),
  licensingNotes: text("licensing_notes"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
});

export const insertDataSourceSchema = createInsertSchema(dataSources, { lastRefresh: () => z.date(), createdAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
});
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

// AI Chat History
export const aiChats = sqliteTable(
  "ai_chats",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id).notNull(),
    propertyId: text("property_id").references(() => properties.id),
    geoId: text("geo_id"),
    question: text("question").notNull(),
    response: text("response", { mode: "json" }).notNull(), // structured JSON response
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [index("idx_ai_chats_user").on(table.userId)]
);

export const insertAiChatSchema = createInsertSchema(aiChats, { createdAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
});
export type InsertAiChat = z.infer<typeof insertAiChatSchema>;
export type AiChat = typeof aiChats.$inferSelect;

// ============================================
// STAGING TABLES - Raw data from each source
// ============================================

// PLUTO Raw Data - Full NYC tax lot data
export const plutoRaw = sqliteTable(
  "pluto_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bbl: text("bbl").notNull(),
    borough: text("borough"),
    block: text("block"),
    lot: text("lot"),
    address: text("address"),
    zipCode: text("zip_code"),
    bldgClass: text("bldg_class"),
    landUse: text("land_use"),
    ownerName: text("owner_name"),
    numFloors: real("num_floors"),
    unitsRes: integer("units_res"),
    unitsTotal: integer("units_total"),
    lotArea: integer("lot_area"),
    bldgArea: integer("bldg_area"),
    resArea: integer("res_area"),
    officeArea: integer("office_area"),
    retailArea: integer("retail_area"),
    yearBuilt: integer("year_built"),
    yearAltered1: integer("year_altered_1"),
    yearAltered2: integer("year_altered_2"),
    condoNo: text("condo_no"),
    xCoord: real("x_coord"),
    yCoord: real("y_coord"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    communityDistrict: text("community_district"),
    zoneDist1: text("zone_dist_1"),
    zoneDist2: text("zone_dist_2"),
    overlay1: text("overlay_1"),
    overlay2: text("overlay_2"),
    spdist1: text("spdist_1"),
    spdist2: text("spdist_2"),
    assessLand: integer("assess_land"),
    assessTot: integer("assess_tot"),
    exemptLand: integer("exempt_land"),
    exemptTot: integer("exempt_tot"),
    rawData: text("raw_data", { mode: "json" }), // Store full record for reference
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_pluto_bbl").on(table.bbl),
    index("idx_pluto_zip").on(table.zipCode),
  ]
);

export type PlutoRaw = typeof plutoRaw.$inferSelect;

// Property Valuation Raw Data - Tax assessment data
export const valuationsRaw = sqliteTable(
  "valuations_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bbl: text("bbl").notNull(),
    borough: text("borough"),
    block: text("block"),
    lot: text("lot"),
    taxClass: text("tax_class"),
    buildingClass: text("building_class"),
    ownerName: text("owner_name"),
    address: text("address"),
    aptNo: text("apt_no"),
    zipCode: text("zip_code"),
    assessYear: integer("assess_year"),
    landValue: integer("land_value"),
    totalValue: integer("total_value"),
    transitionalLand: integer("transitional_land"),
    transitionalTotal: integer("transitional_total"),
    newLandValue: integer("new_land_value"),
    newTotalValue: integer("new_total_value"),
    exemptionCodeOne: text("exemption_code_one"),
    exemptionCodeTwo: text("exemption_code_two"),
    exemptionCodeThree: text("exemption_code_three"),
    exemptionCodeFour: text("exemption_code_four"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_valuations_bbl").on(table.bbl),
    index("idx_valuations_year").on(table.assessYear),
  ]
);

export type ValuationsRaw = typeof valuationsRaw.$inferSelect;

// ACRIS Raw Data - Deed and mortgage transactions
export const acrisRaw = sqliteTable(
  "acris_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    documentId: text("document_id").notNull(),
    recordType: text("record_type"), // MASTER, LEGAL, PARTY
    bbl: text("bbl"),
    borough: text("borough"),
    block: text("block"),
    lot: text("lot"),
    docType: text("doc_type"), // DEED, MTGE, ASST, etc.
    docDate: timestamp("doc_date"),
    recordedDateTime: timestamp("recorded_date_time"),
    docAmount: real("doc_amount"),
    percentTransferred: real("percent_transferred"),
    goodThroughDate: timestamp("good_through_date"),
    partyType: text("party_type"), // buyer, seller, lender
    partyName: text("party_name"),
    partyAddress: text("party_address"),
    streetNumber: text("street_number"),
    streetName: text("street_name"),
    unit: text("unit"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_acris_bbl").on(table.bbl),
    index("idx_acris_doc").on(table.documentId),
    index("idx_acris_date").on(table.recordedDateTime),
  ]
);

export type AcrisRaw = typeof acrisRaw.$inferSelect;

// HPD Raw Data - Building registrations, violations, complaints
export const hpdRaw = sqliteTable(
  "hpd_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bbl: text("bbl"),
    buildingId: text("building_id"),
    registrationId: text("registration_id"),
    boroId: text("boro_id"),
    borough: text("borough"),
    block: text("block"),
    lot: text("lot"),
    houseNumber: text("house_number"),
    streetName: text("street_name"),
    zipCode: text("zip_code"),
    registrationStatus: text("registration_status"),
    buildingOwnerName: text("building_owner_name"),
    buildingOwnerPhone: text("building_owner_phone"),
    buildingOwnerEmail: text("building_owner_email"),
    agentName: text("agent_name"),
    agentPhone: text("agent_phone"),
    agentAddress: text("agent_address"),
    numFloors: integer("num_floors"),
    numApartments: integer("num_apartments"),
    numLegalUnits: integer("num_legal_units"),
    totalViolations: integer("total_violations"),
    openViolations: integer("open_violations"),
    totalComplaints: integer("total_complaints"),
    openComplaints: integer("open_complaints"),
    lastInspectionDate: timestamp("last_inspection_date"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_hpd_bbl").on(table.bbl),
    index("idx_hpd_building").on(table.buildingId),
  ]
);

export type HpdRaw = typeof hpdRaw.$inferSelect;

// DOB Permits Raw - Building permits from NYC DOB
export const dobPermitsRaw = sqliteTable(
  "dob_permits_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobNumber: text("job_number").notNull(),
    bbl: text("bbl"),
    bin: text("bin"),
    borough: text("borough"),
    block: text("block"),
    lot: text("lot"),
    houseNumber: text("house_number"),
    streetName: text("street_name"),
    zipCode: text("zip_code"),
    jobType: text("job_type"), // NB (New Building), A1 (Alteration), DM (Demolition), etc.
    jobDescription: text("job_description"),
    workType: text("work_type"),
    permitStatus: text("permit_status"), // Filed, Approved, In Process, Complete
    filingDate: timestamp("filing_date"),
    issuanceDate: timestamp("issuance_date"),
    expirationDate: timestamp("expiration_date"),
    estimatedCost: integer("estimated_cost"),
    ownerBusinessName: text("owner_business_name"),
    ownerName: text("owner_name"),
    applicantName: text("applicant_name"),
    professionalCert: integer("professional_cert", { mode: "boolean" }),
    existingStories: integer("existing_stories"),
    proposedStories: integer("proposed_stories"),
    existingDwellingUnits: integer("existing_dwelling_units"),
    proposedDwellingUnits: integer("proposed_dwelling_units"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_dob_permits_bbl").on(table.bbl),
    index("idx_dob_permits_job").on(table.jobNumber),
    index("idx_dob_permits_filing").on(table.filingDate),
  ]
);

export type DobPermitRaw = typeof dobPermitsRaw.$inferSelect;

// DOB Complaints Raw - Building complaints from NYC DOB
export const dobComplaintsRaw = sqliteTable(
  "dob_complaints_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    complaintNumber: text("complaint_number").notNull(),
    bbl: text("bbl"),
    bin: text("bin"),
    borough: text("borough"),
    block: text("block"),
    lot: text("lot"),
    houseNumber: text("house_number"),
    streetName: text("street_name"),
    zipCode: text("zip_code"),
    complaintCategory: text("complaint_category"), // Construction, Plumbing, Electrical, etc.
    complaintCategoryDescription: text("complaint_category_description"),
    unitOrApartment: text("unit_or_apartment"),
    status: text("status"), // Active, Closed
    dispositionCode: text("disposition_code"),
    dispositionDate: timestamp("disposition_date"),
    dateEntered: timestamp("date_entered"),
    inspectionDate: timestamp("inspection_date"),
    dobRunDate: timestamp("dob_run_date"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_dob_complaints_bbl").on(table.bbl),
    index("idx_dob_complaints_number").on(table.complaintNumber),
    index("idx_dob_complaints_date").on(table.dateEntered),
  ]
);

export type DobComplaintRaw = typeof dobComplaintsRaw.$inferSelect;

// 311 Service Requests Raw - NYC 311 complaints
export const complaints311Raw = sqliteTable(
  "complaints_311_raw",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    uniqueKey: text("unique_key").notNull(),
    bbl: text("bbl"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    address: text("address"),
    city: text("city"),
    borough: text("borough"),
    zipCode: text("zip_code"),
    complaintType: text("complaint_type"), // Noise, Heat/Hot Water, Illegal Parking, etc.
    descriptor: text("descriptor"),
    locationType: text("location_type"),
    status: text("status"), // Open, Closed, Pending
    resolutionDescription: text("resolution_description"),
    createdDate: timestamp("created_date"),
    closedDate: timestamp("closed_date"),
    agency: text("agency"),
    agencyName: text("agency_name"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_311_bbl").on(table.bbl),
    index("idx_311_unique_key").on(table.uniqueKey),
    index("idx_311_created").on(table.createdDate),
    index("idx_311_type").on(table.complaintType),
  ]
);

export type Complaint311Raw = typeof complaints311Raw.$inferSelect;

// Subway Entrances - MTA subway station entrances for transit accessibility
export const subwayEntrances = sqliteTable(
  "subway_entrances",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    stationName: text("station_name").notNull(),
    lineName: text("line_name"), // e.g., "A-C-E", "1-2-3"
    division: text("division"), // BMT, IND, IRT
    routesServed: text("routes_served", { mode: "json" }).$type<string[]>(), // Array of routes: ["A", "C", "E"]
    entranceType: text("entrance_type"), // Stair, Escalator, Elevator, etc.
    isAccessible: integer("is_accessible", { mode: "boolean" }).default(false), // ADA accessible
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    gridLat: integer("grid_lat"), // floor(lat * 1000) for fast spatial lookup
    gridLng: integer("grid_lng"), // floor(lng * 1000) for fast spatial lookup
    corner: text("corner"), // NE, NW, SE, SW
    northSouthStreet: text("north_south_street"),
    eastWestStreet: text("east_west_street"),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_subway_station").on(table.stationName),
    index("idx_subway_grid").on(table.gridLat, table.gridLng),
    index("idx_subway_accessible").on(table.isAccessible),
  ]
);

export type SubwayEntrance = typeof subwayEntrances.$inferSelect;

// Flood Zones - FEMA flood zone data mapped to BBL/area
export const floodZones = sqliteTable(
  "flood_zones",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    bbl: text("bbl"),
    zipCode: text("zip_code"),
    floodZone: text("flood_zone").notNull(), // X, A, AE, V, VE, AO, etc.
    floodZoneSubtype: text("flood_zone_subtype"), // 0.2 PCT, 1 PCT, etc.
    femaFirmPanelId: text("fema_firm_panel_id"),
    effectiveDate: timestamp("effective_date"),
    isHighRisk: integer("is_high_risk", { mode: "boolean" }).default(false), // Zone A or V
    isModerateRisk: integer("is_moderate_risk", { mode: "boolean" }).default(false), // Zone X shaded
    baseFloodElevation: real("base_flood_elevation"),
    specialFloodHazardArea: integer("special_flood_hazard_area", { mode: "boolean" }).default(false),
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_flood_bbl").on(table.bbl),
    index("idx_flood_zip").on(table.zipCode),
    index("idx_flood_zone").on(table.floodZone),
  ]
);

export type FloodZone = typeof floodZones.$inferSelect;

// Amenities - Parks, restaurants, retail for walkability scoring
export const amenities = sqliteTable(
  "amenities",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    category: text("category").notNull(), // park, restaurant, grocery, retail, cafe, gym, etc.
    subcategory: text("subcategory"),
    address: text("address"),
    city: text("city"),
    borough: text("borough"),
    zipCode: text("zip_code"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    gridLat: integer("grid_lat"), // floor(lat * 1000) for fast spatial lookup
    gridLng: integer("grid_lng"), // floor(lng * 1000) for fast spatial lookup
    sourceId: text("source_id"), // ID from source dataset
    sourceType: text("source_type"), // nyc_parks, yelp, google, etc.
    rawData: text("raw_data", { mode: "json" }),
    importedAt: timestamp("imported_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_amenities_category").on(table.category),
    index("idx_amenities_grid").on(table.gridLat, table.gridLng),
    index("idx_amenities_zip").on(table.zipCode),
  ]
);

export type Amenity = typeof amenities.$inferSelect;

// ============================================
// PROPERTY SIGNAL SUMMARY - Precomputed NYC deep data per property
// ============================================

export const propertySignalSummary = sqliteTable(
  "property_signal_summary",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id).notNull(),
    bbl: text("bbl"),

    // Building permits (construction momentum)
    permitCount12m: integer("permit_count_12m").default(0),
    permitCount24m: integer("permit_count_24m").default(0),
    activePermits: integer("active_permits").default(0),
    majorAlteration: integer("major_alteration", { mode: "boolean" }).default(false), // A1 permit in last 24m
    newConstruction: integer("new_construction", { mode: "boolean" }).default(false), // NB permit
    estimatedPermitValue: integer("estimated_permit_value"), // Sum of estimated costs

    // HPD violations & complaints (building health)
    openHpdViolations: integer("open_hpd_violations").default(0),
    totalHpdViolations12m: integer("total_hpd_violations_12m").default(0),
    hazardousViolations: integer("hazardous_violations").default(0),
    openHpdComplaints: integer("open_hpd_complaints").default(0),
    totalHpdComplaints12m: integer("total_hpd_complaints_12m").default(0),

    // DOB complaints
    dobComplaints12m: integer("dob_complaints_12m").default(0),
    activeDobComplaints: integer("active_dob_complaints").default(0),

    // 311 complaints (neighborhood quality)
    complaints311_12m: integer("complaints_311_12m").default(0),
    noiseComplaints12m: integer("noise_complaints_12m").default(0),

    // Building health score (0-100, higher is better)
    buildingHealthScore: integer("building_health_score"),
    healthRiskLevel: text("health_risk_level"), // low, medium, high, critical

    // Transit accessibility
    nearestSubwayMeters: integer("nearest_subway_meters"),
    nearestSubwayStation: text("nearest_subway_station"),
    nearestSubwayLines: text("nearest_subway_lines", { mode: "json" }).$type<string[]>(),
    hasAccessibleTransit: integer("has_accessible_transit", { mode: "boolean" }).default(false),
    transitScore: integer("transit_score"), // 0-100

    // Flood risk
    floodZone: text("flood_zone"),
    isFloodHighRisk: integer("is_flood_high_risk", { mode: "boolean" }).default(false),
    isFloodModerateRisk: integer("is_flood_moderate_risk", { mode: "boolean" }).default(false),
    floodRiskLevel: text("flood_risk_level"), // minimal, moderate, high, severe

    // Amenity density
    amenities400m: integer("amenities_400m").default(0), // ~5 min walk
    amenities800m: integer("amenities_800m").default(0), // ~10 min walk
    restaurants400m: integer("restaurants_400m").default(0),
    parks400m: integer("parks_400m").default(0),
    groceries800m: integer("groceries_800m").default(0),
    amenityScore: integer("amenity_score"), // 0-100

    // Data quality and confidence
    signalConfidence: text("signal_confidence"), // high, medium, low based on data completeness
    dataCompleteness: integer("data_completeness"), // 0-100 percentage of available data points

    // NYC deep coverage indicator
    hasDeepCoverage: integer("has_deep_coverage", { mode: "boolean" }).default(false),
    signalDataSources: text("signal_data_sources", { mode: "json" }).$type<string[]>(), // Which datasets contributed

    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    uniqueIndex("idx_signal_property_unique").on(table.propertyId),
    index("idx_signal_bbl").on(table.bbl),
    index("idx_signal_health").on(table.buildingHealthScore),
    index("idx_signal_transit").on(table.transitScore),
  ]
);

export const insertPropertySignalSummarySchema = createInsertSchema(propertySignalSummary, { nearestSubwayLines: () => z.array(z.string()), signalDataSources: () => z.array(z.string()), updatedAt: () => z.date() }).omit({
  id: true,
  updatedAt: true,
});
export type InsertPropertySignalSummary = z.infer<typeof insertPropertySignalSummarySchema>;
export type PropertySignalSummary = typeof propertySignalSummary.$inferSelect;

// ============================================
// NORMALIZED TABLES - Processed and linked data
// ============================================

// Property Valuations - Historical tax assessments
export const propertyValuations = sqliteTable(
  "property_valuations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id),
    bbl: text("bbl").notNull(),
    assessYear: integer("assess_year").notNull(),
    taxClass: text("tax_class"),
    landValue: integer("land_value"),
    totalValue: integer("total_value"),
    exemptionAmount: integer("exemption_amount"),
    taxableValue: integer("taxable_value"),
    annualTax: integer("annual_tax"),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_prop_val_property").on(table.propertyId),
    index("idx_prop_val_bbl").on(table.bbl),
    index("idx_prop_val_year").on(table.assessYear),
  ]
);

export type PropertyValuation = typeof propertyValuations.$inferSelect;

// Property Transactions - All deed/mortgage activity
export const propertyTransactions = sqliteTable(
  "property_transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id),
    bbl: text("bbl").notNull(),
    documentId: text("document_id"),
    transactionType: text("transaction_type").notNull(), // sale, mortgage, refinance, transfer
    transactionDate: timestamp("transaction_date").notNull(),
    amount: real("amount"),
    buyerName: text("buyer_name"),
    sellerName: text("seller_name"),
    lenderName: text("lender_name"),
    isArmsLength: integer("is_arms_length", { mode: "boolean" }).default(true),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_prop_tx_property").on(table.propertyId),
    index("idx_prop_tx_bbl").on(table.bbl),
    index("idx_prop_tx_date").on(table.transactionDate),
  ]
);

export type PropertyTransaction = typeof propertyTransactions.$inferSelect;

// Property Compliance - HPD violations and complaints
export const propertyCompliance = sqliteTable(
  "property_compliance",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id),
    bbl: text("bbl").notNull(),
    registrationStatus: text("registration_status"),
    totalViolations: integer("total_violations").default(0),
    openViolations: integer("open_violations").default(0),
    hazardousViolations: integer("hazardous_violations").default(0),
    totalComplaints: integer("total_complaints").default(0),
    openComplaints: integer("open_complaints").default(0),
    lastInspectionDate: timestamp("last_inspection_date"),
    complianceScore: integer("compliance_score"), // 0-100, higher is better
    riskLevel: text("risk_level"), // low, medium, high
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_compliance_property").on(table.propertyId),
    index("idx_compliance_bbl").on(table.bbl),
  ]
);

export type PropertyCompliance = typeof propertyCompliance.$inferSelect;

// ============================================
// AI LAYER - Enriched property profiles
// ============================================

// Property Profiles - Consolidated AI-ready data
export const propertyProfiles = sqliteTable(
  "property_profiles",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id).notNull(),
    bbl: text("bbl"),

    // Consolidated metrics
    currentValue: integer("current_value"),
    valueConfidence: real("value_confidence"),
    priceHistory: text("price_history", { mode: "json" }), // Array of {date, price, source}

    // Financial metrics
    capRate: real("cap_rate"),
    cashOnCash: real("cash_on_cash"),
    appreciationRate: real("appreciation_rate"),
    taxBurden: real("tax_burden"), // Annual tax as % of value

    // Risk metrics
    complianceScore: integer("compliance_score"),
    marketVolatility: real("market_volatility"),
    liquidityScore: integer("liquidity_score"),

    // Opportunity metrics
    opportunityScore: integer("opportunity_score"),
    mispricingIndicator: real("mispricing_indicator"),
    valueAddPotential: real("value_add_potential"),

    // Data completeness
    dataCompleteness: real("data_completeness"), // 0-1, how complete is the profile
    sourcesUsed: text("sources_used", { mode: "json" }).$type<string[]>(),
    lastEnrichedAt: timestamp("last_enriched_at"),

    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_profile_property").on(table.propertyId),
    index("idx_profile_bbl").on(table.bbl),
    index("idx_profile_opportunity").on(table.opportunityScore),
  ]
);

export type PropertyProfile = typeof propertyProfiles.$inferSelect;

// AI Insights - Stored AI analysis results
export const aiInsights = sqliteTable(
  "ai_insights",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id),
    bbl: text("bbl"),
    insightType: text("insight_type").notNull(), // opportunity_analysis, deal_memo, market_comparison, risk_assessment

    // AI-generated content
    summary: text("summary"),
    keyFindings: text("key_findings", { mode: "json" }), // Array of {finding, confidence, evidence}
    recommendations: text("recommendations", { mode: "json" }), // Array of {action, impact, priority}
    citations: text("citations", { mode: "json" }), // Array of {source, dataPoint, value}

    // Metadata
    modelUsed: text("model_used"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    confidence: real("confidence"),

    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    expiresAt: timestamp("expires_at"), // Cache expiration
  },
  (table) => [
    index("idx_insights_property").on(table.propertyId),
    index("idx_insights_bbl").on(table.bbl),
    index("idx_insights_type").on(table.insightType),
  ]
);

export type AiInsight = typeof aiInsights.$inferSelect;

// Data Source Links - Track which sources contributed to each property
export const propertyDataLinks = sqliteTable(
  "property_data_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").references(() => properties.id).notNull(),
    bbl: text("bbl"),
    sourceType: text("source_type").notNull(), // PLUTO, Valuations, ACRIS, HPD
    sourceRecordId: text("source_record_id").notNull(),
    matchType: text("match_type").notNull(), // bbl, address, fuzzy
    matchConfidence: real("match_confidence"),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_data_links_property").on(table.propertyId),
    index("idx_data_links_bbl").on(table.bbl),
    index("idx_data_links_source").on(table.sourceType),
  ]
);

export type PropertyDataLink = typeof propertyDataLinks.$inferSelect;

// Saved Searches - User saved search filters for notifications
export const savedSearchFrequencies = ["instant", "daily", "weekly"] as const;
export type SavedSearchFrequency = typeof savedSearchFrequencies[number];

export const savedSearches = sqliteTable(
  "saved_searches",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),

    // Filters stored as JSON for flexibility
    filters: text("filters", { mode: "json" }).notNull(), // ScreenerFilters compatible

    // Indexed columns for efficient querying (denormalized from filters)
    state: text("state"),
    cities: text("cities", { mode: "json" }).$type<string[]>(),
    zipCodes: text("zip_codes", { mode: "json" }).$type<string[]>(),
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    bedsMin: integer("beds_min"),
    bedsMax: integer("beds_max"),
    bathsMin: real("baths_min"),
    opportunityScoreMin: integer("opportunity_score_min"),

    // NYC Deep signal thresholds
    transitScoreMin: integer("transit_score_min"),
    buildingHealthMin: integer("building_health_min"),
    floodRiskMax: text("flood_risk_max"), // minimal, moderate, high

    // Notification settings
    frequency: text("frequency").default("daily").notNull(), // instant, daily, weekly
    emailEnabled: integer("email_enabled", { mode: "boolean" }).default(true),
    pushEnabled: integer("push_enabled", { mode: "boolean" }).default(false),
    isActive: integer("is_active", { mode: "boolean" }).default(true),

    // Tracking
    matchCount: integer("match_count").default(0), // Current # of matching properties
    lastRunAt: timestamp("last_run_at"),
    lastNotifiedAt: timestamp("last_notified_at"),

    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_saved_searches_user").on(table.userId),
    index("idx_saved_searches_frequency").on(table.frequency),
    index("idx_saved_searches_active").on(table.isActive),
  ]
);

export const insertSavedSearchSchema = createInsertSchema(savedSearches, { cities: () => z.array(z.string()), zipCodes: () => z.array(z.string()), lastRunAt: () => z.date(), lastNotifiedAt: () => z.date(), createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  matchCount: true,
  lastRunAt: true,
  lastNotifiedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;

// Property Changes - Track changes for saved search notifications
export const propertyChangeTypes = [
  "new_listing",
  "price_change",
  "score_change",
  "status_change",
  "signal_update",
  "permits_added",
  "violations_added",
  "flood_status_change",
] as const;
export type PropertyChangeType = typeof propertyChangeTypes[number];

export const propertyChanges = sqliteTable(
  "property_changes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id").notNull().references(() => properties.id),
    changeType: text("change_type").notNull(), // PropertyChangeType

    // Change details
    previousValue: text("previous_value", { mode: "json" }),
    newValue: text("new_value", { mode: "json" }),
    changeSummary: text("change_summary"), // Human-readable description

    // For efficient batch processing
    processedForDigest: integer("processed_for_digest", { mode: "boolean" }).default(false),
    processedForInstant: integer("processed_for_instant", { mode: "boolean" }).default(false),

    changedAt: timestamp("changed_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_property_changes_property").on(table.propertyId),
    index("idx_property_changes_type").on(table.changeType),
    index("idx_property_changes_date").on(table.changedAt),
    index("idx_property_changes_unprocessed_digest").on(table.processedForDigest, table.changedAt),
    index("idx_property_changes_unprocessed_instant").on(table.processedForInstant, table.changedAt),
  ]
);

export const insertPropertyChangeSchema = createInsertSchema(propertyChanges, { changedAt: () => z.date() }).omit({
  id: true,
  changedAt: true,
});
export type InsertPropertyChange = z.infer<typeof insertPropertyChangeSchema>;
export type PropertyChange = typeof propertyChanges.$inferSelect;

// Saved Search Notifications - Track sent notifications
export const savedSearchNotifications = sqliteTable(
  "saved_search_notifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    savedSearchId: text("saved_search_id").notNull().references(() => savedSearches.id),
    userId: text("user_id").notNull().references(() => users.id),

    // What was notified
    matchedPropertyIds: text("matched_property_ids", { mode: "json" }).$type<string[]>(),
    changeIds: text("change_ids", { mode: "json" }).$type<string[]>(), // Property change IDs that triggered this
    notificationType: text("notification_type").notNull(), // new_matches, score_changed, price_changed

    // Email details
    emailSent: integer("email_sent", { mode: "boolean" }).default(false),
    emailSentAt: timestamp("email_sent_at"),
    emailId: text("email_id"), // Cloudflare Email message ID

    // Content
    subject: text("subject"),
    summary: text("summary"),

    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_ss_notifications_user").on(table.userId),
    index("idx_ss_notifications_search").on(table.savedSearchId),
    index("idx_ss_notifications_date").on(table.createdAt),
  ]
);

export const insertSavedSearchNotificationSchema = createInsertSchema(savedSearchNotifications, { matchedPropertyIds: () => z.array(z.string()), changeIds: () => z.array(z.string()), emailSentAt: () => z.date(), createdAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
});
export type InsertSavedSearchNotification = z.infer<typeof insertSavedSearchNotificationSchema>;
export type SavedSearchNotification = typeof savedSearchNotifications.$inferSelect;

// NYC Condo Registry - maps unit BBLs to base building BBLs
// Source: NYC Digital Tax Map Condominium Units (eguu-7ie3)
export const condoRegistry = sqliteTable(
  "condo_registry",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    unitBbl: text("unit_bbl").notNull().unique(), // Unit-level BBL (lot 1001+)
    baseBbl: text("base_bbl"), // Base building/tax lot BBL
    condoNumber: text("condo_number"), // Condo declaration number
    borough: text("borough"), // 1=MN, 2=BX, 3=BK, 4=QN, 5=SI
    block: text("block"),
    lot: text("lot"),
    unitDesignation: text("unit_designation"), // Unit label from DOF
    address: text("address"), // Normalized address from DOF
    zipCode: text("zip_code"),
    metadata: text("metadata", { mode: "json" }), // Additional DOF attributes
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_condo_unit_bbl").on(table.unitBbl),
    index("idx_condo_base_bbl").on(table.baseBbl),
    index("idx_condo_address").on(table.address),
  ]
);

export const insertCondoRegistrySchema = createInsertSchema(condoRegistry, { createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCondoRegistry = z.infer<typeof insertCondoRegistrySchema>;
export type CondoRegistry = typeof condoRegistry.$inferSelect;

// Condo Units - first-class unit entities that can receive sales/signals
// Populated from condo_registry with inherited building data
export const unitTypeHints = ["residential", "parking", "storage", "commercial", "other"] as const;
export type UnitTypeHint = typeof unitTypeHints[number];

export const condoUnits = sqliteTable(
  "condo_units",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    unitBbl: text("unit_bbl").notNull().unique(),
    baseBbl: text("base_bbl").notNull(),
    condoNumber: text("condo_number"),
    unitDesignation: text("unit_designation"),
    unitTypeHint: text("unit_type_hint").default("residential"),
    buildingPropertyId: text("building_property_id").references(() => properties.id),
    buildingDisplayAddress: text("building_display_address"),
    unitDisplayAddress: text("unit_display_address"),
    slug: text("slug").unique(),
    bin: text("bin"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    borough: text("borough"),
    zipCode: text("zip_code"),
    // Unit specifications (for future data enrichment)
    beds: integer("beds"),
    baths: real("baths"),
    sqft: integer("sqft"),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_condo_units_unit_bbl").on(table.unitBbl),
    index("idx_condo_units_base_bbl").on(table.baseBbl),
    index("idx_condo_units_building").on(table.buildingPropertyId),
    index("idx_condo_units_address").on(table.unitDisplayAddress),
    index("idx_condo_units_type_hint").on(table.unitTypeHint),
    index("idx_condo_units_slug").on(table.slug),
  ]
);

export const insertCondoUnitSchema = createInsertSchema(condoUnits, { createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCondoUnit = z.infer<typeof insertCondoUnitSchema>;
export type CondoUnit = typeof condoUnits.$inferSelect;

// Buildings - authoritative parent inventory for condo units
// Keyed by baseBbl, populated from distinct baseBbls in condo_units
export const buildings = sqliteTable(
  "buildings",
  {
    baseBbl: text("base_bbl").primaryKey(),
    displayAddress: text("display_address"),
    bin: text("bin"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    borough: text("borough"),
    zipCode: text("zip_code"),
    unitCount: integer("unit_count").default(0),
    residentialUnitCount: integer("residential_unit_count").default(0),
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_buildings_address").on(table.displayAddress),
    index("idx_buildings_borough").on(table.borough),
    index("idx_buildings_zip").on(table.zipCode),
  ]
);

export const insertBuildingSchema = createInsertSchema(buildings, { createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildings.$inferSelect;

// Cached AI-generated narratives for unit/property SEO pages.
// Regenerated quarterly (90 days) so crawlers see substantive unique prose.
export const pageNarratives = sqliteTable(
  "page_narratives",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    kind: text("kind").notNull(),
    refId: text("ref_id").notNull(),
    narrative: text("narrative").notNull(),
    model: text("model"),
    generatedAt: timestamp("generated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    uniqueIndex("page_narratives_kind_ref").on(table.kind, table.refId),
  ]
);

export type PageNarrative = typeof pageNarratives.$inferSelect;

// Entity Resolution Map - tracks source record mappings to properties
// Supports multiple match types with confidence scoring
export const matchTypes = ["bbl_exact", "unit_registry", "address_normalized", "address_fuzzy", "geoclient"] as const;
export type MatchType = typeof matchTypes[number];

export const entityResolutionMap = sqliteTable(
  "entity_resolution_map",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    sourceSystem: text("source_system").notNull(), // e.g., "nyc_sales", "pluto", "acris"
    sourceRecordId: text("source_record_id").notNull(), // Original record ID from source
    sourceBbl: text("source_bbl"), // BBL as provided by source
    matchedPropertyId: text("matched_property_id").references(() => properties.id),
    matchType: text("match_type").notNull(), // bbl_exact, unit_registry, address_normalized, address_fuzzy
    matchConfidence: real("match_confidence").notNull(), // 0.0-1.0
    matchMetadata: text("match_metadata", { mode: "json" }), // Details about match (normalized address, etc.)
    createdAt: timestamp("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    updatedAt: timestamp("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
  },
  (table) => [
    index("idx_erm_source").on(table.sourceSystem, table.sourceRecordId),
    index("idx_erm_property").on(table.matchedPropertyId),
    index("idx_erm_bbl").on(table.sourceBbl),
    uniqueIndex("idx_erm_unique_match").on(table.sourceSystem, table.sourceRecordId),
  ]
);

export const insertEntityResolutionSchema = createInsertSchema(entityResolutionMap, { createdAt: () => z.date(), updatedAt: () => z.date() }).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEntityResolution = z.infer<typeof insertEntityResolutionSchema>;
export type EntityResolution = typeof entityResolutionMap.$inferSelect;

// Usage Tracking for Free tier limits
export const usageTracking = sqliteTable(
  "usage_tracking",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => users.id),
    actionType: text("action_type").notNull(), // search, property_unlock, pdf_export
    actionDate: timestamp("action_date").default(sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')`),
    propertyId: text("property_id"), // Optional reference to property
    metadata: text("metadata", { mode: "json" }), // Additional context
  },
  (table) => [
    index("idx_usage_user_type_date").on(table.userId, table.actionType, table.actionDate),
  ]
);

export const insertUsageTrackingSchema = createInsertSchema(usageTracking, { actionDate: () => z.date() }).omit({
  id: true,
  actionDate: true,
});

export * from "./dataPlatformSchema";
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type UsageTracking = typeof usageTracking.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  watchlists: many(watchlists),
  alerts: many(alerts),
  notifications: many(notifications),
  aiChats: many(aiChats),
  savedSearches: many(savedSearches),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one, many }) => ({
  user: one(users, { fields: [savedSearches.userId], references: [users.id] }),
  notifications: many(savedSearchNotifications),
}));

export const savedSearchNotificationsRelations = relations(savedSearchNotifications, ({ one }) => ({
  savedSearch: one(savedSearches, { fields: [savedSearchNotifications.savedSearchId], references: [savedSearches.id] }),
  user: one(users, { fields: [savedSearchNotifications.userId], references: [users.id] }),
}));

export const propertyChangesRelations = relations(propertyChanges, ({ one }) => ({
  property: one(properties, { fields: [propertyChanges.propertyId], references: [properties.id] }),
}));

export const propertiesRelations = relations(properties, ({ many }) => ({
  sales: many(sales),
  compsAsSubject: many(comps, { relationName: "subjectProperty" }),
  compsAsComp: many(comps, { relationName: "compProperty" }),
}));

export const watchlistsRelations = relations(watchlists, ({ one, many }) => ({
  user: one(users, { fields: [watchlists.userId], references: [users.id] }),
  properties: many(watchlistProperties),
  alerts: many(alerts),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  user: one(users, { fields: [alerts.userId], references: [users.id] }),
  watchlist: one(watchlists, { fields: [alerts.watchlistId], references: [watchlists.id] }),
  property: one(properties, { fields: [alerts.propertyId], references: [properties.id] }),
}));

// Opportunity Score breakdown type
export type OpportunityScoreBreakdown = {
  overall: number;
  mispricing: number;
  confidence: number;
  liquidity: number;
  risk: number;
  valueAdd: number;
  explanations: string[];
  evidence: { type: string; id: string; description: string }[];
};

// AI Response type
export type AIResponse = {
  answerSummary: string;
  keyNumbers: { label: string; value: string; unit?: string }[];
  evidence: { type: string; id: string; description: string }[];
  confidence: ConfidenceLevel;
  limitations: string[];
};

// Filter types for screener
export type ScreenerFilters = {
  state?: State;
  zipCodes?: string[];
  cities?: string[];
  propertyTypes?: PropertyType[];
  bedsBands?: string[];
  bathsBands?: string[];
  yearBuiltBands?: string[];
  sizeBands?: string[];
  priceMin?: number;
  priceMax?: number;
  opportunityScoreMin?: number;
  confidenceLevels?: ConfidenceLevel[];
};

// Up and Coming ZIP code type
export type UpAndComingZip = {
  zipCode: string;
  city: string;
  state: string;
  trendScore: number; // 0-100 composite score
  trend12m: number | null; // YoY appreciation %
  trend6m: number | null; // 6-month trend %
  trend3m: number | null; // 3-month trend %
  medianPrice: number | null;
  medianPricePerSqft: number | null;
  transactionCount: number | null;
  avgOpportunityScore: number | null;
  propertyCount: number;
  momentum: "accelerating" | "steady" | "decelerating";
  latitude: number | null;
  longitude: number | null;
};

// Flat ZIP-level summary returned by the external /api/external/zip/:zipCode endpoint
export type ZipMarketSummary = {
  zipCode: string;
  city: string | null;
  state: string | null;
  medianPrice: number | null;
  medianPricePerSqft: number | null;
  p25Price: number | null;
  p75Price: number | null;
  p25PricePerSqft: number | null;
  p75PricePerSqft: number | null;
  transactionCount: number | null;
  trend3m: number | null;
  trend6m: number | null;
  trend12m: number | null;
  computedAt: Date | null;
};
