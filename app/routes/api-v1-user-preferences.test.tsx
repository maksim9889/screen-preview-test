import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-user-preferences-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-user-preferences";
import { saveConfig, getUser, resetDatabaseConnection, createApiToken } from "../lib/db.server";
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

describe("PATCH /api/v1/user/preferences", () => {
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

  it("updates lastConfigId preference successfully", async () => {
    // Create a config first
    saveConfig(testUserId, "my-config", testConfigData);

    const formData = new FormData();
    formData.append("lastConfigId", "my-config");

    const request = createRequest("http://localhost/api/v1/user/preferences", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.lastConfigId).toBe("my-config");
    expect(data.apiVersion).toBe("v1");

    // Verify preference was saved
    const user = getUser("testuser");
    expect(user!.last_config_id).toBe("my-config");
  });

  it("returns 401 without auth token", async () => {
    const formData = new FormData();
    formData.append("lastConfigId", "my-config");

    const request = createRequest("http://localhost/api/v1/user/preferences", undefined, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with invalid token", async () => {
    const formData = new FormData();
    formData.append("lastConfigId", "my-config");

    const request = createRequest("http://localhost/api/v1/user/preferences", "invalid-token", {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for missing preference fields", async () => {
    const formData = new FormData();
    // No fields provided

    const request = createRequest("http://localhost/api/v1/user/preferences", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid config ID format", async () => {
    const formData = new FormData();
    formData.append("lastConfigId", "invalid@id!");

    const request = createRequest("http://localhost/api/v1/user/preferences", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_CONFIG_ID");
  });

  it("returns 404 for non-existent config", async () => {
    const formData = new FormData();
    formData.append("lastConfigId", "non-existent-config");

    const request = createRequest("http://localhost/api/v1/user/preferences", authToken, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("cannot set lastConfigId to another user's config", async () => {
    // Create config for first user
    saveConfig(testUserId, "user1-config", testConfigData);

    // Create second user
    const result2 = await register("otheruser", "Password123");
    if ('error' in result2) throw new Error(result2.error);
    const user2 = getUser("otheruser");
    const apiTokenValue2 = crypto.randomBytes(32).toString("hex");
    createApiToken(apiTokenValue2, user2!.id, "test-token-2");

    // Try to set first user's config as second user's preference
    const formData = new FormData();
    formData.append("lastConfigId", "user1-config");

    const request = createRequest("http://localhost/api/v1/user/preferences", apiTokenValue2, {
      method: "PATCH",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("can update lastConfigId multiple times", async () => {
    // Create two configs
    saveConfig(testUserId, "config-a", testConfigData);
    saveConfig(testUserId, "config-b", testConfigData);

    // Set first config
    const formData1 = new FormData();
    formData1.append("lastConfigId", "config-a");

    const request1 = createRequest("http://localhost/api/v1/user/preferences", authToken, {
      method: "PATCH",
      body: formData1,
    });

    await action({ request: request1, params: {}, context: {}, unstable_pattern: "" });

    // Set second config
    const formData2 = new FormData();
    formData2.append("lastConfigId", "config-b");

    const request2 = createRequest("http://localhost/api/v1/user/preferences", authToken, {
      method: "PATCH",
      body: formData2,
    });

    const response = await action({ request: request2, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.lastConfigId).toBe("config-b");

    // Verify preference was updated
    const user = getUser("testuser");
    expect(user!.last_config_id).toBe("config-b");
  });
});
