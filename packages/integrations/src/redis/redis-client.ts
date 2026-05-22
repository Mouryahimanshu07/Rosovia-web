import Redis from 'ioredis';

let redisInstance: Redis | null = null;
let useMemoryFallback = false;
const memoryCacheMap = new Map<string, { value: string; expires: number }>();

export function getRedisClient(): Redis | null {
  if (useMemoryFallback) return null;
  if (redisInstance) return redisInstance;

  const url = process.env.REDIS_URL;
  if (!url || url.trim() === '') {
    console.warn('REDIS_URL not configured or empty. Falling back to local in-memory simulation instantly.');
    useMemoryFallback = true;
    return null;
  }

  try {
    redisInstance = new Redis(url, {
      maxRetriesPerRequest: 1, // Minimize retries per request for faster failure
      connectTimeout: 1500,    // 1.5 seconds connection timeout instead of 5
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 1) {
          console.warn('Redis reconnection failed. Disabling Redis and switching to memory fallback.');
          useMemoryFallback = true;
          return null; // Stop retrying
        }
        return 500;
      }
    });

    redisInstance.on('error', (err) => {
      console.error('Redis Client connection error:', err.message || err);
      console.warn('Immediately switching to in-memory fallback to prevent page hanging.');
      useMemoryFallback = true;
      if (redisInstance) {
        try {
          redisInstance.disconnect();
        } catch {}
        redisInstance = null;
      }
    });

    return redisInstance;
  } catch (e) {
    console.warn('Redis initial connection error. Using memory fallback:', e);
    useMemoryFallback = true;
    return null;
  }
}

// Resilient memory-fallback cache functions
export const cacheHelpers = {
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    if (client) {
      try {
        return await client.get(key);
      } catch (err) {
        console.warn(`Redis get failed for key ${key}:`, err);
      }
    }

    // In-memory simulation fallback
    const entry = memoryCacheMap.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      memoryCacheMap.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const client = getRedisClient();
    if (client) {
      try {
        await client.set(key, value, 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.warn(`Redis set failed for key ${key}:`, err);
      }
    }

    // In-memory simulation fallback
    memoryCacheMap.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000)
    });
  },

  async del(key: string): Promise<void> {
    const client = getRedisClient();
    if (client) {
      try {
        await client.del(key);
        return;
      } catch (err) {
        console.warn(`Redis delete failed for key ${key}:`, err);
      }
    }
    memoryCacheMap.delete(key);
  },

  // Mutex Lock for stampede prevention
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const client = getRedisClient();
    if (client) {
      try {
        const result = await client.set(`lock:${key}`, '1', 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch {
        return true; // fail-open
      }
    }
    return true; // local memory bypasses locks
  },

  async releaseLock(key: string): Promise<void> {
    const client = getRedisClient();
    if (client) {
      try {
        await client.del(`lock:${key}`);
      } catch {}
    }
  }
};
