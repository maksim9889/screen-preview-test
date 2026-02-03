import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-api-token-delete.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-api-token";
import { register, generateApiToken } from "../lib/auth.server";
import { resetDatabaseConnection } from "../lib/db.server";

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

describe("DELETE /api/v1/api-tokens/:tokenId", () => {
  let userId: number;
  let apiToken: string;
  let tokenId: number;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();
    const result = await register("testuser", "Password123");
    userId = result.userId!;
    const tokenResult = generateApiToken(userId, "Test Token");
    apiToken = tokenResult.token;
    tokenId = tokenResult.id;
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  it("deletes token successfully with valid auth", async () => {
    // Create another token to delete
    const tokenToDelete = generateApiToken(userId, "Token to Delete");

    const request = new Request("http://localhost/api/v1/api-tokens/" + tokenToDelete.id, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    const response = await action({
      request,
      params: { tokenId: String(tokenToDelete.id) },
      context: {},
      unstable_pattern: "",
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("API token revoked");
  });

  it("returns 401 for unauthenticated request", async () => {
    const request = new Request("http://localhost/api/v1/api-tokens/1", {
      method: "DELETE",
    });

    const response = await action({
      request,
      params: { tokenId: "1" },
      context: {},
      unstable_pattern: "",
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for non-existent token", async () => {
    const request = new Request("http://localhost/api/v1/api-tokens/99999", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    const response = await action({
      request,
      params: { tokenId: "99999" },
      context: {},
      unstable_pattern: "",
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("NOT_FOUND");
  });

  it("returns 404 for invalid token ID format", async () => {
    const request = new Request("http://localhost/api/v1/api-tokens/invalid", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    const response = await action({
      request,
      params: { tokenId: "invalid" },
      context: {},
      unstable_pattern: "",
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for non-DELETE method", async () => {
    const request = new Request("http://localhost/api/v1/api-tokens/1", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    const response = await action({
      request,
      params: { tokenId: "1" },
      context: {},
      unstable_pattern: "",
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });
});
