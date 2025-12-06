import type { Express } from "express";
import { type Server } from "http";
import passport from "passport";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, hashPassword } from "./auth";
import { analyzeProperty, analyzeMarket, generateDealMemo, calculateScenario, analyzeScenario, type ScenarioInputs } from "./openai";
import { insertWatchlistSchema, insertAlertSchema, insertNotificationSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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
        (err) => {
          if (err) {
            console.error("Login after register error:", err);
            return res.status(500).json({ message: "Registration successful but login failed" });
          }
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

  app.get("/api/properties/screener", async (req, res) => {
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
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const properties = await storage.getProperties(filters, limit, offset);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching screener properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/area", async (req, res) => {
    try {
      const { geoType, geoId, limit } = req.query;
      if (!geoType || !geoId) {
        return res.status(400).json({ message: "geoType and geoId are required" });
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

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.get("/api/properties/:id/comps", async (req, res) => {
    try {
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

  // Search routes - public read access
  app.get("/api/search/geo", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const results = await storage.searchGeo(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching geo:", error);
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      if (watchlist.userId !== req.user.claims.sub) {
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
        const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const alerts = await storage.getAlerts(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertAlertSchema.parse({ ...req.body, userId });
      const alert = await storage.createAlert(parsed);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(500).json({ message: "Failed to create alert" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // AI Chat route
  app.post("/api/ai/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // AI Deal Memo generation
  app.post("/api/ai/deal-memo/:propertyId", isAuthenticated, async (req: any, res) => {
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

  // Investment Scenario Calculator
  app.post("/api/ai/scenario/:propertyId", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error calculating scenario:", error);
      res.status(500).json({ message: "Failed to calculate scenario" });
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
      const user = await storage.getUser(req.user.claims.sub);
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
      const user = await storage.getUser(req.user.claims.sub);
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
      const user = await storage.getUser(req.user.claims.sub);
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

  // Export routes
  app.get("/api/export/market-report", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/export/property-dossier/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/export/opportunities", isAuthenticated, async (req: any, res) => {
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
      const user = await storage.getUser(req.user.claims.sub);
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

  return httpServer;
}
