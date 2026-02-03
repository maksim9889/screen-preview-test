import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-configs-export-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader } from "./api-v1-config-export";
import { saveConfig, getConfig, resetDatabaseConnection, getUser, createApiToken } from "../lib/db.server";
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

describe("GET /api/v1/configs/:configId/export", () => {
  let testUserId: number;
  let authToken: string;

  const testConfigData = {
    carousel: {
      images: ["https://example.com/image.jpg"],
      aspectRatio: "portrait" as const,
    },
    textSection: {
      title: "Test Title",
      titleColor: "#000000",
      description: "Test Description",
      descriptionColor: "#666666",
    },
    cta: {
      label: "Click Me",
      url: "https://example.com",
      backgroundColor: "#007AFF",
      textColor: "#FFFFFF",
    },
  };

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();

    // Create test user
    const result = await register("testuser", "TestPassword123");
    const user = getUser("testuser");
    testUserId = user!.id;

    // Create API token for testing
    const apiTokenValue = crypto.randomBytes(32).toString("hex");
    createApiToken(apiTokenValue, testUserId, "test-token");
    authToken = apiTokenValue;
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  it("exports configuration successfully", async () => {
    // Create a config to export
    saveConfig(testUserId, "export-test", testConfigData);

    const request = createRequest("http://localhost/api/v1/configs/export-test/export", authToken);

    const response = await loader({ request, params: { configId: "export-test" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("export-test");
    expect(response.headers.get("X-API-Version")).toBe("v1");

    const data = await response.json();
    expect(data.config_id).toBe("export-test");
    expect(data.data.textSection.title).toBe("Test Title");
  });

  it("includes username and date in filename", async () => {
    saveConfig(testUserId, "my-config", testConfigData);

    const request = createRequest("http://localhost/api/v1/configs/my-config/export", authToken);
    const response = await loader({ request, params: { configId: "my-config" }, context: {}, unstable_pattern: "" });

    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("testuser");
    expect(disposition).toContain("my-config");
    // Should contain date in format YYYY-MM-DD
    expect(disposition).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("returns 401 without auth token", async () => {
    saveConfig(testUserId, "test-config", testConfigData);

    const request = createRequest("http://localhost/api/v1/configs/test-config/export");

    const response = await loader({ request, params: { configId: "test-config" }, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with invalid token", async () => {
    saveConfig(testUserId, "test-config", testConfigData);

    const request = createRequest("http://localhost/api/v1/configs/test-config/export", "invalid-token");

    const response = await loader({ request, params: { configId: "test-config" }, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid config ID", async () => {
    const request = createRequest("http://localhost/api/v1/configs/invalid@id!/export", authToken);

    const response = await loader({ request, params: { configId: "invalid@id!" }, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_CONFIG_ID");
  });

  it("returns 404 for non-existent config", async () => {
    const request = createRequest("http://localhost/api/v1/configs/non-existent/export", authToken);

    const response = await loader({ request, params: { configId: "non-existent" }, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("exports config with schemaVersion and updatedAt", async () => {
    saveConfig(testUserId, "schema-test", testConfigData);

    const request = createRequest("http://localhost/api/v1/configs/schema-test/export", authToken);
    const response = await loader({ request, params: { configId: "schema-test" }, context: {}, unstable_pattern: "" });

    const data = await response.json();

    expect(data.schemaVersion).toBeDefined();
    expect(data.updatedAt).toBeDefined();
    expect(typeof data.schemaVersion).toBe("number");
  });

  it("does not expose other users' configs", async () => {
    // Create config for first user
    saveConfig(testUserId, "private-config", testConfigData);

    // Create second user
    const result2 = await register("otheruser", "Password123");
    if ('error' in result2) throw new Error(result2.error);
    const user2 = getUser("otheruser");
    const apiTokenValue2 = crypto.randomBytes(32).toString("hex");
    createApiToken(apiTokenValue2, user2!.id, "test-token-2");

    // Try to export first user's config with second user's token
    const request = createRequest("http://localhost/api/v1/configs/private-config/export", apiTokenValue2);
    const response = await loader({ request, params: { configId: "private-config" }, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });
});
