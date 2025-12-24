import { db } from "./db";
import { usageTracking, users } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export type ActionType = "search" | "property_unlock" | "pdf_export";

const FREE_TIER_LIMITS = {
  search: { daily: 5 },
  property_unlock: { daily: 3 },
  pdf_export: { weekly: 1 },
} as const;

export class UsageService {
  async trackAction(userId: string, actionType: ActionType, propertyId?: string, metadata?: Record<string, unknown>) {
    await db.insert(usageTracking).values({
      userId,
      actionType,
      propertyId: propertyId || null,
      metadata: metadata || null,
    });
  }

  async getUsageCount(userId: string, actionType: ActionType, periodDays: number): Promise<number> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    periodStart.setHours(0, 0, 0, 0);

    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.userId, userId),
          eq(usageTracking.actionType, actionType),
          gte(usageTracking.actionDate, periodStart)
        )
      );

    return Number(result[0]?.count || 0);
  }

  async getDailyUsage(userId: string, actionType: ActionType): Promise<number> {
    return this.getUsageCount(userId, actionType, 1);
  }

  async getWeeklyUsage(userId: string, actionType: ActionType): Promise<number> {
    return this.getUsageCount(userId, actionType, 7);
  }

  async checkAndTrack(userId: string, actionType: ActionType, propertyId?: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tier = user[0]?.subscriptionTier || "free";
    const status = user[0]?.subscriptionStatus;
    
    const isPaidTier = (tier === "pro" || tier === "premium") && status === "active";
    
    if (isPaidTier) {
      await this.trackAction(userId, actionType, propertyId);
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    let currentUsage: number;
    let limit: number;
    
    if (actionType === "pdf_export") {
      currentUsage = await this.getWeeklyUsage(userId, actionType);
      limit = FREE_TIER_LIMITS.pdf_export.weekly;
    } else if (actionType === "search") {
      currentUsage = await this.getDailyUsage(userId, actionType);
      limit = FREE_TIER_LIMITS.search.daily;
    } else {
      currentUsage = await this.getDailyUsage(userId, actionType);
      limit = FREE_TIER_LIMITS.property_unlock.daily;
    }

    const remaining = Math.max(0, limit - currentUsage);
    const allowed = remaining > 0;

    if (allowed) {
      await this.trackAction(userId, actionType, propertyId);
    }

    return { allowed, remaining: remaining - (allowed ? 1 : 0), limit };
  }

  async checkRemaining(userId: string, actionType: ActionType, propertyId?: string): Promise<{ remaining: number; limit: number; alreadyTracked: boolean }> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tier = user[0]?.subscriptionTier || "free";
    const status = user[0]?.subscriptionStatus;
    
    const isPaidTier = (tier === "pro" || tier === "premium") && status === "active";
    
    if (isPaidTier) {
      return { remaining: Infinity, limit: Infinity, alreadyTracked: true };
    }

    let currentUsage: number;
    let limit: number;
    
    if (actionType === "pdf_export") {
      currentUsage = await this.getWeeklyUsage(userId, actionType);
      limit = FREE_TIER_LIMITS.pdf_export.weekly;
    } else if (actionType === "search") {
      currentUsage = await this.getDailyUsage(userId, actionType);
      limit = FREE_TIER_LIMITS.search.daily;
    } else {
      currentUsage = await this.getDailyUsage(userId, actionType);
      limit = FREE_TIER_LIMITS.property_unlock.daily;
    }

    let alreadyTracked = false;
    if (propertyId && actionType === "property_unlock") {
      const periodStart = new Date();
      periodStart.setHours(0, 0, 0, 0);
      
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(usageTracking)
        .where(
          and(
            eq(usageTracking.userId, userId),
            eq(usageTracking.actionType, actionType),
            eq(usageTracking.propertyId, propertyId),
            gte(usageTracking.actionDate, periodStart)
          )
        );
      alreadyTracked = Number(existing[0]?.count || 0) > 0;
    }

    return { remaining: Math.max(0, limit - currentUsage), limit, alreadyTracked };
  }

  async getRemainingLimits(userId: string): Promise<{
    searches: { used: number; limit: number; remaining: number };
    unlocks: { used: number; limit: number; remaining: number };
    pdfs: { used: number; limit: number; remaining: number };
  }> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const tier = user[0]?.subscriptionTier || "free";
    const status = user[0]?.subscriptionStatus;
    
    const isPaidTier = (tier === "pro" || tier === "premium") && status === "active";
    
    if (isPaidTier) {
      return {
        searches: { used: 0, limit: Infinity, remaining: Infinity },
        unlocks: { used: 0, limit: Infinity, remaining: Infinity },
        pdfs: { used: 0, limit: Infinity, remaining: Infinity },
      };
    }

    const [searchesUsed, unlocksUsed, pdfsUsed] = await Promise.all([
      this.getDailyUsage(userId, "search"),
      this.getDailyUsage(userId, "property_unlock"),
      this.getWeeklyUsage(userId, "pdf_export"),
    ]);

    return {
      searches: {
        used: searchesUsed,
        limit: FREE_TIER_LIMITS.search.daily,
        remaining: Math.max(0, FREE_TIER_LIMITS.search.daily - searchesUsed),
      },
      unlocks: {
        used: unlocksUsed,
        limit: FREE_TIER_LIMITS.property_unlock.daily,
        remaining: Math.max(0, FREE_TIER_LIMITS.property_unlock.daily - unlocksUsed),
      },
      pdfs: {
        used: pdfsUsed,
        limit: FREE_TIER_LIMITS.pdf_export.weekly,
        remaining: Math.max(0, FREE_TIER_LIMITS.pdf_export.weekly - pdfsUsed),
      },
    };
  }
}

export const usageService = new UsageService();
