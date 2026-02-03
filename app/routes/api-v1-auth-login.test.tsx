import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-auth-login-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-auth-login";
import { register } from "../lib/auth.server";
import { resetDatabaseConnection } from "../lib/db.server";

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

describe("POST /api/v1/auth/login", () => {
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

  it("logs in successfully with valid credentials", async () => {
    const formData = new FormData();
    formData.append("username", "testuser");
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Login successful");
    expect(data.apiVersion).toBe("v1");

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("auth_token=");
  });

  it("returns 401 for invalid password", async () => {
    const formData = new FormData();
    formData.append("username", "testuser");
    formData.append("password", "wrongpassword");

    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for non-existent user", async () => {
    const formData = new FormData();
    formData.append("username", "nonexistent");
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 400 for missing credentials", async () => {
    const formData = new FormData();

    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("MISSING_FIELD");
  });

  it("enforces rate limiting after multiple failed attempts", async () => {
    const ipAddress = "192.168.1.1";

    for (let i = 0; i < 5; i++) {
      const formData = new FormData();
      formData.append("username", "testuser");
      formData.append("password", "wrongpassword");

      const request = new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ipAddress },
        body: formData,
      });

      await action({ request, params: {}, context: {}, unstable_pattern: "" });
    }

    const formData = new FormData();
    formData.append("username", "testuser");
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": ipAddress },
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
