import type { Context, Next } from 'hono';

interface RateEntry {
  count: number;
  reset: number;
}

const rateBuckets = new Map<string, Map<string, RateEntry>>();

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [bucketName, bucket] of rateBuckets) {
    for (const [ip, entry] of bucket) {
      if (now > entry.reset) {
        bucket.delete(ip);
      }
    }
    if (bucket.size === 0) {
      rateBuckets.delete(bucketName);
    }
  }
}, 5 * 60 * 1000);

/**
 * Creates a rate limiting middleware.
 * @param limit - Maximum number of requests allowed within the window.
 * @param windowMs - Time window in milliseconds.
 * @param bucketName - Optional name for the rate limit bucket (allows separate limits for different routes).
 */
export const rateLimit = (limit: number, windowMs: number, bucketName = 'global') => {
  if (!rateBuckets.has(bucketName)) {
    rateBuckets.set(bucketName, new Map());
  }

  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      || c.req.header('x-real-ip')
      || 'anonymous';

    if (!rateBuckets.has(bucketName)) {
      rateBuckets.set(bucketName, new Map());
    }
    const bucket = rateBuckets.get(bucketName)!;
    const now = Date.now();
    const entry = bucket.get(ip) || { count: 0, reset: now + windowMs };

    if (now > entry.reset) {
      entry.count = 1;
      entry.reset = now + windowMs;
    } else {
      entry.count++;
    }

    bucket.set(ip, entry);

    // Set rate limit headers
    const remaining = Math.max(0, limit - entry.count);
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.reset / 1000)));

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }

    await next();
  };
};
