import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { storage } from './storage';
import type { ApiKey, User } from '@shared/schema';

const SALT_ROUNDS = 10;
const KEY_PREFIX = 'rd_live_';

export interface ApiKeyWithRawKey {
  apiKey: ApiKey;
  rawKey: string;
}

export class ApiKeyService {
  async generateApiKey(userId: string): Promise<ApiKeyWithRawKey> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.subscriptionTier !== 'pro' || user.subscriptionStatus !== 'active') {
      throw new Error('Pro subscription required to generate API keys');
    }

    const existingKeys = await storage.getApiKeysForUser(userId);
    const activeKeys = existingKeys.filter(k => k.status === 'active');
    for (const key of activeKeys) {
      await storage.revokeApiKey(key.id);
    }

    const randomPart = crypto.randomBytes(24).toString('hex');
    const rawKey = `${KEY_PREFIX}${randomPart}`;
    
    const hashedKey = await bcrypt.hash(rawKey, SALT_ROUNDS);
    const lastFour = randomPart.slice(-4);

    const apiKey = await storage.createApiKey({
      userId,
      hashedKey,
      prefix: KEY_PREFIX,
      lastFour,
      name: 'Default API Key',
      status: 'active',
    });

    return { apiKey, rawKey };
  }

  async validateApiKey(rawKey: string): Promise<{ valid: boolean; user?: User; apiKey?: ApiKey }> {
    if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
      return { valid: false };
    }

    const lastFour = rawKey.slice(-4);
    const candidateKeys = await storage.getApiKeysByLastFour(lastFour);
    
    if (candidateKeys.length === 0) {
      return { valid: false };
    }

    for (const apiKey of candidateKeys) {
      if (apiKey.status !== 'active') continue;
      
      const isValid = await bcrypt.compare(rawKey, apiKey.hashedKey);
      if (isValid) {
        const user = await storage.getUser(apiKey.userId);
        if (!user) {
          return { valid: false };
        }

        if (user.subscriptionTier !== 'pro' || user.subscriptionStatus !== 'active') {
          return { valid: false };
        }

        await storage.incrementApiKeyUsage(apiKey.id);
        return { valid: true, user, apiKey };
      }
    }
    
    return { valid: false };
  }

  async getApiKeyForUser(userId: string): Promise<ApiKey | undefined> {
    const keys = await storage.getApiKeysForUser(userId);
    return keys.find(k => k.status === 'active');
  }

  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    const apiKey = await storage.getApiKey(keyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }
    if (apiKey.userId !== userId) {
      throw new Error('Unauthorized');
    }
    await storage.revokeApiKey(keyId);
  }

  async regenerateApiKey(userId: string): Promise<ApiKeyWithRawKey> {
    return this.generateApiKey(userId);
  }
}

export const apiKeyService = new ApiKeyService();
