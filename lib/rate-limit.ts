/**
 * Lightweight in-memory rate limiter for serverless.
 * Good enough for a portfolio deploy; resets per instance cold start.
 * For multi-region hard limits, swap to Upstash Redis later.
 */

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
};

export function rateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const windowStart = now - input.windowMs;
  const bucket = buckets.get(input.key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= input.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + input.windowMs - now) / 1000));
    buckets.set(input.key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterSec,
      limit: input.limit,
    };
  }

  bucket.timestamps.push(now);
  buckets.set(input.key, bucket);

  // Prevent unbounded growth across many keys
  if (buckets.size > 5000) {
    const keys = Array.from(buckets.keys()).slice(0, 1000);
    for (const k of keys) buckets.delete(k);
  }

  return {
    ok: true,
    remaining: Math.max(0, input.limit - bucket.timestamps.length),
    retryAfterSec: 0,
    limit: input.limit,
  };
}

/** Best-effort client key from request headers. */
export function getClientKey(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  return `ip:${ip}`;
}
