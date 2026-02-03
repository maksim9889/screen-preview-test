import { config } from "./config.server";
import { getClientIp } from "./request-utils.server";

// Re-export for backward compatibility
export { getClientIp } from "./request-utils.server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiting store
 * For production multi-server deployments, consider using Redis
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    // Don't keep the process alive just for cleanup
    // This allows clean shutdown in tests, serverless, and CLI environments
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    entry.count++;
    return entry;
  }

  reset(key: string) {
    this.store.delete(key);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

const store = new RateLimitStore();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Rate limit for login attempts
 * Limits by IP address and username combination
 */
export function checkLoginRateLimit(
  ip: string,
  username: string
): RateLimitResult {
  const key = `login:${ip}:${username}`;
  const windowMs = config.rateLimit.windowMs;
  const maxAttempts = config.rateLimit.maxLoginAttempts;

  const entry = store.increment(key, windowMs);

  const allowed = entry.count <= maxAttempts;
  const remaining = Math.max(0, maxAttempts - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - Date.now()) / 1000),
  };
}

/**
 * Rate limit for API requests
 * Limits by IP address
 */
export function checkApiRateLimit(ip: string): RateLimitResult {
  const key = `api:${ip}`;
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxApiRequests;

  const entry = store.increment(key, windowMs);

  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetAt - Date.now()) / 1000),
  };
}

/**
 * Reset rate limit for a specific key
 * Useful after successful login to prevent lockout on retry
 */
export function resetLoginRateLimit(ip: string, username: string) {
  const key = `login:${ip}:${username}`;
  store.reset(key);
}

/**
 * Creates rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(
      result.remaining + (result.allowed ? 1 : 0)
    ),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
  };

  if (result.retryAfter !== undefined) {
    headers["Retry-After"] = String(result.retryAfter);
  }

  return headers;
}

// Clean up on process exit
process.on("SIGTERM", () => store.destroy());
process.on("SIGINT", () => store.destroy());
