import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Subscription tiers
export const subscriptionTiers = ["free", "pro"] as const;
export type SubscriptionTier = typeof subscriptionTiers[number];

// User storage table for username/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // user, admin
  subscriptionTier: varchar("subscription_tier").default("free"), // free, pro
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status"), // active, canceled, past_due, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
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
export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    hashedKey: varchar("hashed_key").notNull(),
    prefix: varchar("prefix").notNull(), // First 8 chars for quick lookup (e.g., "rd_live_")
    lastFour: varchar("last_four").notNull(), // Last 4 chars for display
    name: varchar("name").default("Default API Key"),
    status: varchar("status").default("active"), // active, revoked
    lastUsedAt: timestamp("last_used_at"),
    requestCount: integer("request_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_api_keys_user").on(table.userId),
    index("idx_api_keys_prefix").on(table.prefix),
  ]
);

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
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
export const properties = pgTable(
  "properties",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    bbl: varchar("bbl"), // Borough-Block-Lot: master key for NYC properties
    address: text("address").notNull(),
    city: varchar("city").notNull(),
    state: varchar("state").notNull(),
    zipCode: varchar("zip_code").notNull(),
    county: varchar("county"),
    neighborhood: varchar("neighborhood"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    propertyType: varchar("property_type").notNull(),
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
    confidenceLevel: varchar("confidence_level"),
    imageUrl: text("image_url"),
    dataSources: text("data_sources").array(), // Track which datasets contributed
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_properties_bbl").on(table.bbl),
    index("idx_properties_zip").on(table.zipCode),
    index("idx_properties_city").on(table.city),
    index("idx_properties_state").on(table.state),
  ]
);

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Sales/Transactions table
export const sales = pgTable(
  "sales",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id),
    salePrice: integer("sale_price").notNull(),
    saleDate: timestamp("sale_date").notNull(),
    armsLength: boolean("arms_length").default(true),
    deedType: varchar("deed_type"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_sales_property").on(table.propertyId)]
);

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

// Market Aggregates table - precomputed stats per geography and segment
export const marketAggregates = pgTable(
  "market_aggregates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    geoType: varchar("geo_type").notNull(), // zip, city, county, neighborhood
    geoId: varchar("geo_id").notNull(),
    geoName: varchar("geo_name").notNull(),
    state: varchar("state").notNull(),
    propertyType: varchar("property_type"),
    bedsBand: varchar("beds_band"),
    bathsBand: varchar("baths_band"),
    yearBuiltBand: varchar("year_built_band"),
    sizeBand: varchar("size_band"),
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
    computedAt: timestamp("computed_at").defaultNow(),
  },
  (table) => [
    index("idx_aggregates_geo").on(table.geoType, table.geoId),
    index("idx_aggregates_state").on(table.state),
  ]
);

export const insertMarketAggregateSchema = createInsertSchema(marketAggregates).omit({
  id: true,
  computedAt: true,
});
export type InsertMarketAggregate = z.infer<typeof insertMarketAggregateSchema>;
export type MarketAggregate = typeof marketAggregates.$inferSelect;

// Coverage Matrix - data quality by geography
export const coverageMatrix = pgTable(
  "coverage_matrix",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    state: varchar("state").notNull(),
    county: varchar("county"),
    zipCode: varchar("zip_code"),
    coverageLevel: varchar("coverage_level").notNull(),
    freshnessSla: integer("freshness_sla_days").default(30),
    sqftCompleteness: real("sqft_completeness"),
    yearBuiltCompleteness: real("year_built_completeness"),
    lastSaleCompleteness: real("last_sale_completeness"),
    confidenceScore: real("confidence_score"),
    allowedAiClaims: text("allowed_ai_claims").array(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_coverage_state").on(table.state)]
);

export const insertCoverageMatrixSchema = createInsertSchema(coverageMatrix).omit({
  id: true,
  updatedAt: true,
});
export type InsertCoverageMatrix = z.infer<typeof insertCoverageMatrixSchema>;
export type CoverageMatrix = typeof coverageMatrix.$inferSelect;

// Watchlists
export const watchlists = pgTable(
  "watchlists",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    name: varchar("name").notNull(),
    geoType: varchar("geo_type"), // zip, city, neighborhood
    geoId: varchar("geo_id"),
    filters: jsonb("filters"), // stored filter criteria
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("idx_watchlists_user").on(table.userId)]
);

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type Watchlist = typeof watchlists.$inferSelect;

// Watchlist Properties (saved properties)
export const watchlistProperties = pgTable(
  "watchlist_properties",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    watchlistId: varchar("watchlist_id").references(() => watchlists.id).notNull(),
    propertyId: varchar("property_id").references(() => properties.id).notNull(),
    addedAt: timestamp("added_at").defaultNow(),
    notes: text("notes"),
  },
  (table) => [index("idx_watchlist_props").on(table.watchlistId)]
);

export const insertWatchlistPropertySchema = createInsertSchema(watchlistProperties).omit({
  id: true,
  addedAt: true,
});
export type InsertWatchlistProperty = z.infer<typeof insertWatchlistPropertySchema>;
export type WatchlistProperty = typeof watchlistProperties.$inferSelect;

// Alerts
export const alerts = pgTable(
  "alerts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    watchlistId: varchar("watchlist_id").references(() => watchlists.id),
    propertyId: varchar("property_id").references(() => properties.id),
    alertType: varchar("alert_type").notNull(), // score_threshold, price_cut, new_comp, market_shift
    threshold: real("threshold"),
    isActive: boolean("is_active").default(true),
    lastTriggered: timestamp("last_triggered"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_alerts_user").on(table.userId)]
);

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  lastTriggered: true,
  createdAt: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Notifications
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    alertId: varchar("alert_id").references(() => alerts.id),
    title: varchar("title").notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_notifications_user").on(table.userId)]
);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Comps (comparable properties)
export const comps = pgTable(
  "comps",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    subjectPropertyId: varchar("subject_property_id").references(() => properties.id).notNull(),
    compPropertyId: varchar("comp_property_id").references(() => properties.id).notNull(),
    similarityScore: real("similarity_score"),
    sqftAdjustment: real("sqft_adjustment"),
    ageAdjustment: real("age_adjustment"),
    bedsAdjustment: real("beds_adjustment"),
    adjustedPrice: integer("adjusted_price"),
    computedAt: timestamp("computed_at").defaultNow(),
  },
  (table) => [index("idx_comps_subject").on(table.subjectPropertyId)]
);

export const insertCompSchema = createInsertSchema(comps).omit({
  id: true,
  computedAt: true,
});
export type InsertComp = z.infer<typeof insertCompSchema>;
export type Comp = typeof comps.$inferSelect;

// Data Sources (for admin catalog)
export const dataSources = pgTable("data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // public, paid, internal
  description: text("description"),
  refreshCadence: varchar("refresh_cadence"), // daily, weekly, monthly
  lastRefresh: timestamp("last_refresh"),
  recordCount: integer("record_count"),
  licensingNotes: text("licensing_notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
});
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

// AI Chat History
export const aiChats = pgTable(
  "ai_chats",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    propertyId: varchar("property_id").references(() => properties.id),
    geoId: varchar("geo_id"),
    question: text("question").notNull(),
    response: jsonb("response").notNull(), // structured JSON response
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_ai_chats_user").on(table.userId)]
);

export const insertAiChatSchema = createInsertSchema(aiChats).omit({
  id: true,
  createdAt: true,
});
export type InsertAiChat = z.infer<typeof insertAiChatSchema>;
export type AiChat = typeof aiChats.$inferSelect;

// ============================================
// STAGING TABLES - Raw data from each source
// ============================================

// PLUTO Raw Data - Full NYC tax lot data
export const plutoRaw = pgTable(
  "pluto_raw",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    bbl: varchar("bbl").notNull(),
    borough: varchar("borough"),
    block: varchar("block"),
    lot: varchar("lot"),
    address: text("address"),
    zipCode: varchar("zip_code"),
    bldgClass: varchar("bldg_class"),
    landUse: varchar("land_use"),
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
    condoNo: varchar("condo_no"),
    xCoord: real("x_coord"),
    yCoord: real("y_coord"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    communityDistrict: varchar("community_district"),
    zoneDist1: varchar("zone_dist_1"),
    zoneDist2: varchar("zone_dist_2"),
    overlay1: varchar("overlay_1"),
    overlay2: varchar("overlay_2"),
    spdist1: varchar("spdist_1"),
    spdist2: varchar("spdist_2"),
    assessLand: integer("assess_land"),
    assessTot: integer("assess_tot"),
    exemptLand: integer("exempt_land"),
    exemptTot: integer("exempt_tot"),
    rawData: jsonb("raw_data"), // Store full record for reference
    importedAt: timestamp("imported_at").defaultNow(),
  },
  (table) => [
    index("idx_pluto_bbl").on(table.bbl),
    index("idx_pluto_zip").on(table.zipCode),
  ]
);

export type PlutoRaw = typeof plutoRaw.$inferSelect;

// Property Valuation Raw Data - Tax assessment data
export const valuationsRaw = pgTable(
  "valuations_raw",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    bbl: varchar("bbl").notNull(),
    borough: varchar("borough"),
    block: varchar("block"),
    lot: varchar("lot"),
    taxClass: varchar("tax_class"),
    buildingClass: varchar("building_class"),
    ownerName: text("owner_name"),
    address: text("address"),
    aptNo: varchar("apt_no"),
    zipCode: varchar("zip_code"),
    assessYear: integer("assess_year"),
    landValue: integer("land_value"),
    totalValue: integer("total_value"),
    transitionalLand: integer("transitional_land"),
    transitionalTotal: integer("transitional_total"),
    newLandValue: integer("new_land_value"),
    newTotalValue: integer("new_total_value"),
    exemptionCodeOne: varchar("exemption_code_one"),
    exemptionCodeTwo: varchar("exemption_code_two"),
    exemptionCodeThree: varchar("exemption_code_three"),
    exemptionCodeFour: varchar("exemption_code_four"),
    rawData: jsonb("raw_data"),
    importedAt: timestamp("imported_at").defaultNow(),
  },
  (table) => [
    index("idx_valuations_bbl").on(table.bbl),
    index("idx_valuations_year").on(table.assessYear),
  ]
);

export type ValuationsRaw = typeof valuationsRaw.$inferSelect;

// ACRIS Raw Data - Deed and mortgage transactions
export const acrisRaw = pgTable(
  "acris_raw",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: varchar("document_id").notNull(),
    recordType: varchar("record_type"), // MASTER, LEGAL, PARTY
    bbl: varchar("bbl"),
    borough: varchar("borough"),
    block: varchar("block"),
    lot: varchar("lot"),
    docType: varchar("doc_type"), // DEED, MTGE, ASST, etc.
    docDate: timestamp("doc_date"),
    recordedDateTime: timestamp("recorded_date_time"),
    docAmount: real("doc_amount"),
    percentTransferred: real("percent_transferred"),
    goodThroughDate: timestamp("good_through_date"),
    partyType: varchar("party_type"), // buyer, seller, lender
    partyName: text("party_name"),
    partyAddress: text("party_address"),
    streetNumber: varchar("street_number"),
    streetName: text("street_name"),
    unit: varchar("unit"),
    city: varchar("city"),
    state: varchar("state"),
    country: varchar("country"),
    rawData: jsonb("raw_data"),
    importedAt: timestamp("imported_at").defaultNow(),
  },
  (table) => [
    index("idx_acris_bbl").on(table.bbl),
    index("idx_acris_doc").on(table.documentId),
    index("idx_acris_date").on(table.recordedDateTime),
  ]
);

export type AcrisRaw = typeof acrisRaw.$inferSelect;

// HPD Raw Data - Building registrations, violations, complaints
export const hpdRaw = pgTable(
  "hpd_raw",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    bbl: varchar("bbl"),
    buildingId: varchar("building_id"),
    registrationId: varchar("registration_id"),
    boroId: varchar("boro_id"),
    borough: varchar("borough"),
    block: varchar("block"),
    lot: varchar("lot"),
    houseNumber: varchar("house_number"),
    streetName: text("street_name"),
    zipCode: varchar("zip_code"),
    registrationStatus: varchar("registration_status"),
    buildingOwnerName: text("building_owner_name"),
    buildingOwnerPhone: varchar("building_owner_phone"),
    buildingOwnerEmail: text("building_owner_email"),
    agentName: text("agent_name"),
    agentPhone: varchar("agent_phone"),
    agentAddress: text("agent_address"),
    numFloors: integer("num_floors"),
    numApartments: integer("num_apartments"),
    numLegalUnits: integer("num_legal_units"),
    totalViolations: integer("total_violations"),
    openViolations: integer("open_violations"),
    totalComplaints: integer("total_complaints"),
    openComplaints: integer("open_complaints"),
    lastInspectionDate: timestamp("last_inspection_date"),
    rawData: jsonb("raw_data"),
    importedAt: timestamp("imported_at").defaultNow(),
  },
  (table) => [
    index("idx_hpd_bbl").on(table.bbl),
    index("idx_hpd_building").on(table.buildingId),
  ]
);

export type HpdRaw = typeof hpdRaw.$inferSelect;

// ============================================
// NORMALIZED TABLES - Processed and linked data
// ============================================

// Property Valuations - Historical tax assessments
export const propertyValuations = pgTable(
  "property_valuations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id),
    bbl: varchar("bbl").notNull(),
    assessYear: integer("assess_year").notNull(),
    taxClass: varchar("tax_class"),
    landValue: integer("land_value"),
    totalValue: integer("total_value"),
    exemptionAmount: integer("exemption_amount"),
    taxableValue: integer("taxable_value"),
    annualTax: integer("annual_tax"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_prop_val_property").on(table.propertyId),
    index("idx_prop_val_bbl").on(table.bbl),
    index("idx_prop_val_year").on(table.assessYear),
  ]
);

export type PropertyValuation = typeof propertyValuations.$inferSelect;

// Property Transactions - All deed/mortgage activity
export const propertyTransactions = pgTable(
  "property_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id),
    bbl: varchar("bbl").notNull(),
    documentId: varchar("document_id"),
    transactionType: varchar("transaction_type").notNull(), // sale, mortgage, refinance, transfer
    transactionDate: timestamp("transaction_date").notNull(),
    amount: real("amount"),
    buyerName: text("buyer_name"),
    sellerName: text("seller_name"),
    lenderName: text("lender_name"),
    isArmsLength: boolean("is_arms_length").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_prop_tx_property").on(table.propertyId),
    index("idx_prop_tx_bbl").on(table.bbl),
    index("idx_prop_tx_date").on(table.transactionDate),
  ]
);

export type PropertyTransaction = typeof propertyTransactions.$inferSelect;

// Property Compliance - HPD violations and complaints
export const propertyCompliance = pgTable(
  "property_compliance",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id),
    bbl: varchar("bbl").notNull(),
    registrationStatus: varchar("registration_status"),
    totalViolations: integer("total_violations").default(0),
    openViolations: integer("open_violations").default(0),
    hazardousViolations: integer("hazardous_violations").default(0),
    totalComplaints: integer("total_complaints").default(0),
    openComplaints: integer("open_complaints").default(0),
    lastInspectionDate: timestamp("last_inspection_date"),
    complianceScore: integer("compliance_score"), // 0-100, higher is better
    riskLevel: varchar("risk_level"), // low, medium, high
    updatedAt: timestamp("updated_at").defaultNow(),
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
export const propertyProfiles = pgTable(
  "property_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id).notNull(),
    bbl: varchar("bbl"),
    
    // Consolidated metrics
    currentValue: integer("current_value"),
    valueConfidence: real("value_confidence"),
    priceHistory: jsonb("price_history"), // Array of {date, price, source}
    
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
    sourcesUsed: text("sources_used").array(),
    lastEnrichedAt: timestamp("last_enriched_at"),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_profile_property").on(table.propertyId),
    index("idx_profile_bbl").on(table.bbl),
    index("idx_profile_opportunity").on(table.opportunityScore),
  ]
);

export type PropertyProfile = typeof propertyProfiles.$inferSelect;

// AI Insights - Stored AI analysis results
export const aiInsights = pgTable(
  "ai_insights",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id),
    bbl: varchar("bbl"),
    insightType: varchar("insight_type").notNull(), // opportunity_analysis, deal_memo, market_comparison, risk_assessment
    
    // AI-generated content
    summary: text("summary"),
    keyFindings: jsonb("key_findings"), // Array of {finding, confidence, evidence}
    recommendations: jsonb("recommendations"), // Array of {action, impact, priority}
    citations: jsonb("citations"), // Array of {source, dataPoint, value}
    
    // Metadata
    modelUsed: varchar("model_used"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    confidence: real("confidence"),
    
    createdAt: timestamp("created_at").defaultNow(),
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
export const propertyDataLinks = pgTable(
  "property_data_links",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    propertyId: varchar("property_id").references(() => properties.id).notNull(),
    bbl: varchar("bbl"),
    sourceType: varchar("source_type").notNull(), // PLUTO, Valuations, ACRIS, HPD
    sourceRecordId: varchar("source_record_id").notNull(),
    matchType: varchar("match_type").notNull(), // bbl, address, fuzzy
    matchConfidence: real("match_confidence"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_data_links_property").on(table.propertyId),
    index("idx_data_links_bbl").on(table.bbl),
    index("idx_data_links_source").on(table.sourceType),
  ]
);

export type PropertyDataLink = typeof propertyDataLinks.$inferSelect;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  watchlists: many(watchlists),
  alerts: many(alerts),
  notifications: many(notifications),
  aiChats: many(aiChats),
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
  transactionCount: number | null;
  avgOpportunityScore: number | null;
  propertyCount: number;
  momentum: "accelerating" | "steady" | "decelerating";
  latitude: number | null;
  longitude: number | null;
};
