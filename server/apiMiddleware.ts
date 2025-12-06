import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from './apiKeyService';
import type { User, ApiKey } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      apiUser?: User;
      apiKey?: ApiKey;
    }
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function cleanupRateLimitStore() {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, value] of entries) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupRateLimitStore, 60 * 1000);

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Include it in the x-api-key header.',
      docs: '/developers',
    });
  }

  try {
    const result = await apiKeyService.validateApiKey(apiKey);
    
    if (!result.valid || !result.user || !result.apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired API key.',
        docs: '/developers',
      });
    }

    req.apiUser = result.user;
    req.apiKey = result.apiKey;
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate API key.',
    });
  }
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const keyId = req.apiKey?.id;
  if (!keyId) {
    return next();
  }

  const now = Date.now();
  let entry = rateLimitStore.get(keyId);
  
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(keyId, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute.`,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  next();
}

export const externalApiMiddleware = [apiKeyAuth, apiRateLimit];
