import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-versions-restore-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-version-restore";
import {
  saveConfig,
  createConfigVersion,
  getLoadedVersion,
  getUser,
  resetDatabaseConnection,
  createApiToken,
} from "../lib/db.server";
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

describe("POST /api/v1/versions/{versionNumber}/restore", () => {
  let testUserId: number;
  let authToken: string;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();

    const result = await register("testuser", "TestPassword123");
    const user = getUser("testuser");
    testUserId = user!.id;

    // Create API token for testing
    const apiTokenValue = crypto.randomBytes(32).toString("hex");
    createApiToken(apiTokenValue, testUserId, "test-token");
    authToken = apiTokenValue;

    const configData = {
      carousel: {
        images: ["https://example.com/image.jpg"],
        aspectRatio: "portrait" as const,
      },
      textSection: {
        title: "Version 1 Title",
        titleColor: "#000000",
        description: "Version 1 Description",
        descriptionColor: "#666666",
      },
      cta: {
        label: "Button",
        url: "https://example.com",
        backgroundColor: "#007AFF",
        textColor: "#FFFFFF",
      },
    };

    saveConfig(testUserId, "default", configData);
    createConfigVersion(testUserId, "default", configData);
    createConfigVersion(testUserId, "default", {
      ...configData,
      textSection: { ...configData.textSection, title: "Version 2 Title" },
    });
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  it("restores a version successfully", async () => {
    const formData = new FormData();
    formData.append("configId", "default");

    const request = createRequest("http://localhost/api/v1/versions/1/restore", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({
      request,
      params: { versionNumber: "1" },
      context: {}
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.restoredVersion).toBe(1);
    expect(data.configId).toBe("default");
    expect(data.apiVersion).toBe("v1");
  });

  it("updates loaded_version after restore", async () => {
    const formData = new FormData();
    formData.append("configId", "default");

    const request = createRequest("http://localhost/api/v1/versions/1/restore", authToken, {
      method: "POST",
      body: formData,
    });

    await action({
      request,
      params: { versionNumber: "1" },
      context: {}
    });

    const loadedVersion = getLoadedVersion(testUserId, "default");
    expect(loadedVersion).toBe(1);
  });

  it("returns 401 for unauthenticated user", async () => {
    const formData = new FormData();

    const request = createRequest("http://localhost/api/v1/versions/1/restore", undefined, {
      method: "POST",
      body: formData,
    });

    const response = await action({
      request,
      params: { versionNumber: "1" },
      context: {}
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid version number", async () => {
    const formData = new FormData();
    formData.append("configId", "default");

    const request = createRequest("http://localhost/api/v1/versions/invalid/restore", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({
      request,
      params: { versionNumber: "invalid" },
      context: {}
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for non-existent version", async () => {
    const formData = new FormData();
    formData.append("configId", "default");

    const request = createRequest("http://localhost/api/v1/versions/999/restore", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({
      request,
      params: { versionNumber: "999" },
      context: {}
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("CONFIG_NOT_FOUND");
  });

  it("returns 400 for invalid configId", async () => {
    const formData = new FormData();
    formData.append("configId", "invalid@config");

    const request = createRequest("http://localhost/api/v1/versions/1/restore", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({
      request,
      params: { versionNumber: "1" },
      context: {}
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_CONFIG_ID");
  });
});
