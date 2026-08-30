import type { NextFunction, Request, Response } from "express";

interface SiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export function turnstileConfig() {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || "";
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() || "";
  return { enabled: Boolean(siteKey && secretKey), siteKey };
}

export function requireTurnstile(expectedAction: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secretKey) return next();

    const body = req.body as Record<string, unknown> | undefined;
    const token = String(body?.turnstileToken || req.get("x-turnstile-token") || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Please complete the security check.", code: "turnstile_required" });
    }

    try {
      const form = new FormData();
      form.set("secret", secretKey);
      form.set("response", token);
      const remoteIp = req.get("cf-connecting-ip");
      if (remoteIp) form.set("remoteip", remoteIp);
      form.set("idempotency_key", crypto.randomUUID());

      const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: form,
      });
      const result = await verification.json<SiteverifyResponse>();
      const actionMatches = !result.action || result.action === expectedAction;
      if (!result.success || !actionMatches) {
        console.warn(JSON.stringify({
          level: "warn",
          source: "turnstile",
          action: expectedAction,
          errors: result["error-codes"] || [],
          timestamp: new Date().toISOString(),
        }));
        return res.status(400).json({ message: "Security check failed. Please try again.", code: "turnstile_failed" });
      }
      return next();
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        source: "turnstile",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
      return res.status(503).json({ message: "Security check is temporarily unavailable." });
    }
  };
}
