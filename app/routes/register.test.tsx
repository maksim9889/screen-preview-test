import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-register-route.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./register";
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

describe("Register Route", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();
    // Create initial user so setup is complete
    await register("existinguser", "Password123");
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
      const request = new Request("http://localhost/register", {
        method: "GET",
      });

      // Loader should not throw - it returns data or redirect
      const response = await loader({ request, params: {}, context: {} });
      expect(response).toBeDefined();
    });
  });

  describe("action", () => {
    it("registers new user successfully", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const cookieValue = setCookie?.split(";")[0] || "";

      const formData = new FormData();
      formData.append("username", "newuser");
      formData.append("password", "Password123");
      formData.append("confirmPassword", "Password123");
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      // Successful registration redirects
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/");
    });

    it("returns error for password mismatch", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const cookieValue = setCookie?.split(";")[0] || "";

      const formData = new FormData();
      formData.append("username", "newuser2");
      formData.append("password", "Password123");
      formData.append("confirmPassword", "DifferentPassword123");
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
    });

    it("returns error for existing username", async () => {
      const { token: csrfToken, setCookie } = ensureCsrfToken(null);
      const cookieValue = setCookie?.split(";")[0] || "";

      const formData = new FormData();
      formData.append("username", "existinguser");
      formData.append("password", "Password123");
      formData.append("confirmPassword", "Password123");
      formData.append("csrf_token", csrfToken);

      const request = new Request("http://localhost/register", {
        method: "POST",
        headers: {
          Cookie: cookieValue,
        },
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      // Register route returns 400 with VALIDATION_ERROR for existing username
      expect(response.status).toBe(400);
      expect(data.code).toBe("VALIDATION_ERROR");
      expect(data.error).toContain("Username already exists");
    });

    it("returns error for invalid CSRF token", async () => {
      const formData = new FormData();
      formData.append("username", "newuser3");
      formData.append("password", "Password123");
      formData.append("confirmPassword", "Password123");
      formData.append("csrf_token", "invalid-csrf-token");

      const request = new Request("http://localhost/register", {
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
