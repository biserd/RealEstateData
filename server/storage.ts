import { eq, and, desc, gte, lte, inArray, sql, or, ilike, isNotNull } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  properties,
  sales,
  marketAggregates,
  coverageMatrix,
  watchlists,
  watchlistProperties,
  alerts,
  notifications,
  comps,
  dataSources,
  aiChats,
  type User,
  type UpsertUser,
  type Property,
  type InsertProperty,
  type Sale,
  type InsertSale,
  type MarketAggregate,
  type InsertMarketAggregate,
  type CoverageMatrix,
  type InsertCoverageMatrix,
  type Watchlist,
  type InsertWatchlist,
  type WatchlistProperty,
  type InsertWatchlistProperty,
  type Alert,
  type InsertAlert,
  type Notification,
  type InsertNotification,
  type Comp,
  type InsertComp,
  type DataSource,
  type InsertDataSource,
  type AiChat,
  type InsertAiChat,
  type ScreenerFilters,
  type UpAndComingZip,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Property operations
  getProperty(id: string): Promise<Property | undefined>;
  getProperties(filters: ScreenerFilters, limit?: number, offset?: number): Promise<Property[]>;
  getPropertiesByArea(geoType: string, geoId: string, limit?: number): Promise<Property[]>;
  getTopOpportunities(limit?: number): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined>;
  
  // Sales operations
  getSalesForProperty(propertyId: string): Promise<Sale[]>;
  getRecentSalesForArea(geoType: string, geoId: string, limit?: number): Promise<(Sale & { property: Property })[]>;
  createSale(sale: InsertSale): Promise<Sale>;
  
  // Market aggregate operations
  getMarketAggregates(geoType: string, geoId: string, filters?: any): Promise<MarketAggregate[]>;
  getMarketOverview(): Promise<MarketAggregate[]>;
  createMarketAggregate(aggregate: InsertMarketAggregate): Promise<MarketAggregate>;
  
  // Geo search
  searchGeo(query: string): Promise<Array<{ type: string; id: string; name: string; state: string }>>;
  
  // Coverage matrix operations
  getCoverageMatrix(state?: string): Promise<CoverageMatrix[]>;
  createCoverageMatrix(coverage: InsertCoverageMatrix): Promise<CoverageMatrix>;
  
  // Watchlist operations
  getWatchlists(userId: string): Promise<Watchlist[]>;
  getWatchlist(id: string): Promise<Watchlist | undefined>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  deleteWatchlist(id: string): Promise<void>;
  
  // Watchlist property operations
  getWatchlistProperties(watchlistId: string): Promise<Property[]>;
  addPropertyToWatchlist(data: InsertWatchlistProperty): Promise<WatchlistProperty>;
  removePropertyFromWatchlist(watchlistId: string, propertyId: string): Promise<void>;
  
  // Alert operations
  getAlerts(userId: string): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  updateAlert(id: string, alert: Partial<InsertAlert>): Promise<Alert | undefined>;
  
  // Notification operations
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  
  // Comps operations
  getComps(propertyId: string): Promise<(Comp & { property: Property })[]>;
  createComp(comp: InsertComp): Promise<Comp>;
  
  // Data source operations
  getDataSources(): Promise<DataSource[]>;
  createDataSource(source: InsertDataSource): Promise<DataSource>;
  
  // AI chat operations
  getAiChats(userId: string): Promise<AiChat[]>;
  createAiChat(chat: InsertAiChat): Promise<AiChat>;
  
  // Up and coming ZIP codes
  getUpAndComingZips(state?: string, limit?: number): Promise<UpAndComingZip[]>;
  
  // Platform statistics
  getPlatformStats(): Promise<{
    properties: number;
    sales: number;
    marketAggregates: number;
    comps: number;
    aiChats: number;
    dataSources: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.email) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email));
      
      if (existingByEmail) {
        const [updated] = await db
          .update(users)
          .set({
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return updated;
      }
    }

    const [existingById] = await db
      .select()
      .from(users)
      .where(eq(users.id, userData.id || ""));
    
    if (existingById) {
      const [updated] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingById.id))
        .returning();
      return updated;
    }

    const [newUser] = await db
      .insert(users)
      .values(userData)
      .returning();
    return newUser;
  }

  // Property operations
  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async getProperties(filters: ScreenerFilters, limit = 50, offset = 0): Promise<Property[]> {
    const conditions = [];
    
    if (filters.state) {
      conditions.push(eq(properties.state, filters.state));
    }
    if (filters.zipCodes && filters.zipCodes.length > 0) {
      conditions.push(inArray(properties.zipCode, filters.zipCodes));
    }
    if (filters.cities && filters.cities.length > 0) {
      conditions.push(inArray(properties.city, filters.cities));
    }
    if (filters.propertyTypes && filters.propertyTypes.length > 0) {
      conditions.push(inArray(properties.propertyType, filters.propertyTypes));
    }
    if (filters.priceMin) {
      conditions.push(gte(properties.estimatedValue, filters.priceMin));
    }
    if (filters.priceMax) {
      conditions.push(lte(properties.estimatedValue, filters.priceMax));
    }
    if (filters.opportunityScoreMin) {
      conditions.push(gte(properties.opportunityScore, filters.opportunityScoreMin));
    }
    if (filters.confidenceLevels && filters.confidenceLevels.length > 0) {
      conditions.push(inArray(properties.confidenceLevel, filters.confidenceLevels));
    }

    const query = conditions.length > 0
      ? db.select().from(properties).where(and(...conditions))
      : db.select().from(properties);
    
    return await query
      .orderBy(desc(properties.opportunityScore))
      .limit(limit)
      .offset(offset);
  }

  async getPropertiesByArea(geoType: string, geoId: string, limit = 50): Promise<Property[]> {
    let condition;
    
    switch (geoType.toLowerCase()) {
      case "zip":
        condition = eq(properties.zipCode, geoId);
        break;
      case "city":
        condition = eq(properties.city, geoId);
        break;
      case "state":
        condition = eq(properties.state, geoId);
        break;
      case "neighborhood":
        condition = eq(properties.neighborhood, geoId);
        break;
      default:
        return [];
    }

    return await db
      .select()
      .from(properties)
      .where(and(condition, isNotNull(properties.latitude), isNotNull(properties.longitude)))
      .orderBy(desc(properties.opportunityScore))
      .limit(limit);
  }

  async getTopOpportunities(limit = 10): Promise<Property[]> {
    return await db
      .select()
      .from(properties)
      .where(gte(properties.opportunityScore, 70))
      .orderBy(desc(properties.opportunityScore))
      .limit(limit);
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [created] = await db.insert(properties).values(property).returning();
    return created;
  }

  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined> {
    const [updated] = await db
      .update(properties)
      .set({ ...property, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  // Sales operations
  async getSalesForProperty(propertyId: string): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.propertyId, propertyId))
      .orderBy(desc(sales.saleDate));
  }

  async getRecentSalesForArea(geoType: string, geoId: string, limit = 20): Promise<(Sale & { property: Property })[]> {
    let whereCondition;
    
    if (geoType === "zip") {
      whereCondition = eq(properties.zipCode, geoId);
    } else if (geoType === "city") {
      whereCondition = eq(properties.city, geoId);
    } else if (geoType === "neighborhood") {
      whereCondition = eq(properties.neighborhood, geoId);
    } else if (geoType === "state") {
      whereCondition = eq(properties.state, geoId);
    } else {
      return [];
    }
    
    const results = await db
      .select({
        sale: sales,
        property: properties,
      })
      .from(sales)
      .innerJoin(properties, eq(sales.propertyId, properties.id))
      .where(whereCondition)
      .orderBy(desc(sales.saleDate))
      .limit(limit);
    
    return results.map((r) => ({
      ...r.sale,
      property: r.property,
    }));
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const [created] = await db.insert(sales).values(sale).returning();
    return created;
  }

  // Market aggregate operations
  async getMarketAggregates(geoType: string, geoId: string, filters?: any): Promise<MarketAggregate[]> {
    const conditions = [
      eq(marketAggregates.geoType, geoType),
      eq(marketAggregates.geoId, geoId),
    ];
    
    if (filters?.propertyType && filters.propertyType !== "all") {
      conditions.push(eq(marketAggregates.propertyType, filters.propertyType));
    }
    if (filters?.bedsBand && filters.bedsBand !== "all") {
      conditions.push(eq(marketAggregates.bedsBand, filters.bedsBand));
    }
    if (filters?.yearBuiltBand && filters.yearBuiltBand !== "all") {
      conditions.push(eq(marketAggregates.yearBuiltBand, filters.yearBuiltBand));
    }

    return await db
      .select()
      .from(marketAggregates)
      .where(and(...conditions))
      .orderBy(desc(marketAggregates.computedAt))
      .limit(1);
  }

  async getMarketOverview(): Promise<MarketAggregate[]> {
    return await db
      .select()
      .from(marketAggregates)
      .where(eq(marketAggregates.geoType, "state"))
      .orderBy(marketAggregates.state);
  }

  async createMarketAggregate(aggregate: InsertMarketAggregate): Promise<MarketAggregate> {
    const [created] = await db.insert(marketAggregates).values(aggregate).returning();
    return created;
  }

  // Geo search
  async searchGeo(query: string): Promise<Array<{ type: string; id: string; name: string; state: string }>> {
    // Neighborhood name to CD code mapping for common NYC neighborhoods
    const neighborhoodMappings: Record<string, { code: string; name: string; city: string }> = {
      "upper east side": { code: "CD 108", name: "Upper East Side", city: "Manhattan" },
      "upper west side": { code: "CD 107", name: "Upper West Side", city: "Manhattan" },
      "midtown": { code: "CD 105", name: "Midtown", city: "Manhattan" },
      "chelsea": { code: "CD 104", name: "Chelsea", city: "Manhattan" },
      "greenwich village": { code: "CD 102", name: "Greenwich Village", city: "Manhattan" },
      "soho": { code: "CD 102", name: "SoHo", city: "Manhattan" },
      "tribeca": { code: "CD 101", name: "Tribeca", city: "Manhattan" },
      "lower east side": { code: "CD 103", name: "Lower East Side", city: "Manhattan" },
      "east village": { code: "CD 103", name: "East Village", city: "Manhattan" },
      "harlem": { code: "CD 110", name: "Harlem", city: "Manhattan" },
      "east harlem": { code: "CD 111", name: "East Harlem", city: "Manhattan" },
      "washington heights": { code: "CD 112", name: "Washington Heights", city: "Manhattan" },
      "williamsburg": { code: "CD 301", name: "Williamsburg", city: "Brooklyn" },
      "brooklyn heights": { code: "CD 302", name: "Brooklyn Heights", city: "Brooklyn" },
      "park slope": { code: "CD 306", name: "Park Slope", city: "Brooklyn" },
      "bed stuy": { code: "CD 303", name: "Bedford-Stuyvesant", city: "Brooklyn" },
      "bedford stuyvesant": { code: "CD 303", name: "Bedford-Stuyvesant", city: "Brooklyn" },
      "bushwick": { code: "CD 304", name: "Bushwick", city: "Brooklyn" },
      "crown heights": { code: "CD 308", name: "Crown Heights", city: "Brooklyn" },
      "astoria": { code: "CD 401", name: "Astoria", city: "Queens" },
      "long island city": { code: "CD 402", name: "Long Island City", city: "Queens" },
      "flushing": { code: "CD 407", name: "Flushing", city: "Queens" },
      "jamaica": { code: "CD 412", name: "Jamaica", city: "Queens" },
      "south bronx": { code: "CD 201", name: "South Bronx", city: "Bronx" },
      "fordham": { code: "CD 205", name: "Fordham", city: "Bronx" },
      "riverdale": { code: "CD 208", name: "Riverdale", city: "Bronx" },
    };

    const queryLower = query.toLowerCase();
    const neighborhoodMatches: Array<{ type: string; id: string; name: string; state: string }> = [];
    
    // Check for neighborhood name matches
    for (const [key, value] of Object.entries(neighborhoodMappings)) {
      if (key.includes(queryLower) || queryLower.includes(key.split(" ")[0])) {
        neighborhoodMatches.push({
          type: "neighborhood",
          id: value.code,
          name: `${value.name}, ${value.city}`,
          state: "NY",
        });
      }
    }

    const zipMatches = await db
      .select({
        id: properties.zipCode,
        name: properties.zipCode,
        state: properties.state,
      })
      .from(properties)
      .where(ilike(properties.zipCode, `${query}%`))
      .groupBy(properties.zipCode, properties.state)
      .limit(5);

    const cityMatches = await db
      .select({
        id: properties.city,
        name: properties.city,
        state: properties.state,
      })
      .from(properties)
      .where(ilike(properties.city, `%${query}%`))
      .groupBy(properties.city, properties.state)
      .limit(5);

    return [
      ...neighborhoodMatches.slice(0, 5),
      ...zipMatches.map((z) => ({ type: "zip", id: z.id, name: z.name, state: z.state })),
      ...cityMatches.map((c) => ({ type: "city", id: c.id, name: c.name, state: c.state })),
    ];
  }

  // Coverage matrix operations
  async getCoverageMatrix(state?: string): Promise<CoverageMatrix[]> {
    if (state) {
      return await db.select().from(coverageMatrix).where(eq(coverageMatrix.state, state));
    }
    return await db.select().from(coverageMatrix);
  }

  async createCoverageMatrix(coverage: InsertCoverageMatrix): Promise<CoverageMatrix> {
    const [created] = await db.insert(coverageMatrix).values(coverage).returning();
    return created;
  }

  // Watchlist operations
  async getWatchlists(userId: string): Promise<Watchlist[]> {
    return await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(desc(watchlists.createdAt));
  }

  async getWatchlist(id: string): Promise<Watchlist | undefined> {
    const [watchlist] = await db.select().from(watchlists).where(eq(watchlists.id, id));
    return watchlist;
  }

  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const [created] = await db.insert(watchlists).values(watchlist).returning();
    return created;
  }

  async deleteWatchlist(id: string): Promise<void> {
    await db.delete(watchlistProperties).where(eq(watchlistProperties.watchlistId, id));
    await db.delete(alerts).where(eq(alerts.watchlistId, id));
    await db.delete(watchlists).where(eq(watchlists.id, id));
  }

  // Watchlist property operations
  async getWatchlistProperties(watchlistId: string): Promise<Property[]> {
    const result = await db
      .select({ property: properties })
      .from(watchlistProperties)
      .innerJoin(properties, eq(watchlistProperties.propertyId, properties.id))
      .where(eq(watchlistProperties.watchlistId, watchlistId));
    return result.map((r) => r.property);
  }

  async addPropertyToWatchlist(data: InsertWatchlistProperty): Promise<WatchlistProperty> {
    const [created] = await db.insert(watchlistProperties).values(data).returning();
    return created;
  }

  async removePropertyFromWatchlist(watchlistId: string, propertyId: string): Promise<void> {
    await db
      .delete(watchlistProperties)
      .where(
        and(
          eq(watchlistProperties.watchlistId, watchlistId),
          eq(watchlistProperties.propertyId, propertyId)
        )
      );
  }

  // Alert operations
  async getAlerts(userId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async updateAlert(id: string, alert: Partial<InsertAlert>): Promise<Alert | undefined> {
    const [updated] = await db
      .update(alerts)
      .set(alert)
      .where(eq(alerts.id, id))
      .returning();
    return updated;
  }

  // Notification operations
  async getNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // Comps operations
  async getComps(propertyId: string): Promise<(Comp & { property: Property })[]> {
    const result = await db
      .select()
      .from(comps)
      .innerJoin(properties, eq(comps.compPropertyId, properties.id))
      .where(eq(comps.subjectPropertyId, propertyId))
      .orderBy(desc(comps.similarityScore));
    
    return result.map((r) => ({
      ...r.comps,
      property: r.properties,
    }));
  }

  async createComp(comp: InsertComp): Promise<Comp> {
    const [created] = await db.insert(comps).values(comp).returning();
    return created;
  }

  // Data source operations
  async getDataSources(): Promise<DataSource[]> {
    return await db.select().from(dataSources).orderBy(dataSources.name);
  }

  async createDataSource(source: InsertDataSource): Promise<DataSource> {
    const [created] = await db.insert(dataSources).values(source).returning();
    return created;
  }

  // AI chat operations
  async getAiChats(userId: string): Promise<AiChat[]> {
    return await db
      .select()
      .from(aiChats)
      .where(eq(aiChats.userId, userId))
      .orderBy(desc(aiChats.createdAt))
      .limit(100);
  }

  async createAiChat(chat: InsertAiChat): Promise<AiChat> {
    const [created] = await db.insert(aiChats).values(chat).returning();
    return created;
  }

  // Up and coming ZIP codes
  async getUpAndComingZips(state?: string, limit = 25): Promise<UpAndComingZip[]> {
    // Get ZIP-level market aggregates with trend data
    const conditions = [
      eq(marketAggregates.geoType, "zip"),
      isNotNull(marketAggregates.trend12m),
    ];
    
    if (state) {
      conditions.push(eq(marketAggregates.state, state));
    }

    const zipAggregates = await db
      .select()
      .from(marketAggregates)
      .where(and(...conditions));

    // Get property counts and avg opportunity scores per ZIP
    const propertyStats = await db
      .select({
        zipCode: properties.zipCode,
        city: properties.city,
        state: properties.state,
        propertyCount: sql<number>`count(*)::int`,
        avgOpportunityScore: sql<number>`round(avg(${properties.opportunityScore}))::int`,
        avgLat: sql<number>`avg(${properties.latitude})`,
        avgLng: sql<number>`avg(${properties.longitude})`,
      })
      .from(properties)
      .where(state ? eq(properties.state, state) : sql`true`)
      .groupBy(properties.zipCode, properties.city, properties.state);

    // Combine data and calculate trend scores
    const zipMap = new Map<string, {
      aggregate: typeof zipAggregates[0];
      stats: typeof propertyStats[0] | null;
    }>();

    // Index aggregates by ZIP
    for (const agg of zipAggregates) {
      zipMap.set(agg.geoId, { aggregate: agg, stats: null });
    }

    // Match property stats
    for (const stat of propertyStats) {
      const existing = zipMap.get(stat.zipCode);
      if (existing) {
        existing.stats = stat;
      }
    }

    // Calculate trend scores and rank
    const results: UpAndComingZip[] = [];

    const entries = Array.from(zipMap.entries());
    for (const [zipCode, data] of entries) {
      const { aggregate, stats } = data;
      
      // Skip if no positive trend
      if (!aggregate.trend12m || aggregate.trend12m <= 0) continue;

      // Calculate momentum
      const trend12m = aggregate.trend12m || 0;
      const trend6m = aggregate.trend6m || 0;
      const trend3m = aggregate.trend3m || 0;
      
      let momentum: "accelerating" | "steady" | "decelerating";
      if (trend3m > trend6m && trend6m > 0) {
        momentum = "accelerating";
      } else if (trend3m < trend6m * 0.5 || trend3m < 0) {
        momentum = "decelerating";
      } else {
        momentum = "steady";
      }

      // Calculate composite trend score (0-100)
      // Components:
      // - trend12m: up to 40 points (capped at 20% annual growth = 40 points)
      // - acceleration bonus: up to 20 points (based on absolute improvement in momentum)
      // - opportunity score: up to 25 points
      // - transaction volume: up to 15 points
      
      const trend12mScore = Math.min(40, (trend12m / 20) * 40);
      
      // Use absolute delta for acceleration (avoid division by small numbers)
      // 5% improvement in 6m vs 12m trend = full 20 points
      const accelerationDelta = trend6m - trend12m;
      const accelerationScore = accelerationDelta > 0 
        ? Math.min(20, (accelerationDelta / 5) * 20)
        : 0;
      
      const avgOppScore = stats?.avgOpportunityScore || 50;
      const oppScoreComponent = (avgOppScore / 100) * 25;
      
      const txCount = aggregate.transactionCount || 0;
      const volumeScore = Math.min(15, (txCount / 50) * 15);

      const trendScore = Math.round(
        trend12mScore + accelerationScore + oppScoreComponent + volumeScore
      );

      results.push({
        zipCode,
        city: stats?.city || aggregate.geoName,
        state: aggregate.state,
        trendScore: Math.min(100, Math.max(0, trendScore)),
        trend12m: aggregate.trend12m,
        trend6m: aggregate.trend6m,
        trend3m: aggregate.trend3m,
        medianPrice: aggregate.medianPrice,
        transactionCount: aggregate.transactionCount,
        avgOpportunityScore: stats?.avgOpportunityScore || null,
        propertyCount: stats?.propertyCount || 0,
        momentum,
        latitude: stats?.avgLat || null,
        longitude: stats?.avgLng || null,
      });
    }

    // Sort by trend score descending
    results.sort((a, b) => b.trendScore - a.trendScore);

    return results.slice(0, limit);
  }

  async getPlatformStats(): Promise<{
    properties: number;
    sales: number;
    marketAggregates: number;
    comps: number;
    aiChats: number;
    dataSources: number;
  }> {
    const [propertiesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties);
    
    const [salesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales);
    
    const [marketAggregatesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketAggregates);
    
    const [compsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(comps);
    
    const [aiChatsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiChats);
    
    const [dataSourcesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dataSources);

    return {
      properties: propertiesCount?.count || 0,
      sales: salesCount?.count || 0,
      marketAggregates: marketAggregatesCount?.count || 0,
      comps: compsCount?.count || 0,
      aiChats: aiChatsCount?.count || 0,
      dataSources: dataSourcesCount?.count || 0,
    };
  }
}

export const storage = new DatabaseStorage();
