import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string | null;
    }
  }
}

const SALT_ROUNDS = 12;

class DrizzleSessionStore extends session.Store {
  constructor(private readonly ttlMs: number) {
    super();
  }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    void db.execute(sql`
      SELECT sess FROM sessions
      WHERE sid = ${sid} AND expire > NOW()
      LIMIT 1
    `).then((result: any) => {
      const value = result.rows?.[0]?.sess;
      callback(null, typeof value === "string" ? JSON.parse(value) : value ?? null);
    }).catch((error) => callback(error));
  }

  set(sid: string, value: session.SessionData, callback?: (err?: unknown) => void): void {
    const cookieExpiry = value.cookie?.expires ? new Date(value.cookie.expires) : null;
    const expiresAt = cookieExpiry && Number.isFinite(cookieExpiry.getTime())
      ? cookieExpiry
      : new Date(Date.now() + this.ttlMs);
    void db.execute(sql`
      INSERT INTO sessions (sid, sess, expire)
      VALUES (${sid}, ${JSON.stringify(value)}::jsonb, ${expiresAt})
      ON CONFLICT (sid) DO UPDATE
      SET sess = EXCLUDED.sess, expire = EXCLUDED.expire
    `).then(() => callback?.()).catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    void db.execute(sql`DELETE FROM sessions WHERE sid = ${sid}`)
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(sid: string, value: session.SessionData, callback?: (err?: unknown) => void): void {
    const cookieExpiry = value.cookie?.expires ? new Date(value.cookie.expires) : null;
    const expiresAt = cookieExpiry && Number.isFinite(cookieExpiry.getTime())
      ? cookieExpiry
      : new Date(Date.now() + this.ttlMs);
    void db.execute(sql`UPDATE sessions SET expire = ${expiresAt} WHERE sid = ${sid}`)
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const sessionStore = new DrizzleSessionStore(sessionTtl);
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          // Reject pending_activation users - they need to complete activation first
          if (user.status === "pending_activation") {
            return done(null, false, { message: "Please complete your account activation first. Check your email for the activation link." });
          }

          // Users without a password can't log in with password
          if (!user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (error) {
      done(error);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

export const optionalAuth: RequestHandler = (req, res, next) => {
  passport.authenticate("session", { session: true }, () => {
    next();
  })(req, res, next);
};

// Activation token utilities
const ACTIVATION_TOKEN_EXPIRY_MINUTES = 60; // 1 hour

export function generateActivationToken(): { token: string; hash: string; expiresAt: Date } {
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString("hex");
  // Hash the token for storage (SHA-256)
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  // Set expiry
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  
  return { token, hash, expiresAt };
}

export function hashActivationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
