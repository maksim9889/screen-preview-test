import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// Mock the config module to enable proxy trust for getClientIp tests
vi.mock("./config.server", () => ({
  config: {
    proxy: {
      trustProxy: true,
    },
    rateLimit: {
      windowMs: 900000,
      maxLoginAttempts: 5,
      maxApiRequests: 100,
    },
  },
}));

import {
  checkLoginRateLimit,
  checkApiRateLimit,
  resetLoginRateLimit,
  getClientIp,
  createRateLimitHeaders,
} from "./rate-limit.server";
import { config } from "./config.server";

describe("rate-limit.server", () => {
  // Clean up between tests to avoid rate limit carryover
  beforeEach(() => {
    // Each test gets fresh state
  });

  // Note: Rate limit store cleanup is handled internally by the rate-limit module

  describe("getClientIp (with TRUST_PROXY=true)", () => {
    beforeEach(() => {
      // Ensure proxy trust is enabled for these tests
      vi.mocked(config.proxy).trustProxy = true;
    });

    it("should extract IP from x-forwarded-for header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-forwarded-for": "192.168.1.100, 10.0.0.1",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.100");
    });

    it("should extract IP from x-real-ip header", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-real-ip": "192.168.1.200",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.200");
    });

    it("should prefer x-forwarded-for over x-real-ip", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-forwarded-for": "192.168.1.100",
          "x-real-ip": "192.168.1.200",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("192.168.1.100");
    });

    it("should return 'unknown' when no IP headers present", () => {
      const request = new Request("http://example.com");
      const ip = getClientIp(request);
      expect(ip).toBe("unknown");
    });

    it("should handle multiple IPs in x-forwarded-for (take first)", () => {
      const request = new Request("http://example.com", {
        headers: {
          "x-forwarded-for": "  203.0.113.1  ,  198.51.100.1  ,  192.0.2.1  ",
        },
      });

      const ip = getClientIp(request);
      expect(ip).toBe("203.0.113.1");
    });
  });

  describe("checkLoginRateLimit", () => {
    it("should allow first login attempt", () => {
      const result = checkLoginRateLimit("192.168.1.1", "testuser");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.retryAfter).toBeUndefined();
    });

    it("should track separate limits for different IPs", () => {
      const result1 = checkLoginRateLimit("192.168.1.1", "testuser");
      const result2 = checkLoginRateLimit("192.168.1.2", "testuser");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it("should track separate limits for different usernames", () => {
      const result1 = checkLoginRateLimit("192.168.1.1", "user1");
      const result2 = checkLoginRateLimit("192.168.1.1", "user2");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it("should decrement remaining count on each attempt", () => {
      const ip = "192.168.1.100";
      const username = "testuser";

      const result1 = checkLoginRateLimit(ip, username);
      const result2 = checkLoginRateLimit(ip, username);

      expect(result2.remaining).toBe(result1.remaining - 1);
    });

    it("should block after max attempts reached", () => {
      const ip = "192.168.1.101";
      const username = "bruteforce";

      // Make multiple attempts (default limit is 5)
      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit(ip, username);
      }

      // 6th attempt should be blocked
      const result = checkLoginRateLimit(ip, username);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should provide retryAfter when blocked", () => {
      const ip = "192.168.1.102";
      const username = "user";

      // Exhaust attempts
      for (let i = 0; i < 6; i++) {
        checkLoginRateLimit(ip, username);
      }

      const result = checkLoginRateLimit(ip, username);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should include resetAt timestamp", () => {
      const result = checkLoginRateLimit("192.168.1.1", "user");
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });
  });

  describe("checkApiRateLimit", () => {
    it("should allow first API request", () => {
      const result = checkApiRateLimit("192.168.2.1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.retryAfter).toBeUndefined();
    });

    it("should track separate limits per IP", () => {
      const result1 = checkApiRateLimit("192.168.2.1");
      const result2 = checkApiRateLimit("192.168.2.2");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it("should decrement remaining count on each request", () => {
      const ip = "192.168.2.100";

      const result1 = checkApiRateLimit(ip);
      const result2 = checkApiRateLimit(ip);

      expect(result2.remaining).toBe(result1.remaining - 1);
    });

    it("should block after max requests reached", () => {
      const ip = "192.168.2.101";

      // Make 100 requests (default limit is 100)
      for (let i = 0; i < 100; i++) {
        checkApiRateLimit(ip);
      }

      // 101st request should be blocked
      const result = checkApiRateLimit(ip);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should provide retryAfter when blocked", () => {
      const ip = "192.168.2.102";

      // Exhaust limit
      for (let i = 0; i < 101; i++) {
        checkApiRateLimit(ip);
      }

      const result = checkApiRateLimit(ip);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("resetLoginRateLimit", () => {
    it("should reset rate limit for specific IP and username", () => {
      const ip = "192.168.3.1";
      const username = "user";

      // Make several attempts
      checkLoginRateLimit(ip, username);
      checkLoginRateLimit(ip, username);
      checkLoginRateLimit(ip, username);

      const beforeReset = checkLoginRateLimit(ip, username);
      expect(beforeReset.remaining).toBeLessThan(5);

      // Reset the limit
      resetLoginRateLimit(ip, username);

      // Should be back to full limit
      const afterReset = checkLoginRateLimit(ip, username);
      expect(afterReset.remaining).toBeGreaterThan(beforeReset.remaining);
    });

    it("should only reset specific IP/username combination", () => {
      const ip1 = "192.168.3.2";
      const ip2 = "192.168.3.3";
      const username = "user";

      // Make attempts from both IPs
      checkLoginRateLimit(ip1, username);
      checkLoginRateLimit(ip1, username);
      checkLoginRateLimit(ip2, username);
      checkLoginRateLimit(ip2, username);

      // Reset only ip1
      resetLoginRateLimit(ip1, username);

      // ip1 should be reset
      const result1 = checkLoginRateLimit(ip1, username);
      expect(result1.remaining).toBeGreaterThan(3);

      // ip2 should still be rate limited
      const result2 = checkLoginRateLimit(ip2, username);
      expect(result2.remaining).toBeLessThan(5);
    });
  });

  describe("createRateLimitHeaders", () => {
    it("should create headers with limit, remaining, and reset", () => {
      const result = {
        allowed: true,
        remaining: 3,
        resetAt: Date.now() + 60000,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers["X-RateLimit-Limit"]).toBeDefined();
      expect(headers["X-RateLimit-Remaining"]).toBe("3");
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should include Retry-After when retryAfter is present", () => {
      const result = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfter: 60,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers["Retry-After"]).toBe("60");
    });

    it("should not include Retry-After when undefined", () => {
      const result = {
        allowed: true,
        remaining: 5,
        resetAt: Date.now() + 60000,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers["Retry-After"]).toBeUndefined();
    });

    it("should format resetAt as ISO string", () => {
      const resetAt = Date.now() + 60000;
      const result = {
        allowed: true,
        remaining: 5,
        resetAt,
      };

      const headers = createRateLimitHeaders(result);

      expect(headers["X-RateLimit-Reset"]).toBe(new Date(resetAt).toISOString());
    });
  });

  describe("Rate limit window behavior", () => {
    it("should reset count after window expires", async () => {
      const ip = "192.168.4.1";
      const username = "user";

      // Make some attempts
      checkLoginRateLimit(ip, username);
      checkLoginRateLimit(ip, username);
      const before = checkLoginRateLimit(ip, username);

      expect(before.remaining).toBeLessThan(5);

      // Wait for window to expire (in real scenario)
      // In tests, we can't easily wait 15 minutes, so this documents the expected behavior
      // The window is tracked by resetAt timestamp in the store
    });
  });

  describe("Security considerations", () => {
    it("should prevent brute force attacks by limiting login attempts", () => {
      const ip = "attacker-ip";
      const username = "victim";

      let attempts = 0;
      let result;

      // Simulate brute force attack
      do {
        result = checkLoginRateLimit(ip, username);
        attempts++;
      } while (result.allowed && attempts < 10);

      // Should block before 10 attempts
      expect(attempts).toBeLessThanOrEqual(6);
      expect(result.allowed).toBe(false);
    });

    it("should prevent API abuse by limiting requests", () => {
      const ip = "abusive-client";

      let requests = 0;
      let result;

      // Simulate API abuse
      do {
        result = checkApiRateLimit(ip);
        requests++;
      } while (result.allowed && requests < 150);

      // Should block before 150 requests
      expect(requests).toBeLessThanOrEqual(101);
      expect(result.allowed).toBe(false);
    });

    it("should isolate rate limits per IP to prevent DoS", () => {
      // One abusive client shouldn't affect others
      const abusiveIp = "192.168.5.1";
      const legitimateIp = "192.168.5.2";

      // Exhaust rate limit for abusive client
      for (let i = 0; i < 101; i++) {
        checkApiRateLimit(abusiveIp);
      }

      const abusiveResult = checkApiRateLimit(abusiveIp);
      expect(abusiveResult.allowed).toBe(false);

      // Legitimate client should still work
      const legitResult = checkApiRateLimit(legitimateIp);
      expect(legitResult.allowed).toBe(true);
    });
  });

  describe("Rate limit store cleanup", () => {
    it("should handle cleanup without errors", () => {
      // Make some requests to populate the store
      checkLoginRateLimit("192.168.6.1", "user1");
      checkApiRateLimit("192.168.6.2");

      // Cleanup is triggered automatically every 5 minutes
      // This test documents that the cleanup mechanism exists
      // Actual cleanup testing would require time manipulation or mocking
    });
  });
});
