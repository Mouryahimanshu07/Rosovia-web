/**
 * Rosovia — Rate Limiting Utility
 * File: apps/web/src/lib/rate-limit.ts
 *
 * Provides a lightweight, in-memory rate limiter using a sliding-expiration
 * clean-up map. Perfect for local development and easily switchable to a
 * production-ready Redis store (e.g. Upstash / ioredis).
 *
 * Features:
 * - Fixed-window token check.
 * - Auto-prunes expired IPs/user keys to prevent memory leaks.
 * - Fully typed return metrics (limit, remaining, reset timestamp).
 */

interface RateLimitTracker {
  count: number;
  resetTime: number;
}

// In-memory store for tracking request counts.
// NOTE: For multi-instance, serverless, or edge environments, this should be
// swapped with a Redis cache (e.g. Upstash Redis).
const rateLimitStore = new Map<string, RateLimitTracker>();

// Periodically clean up expired tracker keys every 5 minutes
if (typeof global !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.(); // Avoid blocking node exit in test environments
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // UTC timestamp when count resets
}

/**
 * Checks request limits for a given identifier (e.g. user_id, IP address, or token).
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
  // TODO: Swapping to production-ready Redis:
  // const redis = getRedisClient();
  // const current = await redis.incr(identifier);
  // if (current === 1) { await redis.expire(identifier, windowMs / 1000); }
  // return { success: current <= limit, limit, remaining: Math.max(0, limit - current) };

  const now = Date.now();
  const key = `rl:${identifier}`;
  const tracker = rateLimitStore.get(key);

  if (!tracker || now > tracker.resetTime) {
    // Start a new window
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

  // Increment existing window count
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
