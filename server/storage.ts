import { eq, and, desc, gte, lte, inArray, sql, or, ilike } from "drizzle-orm";
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
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Property operations
  getProperty(id: string): Promise<Property | undefined>;
  getProperties(filters: ScreenerFilters, limit?: number, offset?: number): Promise<Property[]>;
  getTopOpportunities(limit?: number): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined>;
  
  // Sales operations
  getSalesForProperty(propertyId: string): Promise<Sale[]>;
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
}

export const storage = new DatabaseStorage();
