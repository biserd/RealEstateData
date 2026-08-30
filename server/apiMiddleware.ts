import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from './apiKeyService';
import type { User as AppUser, ApiKey } from '@shared/schema';
import { consumeQuota, type SubscriptionTier } from './quota';

declare global {
  namespace Express {
    interface Request {
      apiUser?: AppUser;
      apiKey?: ApiKey;
    }
  }
}

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

export async function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const keyId = req.apiKey?.id;
  if (!keyId) {
    return next();
  }
  const user = req.apiUser;
  const tier: SubscriptionTier = user?.subscriptionTier === 'premium' && user.subscriptionStatus === 'active'
    ? 'premium'
    : user?.subscriptionTier === 'pro' && user.subscriptionStatus === 'active'
      ? 'pro'
      : 'free';
  const decision = await consumeQuota({
    req,
    action: 'developer_api',
    tier,
    subjectId: `api-key:${keyId}`,
  });
  if (!decision) return next();

  res.setHeader('X-RateLimit-Limit', decision.limit);
  res.setHeader('X-RateLimit-Remaining', decision.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(decision.resetAt / 1000));
  if (decision.allowed) return next();
  return res.status(429).json({
    error: 'Too Many Requests',
    message: 'Daily API request quota exceeded.',
    retryAfter: Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000)),
  });
}

export const externalApiMiddleware = [apiKeyAuth, apiRateLimit];
