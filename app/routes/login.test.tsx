import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-login-route.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./login";
import { register } from "../lib/auth.server";
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

describe("Login Route", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();
    await register("testuser", "Password123");
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("loader", () => {
    it("does not throw for unauthenticated user", async () => {
      const request = new Request("http://localhost/login", {
        method: "GET",
      });

      // Loader should not throw - it returns data or redirect
      const response = await loader({ request, params: {}, context: {} });
      expect(response).toBeDefined();
    });
  });

  describe("action", () => {
    it("logs in successfully with valid credentials", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const cookieValue = setCookie?.split(";")[0] || "";

      const formData = new FormData();
      formData.append("username", "testuser");
      formData.append("password", "Password123");
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/login", {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // Successful login redirects
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/");
      expect(response.headers.get("Set-Cookie")).toContain("auth_token=");
    });

    it("returns 401 for invalid credentials", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const cookieValue = setCookie?.split(";")[0] || "";

      const formData = new FormData();
      formData.append("username", "testuser");
      formData.append("password", "wrongpassword");
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/login", {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(401);
    });

    it("returns error for invalid CSRF token", async () => {
      const formData = new FormData();
      formData.append("username", "testuser");
      formData.append("password", "Password123");
      formData.append("csrf_token", "invalid-csrf-token");

      const request = new Request("http://localhost/login", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe("INVALID_CSRF");
    });
  });
});
