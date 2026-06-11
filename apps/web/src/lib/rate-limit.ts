/**
 * Rosovia — Rate Limiting Utility
 * File: apps/web/src/lib/rate-limit.ts
 *
 * Provides a lightweight rate limiter utilizing Upstash Redis when configured,
 * with a sliding-expiration in-memory clean-up map as fallback for local development.
 */

import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  redisClient = new Redis({
    url: redisUrl,
    token: redisToken,
  });
} else {
  // Silent fallback so we don't spam test/dev logs unnecessarily
  if (process.env.NODE_ENV !== 'test') {
    console.warn('UPSTASH_REDIS_REST_URL/TOKEN not configured. Falling back to local in-memory rate limiting.');
  }
}

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

// In-memory store for tracking request counts.
const rateLimitStore = new Map<string, RateLimitTracker>();

// Periodically clean up expired tracker keys every 5 minutes
if (typeof global !== 'undefined') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (interval && typeof interval.unref === 'function') {
    interval.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // UTC timestamp when count resets
}

/**
 * Checks request limits for a given identifier.
 *
 * @param identifier Unique request key to track limits against (IP address, user UUID)
 * @param limit Maximum number of allowed requests in the time window
 * @param windowMs Time window size in milliseconds (e.g. 60000 for 1 minute)
 */
export async function rateLimit(
  identifier: string,
  limit = 60,
  windowMs = 60000
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`;

  if (redisClient) {
    try {
      const current = await redisClient.incr(key);
      let ttl = await redisClient.ttl(key);
      if (current === 1 || ttl === -1) {
        await redisClient.expire(key, Math.ceil(windowMs / 1000));
        ttl = Math.ceil(windowMs / 1000);
      }
      const reset = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
      return {
        success: current <= limit,
        limit,
        remaining: Math.max(0, limit - current),
        reset,
      };
    } catch (err) {
      console.error('Upstash Redis rate limit failed, falling back to in-memory store:', err);
    }
  }

  // Fallback to In-Memory
  const now = Date.now();
  const tracker = rateLimitStore.get(key);

  if (!tracker || now > tracker.resetTime) {
    const newTracker: RateLimitTracker = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, newTracker);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: newTracker.resetTime,
    };
  }

  tracker.count += 1;
  const isAllowed = tracker.count <= limit;
  const remaining = Math.max(0, limit - tracker.count);

  return {
    success: isAllowed,
    limit,
    remaining,
    reset: tracker.resetTime,
  };
}
