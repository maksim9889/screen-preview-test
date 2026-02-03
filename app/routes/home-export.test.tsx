import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-home-export.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader } from "./home-export";
import { saveConfig, resetDatabaseConnection } from "../lib/db.server";
import { register } from "../lib/auth.server";

// Helper to create auth cookie from token
function createAuthCookie(token: string): string {
  return `auth_token=${token}`;
}

// Helper to create request with auth cookie
function createRequest(url: string, authCookie?: string): Request {
  const headers = new Headers();
  if (authCookie) {
    headers.set("Cookie", authCookie);
  }
  return new Request(url, { headers });
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

describe("GET /home/export/:configId", () => {
  let testUserId: number;
  let authCookie: string;

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
    const { getUser } = await import("../lib/db.server");
    const user = getUser("testuser");
    testUserId = user!.id;
    authCookie = createAuthCookie(result.token);
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  it("exports configuration successfully with cookie auth", async () => {
    // Create a config to export
    saveConfig(testUserId, "export-test", testConfigData);

    const request = createRequest("http://localhost/home/export/export-test", authCookie);

    const response = await loader({ request, params: { configId: "export-test" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("export-test");

    const data = await response.json();
    expect(data.config_id).toBe("export-test");
    expect(data.data.textSection.title).toBe("Test Title");
  });

  it("includes username and date in filename", async () => {
    saveConfig(testUserId, "my-config", testConfigData);

    const request = createRequest("http://localhost/home/export/my-config", authCookie);
    const response = await loader({ request, params: { configId: "my-config" }, context: {}, unstable_pattern: "" });

    const disposition = response.headers.get("Content-Disposition");
    expect(disposition).toContain("testuser");
    expect(disposition).toContain("my-config");
    // Should contain date in format YYYY-MM-DD
    expect(disposition).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("redirects to login without auth cookie", async () => {
    saveConfig(testUserId, "test-config", testConfigData);

    const request = createRequest("http://localhost/home/export/test-config");

    const response = await loader({ request, params: { configId: "test-config" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("redirects to login with invalid cookie", async () => {
    saveConfig(testUserId, "test-config", testConfigData);

    const request = createRequest("http://localhost/home/export/test-config", "auth_token=invalid");

    const response = await loader({ request, params: { configId: "test-config" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("redirects to home for invalid config ID", async () => {
    const request = createRequest("http://localhost/home/export/invalid@id!", authCookie);

    const response = await loader({ request, params: { configId: "invalid@id!" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/home");
  });

  it("redirects to home for non-existent config", async () => {
    const request = createRequest("http://localhost/home/export/non-existent", authCookie);

    const response = await loader({ request, params: { configId: "non-existent" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/home");
  });

  it("exports config with schemaVersion and updatedAt", async () => {
    saveConfig(testUserId, "schema-test", testConfigData);

    const request = createRequest("http://localhost/home/export/schema-test", authCookie);
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
    const cookie2 = createAuthCookie(result2.token);

    // Try to export first user's config with second user's cookie
    const request = createRequest("http://localhost/home/export/private-config", cookie2);
    const response = await loader({ request, params: { configId: "private-config" }, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/home");
  });
});
