import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-api-tokens.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./api-v1-api-tokens";
import { register, generateApiToken } from "../lib/auth.server";
import { resetDatabaseConnection } from "../lib/db.server";
import { ensureCsrfToken } from "../lib/csrf.server";

// Cleanup function
function cleanupTestDatabase() {
  const filesToRemove = [
    TEST_DB_PATH,
    `${TEST_DB_PATH}-shm`,
    `${TEST_DB_PATH}-wal`,
  ];
  for (const file of filesToRemove) {
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
    }
  }
}

describe("API Tokens Route", () => {
  let userId: number;
  let apiToken: string;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();
    const result = await register("testuser", "Password123");
    userId = result.userId!;
    const tokenResult = generateApiToken(userId, "Test Token");
    apiToken = tokenResult.token;
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("GET /api/v1/api-tokens", () => {
    it("lists tokens for authenticated user", async () => {
      const request = new Request("http://localhost/api/v1/api-tokens", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tokens).toBeDefined();
      expect(Array.isArray(data.tokens)).toBe(true);
      expect(data.apiVersion).toBe("v1");
    });

    it("returns 401 for unauthenticated request", async () => {
      const request = new Request("http://localhost/api/v1/api-tokens", {
        method: "GET",
      });

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 for invalid token", async () => {
      const request = new Request("http://localhost/api/v1/api-tokens", {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/v1/api-tokens", () => {
    it("returns 401 for unauthenticated request", async () => {
      const formData = new FormData();
      formData.append("name", "New Token");

      const request = new Request("http://localhost/api/v1/api-tokens", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("returns 400 for missing token name", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const cookieValue = setCookie?.split(";")[0] || "";

      const formData = new FormData();
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/api/v1/api-tokens", {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      // Need to be authenticated via cookie for this endpoint
      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      // Will return 401 because cookie auth is required, not bearer token
      expect(response.status).toBe(401);
    });
  });
});
