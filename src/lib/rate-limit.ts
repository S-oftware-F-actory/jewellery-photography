/**
 * Simple in-memory rate limiter for API routes.
 * No Redis dependency — suitable for single-instance Vercel deployments.
 * Uses sliding window counter pattern.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60 seconds
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);
  // Don't block Node.js process exit
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key (e.g., userId or IP).
 * Returns whether the request is allowed and remaining quota.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key);

  // No existing entry or window expired — start fresh
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, limit: config.limit, remaining: config.limit - 1, resetAt };
  }

  // Within window
  if (entry.count < config.limit) {
    entry.count++;
    return { allowed: true, limit: config.limit, remaining: config.limit - entry.count, resetAt: entry.resetAt };
  }

  // Rate limited
  return { allowed: false, limit: config.limit, remaining: 0, resetAt: entry.resetAt };
}

/** Pre-configured rate limits */
export const RATE_LIMITS = {
  /** /api/generate — 10 requests per minute per user */
  generate: { limit: 10, windowSeconds: 60 },
  /** /api/embed — 60 requests per minute per IP (public endpoint) */
  embed: { limit: 60, windowSeconds: 60 },
  /** /api/download — 5 requests per minute per user */
  download: { limit: 5, windowSeconds: 60 },
} as const;
