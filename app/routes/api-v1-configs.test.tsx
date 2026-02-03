import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-configs-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./api-v1-configs";
import { saveConfig, updateLoadedVersion, getUser, getConfig, resetDatabaseConnection, createApiToken } from "../lib/db.server";
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

describe("API v1 Configs Route", () => {
  let testUserId: number;
  let authToken: string;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();

    // Create test user
    await register("testuser", "TestPassword123");
    const user = getUser("testuser");
    testUserId = user!.id;

    // Generate API token for testing (separate from session token)
    const apiTokenValue = crypto.randomBytes(32).toString("hex");
    createApiToken(apiTokenValue, testUserId, "test-token");
    authToken = apiTokenValue;

    // Create test configs
    const configData = {
      carousel: {
        images: ["https://example.com/image.jpg"],
        aspectRatio: "portrait" as const,
      },
      textSection: {
        title: "Title",
        titleColor: "#000000",
        description: "Description",
        descriptionColor: "#666666",
      },
      cta: {
        label: "Button",
        url: "https://example.com",
        backgroundColor: "#007AFF",
        textColor: "#FFFFFF",
      },
    };

    // Insert multiple configs
    saveConfig(testUserId, "default", configData);
    saveConfig(testUserId, "mobile", configData);
    saveConfig(testUserId, "tablet", configData);
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("GET /api/v1/configs", () => {
    it("returns all configurations for authenticated user", async () => {
      const request = createRequest("http://localhost/api/v1/configs", authToken);

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configs).toBeDefined();
      expect(data.configs).toHaveLength(3);
      expect(data.apiVersion).toBe("v1");
    });

    it("returns configs with correct properties", async () => {
      const request = createRequest("http://localhost/api/v1/configs", authToken);

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      const config = data.configs[0];
      expect(config).toHaveProperty("configId");
      expect(config).toHaveProperty("schemaVersion");
      expect(config).toHaveProperty("apiVersion");
      expect(config).toHaveProperty("updatedAt");
      expect(config).toHaveProperty("loadedVersion");
    });

    it("returns configs sorted by config_id", async () => {
      const request = createRequest("http://localhost/api/v1/configs", authToken);

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      const configIds = data.configs.map((c: any) => c.configId);
      expect(configIds).toEqual(["default", "mobile", "tablet"]);
    });

    it("returns 401 for unauthenticated user", async () => {
      const request = createRequest("http://localhost/api/v1/configs");

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("returns empty array when user has no configurations", async () => {
      // Create a new user without configs
      await register("newuser", "NewPassword123");
      const newUser = getUser("newuser");
      const newApiToken = crypto.randomBytes(32).toString("hex");
      createApiToken(newApiToken, newUser!.id, "new-user-token");

      const request = createRequest("http://localhost/api/v1/configs", newApiToken);

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.configs).toHaveLength(0);
    });

    it("includes loaded_version when set", async () => {
      // Set loaded version for one config
      updateLoadedVersion(testUserId, "mobile", 3);

      const request = createRequest("http://localhost/api/v1/configs", authToken);

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      const mobileConfig = data.configs.find((c: any) => c.configId === "mobile");
      expect(mobileConfig.loadedVersion).toBe(3);

      const defaultConfig = data.configs.find((c: any) => c.configId === "default");
      expect(defaultConfig.loadedVersion).toBeNull();
    });

    it("returns api_version from database", async () => {
      const request = createRequest("http://localhost/api/v1/configs", authToken);

      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      data.configs.forEach((config: any) => {
        expect(config.apiVersion).toBe("v1");
      });
    });
  });

  describe("POST /api/v1/configs", () => {
    it("creates new configuration successfully", async () => {
      const newConfig = {
        carousel: {
          images: ["https://example.com/new.jpg"],
          aspectRatio: "landscape" as const,
        },
        textSection: {
          title: "New Config",
          titleColor: "#FF0000",
          description: "New Description",
          descriptionColor: "#333333",
        },
        cta: {
          label: "Click Me",
          url: "https://newexample.com",
          backgroundColor: "#00FF00",
          textColor: "#000000",
        },
      };

      const formData = new FormData();
      formData.append("config", JSON.stringify(newConfig));
      formData.append("configId", "newconfig");

      const request = createRequest("http://localhost/api/v1/configs", authToken, {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.configId).toBe("newconfig");
      expect(data.apiVersion).toBe("v1");

      // Verify config was created
      const created = getConfig(testUserId, "newconfig");
      expect(created).toBeDefined();
      expect(created!.textSection.title).toBe("New Config");
    });

    it("returns 409 when config already exists", async () => {
      const config = {
        carousel: {
          images: ["https://example.com/image.jpg"],
          aspectRatio: "portrait" as const,
        },
        textSection: {
          title: "Title",
          titleColor: "#000000",
          description: "Description",
          descriptionColor: "#666666",
        },
        cta: {
          label: "Button",
          url: "https://example.com",
          backgroundColor: "#007AFF",
          textColor: "#FFFFFF",
        },
      };

      const formData = new FormData();
      formData.append("config", JSON.stringify(config));
      formData.append("configId", "default");

      const request = createRequest("http://localhost/api/v1/configs", authToken, {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe("CONFIG_ALREADY_EXISTS");
    });

    it("returns 400 for missing configId", async () => {
      const config = {
        carousel: {
          images: ["https://example.com/image.jpg"],
          aspectRatio: "portrait" as const,
        },
        textSection: {
          title: "Title",
          titleColor: "#000000",
          description: "Description",
          descriptionColor: "#666666",
        },
        cta: {
          label: "Button",
          url: "https://example.com",
          backgroundColor: "#007AFF",
          textColor: "#FFFFFF",
        },
      };

      const formData = new FormData();
      formData.append("config", JSON.stringify(config));

      const request = createRequest("http://localhost/api/v1/configs", authToken, {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("MISSING_FIELD");
    });

    it("returns 400 for invalid config data", async () => {
      const formData = new FormData();
      formData.append("config", "invalid json");
      formData.append("configId", "newconfig");

      const request = createRequest("http://localhost/api/v1/configs", authToken, {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe("INVALID_CONFIG_DATA");
    });

    it("returns 401 without auth token", async () => {
      const config = {
        carousel: {
          images: ["https://example.com/image.jpg"],
          aspectRatio: "portrait" as const,
        },
        textSection: {
          title: "Title",
          titleColor: "#000000",
          description: "Description",
          descriptionColor: "#666666",
        },
        cta: {
          label: "Button",
          url: "https://example.com",
          backgroundColor: "#007AFF",
          textColor: "#FFFFFF",
        },
      };

      const formData = new FormData();
      formData.append("config", JSON.stringify(config));
      formData.append("configId", "newconfig");

      const request = createRequest("http://localhost/api/v1/configs", undefined, {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });
  });
});
