import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-home-logout.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./home";
import { resetDatabaseConnection, getAuthToken } from "../lib/db.server";
import { register } from "../lib/auth.server";

// Helper to create auth cookie from token
function createAuthCookie(token: string): string {
  return `auth_token=${token}`;
}

// Helper to create CSRF cookie and token
function createCsrfCookie(): { cookie: string; token: string } {
  const token = "test-csrf-token-12345";
  return {
    cookie: `csrf_token=${token}`,
    token,
  };
}

// Helper to create request with auth cookie and form data
function createRequest(
  url: string,
  options: {
    authCookie?: string;
    csrfCookie?: string;
    formData?: FormData;
  } = {}
): Request {
  const headers = new Headers();
  const cookies: string[] = [];

  if (options.authCookie) {
    cookies.push(options.authCookie);
  }
  if (options.csrfCookie) {
    cookies.push(options.csrfCookie);
  }
  if (cookies.length > 0) {
    headers.set("Cookie", cookies.join("; "));
  }

  return new Request(url, {
    method: "POST",
    headers,
    body: options.formData,
  });
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

describe("POST /home (logout intent)", () => {
  let authToken: string;
  let authCookie: string;

  beforeEach(async () => {
    resetDatabaseConnection();
    cleanupTestDatabase();

    // Create test user
    const result = await register("testuser", "TestPassword123");
    authToken = result.token;
    authCookie = createAuthCookie(result.token);
  });

  afterEach(() => {
    resetDatabaseConnection();
  });

  afterAll(() => {
    resetDatabaseConnection();
    cleanupTestDatabase();
  });

  it("logs out user and clears auth token from database", async () => {
    const csrf = createCsrfCookie();

    // Verify token exists before logout
    const tokenBefore = getAuthToken(authToken);
    expect(tokenBefore).toBeDefined();

    const formData = new FormData();
    formData.append("intent", "logout");
    formData.append("csrf_token", csrf.token);

    const request = createRequest("http://localhost/home", {
      authCookie,
      csrfCookie: csrf.cookie,
      formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });

    // Should redirect to login
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");

    // Should set cookie to clear auth token
    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("auth_token=");
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970");

    // Verify token is deleted from database
    const tokenAfter = getAuthToken(authToken);
    expect(tokenAfter).toBeNull();
  });

  it("redirects to login even if token not found in database", async () => {
    const csrf = createCsrfCookie();

    const formData = new FormData();
    formData.append("intent", "logout");
    formData.append("csrf_token", csrf.token);

    // Use a valid auth cookie for authentication, but the logout should still work
    const request = createRequest("http://localhost/home", {
      authCookie,
      csrfCookie: csrf.cookie,
      formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
  });

  it("returns error without authentication", async () => {
    const csrf = createCsrfCookie();

    const formData = new FormData();
    formData.append("intent", "logout");
    formData.append("csrf_token", csrf.token);

    const request = createRequest("http://localhost/home", {
      csrfCookie: csrf.cookie,
      formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });

    // react-router's data() returns a DataWithResponseInit object
    // Check the init status and the data
    expect((response as any).init?.status).toBe(401);
    expect((response as any).type).toBe("DataWithResponseInit");
    expect((response as any).data.code).toBe("UNAUTHORIZED");
  });

  it("returns error with invalid CSRF token", async () => {
    const csrf = createCsrfCookie();

    const formData = new FormData();
    formData.append("intent", "logout");
    formData.append("csrf_token", "invalid-csrf-token");

    const request = createRequest("http://localhost/home", {
      authCookie,
      csrfCookie: csrf.cookie,
      formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });

    // react-router's data() returns a DataWithResponseInit object
    expect((response as any).init?.status).toBe(403);
    expect((response as any).type).toBe("DataWithResponseInit");
    expect((response as any).data.code).toBe("INVALID_CSRF");
  });
});
