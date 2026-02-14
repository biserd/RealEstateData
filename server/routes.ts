import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, optionalAuth, hashPassword, hashActivationToken, generateActivationToken } from "./auth";
import { analyzeProperty, analyzeMarket, generateDealMemo, calculateScenario, analyzeScenario, generatePropertyInsights, type ScenarioInputs, type PropertyInsights } from "./openai";
import { insertWatchlistSchema, insertAlertSchema, insertNotificationSchema, type ScreenerFilters, properties, propertySignalSummary } from "@shared/schema";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { apiKeyService } from "./apiKeyService";
import { externalApiMiddleware } from "./apiMiddleware";
import { sendWelcomeEmail, sendNewUserNotificationToAdmin, sendActivationEmail, sendPasswordResetEmail } from "./emailService";
import { usageService, ActionType } from "./usageService";
import { processDailyDigest, processInstantAlerts, recordPropertyChange } from "./savedSearchService";

const FREE_TIER_LIMITS = {
  search: { daily: 5 },
  property_unlock: { daily: 3 },
  pdf_export: { weekly: 1 },
} as const;

function getSessionUsage(req: any, actionType: ActionType): { count: number; resetTime: number } {
  if (!req.session.usage) {
    req.session.usage = {};
  }
  if (!req.session.usage[actionType]) {
    const now = Date.now();
    const resetTime = actionType === 'pdf_export' 
      ? now + 7 * 24 * 60 * 60 * 1000 
      : now + 24 * 60 * 60 * 1000;
    req.session.usage[actionType] = { count: 0, resetTime };
  }
  
  const usage = req.session.usage[actionType];
  if (Date.now() > usage.resetTime) {
    const now = Date.now();
    const resetTime = actionType === 'pdf_export' 
      ? now + 7 * 24 * 60 * 60 * 1000 
      : now + 24 * 60 * 60 * 1000;
    req.session.usage[actionType] = { count: 0, resetTime };
  }
  
  return req.session.usage[actionType];
}

function trackSessionUsage(req: any, actionType: ActionType): void {
  const usage = getSessionUsage(req, actionType);
  usage.count++;
  req.session.usage[actionType] = usage;
}

async function checkUsageLimit(req: any, res: any, actionType: ActionType, propertyId?: string): Promise<boolean> {
  if (req.isAuthenticated()) {
    const result = await usageService.checkAndTrack(req.user.id, actionType, propertyId);
    if (!result.allowed) {
      res.status(429).json({
        message: `Daily limit reached for ${actionType === 'search' ? 'searches' : actionType === 'property_unlock' ? 'Full Property Insights' : 'PDF exports'}. Upgrade to Pro for unlimited access.`,
        upgrade: true,
        upgradeUrl: "/pricing",
        remaining: result.remaining,
        limit: result.limit,
      });
      return false;
    }
    return true;
  }
  
  // For unauthenticated users, check if property already viewed
  if (actionType === 'property_unlock' && propertyId) {
    if (!req.session.viewedProperties) {
      req.session.viewedProperties = [];
    }
    if (req.session.viewedProperties.includes(propertyId)) {
      return true; // Already unlocked, allow access without counting
    }
  }
  
  const usage = getSessionUsage(req, actionType);
  const limit = actionType === 'search' 
    ? FREE_TIER_LIMITS.search.daily 
    : actionType === 'property_unlock' 
      ? FREE_TIER_LIMITS.property_unlock.daily 
      : FREE_TIER_LIMITS.pdf_export.weekly;
  
  if (usage.count >= limit) {
    res.status(429).json({
      message: `Daily limit reached for ${actionType === 'search' ? 'searches' : actionType === 'property_unlock' ? 'Full Property Insights' : 'PDF exports'}. Sign up or upgrade to Pro for unlimited access.`,
      upgrade: true,
      upgradeUrl: "/pricing",
      remaining: 0,
      limit: limit,
    });
    return false;
  }
  
  trackSessionUsage(req, actionType);
  
  // Track viewed properties for unauthenticated users
  if (actionType === 'property_unlock' && propertyId) {
    req.session.viewedProperties.push(propertyId);
  }
  
  return true;
}

const requirePro = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    const tier = user.subscriptionTier;
    if ((tier !== "pro" && tier !== "premium") || user.subscriptionStatus !== "active") {
      return res.status(403).json({ 
        message: "Pro subscription required",
        upgrade: true,
        upgradeUrl: "/pricing"
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.status(500).json({ message: "Failed to verify subscription" });
  }
};

const requirePremium = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    if (user.subscriptionTier !== "premium" || user.subscriptionStatus !== "active") {
      return res.status(403).json({ 
        message: "Premium subscription required",
        upgrade: true,
        upgradeUrl: "/pricing"
      });
    }
    
    next();
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.status(500).json({ message: "Failed to verify subscription" });
  }
};

// Helper function to generate property slug for sitemap
function generateSitemapSlug(property: { id: string; address: string | null; city: string | null; zipCode: string | null }): string {
  const slugParts: string[] = [];
  
  if (property.address) {
    const addressSlug = property.address
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    slugParts.push(addressSlug);
  }
  
  if (property.city) {
    const citySlug = property.city
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    slugParts.push(citySlug);
  }
  
  if (property.zipCode) {
    slugParts.push(property.zipCode);
  }
  
  slugParts.push(property.id);
  
  return slugParts.filter(Boolean).join('-');
}

// Helper function to generate SEO-friendly unit slug
// Format: "404-east-76-street-unit-15b-manhattan" or "123-broadway-unit-4a-10001"
function generateUnitSlug(unit: {
  unitBbl: string;
  buildingDisplayAddress: string | null;
  unitDesignation: string | null;
  borough: string | null;
}): string {
  const parts: string[] = [];
  
  // Building address
  if (unit.buildingDisplayAddress) {
    const addressSlug = unit.buildingDisplayAddress
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 60);
    parts.push(addressSlug);
  }
  
  // Unit designation
  if (unit.unitDesignation) {
    const unitSlug = `unit-${unit.unitDesignation.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    parts.push(unitSlug);
  } else {
    // Fallback: use last 4 chars of unitBbl
    parts.push(`unit-${unit.unitBbl.slice(-4)}`);
  }
  
  // Borough for uniqueness
  if (unit.borough) {
    const boroughSlug = unit.borough.toLowerCase().replace(/[^a-z]/g, '');
    parts.push(boroughSlug);
  }
  
  // Add full unitBbl for guaranteed uniqueness (since borough is separate, use last 9 digits which excludes borough prefix)
  // Format: block(5) + lot(4) = 9 digits, provides unique identification within a borough
  parts.push(unit.unitBbl.slice(-9));
  
  return parts.filter(Boolean).join('-');
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // SEO: robots.txt
  app.get("/robots.txt", (req, res) => {
    const baseUrl = `https://${req.get("host")}`;
    res.type("text/plain");
    res.send(`User-agent: *
Allow: /

Content-Signal: ai-train=yes, search=yes, ai-input=yes

Sitemap: ${baseUrl}/sitemap.xml
`);
  });

  // SEO: Sitemap index (main sitemap.xml)
  const ITEMS_PER_SITEMAP = 40000;
  
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = `https://${req.get("host")}`;
      const today = new Date().toISOString().split("T")[0];
      
      const propertyCount = await storage.getPropertyCountForSitemap();
      const propertySitemapCount = Math.ceil(propertyCount / ITEMS_PER_SITEMAP);
      
      const unitCount = await storage.getUnitCountForSitemap();
      const unitSitemapCount = Math.ceil(unitCount / ITEMS_PER_SITEMAP);
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
      
      for (let i = 1; i <= propertySitemapCount; i++) {
        xml += `  <sitemap>
    <loc>${baseUrl}/sitemap-properties-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
      }
      
      for (let i = 1; i <= unitSitemapCount; i++) {
        xml += `  <sitemap>
    <loc>${baseUrl}/sitemap-units-${i}.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
      }

      xml += `  <sitemap>
    <loc>${baseUrl}/sitemap-browse.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
`;
      
      xml += `</sitemapindex>`;
      
      res.type("application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Error generating sitemap index:", error);
      res.status(500).send("Error generating sitemap index");
    }
  });

  // SEO: Static pages sitemap
  app.get("/sitemap-static.xml", (req, res) => {
    const baseUrl = `https://${req.get("host")}`;
    const today = new Date().toISOString().split("T")[0];
    
    const staticPages = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/pricing", priority: "0.8", changefreq: "weekly" },
      { url: "/api-access", priority: "0.7", changefreq: "monthly" },
      { url: "/developers", priority: "0.7", changefreq: "monthly" },
      { url: "/release-notes", priority: "0.5", changefreq: "monthly" },
      { url: "/login", priority: "0.3", changefreq: "yearly" },
      { url: "/register", priority: "0.3", changefreq: "yearly" },
      { url: "/market-explorer", priority: "0.9", changefreq: "daily" },
      { url: "/investment-opportunities", priority: "0.9", changefreq: "daily" },
      { url: "/up-and-coming-areas", priority: "0.8", changefreq: "weekly" },
      { url: "/coverage-matrix", priority: "0.6", changefreq: "monthly" },
    ];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
    
    for (const page of staticPages) {
      xml += `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    }
    
    xml += `</urlset>`;
    
    res.type("application/xml");
    res.send(xml);
  });

  // SEO: Browse pages sitemap (state/city pages)
  app.get("/sitemap-browse.xml", async (req, res) => {
    try {
      const baseUrl = `https://${req.get("host")}`;
      const today = new Date().toISOString().split("T")[0];
      const data = await storage.getStateCityList();
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
      
      for (const stateData of data) {
        const stateSlug = stateData.state.toLowerCase();
        xml += `  <url>
    <loc>${baseUrl}/browse/${stateSlug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
        for (const city of stateData.cities) {
          xml += `  <url>
    <loc>${baseUrl}/browse/${stateSlug}/${encodeURIComponent(city)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
        }
      }
      
      xml += `</urlset>`;
      res.type("application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Error generating browse sitemap:", error);
      res.status(500).send("Error generating browse sitemap");
    }
  });

  // SEO: Property pages sitemap (paginated)
  app.get("/sitemap-properties-:page.xml", async (req, res) => {
    try {
      const page = parseInt(req.params.page, 10);
      if (isNaN(page) || page < 1) {
        return res.status(404).send("Invalid sitemap page");
      }
      
      const baseUrl = `https://${req.get("host")}`;
      const today = new Date().toISOString().split("T")[0];
      
      const offset = (page - 1) * ITEMS_PER_SITEMAP;
      const properties = await storage.getPropertiesForSitemapPaginated(ITEMS_PER_SITEMAP, offset);
      
      if (properties.length === 0) {
        return res.status(404).send("Sitemap page not found");
      }
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
      
      for (const property of properties) {
        const slug = generateSitemapSlug(property);
        xml += `  <url>
    <loc>${baseUrl}/properties/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
      }
      
      xml += `</urlset>`;
      
      res.type("application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Error generating property sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // SEO: Unit pages sitemap (paginated)
  app.get("/sitemap-units-:page.xml", async (req, res) => {
    try {
      const page = parseInt(req.params.page, 10);
      if (isNaN(page) || page < 1) {
        return res.status(404).send("Invalid sitemap page");
      }
      
      const baseUrl = `https://${req.get("host")}`;
      const today = new Date().toISOString().split("T")[0];
      
      const offset = (page - 1) * ITEMS_PER_SITEMAP;
      const units = await storage.getUnitsForSitemapPaginated(ITEMS_PER_SITEMAP, offset);
      
      if (units.length === 0) {
        return res.status(404).send("Sitemap page not found");
      }
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
      
      for (const unit of units) {
        const slug = unit.slug || generateUnitSlug(unit);
        xml += `  <url>
    <loc>${baseUrl}/unit/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
`;
      }
      
      xml += `</urlset>`;
      
      res.type("application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Error generating unit sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Registration schema
  const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().optional(),
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const passwordHash = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        email: validatedData.email,
        passwordHash,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        role: "user",
      });

      req.login(
        { 
          id: user.id, 
          email: user.email, 
          firstName: user.firstName, 
          lastName: user.lastName,
          role: user.role 
        },
        async (err) => {
          if (err) {
            console.error("Login after register error:", err);
            return res.status(500).json({ message: "Registration successful but login failed" });
          }
          
          // Send welcome email and admin notification (non-blocking)
          Promise.all([
            sendWelcomeEmail(user.email, user.firstName),
            sendNewUserNotificationToAdmin(user.email, user.firstName, user.lastName)
          ]).catch(emailErr => {
            console.error("Email sending failed:", emailErr);
          });
          
          res.json({ 
            id: user.id, 
            email: user.email, 
            firstName: user.firstName, 
            lastName: user.lastName,
            role: user.role 
          });
        }
      );
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors[0]?.message || "Validation error" });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((logoutErr) => {
      if (logoutErr) {
        console.error("Logout error:", logoutErr);
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
          return res.status(500).json({ message: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());

      if (user && user.passwordHash) {
        const crypto = await import("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await storage.setResetToken(user.id, tokenHash, expiresAt);
        sendPasswordResetEmail(user.email, token).catch((err) => {
          console.error("[ForgotPassword] Failed to send reset email:", err);
        });
      }

      res.json({ message: "If an account with that email exists, we've sent a password reset link." });
    } catch (error) {
      console.error("Error in forgot-password:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const crypto = await import("crypto");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const user = await storage.getUserByResetToken(tokenHash);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (user.resetTokenExpiresAt && new Date() > new Date(user.resetTokenExpiresAt)) {
        return res.status(410).json({ message: "Reset link has expired. Please request a new one.", expired: true });
      }

      const newPasswordHash = await hashPassword(password);
      await storage.resetPassword(user.id, newPasswordHash);

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      console.error("Error in reset-password:", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Property routes - public read access
  app.get("/api/properties/top-opportunities", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const properties = await storage.getTopOpportunities(limit);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching top opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.get("/api/units/top-opportunities", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const borough = req.query.borough as string | undefined;
      const priceMin = req.query.priceMin ? parseInt(req.query.priceMin as string) : undefined;
      const priceMax = req.query.priceMax ? parseInt(req.query.priceMax as string) : undefined;
      const opportunityScoreMin = req.query.opportunityScoreMin ? parseInt(req.query.opportunityScoreMin as string) : undefined;
      
      const units = await storage.getTopUnitOpportunities({ 
        borough, 
        limit, 
        priceMin, 
        priceMax, 
        opportunityScoreMin 
      });
      res.json({
        units,
        count: units.length,
      });
    } catch (error) {
      console.error("Error fetching unit opportunities:", error);
      res.status(500).json({ message: "Failed to fetch unit opportunities" });
    }
  });

  // Combined top opportunities endpoint - includes both buildings and units
  app.get("/api/opportunities/top", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
      
      // Fetch both buildings and units
      const [buildings, unitsData] = await Promise.all([
        storage.getTopOpportunities(limit),
        storage.getTopUnitOpportunities({ limit }),
      ]);
      
      // Normalize into a common format
      type ScoreDriver = { label: string; value: string; impact: "positive" | "neutral" | "negative" };
      type TopOpportunity = {
        id: string;
        entityType: "building" | "unit";
        address: string;
        city: string;
        state: string;
        zipCode: string;
        borough?: string | null;
        price: number;
        priceType: "estimated" | "verified";
        pricePerSqft?: number | null;
        sqft?: number | null;
        yearBuilt?: number | null;
        propertyType?: string;
        opportunityScore: number;
        confidenceLevel?: string | null;
        scoreDrivers?: ScoreDriver[];
        // Unit-specific fields
        unitBbl?: string;
        unitSlug?: string | null;
        unitDesignation?: string | null;
        baseBbl?: string;
        lastSaleDate?: string | null;
        buildingMedianPrice?: number | null;
        buildingSalesCount?: number;
        // Building-specific fields
        propertyId?: string;
      };
      
      const normalizedBuildings: TopOpportunity[] = buildings.map((b) => {
        const drivers: ScoreDriver[] = [];
        
        if (b.opportunityScore && b.opportunityScore >= 75) {
          drivers.push({
            label: "High opportunity score",
            value: `${b.opportunityScore}/100`,
            impact: "positive",
          });
        }
        
        if (b.pricePerSqft && b.pricePerSqft < 300) {
          drivers.push({
            label: "Attractive price per sqft",
            value: `$${b.pricePerSqft}/sqft`,
            impact: "positive",
          });
        }
        
        if (b.confidenceLevel === "high") {
          drivers.push({
            label: "High confidence estimate",
            value: "Strong data coverage",
            impact: "positive",
          });
        } else if (b.confidenceLevel === "medium") {
          drivers.push({
            label: "Moderate confidence",
            value: "Good data coverage",
            impact: "neutral",
          });
        }
        
        return {
          id: b.id,
          entityType: "building" as const,
          address: b.address,
          city: b.city,
          state: b.state,
          zipCode: b.zipCode,
          price: b.estimatedValue || b.lastSalePrice || 0,
          priceType: "estimated" as const,
          pricePerSqft: b.pricePerSqft,
          sqft: b.sqft,
          yearBuilt: b.yearBuilt,
          propertyType: b.propertyType,
          opportunityScore: b.opportunityScore || 0,
          confidenceLevel: b.confidenceLevel,
          propertyId: b.id,
          scoreDrivers: drivers,
        };
      });
      
      const normalizedUnits: TopOpportunity[] = unitsData.map((u) => ({
        id: u.unitBbl,
        entityType: "unit" as const,
        address: u.unitDisplayAddress || u.buildingDisplayAddress || "",
        city: u.borough || "NYC",
        state: "NY",
        zipCode: u.zipCode || "",
        borough: u.borough,
        price: u.lastSalePrice,
        priceType: "verified" as const,
        opportunityScore: u.opportunityScore,
        unitBbl: u.unitBbl,
        unitSlug: u.slug,
        unitDesignation: u.unitDesignation,
        baseBbl: u.baseBbl,
        lastSaleDate: u.lastSaleDate?.toISOString() || null,
        scoreDrivers: u.scoreDrivers,
        buildingMedianPrice: u.buildingMedianPrice,
        buildingSalesCount: u.buildingSalesCount,
      }));
      
      // Merge and sort by opportunity score descending
      const combined = [...normalizedBuildings, ...normalizedUnits]
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, limit);
      
      res.json(combined);
    } catch (error) {
      console.error("Error fetching combined opportunities:", error);
      res.status(500).json({ message: "Failed to fetch opportunities" });
    }
  });

  app.get("/api/properties/screener", optionalAuth, async (req: any, res) => {
    try {
      const stateParam = req.query.state as string | undefined;
      const validStates = ["NY", "NJ", "CT"] as const;
      const state = stateParam && validStates.includes(stateParam as any) ? stateParam as "NY" | "NJ" | "CT" : undefined;
      
      const filters: ScreenerFilters = {
        state,
        zipCodes: req.query.zipCodes ? (req.query.zipCodes as string).split(",") : undefined,
        cities: req.query.cities ? (req.query.cities as string).split(",") : undefined,
        propertyTypes: req.query.propertyTypes ? (req.query.propertyTypes as string).split(",") as any : undefined,
        bedsBands: req.query.bedsBands ? (req.query.bedsBands as string).split(",") : undefined,
        bathsBands: req.query.bathsBands ? (req.query.bathsBands as string).split(",") : undefined,
        yearBuiltBands: req.query.yearBuiltBands ? (req.query.yearBuiltBands as string).split(",") : undefined,
        sizeBands: req.query.sizeBands ? (req.query.sizeBands as string).split(",") : undefined,
        priceMin: req.query.priceMin ? parseInt(req.query.priceMin as string) : undefined,
        priceMax: req.query.priceMax ? parseInt(req.query.priceMax as string) : undefined,
        opportunityScoreMin: req.query.opportunityScoreMin ? parseInt(req.query.opportunityScoreMin as string) : undefined,
        confidenceLevels: req.query.confidenceLevels ? (req.query.confidenceLevels as string).split(",") as any : undefined,
      };
      
      let requestedLimit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      let isFreeUser = true;
      if (req.isAuthenticated()) {
        const user = await storage.getUser(req.user.id);
        const tier = user?.subscriptionTier;
        const status = user?.subscriptionStatus;
        isFreeUser = !((tier === "pro" || tier === "premium") && status === "active");
      }
      
      const FREE_VISIBLE_COUNT = 3;
      const properties = await storage.getProperties(filters, requestedLimit, offset);
      const totalCount = properties.length;
      const hiddenCount = isFreeUser ? Math.max(0, totalCount - FREE_VISIBLE_COUNT) : 0;
      
      res.json({
        properties,
        limited: isFreeUser && totalCount > FREE_VISIBLE_COUNT,
        visibleCount: isFreeUser ? FREE_VISIBLE_COUNT : totalCount,
        hiddenCount,
        message: isFreeUser && hiddenCount > 0 
          ? `Unlock ${hiddenCount} more undervalued properties in this area with Pro.` 
          : undefined,
      });
    } catch (error) {
      console.error("Error fetching screener properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/area", optionalAuth, async (req: any, res) => {
    try {
      const { geoType, geoId, limit } = req.query;
      if (!geoType || !geoId) {
        return res.status(400).json({ message: "geoType and geoId are required" });
      }
      
      if (!(await checkUsageLimit(req, res, "search"))) {
        return;
      }
      
      const properties = await storage.getPropertiesByArea(
        geoType as string,
        geoId as string,
        parseInt(limit as string) || 50
      );
      res.json(properties);
    } catch (error) {
      console.error("Error fetching area properties:", error);
      res.status(500).json({ message: "Failed to fetch properties for area" });
    }
  });

  app.get("/api/condo-units/search", optionalAuth, async (req: any, res) => {
    try {
      const { borough, zipCode, baseBbl, query, includeAll, limit } = req.query;
      
      const includeAllSublots = includeAll === "true" || includeAll === "1";
      const unitTypes = includeAllSublots 
        ? undefined 
        : ["residential"];
      
      const results = await storage.searchCondoUnits({
        borough: borough as string | undefined,
        zipCode: zipCode as string | undefined,
        baseBbl: baseBbl as string | undefined,
        query: query as string | undefined,
        unitTypes,
        limit: Math.min(parseInt(limit as string) || 50, 200),
      });
      
      res.json({
        units: results,
        count: results.length,
        filtered: !includeAllSublots,
        filterType: includeAllSublots ? "all" : "residential",
      });
    } catch (error) {
      console.error("Error searching condo units:", error);
      res.status(500).json({ message: "Failed to search condo units" });
    }
  });

  app.get("/api/buildings/:baseBbl/sales", async (req, res) => {
    try {
      const { baseBbl } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      
      const buildingSales = await storage.getSalesForBuilding(baseBbl, limit);
      
      res.json({
        baseBbl,
        sales: buildingSales,
        count: buildingSales.length,
      });
    } catch (error) {
      console.error("Error fetching building sales:", error);
      res.status(500).json({ message: "Failed to fetch building sales" });
    }
  });

  app.get("/api/units/:unitBbl/sales", async (req, res) => {
    try {
      const { unitBbl } = req.params;
      
      const unitSales = await storage.getSalesForUnit(unitBbl);
      
      res.json({
        unitBbl,
        sales: unitSales,
        count: unitSales.length,
      });
    } catch (error) {
      console.error("Error fetching unit sales:", error);
      res.status(500).json({ message: "Failed to fetch unit sales" });
    }
  });

  app.get("/api/units/:unitBbl/opportunity", async (req, res) => {
    try {
      const { unitBbl } = req.params;
      
      const opportunityData = await storage.getUnitOpportunityData(unitBbl);
      
      if (!opportunityData) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      res.json(opportunityData);
    } catch (error) {
      console.error("Error fetching unit opportunity data:", error);
      res.status(500).json({ message: "Failed to fetch unit opportunity data" });
    }
  });

  app.get("/api/units/:unitBbl/insights", optionalAuth, async (req: any, res) => {
    try {
      const { unitBbl } = req.params;
      
      const unit = await storage.getCondoUnit(unitBbl);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      const opportunityData = await storage.getUnitOpportunityData(unitBbl);
      const building = await storage.getBuilding(unit.baseBbl);
      
      const unitTypeLabels: Record<string, string> = {
        residential: "Residential",
        parking: "Parking",
        storage: "Storage",
        commercial: "Commercial",
        other: "Other",
      };
      
      const context = {
        unit: {
          address: unit.unitDisplayAddress || unit.buildingDisplayAddress || "Unknown",
          designation: unit.unitDesignation || "Unknown",
          type: unitTypeLabels[unit.unitTypeHint || "residential"] || "Residential",
          borough: unit.borough || "NYC",
          zipCode: unit.zipCode || "Unknown",
          beds: unit.beds ?? null,
          baths: unit.baths ?? null,
          sqft: unit.sqft ?? null,
        },
        building: building ? {
          address: building.displayAddress || "Unknown",
          unitCount: building.unitCount || 0,
          residentialUnitCount: building.residentialUnitCount || 0,
        } : null,
        sales: opportunityData ? {
          lastSalePrice: opportunityData.lastSalePrice,
          lastSaleDate: opportunityData.lastSaleDate,
          buildingMedianPrice: opportunityData.buildingMedianPrice,
          recentBuildingSales: opportunityData.buildingSales?.slice(0, 10) || [],
          priceHistory: opportunityData.buildingAvgPricePerYear || [],
        } : null,
        opportunityScore: opportunityData?.opportunityScore ?? null,
        scoreBreakdown: opportunityData?.scoreBreakdown ?? null,
      };

      const analysis = await analyzeProperty(
        `Analyze this condo unit as an investment opportunity. Provide insights on: 
        1. Value assessment compared to building median
        2. Market position and recent price trends
        3. Key considerations for buyers
        4. Potential risks and opportunities`,
        { property: context as any }
      );

      res.json({
        ...analysis,
        unitBbl,
        context,
      });
    } catch (error) {
      console.error("Error generating unit insights:", error);
      res.status(500).json({ message: "Failed to generate unit insights" });
    }
  });

  // Property resolver - detect if ID is a unit, building, or property and redirect
  app.get("/api/property/resolve/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Normalize ID by removing any dashes or spaces
      const normalizedId = id.replace(/[-\s]/g, "").trim();
      
      // Unit BBLs are typically longer (13-15 chars) than base BBLs (10 chars)
      // Check unit first if the ID is long enough to be a unit BBL
      if (normalizedId.length > 10) {
        const unit = await storage.getCondoUnit(normalizedId);
        if (unit) {
          return res.json({
            type: "unit",
            redirectTo: `/unit/${unit.unitBbl}`,
          });
        }
      }
      
      // Check if it's a building base BBL (10 digits)
      if (normalizedId.length === 10 && /^\d+$/.test(normalizedId)) {
        const building = await storage.getBuilding(normalizedId);
        if (building) {
          return res.json({
            type: "building",
            redirectTo: `/building/${building.baseBbl}`,
          });
        }
      }
      
      // Fallback: try unit lookup with original ID
      const unit = await storage.getCondoUnit(id);
      if (unit) {
        return res.json({
          type: "unit",
          redirectTo: `/unit/${unit.unitBbl}`,
        });
      }
      
      // Check if it's a property slug or ID
      const property = await storage.getPropertyByIdOrSlug(id);
      if (property) {
        return res.json({
          type: "property",
          redirectTo: `/properties/${property.id}`,
        });
      }
      
      res.status(404).json({ message: "Property not found", redirectTo: "/not-found" });
    } catch (error) {
      console.error("Error resolving property:", error);
      res.status(500).json({ message: "Failed to resolve property", redirectTo: "/not-found" });
    }
  });

  // Get unit by slug - for SEO-friendly unit pages
  app.get("/api/units/by-slug/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      
      const unit = await storage.getCondoUnitBySlug(slug);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      res.json(unit);
    } catch (error) {
      console.error("Error fetching unit by slug:", error);
      res.status(500).json({ message: "Failed to fetch unit" });
    }
  });

  // Resolve unit - handles both slug and unitBbl lookups
  app.get("/api/units/resolve/:idOrSlug", async (req, res) => {
    try {
      const { idOrSlug } = req.params;
      
      // First try to find by slug stored in database
      let unit = await storage.getCondoUnitBySlug(idOrSlug);
      
      // If not found by stored slug, try to extract unitBbl from slug format
      // Slug format: "{address}-unit-{designation}-{borough}-{9-digit-bbl-suffix}"
      // The last 9 digits after final hyphen are from unitBbl (block 5 + lot 4)
      if (!unit && idOrSlug.includes("-")) {
        const parts = idOrSlug.split("-");
        const bblSuffix = parts[parts.length - 1];
        const boroughFromSlug = parts[parts.length - 2];
        
        // If it looks like a BBL suffix (9 digits for new format, 6 for legacy)
        if (/^\d{9}$/.test(bblSuffix)) {
          // New 9-digit suffix format - more unique
          const unitBySuffix = await storage.getCondoUnitBySuffix9(bblSuffix, boroughFromSlug);
          if (unitBySuffix) {
            unit = unitBySuffix;
          }
        } else if (/^\d{6}$/.test(bblSuffix)) {
          // Legacy 6-digit suffix format
          const unitBySuffix = await storage.getCondoUnitBySuffix(bblSuffix);
          if (unitBySuffix) {
            const unitBorough = unitBySuffix.borough?.toLowerCase().replace(/\s+/g, "");
            const slugBorough = boroughFromSlug?.toLowerCase();
            
            if (!boroughFromSlug || unitBorough === slugBorough) {
              unit = unitBySuffix;
            } else {
              const unitWithBorough = await storage.getCondoUnitBySuffixAndBorough(bblSuffix, boroughFromSlug);
              if (unitWithBorough) {
                unit = unitWithBorough;
              }
            }
          }
        }
      }
      
      // If still not found, try direct unitBbl lookup (legacy support)
      if (!unit) {
        const normalizedBbl = idOrSlug.replace(/[-\s]/g, "");
        const unitByBbl = await storage.getCondoUnit(normalizedBbl);
        if (unitByBbl) {
          // Generate slug for redirect
          const slug = generateUnitSlug({
            unitBbl: unitByBbl.unitBbl,
            buildingDisplayAddress: unitByBbl.buildingDisplayAddress,
            unitDesignation: unitByBbl.unitDesignation,
            borough: unitByBbl.borough,
          });
          
          // Return redirect info to SEO-friendly URL
          return res.json({
            unitBbl: unitByBbl.unitBbl,
            slug,
            redirectTo: `/unit/${slug}`,
            unit: unitByBbl,
          });
        }
      }
      
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      
      // Generate slug if not stored
      const slug = unit.slug || generateUnitSlug({
        unitBbl: unit.unitBbl,
        buildingDisplayAddress: unit.buildingDisplayAddress,
        unitDesignation: unit.unitDesignation,
        borough: unit.borough,
      });
      
      res.json({
        unitBbl: unit.unitBbl,
        slug,
        unit,
      });
    } catch (error) {
      console.error("Error resolving unit:", error);
      res.status(500).json({ message: "Failed to resolve unit" });
    }
  });

  // Admin: Generate slugs for units (batch operation)
  app.post("/api/admin/generate-unit-slugs", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.user.id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const batchSize = parseInt(req.query.batchSize as string) || 1000;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Get units without slugs
      const units = await storage.getUnitsForSitemapPaginated(batchSize, offset);
      
      let generated = 0;
      for (const unit of units) {
        if (!unit.slug) {
          const slug = generateUnitSlug(unit);
          await storage.updateUnitSlug(unit.unitBbl, slug);
          generated++;
        }
      }
      
      res.json({
        message: `Generated ${generated} slugs`,
        batchSize,
        offset,
        unitsProcessed: units.length,
        slugsGenerated: generated,
        nextOffset: offset + batchSize,
      });
    } catch (error) {
      console.error("Error generating unit slugs:", error);
      res.status(500).json({ message: "Failed to generate unit slugs" });
    }
  });

  app.get("/api/buildings", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const buildingsList = await storage.getBuildingsWithUnits(limit, offset);
      
      res.json({
        buildings: buildingsList,
        count: buildingsList.length,
        offset,
      });
    } catch (error) {
      console.error("Error fetching buildings:", error);
      res.status(500).json({ message: "Failed to fetch buildings" });
    }
  });

  app.get("/api/buildings/:baseBbl/details", async (req, res) => {
    try {
      const { baseBbl } = req.params;
      const building = await storage.getBuilding(baseBbl);
      
      if (!building) {
        return res.status(404).json({ message: "Building not found" });
      }
      
      res.json(building);
    } catch (error) {
      console.error("Error fetching building:", error);
      res.status(500).json({ message: "Failed to fetch building" });
    }
  });

  app.get("/api/buildings/:baseBbl/units", async (req, res) => {
    try {
      const { baseBbl } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const includeAll = req.query.includeAll === "true";
      
      const unitTypes = includeAll ? undefined : ["residential"];
      
      const units = await storage.getCondoUnitsForBuilding(baseBbl, {
        unitTypes,
        limit,
        offset,
      });
      
      res.json({
        baseBbl,
        units,
        count: units.length,
        offset,
        filtered: !includeAll,
      });
    } catch (error) {
      console.error("Error fetching building units:", error);
      res.status(500).json({ message: "Failed to fetch building units" });
    }
  });

  app.get("/api/condo-units/:unitBbl", async (req, res) => {
    try {
      const { unitBbl } = req.params;
      const unit = await storage.getCondoUnit(unitBbl);
      
      if (!unit) {
        return res.status(404).json({ message: "Condo unit not found" });
      }
      
      res.json(unit);
    } catch (error) {
      console.error("Error fetching condo unit:", error);
      res.status(500).json({ message: "Failed to fetch condo unit" });
    }
  });

  // Browse: List all states
  app.get("/api/browse/states", async (req, res) => {
    try {
      const states = await storage.getDistinctStates();
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Browse: State stats + cities
  app.get("/api/browse/state/:state", async (req, res) => {
    try {
      const state = req.params.state.toUpperCase();
      const stats = await storage.getStateStats(state);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching state stats:", error);
      res.status(500).json({ message: "Failed to fetch state stats" });
    }
  });

  // Browse: State properties (paginated)
  app.get("/api/browse/state/:state/properties", async (req, res) => {
    try {
      const state = req.params.state.toUpperCase();
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const [props, total] = await Promise.all([
        storage.getPropertiesByState(state, limit, offset),
        storage.getPropertyCountByState(state),
      ]);
      res.json({ properties: props, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Error fetching state properties:", error);
      res.status(500).json({ message: "Failed to fetch state properties" });
    }
  });

  // Browse: City stats + zips
  app.get("/api/browse/state/:state/city/:city", async (req, res) => {
    try {
      const state = req.params.state.toUpperCase();
      const city = decodeURIComponent(req.params.city);
      const stats = await storage.getCityStats(state, city);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching city stats:", error);
      res.status(500).json({ message: "Failed to fetch city stats" });
    }
  });

  // Browse: City properties (paginated)
  app.get("/api/browse/state/:state/city/:city/properties", async (req, res) => {
    try {
      const state = req.params.state.toUpperCase();
      const city = decodeURIComponent(req.params.city);
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const [props, total] = await Promise.all([
        storage.getPropertiesByCity(state, city, limit, offset),
        storage.getPropertyCountByCity(state, city),
      ]);
      res.json({ properties: props, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Error fetching city properties:", error);
      res.status(500).json({ message: "Failed to fetch city properties" });
    }
  });

  // Browse: State/City list for sitemap
  app.get("/api/browse/sitemap-data", async (req, res) => {
    try {
      const data = await storage.getStateCityList();
      res.json(data);
    } catch (error) {
      console.error("Error fetching sitemap data:", error);
      res.status(500).json({ message: "Failed to fetch sitemap data" });
    }
  });

  // Similar properties for a given property
  app.get("/api/properties/:id/similar", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      const limit = Math.min(parseInt(req.query.limit as string) || 6, 12);
      const similar = await storage.getSimilarProperties(
        property.id, property.zipCode, property.propertyType, property.estimatedValue, limit
      );
      res.json(similar);
    } catch (error) {
      console.error("Error fetching similar properties:", error);
      res.status(500).json({ message: "Failed to fetch similar properties" });
    }
  });

  // Get similar properties by ZIP code (for 404 pages)
  app.get("/api/properties/similar-by-zip/:zipCode", async (req, res) => {
    try {
      const { zipCode } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
      
      if (!zipCode || zipCode.length !== 5) {
        return res.status(400).json({ message: "Invalid ZIP code" });
      }
      
      const properties = await storage.getPropertiesByArea("zip", zipCode, limit);
      res.json({
        zipCode,
        properties,
        count: properties.length,
      });
    } catch (error) {
      console.error("Error fetching similar properties:", error);
      res.status(500).json({ message: "Failed to fetch similar properties" });
    }
  });

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        // Return 410 Gone to tell search engines this resource was removed
        // and should be de-indexed faster than a 404
        return res.status(410).json({ message: "Property no longer available" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.get("/api/properties/:id/view-status", optionalAuth, async (req: any, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      if (req.isAuthenticated()) {
        const user = await storage.getUser(req.user.id);
        const tier = user?.subscriptionTier;
        const status = user?.subscriptionStatus;
        const isPaidUser = (tier === "pro" || tier === "premium") && status === "active";
        
        if (isPaidUser) {
          return res.json({ unlocked: true, remaining: Infinity, limit: Infinity });
        }
        
        const result = await usageService.checkRemaining(req.user.id, "property_unlock", propertyId);
        return res.json({
          unlocked: result.alreadyTracked || false,
          remaining: result.remaining,
          limit: result.limit,
          canUnlock: result.remaining > 0 || result.alreadyTracked,
        });
      }
      
      return res.json({
        unlocked: false,
        remaining: 0,
        limit: 0,
        canUnlock: false,
      });
    } catch (error) {
      console.error("Error checking property view status:", error);
      res.status(500).json({ message: "Failed to check view status" });
    }
  });

  app.post("/api/properties/:id/unlock", isAuthenticated, async (req: any, res) => {
    try {
      const propertyId = req.params.id;
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      const user = await storage.getUser(req.user.id);
      const tier = user?.subscriptionTier;
      const status = user?.subscriptionStatus;
      const isPaidUser = (tier === "pro" || tier === "premium") && status === "active";
      
      if (isPaidUser) {
        return res.json({ unlocked: true, remaining: Infinity });
      }
      
      const result = await usageService.checkAndTrack(req.user.id, "property_unlock", propertyId);
      if (!result.allowed) {
        return res.status(429).json({
          message: "Daily limit reached for Full Property Insights. Upgrade to Pro for unlimited access.",
          upgrade: true,
          upgradeUrl: "/pricing",
          remaining: result.remaining,
          limit: result.limit,
        });
      }
      return res.json({ unlocked: true, remaining: result.remaining });
    } catch (error) {
      console.error("Error unlocking property:", error);
      return res.status(500).json({ message: "Failed to unlock property" });
    }
  });

  app.get("/api/properties/:id/comps", optionalAuth, async (req: any, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      if (!(await checkUsageLimit(req, res, "property_unlock", req.params.id))) {
        return;
      }
      
      const comps = await storage.getComps(req.params.id);
      res.json(comps);
    } catch (error) {
      console.error("Error fetching comps:", error);
      res.status(500).json({ message: "Failed to fetch comps" });
    }
  });

  app.get("/api/properties/:id/sales", async (req, res) => {
    try {
      const sales = await storage.getSalesForProperty(req.params.id);
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ message: "Failed to fetch sales" });
    }
  });

  // NYC Deep Coverage - Property Signals
  app.get("/api/properties/:id/signals", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Check if this is a NYC property
      const nycBoroughs = ["Manhattan", "Brooklyn", "Bronx", "Queens", "Staten Island"];
      const isNYC = property.state === "NY" && nycBoroughs.includes(property.city);
      
      if (!isNYC) {
        return res.json({
          hasDeepCoverage: false,
          message: "Deep coverage is currently available for NYC properties only",
          property: { id: property.id, city: property.city, state: property.state },
        });
      }
      
      const signals = await storage.getPropertySignals(req.params.id);
      
      if (!signals) {
        // Get coverage stats for this city
        const coverageStats = await storage.getDeepCoverageCounts("city", property.city);
        const coveragePercent = coverageStats.totalProperties > 0 
          ? Math.round((coverageStats.withSignals / coverageStats.totalProperties) * 100) 
          : 0;
        
        return res.json({
          hasDeepCoverage: true,
          signalsAvailable: false,
          message: "Signal data not yet available for this property",
          property: { id: property.id, bbl: property.bbl, city: property.city },
          coverage: {
            city: property.city,
            percent: coveragePercent,
            totalProperties: coverageStats.totalProperties,
            withSignals: coverageStats.withSignals,
          },
        });
      }
      
      res.json({
        hasDeepCoverage: true,
        signalsAvailable: true,
        signals,
      });
    } catch (error) {
      console.error("Error fetching property signals:", error);
      res.status(500).json({ message: "Failed to fetch property signals" });
    }
  });

  // NYC Deep Coverage - Area signals summary
  app.get("/api/nyc/coverage/:geoType/:geoId", async (req, res) => {
    try {
      const { geoType, geoId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Get accurate coverage counts from full population (not limited)
      const coverageCounts = await storage.getDeepCoverageCounts(geoType, geoId);
      
      // Get sample of properties for aggregates calculation
      const propertiesWithSignals = await storage.getPropertiesWithDeepCoverage(geoType, geoId, limit);
      
      // Calculate area-level signal aggregates from sample
      const signalsData = propertiesWithSignals.filter(p => p.signals);
      
      // Aggregate metrics
      const avgBuildingHealth = signalsData.length > 0
        ? Math.round(signalsData.reduce((sum, p) => sum + (p.signals?.buildingHealthScore || 0), 0) / signalsData.length)
        : null;
      
      const avgTransitScore = signalsData.length > 0
        ? Math.round(signalsData.reduce((sum, p) => sum + (p.signals?.transitScore || 0), 0) / signalsData.length)
        : null;
      
      const avgAmenityScore = signalsData.length > 0
        ? Math.round(signalsData.reduce((sum, p) => sum + (p.signals?.amenityScore || 0), 0) / signalsData.length)
        : null;
      
      const highRiskFlood = signalsData.filter(p => p.signals?.isFloodHighRisk).length;
      const moderateRiskFlood = signalsData.filter(p => p.signals?.isFloodModerateRisk).length;
      
      const totalActivePermits = signalsData.reduce((sum, p) => sum + (p.signals?.activePermits || 0), 0);
      const totalOpenViolations = signalsData.reduce((sum, p) => sum + (p.signals?.openHpdViolations || 0), 0);
      
      res.json({
        geoType,
        geoId,
        coverage: {
          totalProperties: coverageCounts.totalProperties,
          withDeepCoverage: coverageCounts.withSignals,
          coveragePercent: coverageCounts.totalProperties > 0 
            ? Math.round((coverageCounts.withSignals / coverageCounts.totalProperties) * 100) 
            : 0,
        },
        aggregates: {
          avgBuildingHealthScore: avgBuildingHealth,
          avgTransitScore,
          avgAmenityScore,
          floodRisk: {
            highRisk: highRiskFlood,
            moderateRisk: moderateRiskFlood,
            lowRisk: coverageCounts.withSignals - highRiskFlood - moderateRiskFlood,
          },
          constructionActivity: {
            totalActivePermits,
          },
          compliance: {
            totalOpenViolations,
          },
        },
        properties: propertiesWithSignals.slice(0, 20), // Return sample of properties
      });
    } catch (error) {
      console.error("Error fetching NYC coverage:", error);
      res.status(500).json({ message: "Failed to fetch NYC coverage data" });
    }
  });

  // Market routes - public read access
  app.get("/api/market/overview", async (req, res) => {
    try {
      const overview = await storage.getMarketOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching market overview:", error);
      res.status(500).json({ message: "Failed to fetch market overview" });
    }
  });

  app.get("/api/market/aggregates", async (req, res) => {
    try {
      const { geoType, geoId, propertyType, bedsBand, yearBuiltBand } = req.query;
      if (!geoType || !geoId) {
        return res.status(400).json({ message: "geoType and geoId are required" });
      }
      const aggregates = await storage.getMarketAggregates(
        geoType as string,
        geoId as string,
        { propertyType, bedsBand, yearBuiltBand }
      );
      res.json(aggregates);
    } catch (error) {
      console.error("Error fetching market aggregates:", error);
      res.status(500).json({ message: "Failed to fetch market data" });
    }
  });

  // Recent sales for an area - public read access
  app.get("/api/market/recent-sales", async (req, res) => {
    try {
      const { geoType, geoId, limit } = req.query;
      if (!geoType || !geoId) {
        return res.status(400).json({ message: "geoType and geoId are required" });
      }
      const recentSales = await storage.getRecentSalesForArea(
        geoType as string,
        geoId as string,
        parseInt(limit as string) || 20
      );
      res.json(recentSales);
    } catch (error) {
      console.error("Error fetching recent sales:", error);
      res.status(500).json({ message: "Failed to fetch recent sales" });
    }
  });

  // Up and coming ZIP codes - public read access
  app.get("/api/market/up-and-coming", async (req, res) => {
    try {
      const state = req.query.state as string | undefined;
      const limit = parseInt(req.query.limit as string) || 25;
      const upAndComingZips = await storage.getUpAndComingZips(state, limit);
      res.json(upAndComingZips);
    } catch (error) {
      console.error("Error fetching up and coming ZIPs:", error);
      res.status(500).json({ message: "Failed to fetch up and coming areas" });
    }
  });

  // Search routes - with usage limits for free users
  app.get("/api/search/geo", optionalAuth, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      if (!(await checkUsageLimit(req, res, "search"))) {
        return;
      }
      
      const results = await storage.searchGeo(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching geo:", error);
      res.status(500).json({ message: "Failed to search" });
    }
  });

  // Unified search - buildings, units, and locations
  app.get("/api/search/unified", optionalAuth, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      const filter = (req.query.filter as string) || "all";
      
      if (!query || query.length < 2) {
        return res.json({ buildings: [], units: [], locations: [] });
      }
      
      if (!(await checkUsageLimit(req, res, "search"))) {
        return;
      }
      
      const results = await storage.searchUnified(query, filter as "all" | "buildings" | "units");
      res.json(results);
    } catch (error) {
      console.error("Error in unified search:", error);
      res.status(500).json({ message: "Failed to search" });
    }
  });

  // Platform stats - public endpoint for homepage
  app.get("/api/stats/platform", async (req, res) => {
    try {
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      res.status(500).json({ message: "Failed to fetch platform stats" });
    }
  });

  // Watchlist routes
  app.get("/api/watchlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const watchlists = await storage.getWatchlists(userId);
      
      // Enrich with properties
      const enriched = await Promise.all(
        watchlists.map(async (w) => {
          const properties = await storage.getWatchlistProperties(w.id);
          return { ...w, properties, alertCount: 0 };
        })
      );
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({ message: "Failed to fetch watchlists" });
    }
  });

  app.post("/api/watchlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parsed = insertWatchlistSchema.parse({ ...req.body, userId });
      const watchlist = await storage.createWatchlist(parsed);
      res.status(201).json(watchlist);
    } catch (error) {
      console.error("Error creating watchlist:", error);
      res.status(500).json({ message: "Failed to create watchlist" });
    }
  });

  app.delete("/api/watchlists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const watchlist = await storage.getWatchlist(req.params.id);
      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      if (watchlist.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteWatchlist(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      res.status(500).json({ message: "Failed to delete watchlist" });
    }
  });

  app.post("/api/watchlists/properties", isAuthenticated, async (req: any, res) => {
    try {
      const { watchlistId, propertyId } = req.body;
      
      // If no watchlistId, get or create default watchlist
      let targetWatchlistId = watchlistId;
      if (!targetWatchlistId) {
        const userId = req.user.id;
        const watchlists = await storage.getWatchlists(userId);
        let defaultWatchlist = watchlists.find((w) => w.name === "Saved Properties");
        if (!defaultWatchlist) {
          defaultWatchlist = await storage.createWatchlist({
            userId,
            name: "Saved Properties",
          });
        }
        targetWatchlistId = defaultWatchlist.id;
      }
      
      const result = await storage.addPropertyToWatchlist({
        watchlistId: targetWatchlistId,
        propertyId,
      });
      res.status(201).json(result);
    } catch (error) {
      console.error("Error adding property to watchlist:", error);
      res.status(500).json({ message: "Failed to add property" });
    }
  });

  // Alert routes
  app.get("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const alerts = await storage.getAlerts(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parsed = insertAlertSchema.parse({ ...req.body, userId });
      const alert = await storage.createAlert(parsed);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(500).json({ message: "Failed to create alert" });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const alertId = req.params.id;
      await storage.deleteAlert(alertId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (req.body.isRead) {
        await storage.markNotificationRead(req.params.id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating notification:", error);
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  app.get("/api/neighborhood/:geoId/report", optionalAuth, async (req: any, res) => {
    try {
      const { geoId } = req.params;
      const geoType = (req.query.geoType as string) || "zip";

      const marketData = await storage.getMarketAggregates(geoType, geoId, {});
      const market = marketData.length > 0 ? marketData[0] : null;

      const propertiesRes = await db.select().from(properties)
        .where(geoType === "zip" ? eq(properties.zipCode, geoId) : sql`1=1`)
        .limit(500);

      const signalAgg = await db.select({
        totalProperties: sql<number>`count(*)`,
        avgPermits12m: sql<number>`COALESCE(avg(permit_count_12m), 0)`,
        totalPermits12m: sql<number>`COALESCE(sum(permit_count_12m), 0)`,
        totalNewConstruction: sql<number>`COALESCE(sum(CASE WHEN new_construction = true THEN 1 ELSE 0 END), 0)`,
        totalMajorAlteration: sql<number>`COALESCE(sum(CASE WHEN major_alteration = true THEN 1 ELSE 0 END), 0)`,
        avgHpdViolations: sql<number>`COALESCE(avg(total_hpd_violations_12m), 0)`,
        totalHpdViolations: sql<number>`COALESCE(sum(total_hpd_violations_12m), 0)`,
        totalHazardous: sql<number>`COALESCE(sum(hazardous_violations), 0)`,
        avgComplaints311: sql<number>`COALESCE(avg(complaints_311_12m), 0)`,
        totalComplaints311: sql<number>`COALESCE(sum(complaints_311_12m), 0)`,
        avgNoiseComplaints: sql<number>`COALESCE(avg(noise_complaints_12m), 0)`,
        avgBuildingHealth: sql<number>`COALESCE(avg(building_health_score), 0)`,
        avgTransitScore: sql<number>`COALESCE(avg(transit_score), 0)`,
        avgAmenityScore: sql<number>`COALESCE(avg(amenity_score), 0)`,
        avgFloodRisk: sql<number>`COALESCE(avg(CASE WHEN is_flood_high_risk = true THEN 1 WHEN is_flood_moderate_risk = true THEN 0.5 ELSE 0 END), 0)`,
      })
      .from(propertySignalSummary)
      .innerJoin(properties, eq(propertySignalSummary.propertyId, properties.id))
      .where(geoType === "zip" ? eq(properties.zipCode, geoId) : sql`1=1`);

      const signals = signalAgg[0] || {};

      const typeDistribution: Record<string, number> = {};
      const bedDistribution: Record<string, number> = {};
      let totalSqft = 0, sqftCount = 0;
      let totalPrice = 0, priceCount = 0;

      for (const p of propertiesRes) {
        const type = p.propertyType || "Other";
        typeDistribution[type] = (typeDistribution[type] || 0) + 1;

        const beds = p.beds ? `${p.beds} BR` : "Unknown";
        bedDistribution[beds] = (bedDistribution[beds] || 0) + 1;

        if (p.sqft && p.sqft > 0) { totalSqft += p.sqft; sqftCount++; }
        const price = p.estimatedValue || p.lastSalePrice || 0;
        if (price > 0) { totalPrice += Number(price); priceCount++; }
      }

      const avgHealth = Number(signals.avgBuildingHealth) || 50;
      const avgTransit = Number(signals.avgTransitScore) || 50;
      const avgAmenity = Number(signals.avgAmenityScore) || 50;
      const complaintRate = Number(signals.avgComplaints311) || 0;
      const violationRate = Number(signals.avgHpdViolations) || 0;

      const gradeScore = Math.min(100, Math.max(0,
        (avgHealth * 0.3) + (avgTransit * 0.2) + (avgAmenity * 0.2) +
        (Math.max(0, 100 - complaintRate * 10) * 0.15) +
        (Math.max(0, 100 - violationRate * 5) * 0.15)
      ));

      const grade = gradeScore >= 90 ? "A" : gradeScore >= 80 ? "B+" : gradeScore >= 70 ? "B" : gradeScore >= 60 ? "C+" : gradeScore >= 50 ? "C" : gradeScore >= 40 ? "D" : "F";

      const userId = req.user?.id;
      const user = userId ? await storage.getUser(userId) : null;
      const isPro = user?.subscriptionTier === "pro" || user?.subscriptionTier === "premium";

      const report = {
        geoId,
        geoType,
        geoName: market?.geoName || geoId,
        state: market?.state || propertiesRes[0]?.state || "",
        grade,
        gradeScore: Math.round(gradeScore),
        market: market ? {
          medianPrice: market.medianPrice,
          medianPricePerSqft: market.medianPricePerSqft,
          p25Price: market.p25Price,
          p75Price: market.p75Price,
          transactionCount: market.transactionCount,
          trend3m: market.trend3m,
          trend6m: market.trend6m,
          trend12m: market.trend12m,
          turnoverRate: market.turnoverRate,
        } : null,
        propertyCount: propertiesRes.length,
        avgPrice: priceCount > 0 ? Math.round(totalPrice / priceCount) : null,
        avgSqft: sqftCount > 0 ? Math.round(totalSqft / sqftCount) : null,
        typeDistribution,
        bedDistribution,
        indicators: {
          development: {
            totalPermits12m: Number(signals.totalPermits12m) || 0,
            newConstruction: Number(signals.totalNewConstruction) || 0,
            majorAlterations: Number(signals.totalMajorAlteration) || 0,
            avgPermitsPerProperty: Number(signals.avgPermits12m)?.toFixed(1) || "0",
            level: (Number(signals.totalPermits12m) || 0) > 50 ? "High" : (Number(signals.totalPermits12m) || 0) > 10 ? "Moderate" : "Low",
          },
          safety: isPro ? {
            totalViolations12m: Number(signals.totalHpdViolations) || 0,
            hazardousViolations: Number(signals.totalHazardous) || 0,
            avgViolationsPerProperty: Number(signals.avgHpdViolations)?.toFixed(1) || "0",
            totalComplaints311: Number(signals.totalComplaints311) || 0,
            noiseComplaints: Number(signals.avgNoiseComplaints)?.toFixed(1) || "0",
            level: (Number(signals.avgHpdViolations) || 0) > 3 ? "Concerning" : (Number(signals.avgHpdViolations) || 0) > 1 ? "Moderate" : "Good",
          } : {
            level: (Number(signals.avgHpdViolations) || 0) > 3 ? "Concerning" : (Number(signals.avgHpdViolations) || 0) > 1 ? "Moderate" : "Good",
            locked: true,
          },
          transit: isPro ? {
            avgScore: Number(signals.avgTransitScore) || 0,
            level: (Number(signals.avgTransitScore) || 0) > 70 ? "Excellent" : (Number(signals.avgTransitScore) || 0) > 40 ? "Good" : "Limited",
          } : {
            level: (Number(signals.avgTransitScore) || 0) > 70 ? "Excellent" : (Number(signals.avgTransitScore) || 0) > 40 ? "Good" : "Limited",
            locked: true,
          },
          amenities: isPro ? {
            avgScore: Number(signals.avgAmenityScore) || 0,
            level: (Number(signals.avgAmenityScore) || 0) > 70 ? "Excellent" : (Number(signals.avgAmenityScore) || 0) > 40 ? "Good" : "Limited",
          } : {
            level: (Number(signals.avgAmenityScore) || 0) > 70 ? "Excellent" : (Number(signals.avgAmenityScore) || 0) > 40 ? "Good" : "Limited",
            locked: true,
          },
          floodRisk: {
            avgRisk: Number(signals.avgFloodRisk) || 0,
            level: (Number(signals.avgFloodRisk) || 0) > 0.5 ? "High" : (Number(signals.avgFloodRisk) || 0) > 0.1 ? "Moderate" : "Low",
          },
          buildingHealth: {
            avgScore: Math.round(Number(signals.avgBuildingHealth) || 0),
            level: (Number(signals.avgBuildingHealth) || 0) > 70 ? "Good" : (Number(signals.avgBuildingHealth) || 0) > 40 ? "Fair" : "Poor",
          },
        },
        isPro,
      };

      res.json(report);
    } catch (error) {
      console.error("Error generating neighborhood report:", error);
      res.status(500).json({ message: "Failed to generate neighborhood report" });
    }
  });

  // AI Chat route - Pro only
  app.post("/api/ai/chat", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { propertyId, geoId, question } = req.body;

      if (!question) {
        return res.status(400).json({ message: "Question is required" });
      }

      // Build context
      let context: any = {};
      
      if (propertyId) {
        const property = await storage.getProperty(propertyId);
        if (property) {
          context.property = property;
          
          // Get comps
          const comps = await storage.getComps(propertyId);
          if (comps.length > 0) {
            context.compsData = comps;
          }
          
          // Get market data for this property's ZIP
          const marketData = await storage.getMarketAggregates("zip", property.zipCode, {});
          if (marketData.length > 0) {
            context.marketData = marketData[0];
          }
        }
      } else if (geoId) {
        const marketData = await storage.getMarketAggregates("zip", geoId, {});
        if (marketData.length > 0) {
          context.marketData = marketData[0];
        }
      }

      const response = await analyzeProperty(question, context);

      // Save chat history
      await storage.createAiChat({
        userId,
        propertyId: propertyId || null,
        geoId: geoId || null,
        question,
        response,
      });

      res.json(response);
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: "Failed to process AI request" });
    }
  });

  // AI Deal Memo generation - Pro only
  app.post("/api/ai/deal-memo/:propertyId", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      
      // Get property data
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Get comps
      const comps = await storage.getComps(propertyId);
      
      // Get market data for this property's ZIP
      const marketData = await storage.getMarketAggregates("zip", property.zipCode, {});
      
      const memo = await generateDealMemo(
        property,
        marketData.length > 0 ? marketData[0] : null,
        comps
      );
      
      res.json(memo);
    } catch (error) {
      console.error("Error generating deal memo:", error);
      res.status(500).json({ message: "Failed to generate deal memo" });
    }
  });

  // AI Property Insights - Pro only (includes What Now feature)
  app.get("/api/ai/insights/:propertyId", optionalAuth, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.user?.id;
      
      // Get property data
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Get user tier
      const user = userId ? await storage.getUser(userId) : null;
      const userTier = (user?.subscriptionTier as "free" | "pro" | "premium") || "free";
      const isPro = userTier === "pro" || userTier === "premium";
      
      // Get property signals
      const signals = await storage.getPropertySignals(propertyId);
      
      // Get market data for this property's ZIP
      const marketData = await storage.getMarketAggregates("zip", property.zipCode, {});
      
      const insights = await generatePropertyInsights(
        property,
        signals ? {
          transitScore: signals.transitScore,
          buildingHealthScore: signals.buildingHealthScore,
          floodZone: signals.floodZone,
          floodRiskLevel: signals.floodRiskLevel,
          nearestSubwayStation: signals.nearestSubwayStation,
          nearestSubwayMeters: signals.nearestSubwayMeters,
          openHpdViolations: signals.openHpdViolations,
          dobComplaints12m: signals.dobComplaints12m,
          activePermits: signals.activePermits,
          signalConfidence: signals.signalConfidence,
        } : null,
        marketData.length > 0 ? marketData[0] : null,
        userTier
      );
      
      // For free users, return a preview (headline insights only, blur rest)
      if (!isPro) {
        res.json({
          investmentSummary: insights.investmentSummary,
          headlineInsights: insights.headlineInsights,
          riskAssessment: {
            level: insights.riskAssessment.level,
            factors: [], // Hidden for free users
          },
          valueDrivers: [], // Hidden for free users
          concerns: [], // Hidden for free users
          neighborhoodTrends: "", // Hidden for free users
          neighborhoodEvidence: [],
          buyerProfile: "", // Hidden for free users
          whatNow: [], // Hidden for free users
          generatedAt: insights.generatedAt,
          isPreview: true,
        });
        return;
      }
      
      res.json({ ...insights, isPreview: false });
    } catch (error) {
      console.error("Error generating property insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // Investment Scenario Calculator - Pro only
  app.post("/api/ai/scenario/:propertyId", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const inputs: ScenarioInputs = req.body;
      
      // Validate inputs
      if (!inputs.purchasePrice || inputs.purchasePrice <= 0) {
        return res.status(400).json({ message: "Valid purchase price is required" });
      }
      
      // Get property data for context
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      // Calculate financial metrics
      const results = calculateScenario(inputs);
      
      // Get AI assessment
      const aiAssessment = await analyzeScenario(property, inputs, results);
      
      res.json({
        inputs,
        results,
        aiAssessment,
      });
    } catch (error: any) {
      console.error("Error in AI scenario analysis:", error?.message || error);
      res.status(500).json({ message: error?.message || "Failed to analyze scenario" });
    }
  });

  // Quick scenario calculation (no AI, just numbers)
  app.post("/api/scenario/calculate", isAuthenticated, async (req: any, res) => {
    try {
      const inputs: ScenarioInputs = req.body;
      
      if (!inputs.purchasePrice || inputs.purchasePrice <= 0) {
        return res.status(400).json({ message: "Valid purchase price is required" });
      }
      
      const results = calculateScenario(inputs);
      res.json(results);
    } catch (error) {
      console.error("Error calculating scenario:", error);
      res.status(500).json({ message: "Failed to calculate scenario" });
    }
  });

  // Coverage matrix routes (admin)
  app.get("/api/admin/coverage", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const coverage = await storage.getCoverageMatrix();
      res.json(coverage);
    } catch (error) {
      console.error("Error fetching coverage:", error);
      res.status(500).json({ message: "Failed to fetch coverage" });
    }
  });

  // Data sources routes (admin)
  app.get("/api/admin/data-sources", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const sources = await storage.getDataSources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching data sources:", error);
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  // ETL status (admin) - mock for now
  app.get("/api/admin/etl-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json({
        lastRun: new Date().toISOString(),
        status: "healthy",
        recordsProcessed: 45823,
        errors: 0,
      });
    } catch (error) {
      console.error("Error fetching ETL status:", error);
      res.status(500).json({ message: "Failed to fetch ETL status" });
    }
  });

  // Export routes - Pro only
  app.get("/api/export/market-report", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const { geoType, geoId, propertyType, bedsBand, yearBuiltBand, format } = req.query;
      
      if (!geoType || !geoId) {
        return res.status(400).json({ message: "geoType and geoId are required" });
      }
      
      const aggregates = await storage.getMarketAggregates(
        geoType as string,
        geoId as string,
        { propertyType, bedsBand, yearBuiltBand }
      );
      
      const data = aggregates[0] || {};
      const exportFormat = format || "csv";
      
      if (exportFormat === "csv") {
        const headers = [
          "Geography", "Type", "Median Price", "Median $/sqft", "P25 Price", "P75 Price",
          "Transaction Count", "Turnover Rate", "3mo Trend", "12mo Trend"
        ];
        const values = [
          geoId, geoType, data.medianPrice || "N/A", data.medianPricePerSqft || "N/A",
          data.p25Price || "N/A", data.p75Price || "N/A", data.transactionCount || 0,
          data.turnoverRate || 0, data.trend3m || 0, data.trend12m || 0
        ];
        
        const csv = headers.join(",") + "\n" + values.join(",");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=market-report-${geoId}.csv`);
        res.send(csv);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=market-report-${geoId}.json`);
        res.json({
          geography: { type: geoType, id: geoId },
          filters: { propertyType, bedsBand, yearBuiltBand },
          data,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error exporting market report:", error);
      res.status(500).json({ message: "Failed to export market report" });
    }
  });

  app.get("/api/export/property-dossier/:id", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      const comps = await storage.getComps(req.params.id);
      const sales = await storage.getSalesForProperty(req.params.id);
      const marketData = await storage.getMarketAggregates("zip", property.zipCode, {});
      
      const dossier = {
        property,
        comparables: comps,
        salesHistory: sales,
        marketContext: marketData[0] || null,
        exportedAt: new Date().toISOString(),
      };
      
      const format = req.query.format || "json";
      
      if (format === "csv") {
        const headers = [
          "Address", "City", "State", "ZIP", "Property Type", "Beds", "Baths",
          "Sqft", "Year Built", "Estimated Value", "Opportunity Score",
          "Price/Sqft", "Confidence Level"
        ];
        const values = [
          property.address, property.city, property.state, property.zipCode,
          property.propertyType, property.beds, property.baths, property.sqft,
          property.yearBuilt, property.estimatedValue, property.opportunityScore,
          property.pricePerSqft, property.confidenceLevel
        ];
        
        let csv = "PROPERTY DETAILS\n";
        csv += headers.join(",") + "\n";
        csv += values.join(",") + "\n\n";
        
        if (comps.length > 0) {
          csv += "COMPARABLE SALES\n";
          csv += "Address,City,Sale Price,Sale Date,Distance,Similarity Score\n";
          comps.forEach((comp: any) => {
            csv += `${comp.address},${comp.city},${comp.salePrice},${comp.saleDate},${comp.distanceMiles},${comp.similarityScore}\n`;
          });
        }
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=property-dossier-${req.params.id}.csv`);
        res.send(csv);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=property-dossier-${req.params.id}.json`);
        res.json(dossier);
      }
    } catch (error) {
      console.error("Error exporting property dossier:", error);
      res.status(500).json({ message: "Failed to export property dossier" });
    }
  });

  app.get("/api/export/opportunities", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const stateParam = req.query.state as string | undefined;
      const validStates = ["NY", "NJ", "CT"] as const;
      const state = stateParam && validStates.includes(stateParam as any) ? stateParam as "NY" | "NJ" | "CT" : undefined;
      
      const filters: ScreenerFilters = {
        state,
        zipCodes: req.query.zipCodes ? (req.query.zipCodes as string).split(",") : undefined,
        cities: req.query.cities ? (req.query.cities as string).split(",") : undefined,
        propertyTypes: req.query.propertyTypes ? (req.query.propertyTypes as string).split(",") as any : undefined,
        priceMin: req.query.priceMin ? parseInt(req.query.priceMin as string) : undefined,
        priceMax: req.query.priceMax ? parseInt(req.query.priceMax as string) : undefined,
        opportunityScoreMin: req.query.opportunityScoreMin ? parseInt(req.query.opportunityScoreMin as string) : undefined,
      };
      
      const properties = await storage.getProperties(filters, 500, 0);
      const format = req.query.format || "csv";
      
      if (format === "csv") {
        const headers = [
          "ID", "Address", "City", "State", "ZIP", "Property Type",
          "Beds", "Baths", "Sqft", "Year Built", "Estimated Value",
          "Opportunity Score", "Price/Sqft", "Confidence Level"
        ];
        
        let csv = headers.join(",") + "\n";
        properties.forEach((p: any) => {
          csv += [
            p.id, `"${p.address}"`, p.city, p.state, p.zipCode, p.propertyType,
            p.beds, p.baths, p.sqft, p.yearBuilt, p.estimatedValue,
            p.opportunityScore, p.pricePerSqft, p.confidenceLevel
          ].join(",") + "\n";
        });
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=opportunities-export.csv`);
        res.send(csv);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=opportunities-export.json`);
        res.json({
          filters,
          count: properties.length,
          properties,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error exporting opportunities:", error);
      res.status(500).json({ message: "Failed to export opportunities" });
    }
  });

  app.get("/api/export/admin-data", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const coverage = await storage.getCoverageMatrix();
      const sources = await storage.getDataSources();
      
      const exportData = {
        coverage,
        dataSources: sources,
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
      };
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=admin-data-export.json`);
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting admin data:", error);
      res.status(500).json({ message: "Failed to export admin data" });
    }
  });

  // ============================================
  // PREMIUM BULK EXPORT ROUTES
  // ============================================

  app.get("/api/export/bulk/watchlist/:watchlistId", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const watchlist = await storage.getWatchlist(req.params.watchlistId);
      
      if (!watchlist) {
        return res.status(404).json({ message: "Watchlist not found" });
      }
      
      if (watchlist.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const properties = await storage.getWatchlistProperties(req.params.watchlistId);
      const format = req.query.format || "csv";
      
      if (format === "csv") {
        const headers = [
          "ID", "Address", "City", "State", "ZIP", "Property Type",
          "Beds", "Baths", "Sqft", "Year Built", "Estimated Value",
          "Opportunity Score", "Price/Sqft", "Confidence Level"
        ];
        
        let csv = `# Watchlist: ${watchlist.name}\n`;
        csv += `# Exported: ${new Date().toISOString()}\n`;
        csv += `# Total Properties: ${properties.length}\n\n`;
        csv += headers.join(",") + "\n";
        
        properties.forEach((p: any) => {
          csv += [
            p.id, `"${p.address}"`, p.city, p.state, p.zipCode, p.propertyType,
            p.beds, p.baths, p.sqft, p.yearBuilt, p.estimatedValue,
            p.opportunityScore, p.pricePerSqft, p.confidenceLevel
          ].join(",") + "\n";
        });
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=watchlist-${watchlist.name.replace(/\s+/g, "-")}.csv`);
        res.send(csv);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=watchlist-${watchlist.name.replace(/\s+/g, "-")}.json`);
        res.json({
          watchlist: {
            id: watchlist.id,
            name: watchlist.name,
          },
          count: properties.length,
          properties,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error exporting watchlist:", error);
      res.status(500).json({ message: "Failed to export watchlist" });
    }
  });

  app.get("/api/export/bulk/portfolio", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const watchlists = await storage.getWatchlists(userId);
      
      const portfolioData: any[] = [];
      
      for (const watchlist of watchlists) {
        const properties = await storage.getWatchlistProperties(watchlist.id);
        properties.forEach((p: any) => {
          portfolioData.push({
            ...p,
            watchlistName: watchlist.name,
          });
        });
      }
      
      const uniqueProperties = Array.from(
        new Map(portfolioData.map(p => [p.id, p])).values()
      );
      
      let totalValue = 0;
      let scoreSum = 0;
      let scoreCount = 0;
      
      uniqueProperties.forEach((p: any) => {
        if (p.estimatedValue) totalValue += Number(p.estimatedValue);
        if (p.opportunityScore) {
          scoreSum += p.opportunityScore;
          scoreCount++;
        }
      });
      
      const format = req.query.format || "csv";
      
      if (format === "csv") {
        const headers = [
          "ID", "Address", "City", "State", "ZIP", "Property Type",
          "Beds", "Baths", "Sqft", "Year Built", "Estimated Value",
          "Opportunity Score", "Price/Sqft", "Confidence Level", "Watchlist"
        ];
        
        let csv = `# Portfolio Export\n`;
        csv += `# Exported: ${new Date().toISOString()}\n`;
        csv += `# Total Properties: ${uniqueProperties.length}\n`;
        csv += `# Total Estimated Value: $${totalValue.toLocaleString()}\n`;
        csv += `# Average Opportunity Score: ${scoreCount > 0 ? Math.round(scoreSum / scoreCount) : "N/A"}\n\n`;
        csv += headers.join(",") + "\n";
        
        uniqueProperties.forEach((p: any) => {
          csv += [
            p.id, `"${p.address}"`, p.city, p.state, p.zipCode, p.propertyType,
            p.beds, p.baths, p.sqft, p.yearBuilt, p.estimatedValue,
            p.opportunityScore, p.pricePerSqft, p.confidenceLevel, `"${p.watchlistName}"`
          ].join(",") + "\n";
        });
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=portfolio-export.csv`);
        res.send(csv);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=portfolio-export.json`);
        res.json({
          summary: {
            totalProperties: uniqueProperties.length,
            totalWatchlists: watchlists.length,
            totalEstimatedValue: totalValue,
            averageOpportunityScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
          },
          watchlists: watchlists.map(w => ({ id: w.id, name: w.name })),
          properties: uniqueProperties,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error exporting portfolio:", error);
      res.status(500).json({ message: "Failed to export portfolio" });
    }
  });

  app.post("/api/export/bulk/dossiers", isAuthenticated, requirePremium, async (req: any, res) => {
    try {
      const { propertyIds } = req.body;
      
      if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
        return res.status(400).json({ message: "propertyIds array is required" });
      }
      
      if (propertyIds.length > 50) {
        return res.status(400).json({ message: "Maximum 50 properties per batch export" });
      }
      
      const dossiers: any[] = [];
      
      for (const propertyId of propertyIds) {
        const property = await storage.getProperty(propertyId);
        if (property) {
          const comps = await storage.getComps(propertyId);
          const sales = await storage.getSalesForProperty(propertyId);
          
          dossiers.push({
            property,
            comparables: comps,
            salesHistory: sales,
          });
        }
      }
      
      const format = req.query.format || "json";
      
      if (format === "csv") {
        let csv = `# Batch Property Dossiers\n`;
        csv += `# Exported: ${new Date().toISOString()}\n`;
        csv += `# Total Properties: ${dossiers.length}\n\n`;
        
        const headers = [
          "ID", "Address", "City", "State", "ZIP", "Property Type",
          "Beds", "Baths", "Sqft", "Year Built", "Estimated Value",
          "Opportunity Score", "Price/Sqft", "Num Comps", "Num Sales"
        ];
        csv += headers.join(",") + "\n";
        
        dossiers.forEach((d: any) => {
          const p = d.property;
          csv += [
            p.id, `"${p.address}"`, p.city, p.state, p.zipCode, p.propertyType,
            p.beds, p.baths, p.sqft, p.yearBuilt, p.estimatedValue,
            p.opportunityScore, p.pricePerSqft, d.comparables.length, d.salesHistory.length
          ].join(",") + "\n";
        });
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=batch-dossiers.csv`);
        res.send(csv);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename=batch-dossiers.json`);
        res.json({
          count: dossiers.length,
          dossiers,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error exporting batch dossiers:", error);
      res.status(500).json({ message: "Failed to export batch dossiers" });
    }
  });

  // ============================================
  // STRIPE SUBSCRIPTION ROUTES
  // ============================================

  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let subscriptionDetails = null;
      if (user.stripeSubscriptionId) {
        try {
          const subscription = await stripeService.getSubscription(user.stripeSubscriptionId);
          if (subscription) {
            subscriptionDetails = {
              currentPeriodEnd: subscription.current_period_end,
              currentPeriodStart: subscription.current_period_start,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              cancelAt: subscription.cancel_at,
              canceledAt: subscription.canceled_at,
            };
          }
        } catch (subError) {
          console.error("Error fetching subscription details:", subError);
        }
      }

      res.json({
        tier: user.subscriptionTier || "free",
        status: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        subscriptionDetails,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.get("/api/usage-limits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limits = await usageService.getRemainingLimits(userId);
      res.json(limits);
    } catch (error) {
      console.error("Error fetching usage limits:", error);
      res.status(500).json({ message: "Failed to fetch usage limits" });
    }
  });

  // Helper to get the correct base URL in production (handles proxy protocol detection)
  const getBaseUrl = (req: any): string => {
    // Check X-Forwarded-Proto header first (set by reverse proxies)
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
    // In production, always use HTTPS
    const finalProtocol = process.env.NODE_ENV === 'production' ? 'https' : protocol;
    return `${finalProtocol}://${req.get('host')}`;
  };

  app.post("/api/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { priceId } = req.body;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
        return res.status(400).json({ message: "Invalid price ID format" });
      }

      // Validate that the price is for Pro or Premium plan
      const priceValidation = await stripeService.isValidSubscriptionPrice(priceId);
      if (!priceValidation.valid) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
        const customer = await stripeService.createCustomer(user.email, user.id, fullName);
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const baseUrl = getBaseUrl(req);
      let session;
      try {
        session = await stripeService.createCheckoutSession(
          customerId,
          priceId,
          `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          `${baseUrl}/pricing`
        );
      } catch (stripeError: any) {
        if (stripeError?.message?.includes("No such customer")) {
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
          const newCustomer = await stripeService.createCustomer(user.email, user.id, fullName);
          await storage.updateUserStripeInfo(user.id, { stripeCustomerId: newCustomer.id });
          customerId = newCustomer.id;
          session = await stripeService.createCheckoutSession(
            customerId,
            priceId,
            `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            `${baseUrl}/pricing`
          );
        } else {
          throw stripeError;
        }
      }

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Unable to process checkout request" });
    }
  });

  // Guest checkout - no account required, payment-first flow
  app.post("/api/checkout/guest", async (req: any, res) => {
    try {
      const { priceId } = req.body;

      if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
        return res.status(400).json({ message: "Invalid price ID format" });
      }

      // Validate that the price is for Pro or Premium plan
      const priceValidation = await stripeService.isValidSubscriptionPrice(priceId);
      if (!priceValidation.valid) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }

      const baseUrl = getBaseUrl(req);
      const session = await stripeService.createGuestCheckoutSession(
        priceId,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/pricing`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating guest checkout session:", error);
      res.status(500).json({ message: "Unable to process checkout request" });
    }
  });

  // Activate account - set password after payment
  app.post("/api/auth/activate", async (req: any, res) => {
    try {
      const { token, password } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "Invalid activation token" });
      }

      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Hash the token to compare with stored hash
      const tokenHash = hashActivationToken(token);

      // Find user by activation token hash
      const result = await storage.getUserByActivationToken(tokenHash);
      
      if (!result) {
        return res.status(400).json({ message: "Invalid or expired activation link" });
      }

      // Check if token is expired
      if (result.activationTokenExpiresAt && new Date() > new Date(result.activationTokenExpiresAt)) {
        return res.status(410).json({ 
          message: "Activation link has expired. Please request a new one.",
          expired: true 
        });
      }

      // Hash password and activate user
      const passwordHash = await hashPassword(password);
      await storage.activateUser(result.id, passwordHash);

      // Log the user in automatically
      const user = await storage.getUser(result.id);
      if (user) {
        req.login({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }, (err: any) => {
          if (err) {
            console.error("Error logging in after activation:", err);
            return res.json({ 
              success: true, 
              message: "Account activated! Please log in.",
              requiresLogin: true 
            });
          }
          res.json({ 
            success: true, 
            message: "Account activated!",
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
            }
          });
        });
      } else {
        res.json({ 
          success: true, 
          message: "Account activated! Please log in.",
          requiresLogin: true 
        });
      }
    } catch (error) {
      console.error("Error activating account:", error);
      res.status(500).json({ message: "Failed to activate account" });
    }
  });

  // Resend activation email
  app.post("/api/auth/resend-activation", async (req: any, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Don't reveal if email exists
        return res.json({ message: "If an account exists with that email, a new activation link has been sent." });
      }

      if (user.status !== 'pending_activation') {
        return res.json({ message: "This account is already activated. Please log in." });
      }

      // Generate new activation token
      const { token, hash, expiresAt } = generateActivationToken();
      await storage.updateActivationToken(user.id, hash, expiresAt);

      // Determine tier for email
      const tier = user.subscriptionTier === 'premium' ? 'premium' : 'pro';
      await sendActivationEmail(email, token, tier as 'pro' | 'premium');

      res.json({ message: "If an account exists with that email, a new activation link has been sent." });
    } catch (error) {
      console.error("Error resending activation:", error);
      res.status(500).json({ message: "Failed to resend activation email" });
    }
  });

  app.post("/api/billing-portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !user.stripeCustomerId) {
        return res.status(400).json({ message: "No billing account found" });
      }

      const baseUrl = getBaseUrl(req);
      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/settings`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const rows = await stripeService.listProductsWithPrices(true);
      
      // Helper to parse JSON fields that might be strings
      const parseJsonField = (field: any) => {
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch {
            return field;
          }
        }
        return field;
      };
      
      const productsMap = new Map();
      for (const row of rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: parseJsonField(row.product_metadata),
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: parseJsonField(row.recurring),
            active: row.price_active,
            metadata: parseJsonField(row.price_metadata),
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error listing products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // ============================================
  // API KEY MANAGEMENT ROUTES
  // ============================================

  app.get("/api/api-keys", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const apiKey = await apiKeyService.getApiKeyForUser(req.user.id);
      if (!apiKey) {
        return res.json({ hasKey: false, apiKey: null });
      }
      res.json({
        hasKey: true,
        apiKey: {
          id: apiKey.id,
          prefix: apiKey.prefix,
          lastFour: apiKey.lastFour,
          name: apiKey.name,
          status: apiKey.status,
          lastUsedAt: apiKey.lastUsedAt,
          requestCount: apiKey.requestCount,
          createdAt: apiKey.createdAt,
        },
      });
    } catch (error) {
      console.error("Error fetching API key:", error);
      res.status(500).json({ message: "Failed to fetch API key" });
    }
  });

  app.post("/api/api-keys/generate", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      const { apiKey, rawKey } = await apiKeyService.generateApiKey(req.user.id);
      res.json({
        apiKey: {
          id: apiKey.id,
          prefix: apiKey.prefix,
          lastFour: apiKey.lastFour,
          name: apiKey.name,
          status: apiKey.status,
          createdAt: apiKey.createdAt,
        },
        rawKey,
        warning: "This is the only time you will see the full API key. Store it securely.",
      });
    } catch (error: any) {
      console.error("Error generating API key:", error);
      res.status(400).json({ message: error.message || "Failed to generate API key" });
    }
  });

  app.post("/api/api-keys/:id/revoke", isAuthenticated, requirePro, async (req: any, res) => {
    try {
      await apiKeyService.revokeApiKey(req.user.id, req.params.id);
      res.json({ success: true, message: "API key revoked" });
    } catch (error: any) {
      console.error("Error revoking API key:", error);
      res.status(400).json({ message: error.message || "Failed to revoke API key" });
    }
  });

  // ============================================
  // SAVED SEARCH ROUTES
  // ============================================

  // Get all saved searches for user
  app.get("/api/saved-searches", isAuthenticated, async (req: any, res) => {
    try {
      const searches = await storage.getSavedSearches(req.user.id);
      res.json(searches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  // Get single saved search
  app.get("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const search = await storage.getSavedSearch(req.params.id);
      if (!search || search.userId !== req.user.id) {
        return res.status(404).json({ message: "Saved search not found" });
      }
      res.json(search);
    } catch (error) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ message: "Failed to fetch saved search" });
    }
  });

  // Create saved search
  app.post("/api/saved-searches", isAuthenticated, async (req: any, res) => {
    try {
      const { name, filters, frequency, emailEnabled, pushEnabled } = req.body;
      
      if (!name || !filters) {
        return res.status(400).json({ message: "Name and filters are required" });
      }

      // Extract normalized fields from filters for indexing
      const normalizedData: any = {
        userId: req.user.id,
        name,
        filters,
        frequency: frequency || "daily",
        emailEnabled: emailEnabled !== false,
        pushEnabled: pushEnabled || false,
        isActive: true,
      };

      // Denormalize filter fields for efficient queries
      if (filters.state) normalizedData.state = filters.state;
      if (filters.cities?.length) normalizedData.cities = filters.cities;
      if (filters.zipCodes?.length) normalizedData.zipCodes = filters.zipCodes;
      if (filters.priceMin) normalizedData.priceMin = filters.priceMin;
      if (filters.priceMax) normalizedData.priceMax = filters.priceMax;
      if (filters.opportunityScoreMin) normalizedData.opportunityScoreMin = filters.opportunityScoreMin;
      
      // NYC signal thresholds
      if (filters.transitScoreMin) normalizedData.transitScoreMin = filters.transitScoreMin;
      if (filters.buildingHealthMin) normalizedData.buildingHealthMin = filters.buildingHealthMin;
      if (filters.floodRiskMax) normalizedData.floodRiskMax = filters.floodRiskMax;

      const search = await storage.createSavedSearch(normalizedData);
      res.status(201).json(search);
    } catch (error) {
      console.error("Error creating saved search:", error);
      res.status(500).json({ message: "Failed to create saved search" });
    }
  });

  // Update saved search
  app.patch("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { name, filters, frequency, emailEnabled, pushEnabled, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (frequency !== undefined) updateData.frequency = frequency;
      if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;
      if (pushEnabled !== undefined) updateData.pushEnabled = pushEnabled;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      if (filters !== undefined) {
        updateData.filters = filters;
        // Update normalized fields
        updateData.state = filters.state || null;
        updateData.cities = filters.cities?.length ? filters.cities : null;
        updateData.zipCodes = filters.zipCodes?.length ? filters.zipCodes : null;
        updateData.priceMin = filters.priceMin || null;
        updateData.priceMax = filters.priceMax || null;
        updateData.opportunityScoreMin = filters.opportunityScoreMin || null;
        updateData.transitScoreMin = filters.transitScoreMin || null;
        updateData.buildingHealthMin = filters.buildingHealthMin || null;
        updateData.floodRiskMax = filters.floodRiskMax || null;
      }

      const updated = await storage.updateSavedSearch(req.params.id, req.user.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Saved search not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating saved search:", error);
      res.status(500).json({ message: "Failed to update saved search" });
    }
  });

  // Delete saved search
  app.delete("/api/saved-searches/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteSavedSearch(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  // Get matching properties count for a saved search
  app.post("/api/saved-searches/preview", isAuthenticated, async (req: any, res) => {
    try {
      const { filters } = req.body;
      if (!filters) {
        return res.status(400).json({ message: "Filters are required" });
      }

      const properties = await storage.getProperties(filters, 100, 0);
      res.json({ matchCount: properties.length, preview: properties.slice(0, 5) });
    } catch (error) {
      console.error("Error previewing saved search:", error);
      res.status(500).json({ message: "Failed to preview saved search" });
    }
  });

  // ============================================
  // NOTIFICATION JOB ENDPOINTS (Admin/Cron)
  // ============================================

  // Trigger daily digest job (can be called by external cron or admin)
  app.post("/api/notifications/daily-digest", async (req, res) => {
    try {
      const cronSecret = req.headers["x-cron-secret"];
      if (cronSecret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      console.log("[Cron] Starting daily digest job...");
      await processDailyDigest();
      console.log("[Cron] Daily digest job completed");
      res.json({ success: true, message: "Daily digest processed" });
    } catch (error) {
      console.error("[Cron] Error processing daily digest:", error);
      res.status(500).json({ message: "Failed to process daily digest" });
    }
  });

  // Trigger instant alerts job (can be called frequently)
  app.post("/api/notifications/instant-alerts", async (req, res) => {
    try {
      const cronSecret = req.headers["x-cron-secret"];
      if (cronSecret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      console.log("[Cron] Starting instant alerts job...");
      await processInstantAlerts();
      console.log("[Cron] Instant alerts job completed");
      res.json({ success: true, message: "Instant alerts processed" });
    } catch (error) {
      console.error("[Cron] Error processing instant alerts:", error);
      res.status(500).json({ message: "Failed to process instant alerts" });
    }
  });

  // ============================================
  // EXTERNAL API ROUTES (API key authenticated)
  // ============================================

  app.get("/api/external/properties", externalApiMiddleware, async (req: any, res: any) => {
    try {
      const filters: ScreenerFilters = {
        state: req.query.state as any,
        cities: req.query.cities ? (req.query.cities as string).split(",") : undefined,
        zipCodes: req.query.zipCodes ? (req.query.zipCodes as string).split(",") : undefined,
        propertyTypes: req.query.propertyTypes ? (req.query.propertyTypes as string).split(",") as any : undefined,
        opportunityScoreMin: req.query.opportunityScoreMin ? parseInt(req.query.opportunityScoreMin) : undefined,
        priceMin: req.query.priceMin ? parseInt(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? parseInt(req.query.priceMax) : undefined,
      };

      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const offset = parseInt(req.query.offset) || 0;

      const properties = await storage.getProperties(filters, limit, offset);
      res.json({
        success: true,
        data: properties,
        pagination: { limit, offset, count: properties.length },
      });
    } catch (error) {
      console.error("External API error:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch properties" });
    }
  });

  app.get("/api/external/properties/:id", externalApiMiddleware, async (req: any, res: any) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Not Found", message: "Property not found" });
      }
      res.json({ success: true, data: property });
    } catch (error) {
      console.error("External API error:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch property" });
    }
  });

  app.get("/api/external/market-stats", externalApiMiddleware, async (req: any, res: any) => {
    try {
      const { geoType, geoId } = req.query;
      if (!geoType || !geoId) {
        return res.status(400).json({ error: "Bad Request", message: "geoType and geoId are required" });
      }

      const aggregates = await storage.getMarketAggregates(geoType as string, geoId as string);
      res.json({ success: true, data: aggregates });
    } catch (error) {
      console.error("External API error:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch market stats" });
    }
  });

  app.get("/api/external/comps/:propertyId", externalApiMiddleware, async (req: any, res: any) => {
    try {
      const comps = await storage.getComps(req.params.propertyId);
      res.json({ success: true, data: comps });
    } catch (error) {
      console.error("External API error:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch comps" });
    }
  });

  app.get("/api/external/up-and-coming", externalApiMiddleware, async (req: any, res: any) => {
    try {
      const state = req.query.state as string | undefined;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      
      const zips = await storage.getUpAndComingZips(state, limit);
      res.json({ success: true, data: zips });
    } catch (error) {
      console.error("External API error:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch trending areas" });
    }
  });

  return httpServer;
}
