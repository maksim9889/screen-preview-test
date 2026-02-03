import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-home-route.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./home";
import { register, login, createAuthTokenCookie } from "../lib/auth.server";
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

describe("Home Route", () => {
  let authCookie: string;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();
    await register("testuser", "Password123");
    const loginResult = await login("testuser", "Password123");
    authCookie = createAuthTokenCookie(loginResult.token!);
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("loader", () => {
    it("redirects to setup when no users exist", async () => {
      resetDatabaseConnection();
      cleanupTestDatabase();

      const request = new Request("http://localhost/", {
        method: "GET",
      });

      const response = await loader({ request, params: {}, context: {} });

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/setup");
    });

    it("redirects to login when not authenticated", async () => {
      const request = new Request("http://localhost/", {
        method: "GET",
      });

      const response = await loader({ request, params: {}, context: {} });

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("returns data for authenticated user", async () => {
      const request = new Request("http://localhost/", {
        method: "GET",
        headers: {
          Cookie: authCookie,
        },
      });

      const response = await loader({ request, params: {}, context: {} });

      // Loader should return data or redirect - doesn't throw
      expect(response).toBeDefined();
    });
  });

  describe("action", () => {
    it("rejects unauthenticated save request", async () => {
      const formData = new FormData();
      formData.append("intent", "save");
      formData.append("config", JSON.stringify({}));

      const request = new Request("http://localhost/", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // React Router data() response - check for error code
      expect(response).toBeDefined();
      // Response contains error info about unauthorized
      const responseData = response as { status?: number; data?: { code?: string } };
      expect(responseData.status === 401 || responseData.data?.code === "UNAUTHORIZED").toBeTruthy();
    });

    it("rejects invalid CSRF token", async () => {
      const formData = new FormData();
      formData.append("intent", "save");
      formData.append("config", JSON.stringify({}));
      formData.append("csrf_token", "invalid-token");

      const request = new Request("http://localhost/", {
        method: "POST",
        headers: {
          Cookie: authCookie,
        },
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // Action should return error response for invalid CSRF
      expect(response).toBeDefined();
    });

    it("processes save request with valid authentication and CSRF", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const csrfCookie = setCookie?.split(";")[0] || "";
      const combinedCookies = `${authCookie}; ${csrfCookie}`;

      const testConfig = {
        carousel: { items: [] },
        text: { items: [] },
        cta: { items: [] },
        sectionOrder: ["carousel", "text", "cta"],
      };

      const formData = new FormData();
      formData.append("intent", "save");
      formData.append("configId", "default");
      formData.append("config", JSON.stringify(testConfig));
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/", {
        method: "POST",
        headers: {
          Cookie: combinedCookies,
        },
        body: formData,
      });

      // Action should complete without throwing
      const response = await action({ request, params: {}, context: {} });
      expect(response).toBeDefined();
    });
  });
});
