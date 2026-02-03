import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-auth-logout-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-auth-logout";
import { register } from "../lib/auth.server";
import { resetDatabaseConnection, getUser, createApiToken } from "../lib/db.server";
import crypto from "crypto";

// Helper to create request with Bearer token
function createRequest(url: string, token?: string, options: RequestInit = {}): Request {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return new Request(url, { ...options, headers });
}

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

describe("POST /api/v1/auth/logout", () => {
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

  it("logs out successfully", async () => {
    await register("testuser", "TestPassword123");
    const user = getUser("testuser");
    const apiTokenValue = crypto.randomBytes(32).toString("hex");
    createApiToken(apiTokenValue, user!.id, "test-token");

    const request = createRequest("http://localhost/api/v1/auth/logout", apiTokenValue, {
      method: "POST",
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Logout successful");
    expect(data.apiVersion).toBe("v1");
  });

  it("returns 401 without auth token", async () => {
    const request = createRequest("http://localhost/api/v1/auth/logout", undefined, {
      method: "POST",
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });
});
