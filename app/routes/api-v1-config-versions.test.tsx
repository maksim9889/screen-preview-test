/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-configId-versions-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./api-v1-config-versions";
import { saveConfig, createConfigVersion, DEFAULT_CONFIG, resetDatabaseConnection, getUser, createApiToken } from "../lib/db.server";
import { register } from "../lib/auth.server";
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

const testUsername = "testuser";
const testPassword = "TestPassword123";
let testUserId: number;
let authToken: string;

async function setupTestUser() {
  const result = await register(testUsername, testPassword);

  const user = getUser(testUsername);
  if (!user) throw new Error("Failed to create test user");
  testUserId = user.id;

  // Create API token for testing
  const apiTokenValue = crypto.randomBytes(32).toString("hex");
  createApiToken(apiTokenValue, testUserId, "test-token");
  authToken = apiTokenValue;

  return { testUserId, authToken };
}

beforeEach(async () => {
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

describe("GET /api/v1/configs/:configId/versions", () => {
  it("returns 401 without auth token", async () => {
    const request = createRequest("http://localhost/api/v1/configs/default/versions");
    const response = await loader({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for non-existent config", async () => {
    await setupTestUser();

    const request = createRequest("http://localhost/api/v1/configs/nonexistent/versions", authToken);

    const response = await loader({
      request,
      params: { configId: "nonexistent" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("returns empty versions array for config without versions", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const request = createRequest("http://localhost/api/v1/configs/default/versions", authToken);

    const response = await loader({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.configId).toBe("default");
    expect(data.versions).toEqual([]);
  });

  it("returns versions list successfully", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");
    createConfigVersion(testUserId, "default", DEFAULT_CONFIG);
    createConfigVersion(testUserId, "default", DEFAULT_CONFIG);

    const request = createRequest("http://localhost/api/v1/configs/default/versions", authToken);

    const response = await loader({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.configId).toBe("default");
    expect(data.versions).toHaveLength(2);
    expect(data.versions[0].version).toBe(2);
    expect(data.versions[1].version).toBe(1);
  });
});

describe("POST /api/v1/configs/:configId/versions", () => {
  it("returns 401 without auth token", async () => {
    const request = createRequest("http://localhost/api/v1/configs/default/versions", undefined, {
      method: "POST",
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 for non-existent config", async () => {
    await setupTestUser();

    const request = createRequest("http://localhost/api/v1/configs/nonexistent/versions", authToken, {
      method: "POST",
    });

    const response = await action({
      request,
      params: { configId: "nonexistent" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("creates version snapshot successfully", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const request = createRequest("http://localhost/api/v1/configs/default/versions", authToken, {
      method: "POST",
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.versionNumber).toBe(1);
    expect(data.configId).toBe("default");
  });

  it("creates multiple versions with incrementing numbers", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    // Create first version
    const request1 = createRequest("http://localhost/api/v1/configs/default/versions", authToken, {
      method: "POST",
    });

    const response1 = await action({
      request: request1,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    const data1 = await response1.json();
    expect(data1.versionNumber).toBe(1);

    // Create second version
    const request2 = createRequest("http://localhost/api/v1/configs/default/versions", authToken, {
      method: "POST",
    });

    const response2 = await action({
      request: request2,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    const data2 = await response2.json();
    expect(data2.versionNumber).toBe(2);
  });
});
