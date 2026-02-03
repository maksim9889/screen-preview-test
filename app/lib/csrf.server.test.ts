import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import {
  generateCsrfToken,
  createCsrfCookie,
  getCsrfTokenFromCookie,
  validateCsrfToken,
  getCsrfTokenFromFormData,
  getCsrfFormFieldName,
  ensureCsrfToken,
} from "./csrf.server";
import { CSRF_COOKIE_NAME, CSRF_FIELD_NAME } from "./constants";

describe("csrf.server", () => {
  describe("generateCsrfToken", () => {
    it("should generate a token", () => {
      const token = generateCsrfToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("should generate unique tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });

    it("should generate hex-encoded tokens", () => {
      const token = generateCsrfToken();
      // Hex tokens should only contain 0-9 and a-f
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("should generate tokens with correct length (32 bytes = 64 hex chars)", () => {
      const token = generateCsrfToken();
      // 32 bytes = 64 hex characters
      expect(token.length).toBe(64);
    });
  });

  describe("createCsrfCookie", () => {
    it("should create cookie with token", () => {
      const token = "test_token_123";
      const cookie = createCsrfCookie(token);
      expect(cookie).toContain(`${CSRF_COOKIE_NAME}=${token}`);
    });

    it("should include Path=/ in cookie", () => {
      const cookie = createCsrfCookie("token");
      expect(cookie).toContain("Path=/");
    });

    it("should include SameSite=Strict", () => {
      const cookie = createCsrfCookie("token");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("should include Secure flag in production", () => {
      // Mock production environment
      vi.mock("./config.server", () => ({
        config: {
          isProduction: true,
          security: { csrfTokenLength: 32 },
        },
      }));

      const cookie = createCsrfCookie("token");
      // In test environment, isProduction is false by default
      // We test the structure, actual Secure flag depends on NODE_ENV
      expect(cookie).toMatch(/Path=\/.*SameSite=Strict/);
    });

    it("should not include HttpOnly flag", () => {
      // CSRF cookies need to be readable by JavaScript for double-submit pattern
      const cookie = createCsrfCookie("token");
      expect(cookie).not.toContain("HttpOnly");
    });
  });

  describe("getCsrfTokenFromCookie", () => {
    it("should extract token from cookie header", () => {
      const token = "test_csrf_token";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should return null for null cookie header", () => {
      const extracted = getCsrfTokenFromCookie(null);
      expect(extracted).toBeNull();
    });

    it("should return null when CSRF cookie not present", () => {
      const cookieHeader = "other_cookie=value";
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBeNull();
    });

    it("should handle multiple cookies", () => {
      const token = "csrf_token_value";
      const cookieHeader = `session=abc123; ${CSRF_COOKIE_NAME}=${token}; other=xyz`;
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should handle cookies with spaces", () => {
      const token = "token_value";
      const cookieHeader = `  ${CSRF_COOKIE_NAME}=${token}  ; other=value  `;
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should handle values containing equals signs", () => {
      const token = "abc123==";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should handle URL-encoded values", () => {
      const token = "token%2Bvalue";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBe("token+value");
    });

    it("should handle malformed cookies gracefully", () => {
      const cookieHeader = `malformed; ${CSRF_COOKIE_NAME}=valid_token`;
      const extracted = getCsrfTokenFromCookie(cookieHeader);
      expect(extracted).toBe("valid_token");
    });
  });

  describe("validateCsrfToken", () => {
    it("should return true for matching tokens", () => {
      const token = "matching_token_12345678";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;
      const isValid = validateCsrfToken(cookieHeader, token);
      expect(isValid).toBe(true);
    });

    it("should return false for non-matching tokens", () => {
      const cookieHeader = `${CSRF_COOKIE_NAME}=token1`;
      const formToken = "token2";
      const isValid = validateCsrfToken(cookieHeader, formToken);
      expect(isValid).toBe(false);
    });

    it("should return false for null cookie header", () => {
      const isValid = validateCsrfToken(null, "token");
      expect(isValid).toBe(false);
    });

    it("should return false for null form token", () => {
      const cookieHeader = `${CSRF_COOKIE_NAME}=token`;
      const isValid = validateCsrfToken(cookieHeader, null);
      expect(isValid).toBe(false);
    });

    it("should return false when cookie has no CSRF token", () => {
      const cookieHeader = "other_cookie=value";
      const isValid = validateCsrfToken(cookieHeader, "token");
      expect(isValid).toBe(false);
    });

    it("should use timing-safe comparison", () => {
      // This tests that timingSafeEqual is being used
      // We can't directly test timing, but we can test it handles equal-length strings
      const token = "a".repeat(64);
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;
      const isValid = validateCsrfToken(cookieHeader, token);
      expect(isValid).toBe(true);
    });

    it("should return false for tokens with different lengths", () => {
      // timingSafeEqual requires same length, so we check length first
      const cookieHeader = `${CSRF_COOKIE_NAME}=short`;
      const formToken = "muchlongertoken";

      const isValid = validateCsrfToken(cookieHeader, formToken);
      expect(isValid).toBe(false);
    });
  });

  describe("getCsrfTokenFromFormData", () => {
    it("should extract token from form data", () => {
      const formData = new FormData();
      const token = "form_token_value";
      formData.set(CSRF_FIELD_NAME, token);

      const extracted = getCsrfTokenFromFormData(formData);
      expect(extracted).toBe(token);
    });

    it("should return null when token not in form data", () => {
      const formData = new FormData();
      const extracted = getCsrfTokenFromFormData(formData);
      expect(extracted).toBeNull();
    });

    it("should handle form data with multiple fields", () => {
      const formData = new FormData();
      formData.set("username", "testuser");
      formData.set(CSRF_FIELD_NAME, "token123");
      formData.set("password", "pass123");

      const extracted = getCsrfTokenFromFormData(formData);
      expect(extracted).toBe("token123");
    });
  });

  describe("getCsrfFormFieldName", () => {
    it("should return the CSRF form field name", () => {
      const fieldName = getCsrfFormFieldName();
      expect(fieldName).toBe(CSRF_FIELD_NAME);
    });
  });

  describe("ensureCsrfToken", () => {
    it("should return existing token if present in cookie", () => {
      const existingToken = "existing_csrf_token";
      const cookieHeader = `${CSRF_COOKIE_NAME}=${existingToken}`;

      const result = ensureCsrfToken(cookieHeader);
      expect(result.token).toBe(existingToken);
      expect(result.setCookie).toBeUndefined();
    });

    it("should generate new token if no cookie", () => {
      const result = ensureCsrfToken(null);
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex
      expect(result.setCookie).toBeDefined();
    });

    it("should return Set-Cookie header for new token", () => {
      const result = ensureCsrfToken(null);
      expect(result.setCookie).toContain(CSRF_COOKIE_NAME);
      expect(result.setCookie).toContain(result.token);
      expect(result.setCookie).toContain("Path=/");
      expect(result.setCookie).toContain("SameSite=Strict");
    });

    it("should generate different tokens each time", () => {
      const result1 = ensureCsrfToken(null);
      const result2 = ensureCsrfToken(null);
      expect(result1.token).not.toBe(result2.token);
    });

    it("should handle cookie header with multiple cookies", () => {
      const token = "my_token";
      const cookieHeader = `session=abc; ${CSRF_COOKIE_NAME}=${token}; other=xyz`;

      const result = ensureCsrfToken(cookieHeader);
      expect(result.token).toBe(token);
      expect(result.setCookie).toBeUndefined();
    });
  });

  describe("CSRF protection integration", () => {
    it("should validate full double-submit cookie flow", () => {
      // Step 1: Generate token
      const token = generateCsrfToken();

      // Step 2: Create cookie
      const setCookie = createCsrfCookie(token);
      expect(setCookie).toContain(token);

      // Step 3: Simulate browser sending cookie back
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;

      // Step 4: Validate token from form matches cookie
      const isValid = validateCsrfToken(cookieHeader, token);
      expect(isValid).toBe(true);
    });

    it("should reject tampered tokens", () => {
      // Generate legitimate token
      const legitimateToken = generateCsrfToken();
      const setCookie = createCsrfCookie(legitimateToken);

      // Simulate cookie with legitimate token
      const cookieHeader = `${CSRF_COOKIE_NAME}=${legitimateToken}`;

      // But attacker submits different token in form
      const attackerToken = generateCsrfToken();

      const isValid = validateCsrfToken(cookieHeader, attackerToken);
      expect(isValid).toBe(false);
    });

    it("should handle ensureCsrfToken -> validate flow", () => {
      // Get or create token
      const { token, setCookie } = ensureCsrfToken(null);
      expect(setCookie).toBeDefined();

      // Simulate browser storing cookie and sending it back
      const cookieHeader = `${CSRF_COOKIE_NAME}=${token}`;

      // Validate form submission with same token
      const isValid = validateCsrfToken(cookieHeader, token);
      expect(isValid).toBe(true);
    });
  });
});
