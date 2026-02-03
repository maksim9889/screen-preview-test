/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-configId-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./api-v1-config";
import { saveConfig, createConfigVersion, DEFAULT_CONFIG, resetDatabaseConnection, getUser, getFullConfigRecord, createApiToken } from "../lib/db.server";
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

// Test user credentials
const testUsername = "testuser";
const testPassword = "TestPassword123";
let testUserId: number;
let authToken: string;

async function setupTestUser() {
  const result = await register(testUsername, testPassword);

  const user = getUser(testUsername);
  if (!user) throw new Error("Failed to create test user");
  testUserId = user.id;

  // Generate API token for testing (separate from session token)
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

describe("GET /api/v1/configs/:configId", () => {
  it("returns 401 without auth token", async () => {
    const request = createRequest("http://localhost/api/v1/configs/default");
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

    const request = createRequest("http://localhost/api/v1/configs/nonexistent", authToken);

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

  it("returns config successfully", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const request = createRequest("http://localhost/api/v1/configs/default", authToken);

    const response = await loader({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.configId).toBe("default");
    expect(data.config).toBeDefined();
    expect(data.apiVersion).toBe("v1");
  });

  it("returns 400 for invalid configId format", async () => {
    await setupTestUser();

    const request = createRequest("http://localhost/api/v1/configs/invalid!@#", authToken);

    const response = await loader({
      request,
      params: { configId: "invalid!@#" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("INVALID_CONFIG_ID");
  });
});

describe("PUT /api/v1/configs/:configId", () => {
  it("returns 404 for non-existent config", async () => {
    await setupTestUser();

    const formData = new FormData();
    formData.append("config", JSON.stringify(DEFAULT_CONFIG));

    const request = createRequest("http://localhost/api/v1/configs/nonexistent", authToken, {
      method: "PUT",
      body: formData,
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

  it("updates existing config successfully", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const updatedConfig = { ...DEFAULT_CONFIG };
    updatedConfig.textSection.title = "Updated Title";

    const formData = new FormData();
    formData.append("config", JSON.stringify(updatedConfig));

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PUT",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.configId).toBe("default");
  });

  it("returns 409 for stale expectedUpdatedAt", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const updatedConfig = { ...DEFAULT_CONFIG };
    updatedConfig.textSection.title = "Updated Title";

    const formData = new FormData();
    formData.append("config", JSON.stringify(updatedConfig));
    formData.append("expectedUpdatedAt", "2020-01-01T00:00:00.000Z"); // Stale timestamp

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PUT",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.code).toBe("STALE_DATA");
    expect(data.requestId).toBeDefined();
  });

  it("succeeds when expectedUpdatedAt matches", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    // Get the actual updatedAt
    const record = getFullConfigRecord(testUserId, "default");
    const currentUpdatedAt = record!.updatedAt;

    const updatedConfig = { ...DEFAULT_CONFIG };
    updatedConfig.textSection.title = "Updated Title";

    const formData = new FormData();
    formData.append("config", JSON.stringify(updatedConfig));
    formData.append("expectedUpdatedAt", currentUpdatedAt);

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PUT",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("normalizes hex colors to uppercase RRGGBB format", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const configWithShortColors = {
      ...DEFAULT_CONFIG,
      textSection: {
        ...DEFAULT_CONFIG.textSection,
        titleColor: "#f00", // Short format
        descriptionColor: "#abc", // Short format
      },
      cta: {
        ...DEFAULT_CONFIG.cta,
        backgroundColor: "#00f", // Short format
        textColor: "#fff", // Short format
      },
    };

    const formData = new FormData();
    formData.append("config", JSON.stringify(configWithShortColors));

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PUT",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);

    // Verify colors were normalized by fetching the saved config
    const { getConfig } = await import("../lib/db.server");
    const savedConfig = getConfig(testUserId, "default");

    expect(savedConfig!.textSection.titleColor).toBe("#FF0000");
    expect(savedConfig!.textSection.descriptionColor).toBe("#AABBCC");
    expect(savedConfig!.cta.backgroundColor).toBe("#0000FF");
    expect(savedConfig!.cta.textColor).toBe("#FFFFFF");
  });
});

describe("PATCH /api/v1/configs/:configId", () => {
  it("restores version successfully", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");
    const version = createConfigVersion(testUserId, "default", DEFAULT_CONFIG);

    const formData = new FormData();
    formData.append("loadedVersion", version.version.toString());

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.restored).toBe(true);
    expect(data.restoredVersion).toBe(version.version);
  });

  it("returns 404 for non-existent version", async () => {
    await setupTestUser();
    saveConfig(testUserId, "default", DEFAULT_CONFIG, "v1");

    const formData = new FormData();
    formData.append("loadedVersion", "999");

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
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

    const formData = new FormData();
    formData.append("loadedVersion", "invalid");

    const request = createRequest("http://localhost/api/v1/configs/default", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({
      request,
      params: { configId: "default" },
      context: {},
    unstable_pattern: "",
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("INVALID_VERSION_NUMBER");
  });
});
