/**
 * OpenAPI Sync Validation Tests
 *
 * These tests validate that the OpenAPI specification stays in sync
 * with the TypeScript type definitions in api-types.ts.
 *
 * Run with: npm test -- openapi-sync
 */

import { describe, it, expect } from "vitest";
import { ErrorCode } from "./api-types";
import { openApiSpec } from "./openapi-spec";

describe("OpenAPI Sync Validation", () => {
  describe("Error Codes", () => {
    it("should have all TypeScript error codes in OpenAPI spec", () => {
      const tsErrorCodes = Object.values(ErrorCode);
      const openApiErrorCodes =
        openApiSpec.components.schemas.ErrorResponse.properties.code.enum;

      const missingInOpenApi = tsErrorCodes.filter(
        (code) => !openApiErrorCodes.includes(code)
      );

      expect(missingInOpenApi).toEqual([]);
    });

    it("should not have extra error codes in OpenAPI spec", () => {
      const tsErrorCodes = Object.values(ErrorCode);
      const openApiErrorCodes =
        openApiSpec.components.schemas.ErrorResponse.properties.code.enum;

      const extraInOpenApi = openApiErrorCodes.filter(
        (code: string) => !tsErrorCodes.includes(code as typeof ErrorCode[keyof typeof ErrorCode])
      );

      expect(extraInOpenApi).toEqual([]);
    });
  });

  describe("AppConfig Schema", () => {
    it("should have carousel section with required fields", () => {
      const carouselProps =
        openApiSpec.components.schemas.AppConfig.properties.carousel.properties;

      expect(carouselProps).toHaveProperty("images");
      expect(carouselProps).toHaveProperty("aspectRatio");
      expect(carouselProps.aspectRatio.enum).toEqual([
        "portrait",
        "landscape",
        "square",
      ]);
    });

    it("should have textSection with required fields", () => {
      const textProps =
        openApiSpec.components.schemas.AppConfig.properties.textSection
          .properties;

      expect(textProps).toHaveProperty("title");
      expect(textProps).toHaveProperty("titleColor");
      expect(textProps).toHaveProperty("description");
      expect(textProps).toHaveProperty("descriptionColor");
    });

    it("should have cta section with required fields", () => {
      const ctaProps =
        openApiSpec.components.schemas.AppConfig.properties.cta.properties;

      expect(ctaProps).toHaveProperty("label");
      expect(ctaProps).toHaveProperty("url");
      expect(ctaProps).toHaveProperty("backgroundColor");
      expect(ctaProps).toHaveProperty("textColor");
    });
  });

  describe("API Endpoints", () => {
    it("should document all config endpoints", () => {
      const paths = Object.keys(openApiSpec.paths);

      expect(paths).toContain("/api/v1/configs");
      expect(paths).toContain("/api/v1/configs/{configId}");
      expect(paths).toContain("/api/v1/configs/{configId}/export");
      expect(paths).toContain("/api/v1/configs/import");
      expect(paths).toContain("/api/v1/configs/{configId}/versions");
      expect(paths).toContain("/api/v1/configs/{configId}/versions/{versionNumber}");
    });

    it("should document all auth endpoints", () => {
      const paths = Object.keys(openApiSpec.paths);

      expect(paths).toContain("/api/v1/auth/login");
      expect(paths).toContain("/api/v1/auth/logout");
      expect(paths).toContain("/api/v1/auth/register");
    });

    it("should document api-tokens endpoints", () => {
      const paths = Object.keys(openApiSpec.paths);

      expect(paths).toContain("/api/v1/api-tokens");
      expect(paths).toContain("/api/v1/api-tokens/{tokenId}");
    });
  });

  describe("HTTP Methods", () => {
    it("should have correct methods for /api/v1/configs", () => {
      const configsPath = openApiSpec.paths["/api/v1/configs"];

      expect(configsPath).toHaveProperty("get");
      expect(configsPath).toHaveProperty("post");
    });

    it("should have correct methods for /api/v1/configs/{configId}", () => {
      const configPath = openApiSpec.paths["/api/v1/configs/{configId}"];

      expect(configPath).toHaveProperty("get");
      expect(configPath).toHaveProperty("put");
      expect(configPath).toHaveProperty("patch");
    });
  });

  describe("Security Schemes", () => {
    it("should define both auth methods", () => {
      const securitySchemes = openApiSpec.components.securitySchemes;

      expect(securitySchemes).toHaveProperty("cookieAuth");
      expect(securitySchemes).toHaveProperty("bearerAuth");
      expect(securitySchemes.bearerAuth.scheme).toBe("bearer");
    });
  });
});
