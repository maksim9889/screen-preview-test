import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-setup-route.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./setup";
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

describe("Setup Route", () => {
  describe("when setup is needed (no users)", () => {
    beforeEach(() => {
      resetDatabaseConnection();
      cleanupTestDatabase();
    });

    afterEach(() => {
      resetDatabaseConnection();
    });

    afterAll(() => {
      resetDatabaseConnection();
      cleanupTestDatabase();
    });

    describe("loader", () => {
      it("does not throw when setup is needed", async () => {
        const request = new Request("http://localhost/setup", {
          method: "GET",
        });

        // Loader should not throw - it returns data or redirect
        const response = await loader({ request, params: {}, context: {} });
        expect(response).toBeDefined();
      });
    });

    describe("action", () => {
      it("creates first user and logs in", async () => {
        // Ensure clean state - no users exist
        resetDatabaseConnection();
        cleanupTestDatabase();

        const { token: csrfToken, setCookie } = ensureCsrfToken(null);
        const cookieValue = setCookie?.split(";")[0] || "";

        const formData = new FormData();
        formData.append("username", "adminuser");
        formData.append("password", "Password123");
        formData.append("confirmPassword", "Password123");
        formData.append("csrf_token", csrfToken);

        const request = new Request("http://localhost/setup", {
          method: "POST",
          headers: {
            Cookie: cookieValue,
          },
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });

        // Successful setup redirects to home
        if (response.status !== 302) {
          // If not redirect, check error for debugging
          const data = await response.json();
          console.log("Setup failed:", data);
        }
        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/");
        expect(response.headers.get("Set-Cookie")).toContain("auth_token=");
      });

      it("returns error for password mismatch", async () => {
        const { token: csrfToken, setCookie } = ensureCsrfToken(null);
        const cookieValue = setCookie?.split(";")[0] || "";

        const formData = new FormData();
        formData.append("username", "admin");
        formData.append("password", "Password123");
        formData.append("confirmPassword", "DifferentPassword");
        formData.append("csrf_token", csrfToken);

        const request = new Request("http://localhost/setup", {
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

      it("returns error for weak password", async () => {
        const { token: csrfToken, setCookie } = ensureCsrfToken(null);
        const cookieValue = setCookie?.split(";")[0] || "";

        const formData = new FormData();
        formData.append("username", "admin");
        formData.append("password", "weak");
        formData.append("confirmPassword", "weak");
        formData.append("csrf_token", csrfToken);

        const request = new Request("http://localhost/setup", {
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
    });
  });

  describe("when setup is complete (users exist)", () => {
    beforeEach(async () => {
      resetDatabaseConnection();
      cleanupTestDatabase();
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
      it("redirects to login when setup is complete", async () => {
        const request = new Request("http://localhost/setup", {
          method: "GET",
        });

        const response = await loader({ request, params: {}, context: {} });

        expect(response.status).toBe(302);
        expect(response.headers.get("Location")).toBe("/login");
      });
    });

    describe("action", () => {
      it("returns error when setup already complete", async () => {
        const { token: csrfToken, setCookie } = ensureCsrfToken(null);
        const cookieValue = setCookie?.split(";")[0] || "";

        const formData = new FormData();
        formData.append("username", "newadmin");
        formData.append("password", "Password123");
        formData.append("confirmPassword", "Password123");
        formData.append("csrf_token", csrfToken);

        const request = new Request("http://localhost/setup", {
          method: "POST",
          headers: {
            Cookie: cookieValue,
          },
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.code).toBe("FORBIDDEN");
      });
    });
  });
});
