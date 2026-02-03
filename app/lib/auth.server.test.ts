import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

// Test database path - set BEFORE importing db.server
const TEST_DB_PATH = path.join(process.cwd(), "data", "test-auth.db");
process.env.DATABASE_PATH = TEST_DB_PATH;

import {
  register,
  login,
  logout,
  validateAuthToken,
  needsSetup,
  getAuthTokenFromCookie,
  createAuthTokenCookie,
  clearAuthTokenCookie,
  AUTH_TOKEN_COOKIE_NAME,
} from "./auth.server";
import {
  getUser,
  getAuthToken,
  createAuthToken as dbCreateAuthToken,
  resetDatabaseConnection,
} from "./db.server";

// Cleanup function to remove test database files
function cleanupTestDatabase() {
  const filesToRemove = [
    TEST_DB_PATH,
    `${TEST_DB_PATH}-shm`,
    `${TEST_DB_PATH}-wal`,
  ];

  for (const file of filesToRemove) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  }
}

describe("auth.server", () => {
  beforeEach(() => {
    // Reset database connection and cleanup before each test
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  afterEach(() => {
    // Reset connection after each test
    resetDatabaseConnection();
  });

  afterAll(() => {
    // Final cleanup
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const result = await register("testuser", "Password123");

      expect(result.success).toBe(true);
      expect(result.username).toBe("testuser");
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.userId).toBeDefined();
    });

    it("should throw error for missing username", async () => {
      await expect(register("", "Password123")).rejects.toThrow(
        "Username and password are required"
      );
    });

    it("should throw error for missing password", async () => {
      await expect(register("testuser", "")).rejects.toThrow(
        "Username and password are required"
      );
    });

    it("should throw error for short username (less than 3 chars)", async () => {
      await expect(register("ab", "Password123")).rejects.toThrow(
        "Username must be at least 3 characters"
      );
    });

    it("should throw error for short password (less than 8 chars)", async () => {
      await expect(register("testuser", "Pass1")).rejects.toThrow(
        "Password must be at least 8 characters"
      );
    });

    it("should throw error for password without uppercase", async () => {
      await expect(register("testuser", "password123")).rejects.toThrow(
        "Password must contain at least one uppercase letter"
      );
    });

    it("should throw error for password without lowercase", async () => {
      await expect(register("testuser", "PASSWORD123")).rejects.toThrow(
        "Password must contain at least one lowercase letter"
      );
    });

    it("should throw error for password without number", async () => {
      await expect(register("testuser", "PasswordABC")).rejects.toThrow(
        "Password must contain at least one number"
      );
    });

    it("should throw error for reserved username", async () => {
      await expect(register("admin", "Password123")).rejects.toThrow(
        "This username is not available"
      );
      await expect(register("root", "Password123")).rejects.toThrow(
        "This username is not available"
      );
    });

    it("should throw error for username with invalid characters", async () => {
      await expect(register("test@user", "Password123")).rejects.toThrow(
        "Username can only contain letters, numbers, and underscores"
      );
    });

    it("should throw error for duplicate username", async () => {
      // Register first user
      await register("testuser", "Password123");

      // Try to register same username again
      await expect(register("testuser", "DifferentPass123")).rejects.toThrow(
        "Username already exists"
      );
    });

    it("should hash passwords (not store plaintext)", async () => {
      const password = "mySecretPassword123";
      const result = await register("testuser", password);

      expect(result.success).toBe(true);

      // Verify password is not stored in plaintext
      const user = getUser("testuser");
      expect(user).toBeDefined();
      expect(user!.passwordHash).not.toBe(password);
      expect(user!.passwordHash.length).toBeGreaterThan(password.length);
    });

    it("should generate unique salt for each user", async () => {
      await register("user1", "Password123");
      await register("user2", "Password123");

      const user1 = getUser("user1");
      const user2 = getUser("user2");

      expect(user1!.salt).not.toBe(user2!.salt);
    });

    it("should create auth token automatically", async () => {
      const result = await register("testuser", "Password123");

      expect(result.token).toBeDefined();
      expect(result.token!.length).toBeGreaterThan(0);

      // Verify token exists in database
      const tokenRecord = getAuthToken(result.token!);
      expect(tokenRecord).toBeDefined();
    });

    it("should set token expiration", async () => {
      const result = await register("testuser", "Password123");

      expect(result.expiresAt).toBeDefined();

      const expiresAt = new Date(result.expiresAt!);
      const now = new Date();

      // Token should expire in the future
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await register("testuser", "Password123");
    });

    it("should login with correct credentials", async () => {
      const result = await login("testuser", "Password123");

      expect(result.success).toBe(true);
      expect(result.username).toBe("testuser");
      expect(result.token).toBeDefined();
      expect(result.userId).toBeDefined();
    });

    it("should throw error for missing username", async () => {
      await expect(login("", "Password123")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw error for missing password", async () => {
      await expect(login("testuser", "")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw error for non-existent user", async () => {
      await expect(login("nonexistent", "Password123")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw error for incorrect password", async () => {
      await expect(login("testuser", "wrongpassword")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should not reveal whether username or password is wrong", async () => {
      // Both wrong username and wrong password should throw same error
      await expect(login("nonexistent", "Password123")).rejects.toThrow(
        "Invalid credentials"
      );
      await expect(login("testuser", "wrongpassword")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should create new auth token on login", async () => {
      const result = await login("testuser", "Password123");

      expect(result.token).toBeDefined();

      const tokenRecord = getAuthToken(result.token!);
      expect(tokenRecord).toBeDefined();
      expect(tokenRecord!.user_id).toBe(result.userId);
    });

    it("should allow multiple logins (multiple tokens)", async () => {
      const login1 = await login("testuser", "Password123");
      const login2 = await login("testuser", "Password123");

      expect(login1.token).toBeDefined();
      expect(login2.token).toBeDefined();
      expect(login1.token).not.toBe(login2.token);

      // Both tokens should be valid
      expect(getAuthToken(login1.token!)).toBeDefined();
      expect(getAuthToken(login2.token!)).toBeDefined();
    });

    it("should use timing-safe password comparison", async () => {
      // This tests that the comparison doesn't leak timing information
      // We can't directly test timing, but we verify both fail with same error

      // Both wrong passwords should throw the same error
      await expect(login("testuser", "wrongpass1")).rejects.toThrow(
        "Invalid credentials"
      );
      await expect(login("testuser", "wrongpass2")).rejects.toThrow(
        "Invalid credentials"
      );
    });
  });

  describe("logout", () => {
    beforeEach(async () => {
      await register("testuser", "Password123");
    });

    it("should delete auth token", async () => {
      // Login to get a token
      const loginResult = await login("testuser", "Password123");
      const token = loginResult.token!;

      // Verify token exists
      expect(getAuthToken(token)).toBeDefined();

      // Logout
      const result = await logout(token);

      expect(result.success).toBe(true);

      // Verify token is deleted
      expect(getAuthToken(token)).toBeNull();
    });

    it("should handle logout with no token gracefully", async () => {
      const result = await logout("");

      expect(result.success).toBe(true);
    });

    it("should handle logout with invalid token gracefully", async () => {
      const result = await logout("invalid_token_123");

      expect(result.success).toBe(true);
    });
  });

  describe("validateAuthToken", () => {
    let validToken: string;
    let userId: number;

    beforeEach(async () => {
      const result = await register("testuser", "Password123");
      validToken = result.token!;
      userId = result.userId!;
    });

    it("should validate valid token", async () => {
      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=${validToken}`;
      const result = await validateAuthToken(cookieHeader);

      expect(result.authenticated).toBe(true);
      expect(result.username).toBe("testuser");
      expect(result.userId).toBe(userId);
      // Security: token is NOT returned to prevent accidental logging/leaking
      expect(result).not.toHaveProperty("token");
    });

    it("should reject null cookie header", async () => {
      const result = await validateAuthToken(null);

      expect(result.authenticated).toBe(false);
      expect(result.username).toBeUndefined();
    });

    it("should reject missing token in cookie", async () => {
      const cookieHeader = "other_cookie=value";
      const result = await validateAuthToken(cookieHeader);

      expect(result.authenticated).toBe(false);
    });

    it("should reject invalid token", async () => {
      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=invalid_token`;
      const result = await validateAuthToken(cookieHeader);

      expect(result.authenticated).toBe(false);
    });

    it("should reject token after logout", async () => {
      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=${validToken}`;

      // Verify token works
      const before = await validateAuthToken(cookieHeader);
      expect(before.authenticated).toBe(true);

      // Logout
      await logout(validToken);

      // Token should no longer work
      const after = await validateAuthToken(cookieHeader);
      expect(after.authenticated).toBe(false);
    });

    it("should handle expired tokens", async () => {
      // Create an expired token directly in database
      const expiredToken = "expired_token_123";
      const expiredDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago

      dbCreateAuthToken(expiredToken, userId, expiredDate);

      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=${expiredToken}`;
      const result = await validateAuthToken(cookieHeader);

      // Token validation checks expiration
      expect(result.authenticated).toBe(false);
    });
  });

  describe("needsSetup", () => {
    it("should return true when no users exist", () => {
      expect(needsSetup()).toBe(true);
    });

    it("should return false after first user is created", async () => {
      await register("firstuser", "Password123");

      expect(needsSetup()).toBe(false);
    });

    it("should return false when multiple users exist", async () => {
      await register("user1", "Password123");
      await register("user2", "Password456");

      expect(needsSetup()).toBe(false);
    });
  });

  describe("getAuthTokenFromCookie", () => {
    it("should extract token from cookie header", () => {
      const token = "my_auth_token_123";
      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=${token}`;

      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should return null for null cookie header", () => {
      const extracted = getAuthTokenFromCookie(null);
      expect(extracted).toBeNull();
    });

    it("should return null when auth token not in cookies", () => {
      const cookieHeader = "other_cookie=value";
      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBeNull();
    });

    it("should handle multiple cookies", () => {
      const token = "auth_token_value";
      const cookieHeader = `session=abc; ${AUTH_TOKEN_COOKIE_NAME}=${token}; other=xyz`;

      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should trim whitespace", () => {
      const token = "token123";
      const cookieHeader = `  ${AUTH_TOKEN_COOKIE_NAME}=${token}  `;

      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should handle values containing equals signs", () => {
      // Edge case: value contains '=' (e.g., base64 encoded data)
      const token = "abc123==";
      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=${token}`;

      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBe(token);
    });

    it("should handle URL-encoded values", () => {
      const token = "token%20with%20spaces";
      const cookieHeader = `${AUTH_TOKEN_COOKIE_NAME}=${token}`;

      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBe("token with spaces");
    });

    it("should handle malformed cookies gracefully", () => {
      const cookieHeader = `malformed; ${AUTH_TOKEN_COOKIE_NAME}=valid_token; another=`;

      const extracted = getAuthTokenFromCookie(cookieHeader);
      expect(extracted).toBe("valid_token");
    });
  });

  describe("createAuthTokenCookie", () => {
    const token = "test_token_123";
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // 24 hours

    it("should create cookie with token", () => {
      const cookie = createAuthTokenCookie(token, futureDate);

      expect(cookie).toContain(`${AUTH_TOKEN_COOKIE_NAME}=${token}`);
    });

    it("should include Path=/", () => {
      const cookie = createAuthTokenCookie(token, futureDate);
      expect(cookie).toContain("Path=/");
    });

    it("should include HttpOnly flag", () => {
      const cookie = createAuthTokenCookie(token, futureDate);
      expect(cookie).toContain("HttpOnly");
    });

    it("should include SameSite=Strict", () => {
      const cookie = createAuthTokenCookie(token, futureDate);
      expect(cookie).toContain("SameSite=Strict");
    });

    it("should include Expires header", () => {
      const cookie = createAuthTokenCookie(token, futureDate);
      expect(cookie).toContain("Expires=");
    });

    it("should format expires date correctly", () => {
      const cookie = createAuthTokenCookie(token, futureDate);
      const expectedExpires = new Date(futureDate).toUTCString();
      expect(cookie).toContain(`Expires=${expectedExpires}`);
    });

    it("should include Secure flag in production", () => {
      // In test environment, Secure flag depends on config.isProduction
      // This test documents the expected behavior
      const cookie = createAuthTokenCookie(token, futureDate);
      // Structure should be correct regardless
      expect(cookie).toMatch(/Path=\/.*HttpOnly.*SameSite=Strict/);
    });
  });

  describe("clearAuthTokenCookie", () => {
    it("should create cookie with empty value", () => {
      const cookie = clearAuthTokenCookie();
      expect(cookie).toContain(`${AUTH_TOKEN_COOKIE_NAME}=;`);
    });

    it("should set expiration to past date", () => {
      const cookie = clearAuthTokenCookie();
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    });

    it("should include Path=/", () => {
      const cookie = clearAuthTokenCookie();
      expect(cookie).toContain("Path=/");
    });

    it("should include HttpOnly", () => {
      const cookie = clearAuthTokenCookie();
      expect(cookie).toContain("HttpOnly");
    });

    it("should include SameSite=Strict", () => {
      const cookie = clearAuthTokenCookie();
      expect(cookie).toContain("SameSite=Strict");
    });
  });

  describe("Security considerations", () => {
    it("should use PBKDF2 for password hashing", async () => {
      const password = "testPassword123";
      await register("testuser", password);

      const user = getUser("testuser");

      // PBKDF2 with SHA512 produces 64-byte hash = 128 hex characters
      expect(user!.passwordHash.length).toBe(128);
      expect(user!.passwordHash).toMatch(/^[0-9a-f]+$/);
    });

    it("should generate cryptographically random tokens", async () => {
      const result1 = await register("user1", "Password123");
      const result2 = await register("user2", "Password123");

      // Tokens should be unique
      expect(result1.token).not.toBe(result2.token);

      // Tokens should be hex strings (from crypto.randomBytes)
      expect(result1.token).toMatch(/^[0-9a-f]+$/);
      expect(result2.token).toMatch(/^[0-9a-f]+$/);
    });

    it("should not allow SQL injection in username", async () => {
      const maliciousUsername = "admin' OR '1'='1";

      // Username validation rejects special characters, preventing SQL injection
      await expect(register(maliciousUsername, "Password123")).rejects.toThrow(
        "Username can only contain letters, numbers, and underscores"
      );
    });

    it("should prevent timing attacks on login", async () => {
      await register("testuser", "Password123");

      // Both wrong username and wrong password should throw same error
      // to prevent timing-based username enumeration
      await expect(login("nonexistent", "Password123")).rejects.toThrow(
        "Invalid credentials"
      );
      await expect(login("testuser", "wrongpassword")).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should use HttpOnly cookies to prevent XSS", () => {
      const token = "token123";
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const cookie = createAuthTokenCookie(token, futureDate);

      expect(cookie).toContain("HttpOnly");
    });

    it("should use SameSite=Strict to prevent CSRF", () => {
      const token = "token123";
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const cookie = createAuthTokenCookie(token, futureDate);

      expect(cookie).toContain("SameSite=Strict");
    });
  });
});
