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

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Property Types Enum
export const propertyTypes = ["SFH", "Condo", "Townhome", "Multi-family 2-4", "Multi-family 5+"] as const;
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

// Properties table
export const properties = pgTable(
  "properties",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
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
