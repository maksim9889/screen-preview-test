/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-configId-versions-versionNumber-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader } from "./api-v1-config-version";
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

describe("GET /api/v1/configs/:configId/versions/:versionNumber", () => {
  it("returns 401 without auth token", async () => {
    const request = createRequest("http://localhost/api/v1/configs/default/versions/1");
    const response = await loader({
      request,
      params: { configId: "default", versionNumber: "1" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for non-existent config", async () => {
    await setupTestUser();

    const request = createRequest("http://localhost/api/v1/configs/nonexistent/versions/1", authToken);

    const response = await loader({
      request,
      params: { configId: "nonexistent", versionNumber: "1" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("returns 404 for non-existent version", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const request = createRequest("http://localhost/api/v1/configs/default/versions/999", authToken);

    const response = await loader({
      request,
      params: { configId: "default", versionNumber: "999" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.code).toBe("VERSION_NOT_FOUND");
  });

  it("returns 400 for invalid version number", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const request = createRequest("http://localhost/api/v1/configs/default/versions/invalid", authToken);

    const response = await loader({
      request,
      params: { configId: "default", versionNumber: "invalid" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("INVALID_VERSION_NUMBER");
  });

  it("returns version successfully", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");
    const version = createConfigVersion(testUserId, "default", DEFAULT_CONFIG);

    const request = createRequest(`http://localhost/api/v1/configs/default/versions/${version.version}`, authToken);

    const response = await loader({
      request,
      params: { configId: "default", versionNumber: version.version.toString() },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.configId).toBe("default");
    expect(data.version).toBeDefined();
    expect(data.version.version).toBe(version.version);
    expect(data.version.data).toEqual(DEFAULT_CONFIG);
  });

  it("returns correct version data", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const customConfig = { ...DEFAULT_CONFIG };
    customConfig.textSection.title = "Version 1 Title";
    const version1 = createConfigVersion(testUserId, "default", customConfig);

    const request = createRequest(`http://localhost/api/v1/configs/default/versions/${version1.version}`, authToken);

    const response = await loader({
      request,
      params: { configId: "default", versionNumber: version1.version.toString() },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.version.data.textSection.title).toBe("Version 1 Title");
  });
});
