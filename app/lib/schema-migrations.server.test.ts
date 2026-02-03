import { describe, it, expect } from "vitest";
import {
  validateSchemaVersion,
  importAndMigrateConfig,
  getSchemaVersionFromApiVersion,
  CURRENT_SCHEMA_VERSION,
} from "./schema-migrations.server";
import type { AppConfig } from "./db.server";

describe("schema-migrations", () => {
  describe("getSchemaVersionFromApiVersion", () => {
    it("should derive schema version from API version", () => {
      expect(getSchemaVersionFromApiVersion("v1")).toBe(1);
      expect(getSchemaVersionFromApiVersion("v2")).toBe(2);
      expect(getSchemaVersionFromApiVersion("v10")).toBe(10);
    });

    it("should fallback to current schema version for invalid format", () => {
      expect(getSchemaVersionFromApiVersion("invalid")).toBe(CURRENT_SCHEMA_VERSION);
      expect(getSchemaVersionFromApiVersion("1")).toBe(CURRENT_SCHEMA_VERSION);
      expect(getSchemaVersionFromApiVersion("")).toBe(CURRENT_SCHEMA_VERSION);
      expect(getSchemaVersionFromApiVersion("vX")).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe("validateSchemaVersion", () => {
    it("should accept valid schema version", () => {
      const error = validateSchemaVersion(1);
      expect(error).toBeNull();
    });

    it("should reject invalid schema versions", () => {
      expect(validateSchemaVersion(0)).toContain("positive integer");
      expect(validateSchemaVersion(-1)).toContain("positive integer");
      expect(validateSchemaVersion(999)).toContain("too new");
    });

    it("should reject non-integer versions", () => {
      expect(validateSchemaVersion(1.5 as any)).toContain("positive integer");
      expect(validateSchemaVersion(NaN as any)).toContain("positive integer");
    });
  });

  describe("importAndMigrateConfig", () => {
    const validConfig: AppConfig = {
      carousel: {
        images: ["https://example.com/1.jpg"],
        aspectRatio: "landscape",
      },
      textSection: {
        title: "Title",
        titleColor: "#000000",
        description: "Description",
        descriptionColor: "#666666",
      },
      cta: {
        label: "Click",
        url: "https://example.com",
        backgroundColor: "#007AFF",
        textColor: "#FFFFFF",
      },
    };

    it("should return config unchanged for current schema version", () => {
      const result = importAndMigrateConfig(
        validConfig,
        CURRENT_SCHEMA_VERSION
      );
      expect(result).toEqual(validConfig);
    });

    it("should handle version 1 configs", () => {
      const result = importAndMigrateConfig(validConfig, 1);
      expect(result).toEqual(validConfig);
    });

    it("should throw error for unsupported schema versions", () => {
      expect(() => importAndMigrateConfig(validConfig, 999)).toThrow(
        "too new"
      );
    });

    it("should preserve all config fields during migration", () => {
      const result = importAndMigrateConfig(validConfig, 1);
      expect(result.carousel).toEqual(validConfig.carousel);
      expect(result.textSection).toEqual(validConfig.textSection);
      expect(result.cta).toEqual(validConfig.cta);
    });
  });
});
