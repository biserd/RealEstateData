import { storage } from "./storage";
import { sendEmail } from "./emailService";
import type { SavedSearch, Property, ScreenerFilters } from "@shared/schema";

interface PropertyChange {
  id: string;
  propertyId: string;
  changeType: string;
  changeSummary: string | null;
  changedAt: Date | null;
}

interface MatchResult {
  savedSearch: SavedSearch;
  matchingProperties: Property[];
  changes: PropertyChange[];
}

export async function evaluateSavedSearch(search: SavedSearch): Promise<{ matchCount: number; properties: Property[] }> {
  const filters = search.filters as ScreenerFilters;
  const properties = await storage.getProperties(filters, 100, 0);
  return { matchCount: properties.length, properties };
}

export async function processInstantAlerts(): Promise<void> {
  console.log("Processing instant alerts...");
  
  const instantSearches = await storage.getActiveSavedSearchesByFrequency("instant");
  if (instantSearches.length === 0) {
    console.log("No instant alert searches configured");
    return;
  }
  
  const unprocessedChanges = await storage.getUnprocessedChanges(false, 500);
  if (unprocessedChanges.length === 0) {
    console.log("No unprocessed changes for instant alerts");
    return;
  }
  
  console.log(`Processing ${unprocessedChanges.length} changes for ${instantSearches.length} instant searches`);
  
  // Track which change IDs were actually included in notifications
  const processedChangeIds = new Set<string>();
  
  for (const search of instantSearches) {
    try {
      const { properties } = await evaluateSavedSearch(search);
      const matchingPropertyIds = new Set(properties.map(p => p.id));
      
      const relevantChanges = unprocessedChanges.filter(
        c => matchingPropertyIds.has(c.propertyId)
      );
      
      if (relevantChanges.length > 0) {
        const relevantProperties = properties.filter(p => 
          relevantChanges.some(c => c.propertyId === p.id)
        );
        
        const sent = await sendInstantAlert(search, relevantProperties, relevantChanges);
        
        if (sent) {
          // Only mark changes as processed if notification was sent
          for (const change of relevantChanges) {
            processedChangeIds.add(change.id);
          }
        }
        
        await storage.updateSavedSearchMatchCount(search.id, properties.length);
      }
    } catch (error) {
      console.error(`Error processing instant alert for search ${search.id}:`, error);
    }
  }
  
  // Only mark changes that were actually included in sent notifications
  if (processedChangeIds.size > 0) {
    await storage.markChangesProcessed(Array.from(processedChangeIds), false);
    console.log(`Marked ${processedChangeIds.size} changes as processed for instant alerts`);
  }
}

export async function processDailyDigest(): Promise<void> {
  console.log("Processing daily digest...");
  
  const dailySearches = await storage.getActiveSavedSearchesByFrequency("daily");
  if (dailySearches.length === 0) {
    console.log("No daily digest searches configured");
    return;
  }
  
  const unprocessedChanges = await storage.getUnprocessedChanges(true, 1000);
  console.log(`Processing ${unprocessedChanges.length} changes for ${dailySearches.length} daily searches`);
  
  const results: MatchResult[] = [];
  // Track which change IDs were actually included in notifications
  const processedChangeIds = new Set<string>();
  
  for (const search of dailySearches) {
    try {
      const { properties } = await evaluateSavedSearch(search);
      
      const relevantChanges = unprocessedChanges.filter(c => 
        properties.some(p => p.id === c.propertyId)
      );
      
      if (properties.length > 0 || relevantChanges.length > 0) {
        results.push({
          savedSearch: search,
          matchingProperties: properties,
          changes: relevantChanges,
        });
        
        // Track changes for this search
        for (const change of relevantChanges) {
          processedChangeIds.add(change.id);
        }
        
        await storage.updateSavedSearchMatchCount(search.id, properties.length);
      }
    } catch (error) {
      console.error(`Error processing daily digest for search ${search.id}:`, error);
    }
  }
  
  // Group results by user
  const userSearchMap = new Map<string, MatchResult[]>();
  for (const result of results) {
    const userId = result.savedSearch.userId;
    if (!userSearchMap.has(userId)) {
      userSearchMap.set(userId, []);
    }
    userSearchMap.get(userId)!.push(result);
  }
  
  // Send digest emails and track sent notifications
  const sentChangeIds = new Set<string>();
  
  for (const [userId, userResults] of Array.from(userSearchMap.entries())) {
    try {
      const sent = await sendDailyDigest(userId, userResults);
      
      if (sent) {
        // Only mark changes as processed if digest was sent
        for (const result of userResults) {
          for (const change of result.changes) {
            sentChangeIds.add(change.id);
          }
        }
      }
    } catch (error) {
      console.error(`Error sending daily digest to user ${userId}:`, error);
    }
  }
  
  // Only mark changes that were actually included in sent digests
  if (sentChangeIds.size > 0) {
    await storage.markChangesProcessed(Array.from(sentChangeIds), true);
    console.log(`Marked ${sentChangeIds.size} changes as processed for daily digest`);
  }
}

async function sendInstantAlert(
  search: SavedSearch, 
  properties: Property[], 
  changes: PropertyChange[]
): Promise<boolean> {
  if (!search.emailEnabled) return false;
  
  const user = await storage.getUser(search.userId);
  if (!user?.email) return false;
  
  const changesSummary = changes.slice(0, 5).map(c => 
    `• ${c.changeSummary || `Property update: ${c.changeType}`}`
  ).join('\n');
  
  const propertyList = properties.slice(0, 3).map(p => 
    `• ${p.address}, ${p.city} - $${p.estimatedValue?.toLocaleString() || 'N/A'}`
  ).join('\n');
  
  const subject = `[Alert] ${changes.length} update${changes.length > 1 ? 's' : ''} for "${search.name}"`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Property Updates for "${search.name}"</h2>
      
      <p style="color: #666;">We found ${changes.length} update${changes.length > 1 ? 's' : ''} matching your saved search:</p>
      
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0; color: #1a1a1a;">Recent Changes</h3>
        <pre style="white-space: pre-wrap; font-family: sans-serif; color: #333;">${changesSummary}</pre>
      </div>
      
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0; color: #1a1a1a;">Affected Properties</h3>
        <pre style="white-space: pre-wrap; font-family: sans-serif; color: #333;">${propertyList}</pre>
      </div>
      
      <p>
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://realtorsdashboard.com'}/screener" 
           style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View All Matches
        </a>
      </p>
      
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        You're receiving this because you have instant alerts enabled for "${search.name}".
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://realtorsdashboard.com'}/settings">Manage your alerts</a>
      </p>
    </div>
  `;
  
  const sent = await sendEmail({
    to: user.email,
    subject,
    html,
  });
  
  if (sent) {
    await storage.createSavedSearchNotification({
      savedSearchId: search.id,
      userId: search.userId,
      matchedPropertyIds: properties.map(p => p.id),
      changeIds: changes.map(c => c.id),
      notificationType: "instant_alert",
      emailSent: true,
      emailSentAt: new Date(),
      subject,
      summary: `${changes.length} updates for ${properties.length} properties`,
    });
  }
  
  return sent;
}

async function sendDailyDigest(userId: string, results: MatchResult[]): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user?.email) return false;
  
  // Check if any of the searches have email enabled
  const hasEmailEnabled = results.some(r => r.savedSearch.emailEnabled);
  if (!hasEmailEnabled) return false;
  
  const totalMatches = results.reduce((sum, r) => sum + r.matchingProperties.length, 0);
  const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);
  
  const searchSummaries = results.map(r => {
    const changeText = r.changes.length > 0 
      ? ` (${r.changes.length} new update${r.changes.length > 1 ? 's' : ''})`
      : '';
    return `• "${r.savedSearch.name}": ${r.matchingProperties.length} properties${changeText}`;
  }).join('\n');
  
  const subject = `Daily Property Digest: ${totalMatches} matches across ${results.length} search${results.length > 1 ? 'es' : ''}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Your Daily Property Digest</h2>
      
      <p style="color: #666;">
        Here's your daily summary: <strong>${totalMatches}</strong> properties match your 
        <strong>${results.length}</strong> saved search${results.length > 1 ? 'es' : ''}
        ${totalChanges > 0 ? ` with <strong>${totalChanges}</strong> new updates` : ''}.
      </p>
      
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0; color: #1a1a1a;">Your Saved Searches</h3>
        <pre style="white-space: pre-wrap; font-family: sans-serif; color: #333;">${searchSummaries}</pre>
      </div>
      
      <p>
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://realtorsdashboard.com'}/screener" 
           style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View Properties
        </a>
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://realtorsdashboard.com'}/settings" 
           style="display: inline-block; margin-left: 12px; color: #0066cc; text-decoration: none;">
          Manage Alerts
        </a>
      </p>
      
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        You're receiving this daily digest because you have saved searches with email notifications enabled.
        <a href="${process.env.REPLIT_DEV_DOMAIN || 'https://realtorsdashboard.com'}/settings">Manage your alerts</a>
      </p>
    </div>
  `;
  
  const sent = await sendEmail({
    to: user.email,
    subject,
    html,
  });
  
  if (sent) {
    for (const result of results) {
      await storage.createSavedSearchNotification({
        savedSearchId: result.savedSearch.id,
        userId,
        matchedPropertyIds: result.matchingProperties.map(p => p.id),
        changeIds: result.changes.map(c => c.id),
        notificationType: "daily_digest",
        emailSent: true,
        emailSentAt: new Date(),
        subject,
        summary: `${result.matchingProperties.length} matches, ${result.changes.length} changes`,
      });
    }
  }
  
  return sent;
}

// Safely serialize values for JSONB columns
function safeJsonValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { value: null };
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  // Wrap primitives and arrays in an object
  return { value };
}

export async function recordPropertyChange(
  propertyId: string,
  changeType: string,
  previousValue: unknown,
  newValue: unknown,
  changeSummary?: string
): Promise<void> {
  try {
    await storage.createPropertyChange({
      propertyId,
      changeType,
      previousValue: safeJsonValue(previousValue),
      newValue: safeJsonValue(newValue),
      changeSummary: changeSummary || null,
      processedForDigest: false,
      processedForInstant: false,
    });
  } catch (error) {
    console.error("Error recording property change:", error);
  }
}
