import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-settings.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { loader, action } from "./settings";
import { register } from "../lib/auth.server";
import { resetDatabaseConnection, getUser, createApiToken, listApiTokens } from "../lib/db.server";
import { generateCsrfToken } from "../lib/csrf.server";
import { CSRF_FIELD_NAME, CSRF_COOKIE_NAME } from "../lib/constants";
import crypto from "crypto";

// Helper to create request with auth cookie
function createRequest(
  url: string,
  options: RequestInit & { authToken?: string; csrfToken?: string } = {}
): Request {
  const { authToken, csrfToken, ...init } = options;
  const headers = new Headers(init.headers);

  const cookies: string[] = [];
  if (authToken) {
    cookies.push(`auth_token=${authToken}`);
  }
  if (csrfToken) {
    cookies.push(`${CSRF_COOKIE_NAME}=${csrfToken}`);
  }
  if (cookies.length > 0) {
    headers.set("Cookie", cookies.join("; "));
  }

  return new Request(url, { ...init, headers });
}

// Helper to create form data
function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

// Helper to extract data from loader/action result
// React Router's data() returns a DataWithResponseInit object when headers/status are set
async function extractData(result: any): Promise<any> {
  if (result instanceof Response) {
    return result.json();
  }
  // DataWithResponseInit from react-router has a 'data' property
  if (result && result.type === "DataWithResponseInit") {
    return result.data;
  }
  // Plain object returned directly
  return result;
}

// Helper to get status from result
function getStatus(result: any): number {
  if (result instanceof Response) {
    return result.status;
  }
  // DataWithResponseInit from react-router has an 'init' property with status
  if (result && result.type === "DataWithResponseInit" && result.init) {
    return result.init.status || 200;
  }
  return 200; // Default status for plain objects
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
      try {
        fs.unlinkSync(file);
      } catch (e) {
        /* ignore */
      }
    }
  }
}

describe("Settings Page", () => {
  let authToken: string;
  let userId: number;
  let csrfToken: string;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();

    // Register a test user
    const result = await register("testuser", "TestPassword123");
    if ("error" in result) throw new Error(result.error as string);
    authToken = result.token!;
    const user = getUser("testuser");
    userId = user!.id;

    // Generate a CSRF token
    csrfToken = generateCsrfToken();
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  describe("loader", () => {
    it("redirects to login when not authenticated", async () => {
      const request = createRequest("http://localhost/settings");
      const response = await loader({ request, params: {}, context: {}, unstable_pattern: "" });

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/login");
    });

    it("returns tokens list when authenticated", async () => {
      // Create some tokens first
      const token1 = crypto.randomBytes(32).toString("hex");
      const token2 = crypto.randomBytes(32).toString("hex");
      createApiToken(token1, userId, "Token 1");
      createApiToken(token2, userId, "Token 2");

      const request = createRequest("http://localhost/settings", {
        authToken,
        csrfToken,
      });

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(data.username).toBe("testuser");
      expect(data.tokens).toHaveLength(2);
      // Check that both tokens are present (order may vary due to timestamp precision)
      const tokenNames = data.tokens.map((t: any) => t.name);
      expect(tokenNames).toContain("Token 1");
      expect(tokenNames).toContain("Token 2");
      // Check token preview format (8-char prefix + "...")
      expect(data.tokens[0].tokenPreview).toMatch(/^.{8}\.\.\.$/);
      expect(data.csrfToken).toBeDefined();
    });

    it("returns empty tokens list when user has no tokens", async () => {
      const request = createRequest("http://localhost/settings", {
        authToken,
        csrfToken,
      });

      const result = await loader({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(data.tokens).toHaveLength(0);
    });
  });

  describe("action - createToken", () => {
    it("creates a new token and returns full token value", async () => {
      const formData = createFormData({
        intent: "createToken",
        name: "My CI Token",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(data.success).toBe(true);
      expect(data.intent).toBe("createToken");
      expect(data.token.name).toBe("My CI Token");
      expect(data.token.token).toHaveLength(64); // Full hex token
      expect(data.token.id).toBeDefined();
      expect(data.token.createdAt).toBeDefined();

      // Verify token was created in database
      const tokens = listApiTokens(userId);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].name).toBe("My CI Token");
    });

    it("returns error for empty token name", async () => {
      const formData = createFormData({
        intent: "createToken",
        name: "",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(400);
      expect(data.error).toBe("Token name is required");
      expect(data.code).toBe("MISSING_FIELD");
    });

    it("returns error for token name exceeding 100 characters", async () => {
      const formData = createFormData({
        intent: "createToken",
        name: "a".repeat(101),
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(400);
      expect(data.error).toBe("Token name must be 100 characters or less");
    });

    it("returns 401 when not authenticated", async () => {
      const formData = createFormData({
        intent: "createToken",
        name: "Test Token",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        csrfToken, // No authToken
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(401);
      expect(data.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 for invalid CSRF token", async () => {
      const formData = createFormData({
        intent: "createToken",
        name: "Test Token",
        [CSRF_FIELD_NAME]: "invalid-csrf-token",
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(403);
      expect(data.code).toBe("INVALID_CSRF");
    });
  });

  describe("action - deleteToken", () => {
    it("deletes an existing token", async () => {
      // Create a token first
      const tokenValue = crypto.randomBytes(32).toString("hex");
      createApiToken(tokenValue, userId, "Token to Delete");
      const tokens = listApiTokens(userId);
      const tokenId = tokens[0].id;

      const formData = createFormData({
        intent: "deleteToken",
        tokenId: tokenId.toString(),
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(data.success).toBe(true);
      expect(data.intent).toBe("deleteToken");
      expect(data.deletedTokenId).toBe(tokenId);

      // Verify token was deleted
      const remainingTokens = listApiTokens(userId);
      expect(remainingTokens).toHaveLength(0);
    });

    it("returns 404 for non-existent token", async () => {
      const formData = createFormData({
        intent: "deleteToken",
        tokenId: "99999",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(404);
      expect(data.error).toBe("Token not found or already deleted");
    });

    it("returns error for missing token ID", async () => {
      const formData = createFormData({
        intent: "deleteToken",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(400);
      expect(data.error).toBe("Token ID is required");
    });

    it("returns error for invalid token ID format", async () => {
      const formData = createFormData({
        intent: "deleteToken",
        tokenId: "not-a-number",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(400);
      expect(data.error).toBe("Invalid token ID");
    });

    it("cannot delete another user's token", async () => {
      // Create another user and their token
      const result2 = await register("otheruser", "Password123");
      if ("error" in result2) throw new Error(result2.error as string);
      const otherUser = getUser("otheruser");

      const tokenValue = crypto.randomBytes(32).toString("hex");
      createApiToken(tokenValue, otherUser!.id, "Other User Token");
      const otherTokens = listApiTokens(otherUser!.id);
      const otherTokenId = otherTokens[0].id;

      // Try to delete as first user
      const formData = createFormData({
        intent: "deleteToken",
        tokenId: otherTokenId.toString(),
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken, // First user's auth token
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(404);
      expect(data.error).toBe("Token not found or already deleted");

      // Verify token still exists for other user
      const remainingTokens = listApiTokens(otherUser!.id);
      expect(remainingTokens).toHaveLength(1);
    });
  });

  describe("action - unknown intent", () => {
    it("returns error for unknown intent", async () => {
      const formData = createFormData({
        intent: "unknownIntent",
        [CSRF_FIELD_NAME]: csrfToken,
      });

      const request = createRequest("http://localhost/settings", {
        method: "POST",
        body: formData,
        authToken,
        csrfToken,
      });

      const result = await action({ request, params: {}, context: {}, unstable_pattern: "" });
      const data = await extractData(result);

      expect(getStatus(result)).toBe(400);
      expect(data.error).toBe("Unknown intent");
      expect(data.code).toBe("INVALID_INTENT");
    });
  });
});
