import { DurableObject } from "cloudflare:workers";
import type { Request } from "express";

export type QuotaAction =
  | "search"
  | "property_unlock"
  | "pdf_export"
  | "ai_credit"
  | "developer_api";

export type SubscriptionTier = "anonymous" | "free" | "pro" | "premium";

export interface QuotaDecision {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  resetAt: number;
}

type QuotaRule = { limit: number; windowMs: number };

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 31 * DAY;

const RULES: Record<QuotaAction, Record<SubscriptionTier, QuotaRule>> = {
  search: {
    anonymous: { limit: 30, windowMs: DAY },
    free: { limit: 100, windowMs: DAY },
    pro: { limit: 1_000, windowMs: DAY },
    premium: { limit: 5_000, windowMs: DAY },
  },
  property_unlock: {
    anonymous: { limit: 0, windowMs: DAY },
    free: { limit: 5, windowMs: DAY },
    pro: { limit: 250, windowMs: DAY },
    premium: { limit: 1_000, windowMs: DAY },
  },
  pdf_export: {
    anonymous: { limit: 0, windowMs: WEEK },
    free: { limit: 1, windowMs: WEEK },
    pro: { limit: 100, windowMs: WEEK },
    premium: { limit: 500, windowMs: WEEK },
  },
  ai_credit: {
    anonymous: { limit: 0, windowMs: MONTH },
    free: { limit: 0, windowMs: MONTH },
    pro: { limit: 200, windowMs: MONTH },
    premium: { limit: 1_000, windowMs: MONTH },
  },
  developer_api: {
    anonymous: { limit: 0, windowMs: DAY },
    free: { limit: 0, windowMs: DAY },
    pro: { limit: 10_000, windowMs: DAY },
    premium: { limit: 100_000, windowMs: DAY },
  },
};

interface ConsumeInput {
  bucket: string;
  limit: number;
  windowMs: number;
  weight: number;
  now: number;
}

export class UsageQuota extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS quota_buckets (
          bucket TEXT PRIMARY KEY,
          used INTEGER NOT NULL,
          reset_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS quota_reset_at_idx ON quota_buckets(reset_at);
      `);
    });
  }

  async consume(input: ConsumeInput): Promise<QuotaDecision> {
    const { bucket, limit, windowMs, weight, now } = input;
    this.ctx.storage.sql.exec("DELETE FROM quota_buckets WHERE reset_at <= ?", now);
    const existing = this.ctx.storage.sql
      .exec<{ used: number; reset_at: number }>(
        "SELECT used, reset_at FROM quota_buckets WHERE bucket = ?",
        bucket,
      )
      .toArray()[0];

    const used = existing?.used ?? 0;
    const resetAt = existing?.reset_at ?? now + windowMs;
    const allowed = limit > 0 && used + weight <= limit;
    const nextUsed = allowed ? used + weight : used;

    if (allowed) {
      this.ctx.storage.sql.exec(
        `INSERT INTO quota_buckets (bucket, used, reset_at) VALUES (?, ?, ?)
         ON CONFLICT(bucket) DO UPDATE SET used = excluded.used, reset_at = excluded.reset_at`,
        bucket,
        nextUsed,
        resetAt,
      );
    }

    return {
      allowed,
      used: nextUsed,
      remaining: Math.max(0, limit - nextUsed),
      limit,
      resetAt,
    };
  }
}

let quotaNamespace: DurableObjectNamespace<UsageQuota> | undefined;

export function configureQuotaNamespace(namespace: DurableObjectNamespace<UsageQuota> | undefined): void {
  quotaNamespace = namespace;
}

function requestIp(req: Request): string {
  return String(req.headers["cf-connecting-ip"] || req.ip || "unknown");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeQuota(options: {
  req: Request;
  action: QuotaAction;
  tier: SubscriptionTier;
  subjectId?: string;
  weight?: number;
}): Promise<QuotaDecision | null> {
  if (!quotaNamespace) return null;

  const { req, action, tier } = options;
  const rule = RULES[action][tier];
  const rawSubject = options.subjectId || `ip:${requestIp(req)}`;
  const subjectHash = await sha256(rawSubject);
  const now = Date.now();
  const windowStart = Math.floor(now / rule.windowMs) * rule.windowMs;
  const bucket = `${action}:${tier}:${windowStart}`;
  const stub = quotaNamespace.getByName(subjectHash);
  return stub.consume({
    bucket,
    limit: rule.limit,
    windowMs: rule.windowMs,
    weight: Math.max(1, Math.floor(options.weight || 1)),
    now,
  });
}

export function getQuotaRule(action: QuotaAction, tier: SubscriptionTier): QuotaRule {
  return RULES[action][tier];
}
