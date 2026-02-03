import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-configs-import-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-configs-import";
import { saveConfig, getConfig, getUser, resetDatabaseConnection, createApiToken } from "../lib/db.server";
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

describe("POST /api/v1/configs/import", () => {
  let testUserId: number;
  let authToken: string;

  const validImportData = {
    config_id: "imported-config",
    schemaVersion: 1,
    updatedAt: "2024-01-15T10:00:00.000Z",
    data: {
      carousel: {
        images: ["https://example.com/image.jpg"],
        aspectRatio: "portrait",
      },
      textSection: {
        title: "Imported Title",
        titleColor: "#000000",
        description: "Imported Description",
        descriptionColor: "#666666",
      },
      cta: {
        label: "Click Me",
        url: "https://example.com",
        backgroundColor: "#007AFF",
        textColor: "#FFFFFF",
      },
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

  it("imports configuration successfully", async () => {
    const formData = new FormData();
    formData.append("importData", JSON.stringify(validImportData));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported).toBe(true);
    expect(data.configId).toBe("imported-config");
    expect(data.apiVersion).toBe("v1");

    // Verify config was imported
    const imported = getConfig(testUserId, "imported-config");
    expect(imported).toBeDefined();
    expect(imported!.textSection.title).toBe("Imported Title");
  });

  it("supports old format with 'id' field", async () => {
    const oldFormatData = {
      id: "old-format-config",
      schemaVersion: 1,
      updatedAt: "2024-01-15T10:00:00.000Z",
      data: validImportData.data,
    };

    const formData = new FormData();
    formData.append("importData", JSON.stringify(oldFormatData));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.configId).toBe("old-format-config");
  });

  it("overwrites existing config on import", async () => {
    // Create existing config
    saveConfig(testUserId, "imported-config", {
      ...validImportData.data,
      textSection: {
        ...validImportData.data.textSection,
        title: "Original Title",
      },
    });

    const formData = new FormData();
    formData.append("importData", JSON.stringify(validImportData));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);

    // Verify config was overwritten
    const imported = getConfig(testUserId, "imported-config");
    expect(imported!.textSection.title).toBe("Imported Title");
  });

  it("returns 401 without auth token", async () => {
    const formData = new FormData();
    formData.append("importData", JSON.stringify(validImportData));

    const request = createRequest("http://localhost/api/v1/configs/import", undefined, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for missing importData", async () => {
    const formData = new FormData();

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("MISSING_FIELD");
  });

  it("returns 400 for invalid JSON", async () => {
    const formData = new FormData();
    formData.append("importData", "not valid json");

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_IMPORT_FILE");
  });

  it("returns 400 for missing required fields", async () => {
    const incompleteData = {
      config_id: "test",
      // Missing schemaVersion, updatedAt, data
    };

    const formData = new FormData();
    formData.append("importData", JSON.stringify(incompleteData));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_IMPORT_FILE");
  });

  it("returns 400 for invalid config_id", async () => {
    const invalidIdData = {
      ...validImportData,
      config_id: "invalid@id!",
    };

    const formData = new FormData();
    formData.append("importData", JSON.stringify(invalidIdData));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_CONFIG_ID");
  });

  it("returns 400 for invalid config data", async () => {
    const invalidConfigData = {
      ...validImportData,
      data: {
        carousel: {
          images: ["not-a-url"],
          aspectRatio: "invalid",
        },
        textSection: {},
        cta: {},
      },
    };

    const formData = new FormData();
    formData.append("importData", JSON.stringify(invalidConfigData));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_CONFIG_DATA");
  });

  it("normalizes hex colors during import", async () => {
    const dataWithShortColors = {
      ...validImportData,
      data: {
        ...validImportData.data,
        textSection: {
          ...validImportData.data.textSection,
          titleColor: "#f00",
          descriptionColor: "#0f0",
        },
      },
    };

    const formData = new FormData();
    formData.append("importData", JSON.stringify(dataWithShortColors));

    const request = createRequest("http://localhost/api/v1/configs/import", authToken, {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.config.textSection.titleColor).toBe("#FF0000");
    expect(data.config.textSection.descriptionColor).toBe("#00FF00");
  });
});
