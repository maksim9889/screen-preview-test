import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_PATH = path.join(process.cwd(), "data", "test-auth-register-api.db");

// Set environment variable BEFORE importing modules
process.env.DATABASE_PATH = TEST_DB_PATH;

import { action } from "./api-v1-auth-register";
import { register } from "../lib/auth.server";
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

describe("POST /api/v1/auth/register", () => {
  beforeEach(() => {
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

  it("registers a new user successfully", async () => {
    const formData = new FormData();
    formData.append("username", "newuser");
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Registration successful");
    expect(data.apiVersion).toBe("v1");

    const setCookie = response.headers.get("Set-Cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("auth_token=");
  });

  it("returns 400 for missing username", async () => {
    const formData = new FormData();
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for username too short", async () => {
    const formData = new FormData();
    formData.append("username", "ab");
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toContain("between 3 and 50");
  });

  it("returns 400 for password too short", async () => {
    const formData = new FormData();
    formData.append("username", "newuser");
    formData.append("password", "short");

    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toContain("at least 8");
  });

  it("returns 400 for duplicate username", async () => {
    await register("existinguser", "Password123");

    const formData = new FormData();
    formData.append("username", "existinguser");
    formData.append("password", "Password123");

    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {}, unstable_pattern: "" });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.error).toContain("already exists");
  });
});
