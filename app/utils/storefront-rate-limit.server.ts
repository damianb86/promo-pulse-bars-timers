type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const windowMs = 60_000;
const maxRequestsPerWindow = 120;

export function checkStorefrontRateLimit(key: string, now = Date.now()) {
  cleanupExpiredBuckets(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      limit: maxRequestsPerWindow,
      remaining: maxRequestsPerWindow - 1,
      resetAt: now + windowMs,
    };
  }

  if (bucket.count >= maxRequestsPerWindow) {
    return {
      allowed: false,
      limit: maxRequestsPerWindow,
      remaining: 0,
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;

  return {
    allowed: true,
    limit: maxRequestsPerWindow,
    remaining: maxRequestsPerWindow - bucket.count,
    resetAt: bucket.resetAt,
  };
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
