import { describe, it, expect } from "vitest";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  internalError,
  conflict,
  tooManyRequests,
  generateRequestId,
} from "./api-responses.server";
import { ErrorCode } from "./api-types";

describe("api-responses", () => {
  describe("ok", () => {
    it("should return 200 status with data", async () => {
      const data = { success: true, message: "Test" };
      const response = ok(data);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual(data);
    });

    it("should set correct content-type header", () => {
      const response = ok({ test: true });
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });
  });

  describe("badRequest", () => {
    it("should return 400 status with error message", async () => {
      const message = "Invalid input";
      const response = badRequest(message, ErrorCode.VALIDATION_ERROR);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe(message);
      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it("should include optional details", async () => {
      const response = badRequest(
        "Error",
        ErrorCode.VALIDATION_ERROR,
        "Extra details"
      );
      const json = await response.json();
      expect(json.details).toBe("Extra details");
    });
  });

  describe("unauthorized", () => {
    it("should return 401 status", async () => {
      const response = unauthorized("Not authenticated", ErrorCode.UNAUTHORIZED);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Not authenticated");
    });
  });

  describe("forbidden", () => {
    it("should return 403 status", async () => {
      const response = forbidden("Access denied", ErrorCode.INVALID_CSRF);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Access denied");
    });
  });

  describe("notFound", () => {
    it("should return 404 status", async () => {
      const response = notFound("Resource not found", ErrorCode.CONFIG_NOT_FOUND);
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Resource not found");
    });
  });

  describe("internalError", () => {
    it("should return 500 status", async () => {
      const response = internalError("Server error", ErrorCode.INTERNAL_ERROR);
      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe("Server error");
    });
  });

  describe("conflict", () => {
    it("should return 409 status", async () => {
      const response = conflict("Data conflict", ErrorCode.STALE_DATA);
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toBe("Data conflict");
      expect(json.code).toBe("STALE_DATA");
    });
  });

  describe("tooManyRequests", () => {
    it("should return 429 status", async () => {
      const response = tooManyRequests("Rate limited", ErrorCode.RATE_LIMIT_EXCEEDED);
      expect(response.status).toBe(429);
      const json = await response.json();
      expect(json.error).toBe("Rate limited");
    });
  });

  describe("generateRequestId", () => {
    it("should generate valid UUID format", () => {
      const requestId = generateRequestId();
      expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it("should generate unique IDs", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("requestId in error responses", () => {
    it("should include requestId in badRequest response", async () => {
      const response = badRequest("Error", ErrorCode.VALIDATION_ERROR);
      const json = await response.json();
      expect(json.requestId).toBeDefined();
      expect(json.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/i);
    });

    it("should include requestId in unauthorized response", async () => {
      const response = unauthorized("Error", ErrorCode.UNAUTHORIZED);
      const json = await response.json();
      expect(json.requestId).toBeDefined();
    });

    it("should include requestId in forbidden response", async () => {
      const response = forbidden("Error", ErrorCode.FORBIDDEN);
      const json = await response.json();
      expect(json.requestId).toBeDefined();
    });

    it("should include requestId in notFound response", async () => {
      const response = notFound("Error", ErrorCode.CONFIG_NOT_FOUND);
      const json = await response.json();
      expect(json.requestId).toBeDefined();
    });

    it("should include requestId in conflict response", async () => {
      const response = conflict("Error", ErrorCode.STALE_DATA);
      const json = await response.json();
      expect(json.requestId).toBeDefined();
    });

    it("should include requestId in internalError response", async () => {
      const response = internalError("Error", ErrorCode.INTERNAL_ERROR);
      const json = await response.json();
      expect(json.requestId).toBeDefined();
    });
  });
});
