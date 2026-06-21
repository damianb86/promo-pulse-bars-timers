type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const windowMs = readPositiveIntegerEnv(
  "STOREFRONT_RATE_LIMIT_WINDOW_MS",
  60_000,
);
const maxRequestsPerWindow =
  process.env.E2E_TEST_MODE === "true" && process.env.NODE_ENV !== "production"
    ? readPositiveIntegerEnv("STOREFRONT_RATE_LIMIT_E2E_MAX_REQUESTS", 1_000)
    : readPositiveIntegerEnv("STOREFRONT_RATE_LIMIT_MAX_REQUESTS", 120);

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

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
