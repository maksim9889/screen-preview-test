import { describe, it, expect } from "vitest";
import {
  PHONE_MODELS,
  SCREEN_RESOLUTIONS,
  DEFAULT_PHONE_SIZE,
  findPhoneModelByName,
  findResolutionByName,
  validateDimensions,
} from "./phone-presets";

describe("phone-presets", () => {
  describe("PHONE_MODELS", () => {
    it("should have valid phone models", () => {
      expect(PHONE_MODELS.length).toBeGreaterThan(0);
      PHONE_MODELS.forEach((model) => {
        expect(model.name).toBeTruthy();
        expect(model.width).toBeGreaterThan(0);
        expect(model.height).toBeGreaterThan(0);
        expect(["iPhone", "Samsung", "Google", "Other"]).toContain(model.category);
      });
    });
  });

  describe("SCREEN_RESOLUTIONS", () => {
    it("should have valid screen resolutions", () => {
      expect(SCREEN_RESOLUTIONS.length).toBeGreaterThan(0);
      SCREEN_RESOLUTIONS.forEach((res) => {
        expect(res.name).toBeTruthy();
        expect(res.width).toBeGreaterThan(0);
        expect(res.height).toBeGreaterThan(0);
      });
    });
  });

  describe("DEFAULT_PHONE_SIZE", () => {
    it("should have valid default values", () => {
      expect(DEFAULT_PHONE_SIZE.width).toBe(390);
      expect(DEFAULT_PHONE_SIZE.height).toBe(844);
      expect(DEFAULT_PHONE_SIZE.name).toBe("iPhone 14");
    });
  });

  describe("findPhoneModelByName", () => {
    it("should find existing phone model", () => {
      const model = findPhoneModelByName("iPhone 15 Pro");
      expect(model).toBeDefined();
      expect(model?.name).toBe("iPhone 15 Pro");
      expect(model?.width).toBe(393);
      expect(model?.height).toBe(852);
    });

    it("should return undefined for non-existent model", () => {
      const model = findPhoneModelByName("NonExistent Phone");
      expect(model).toBeUndefined();
    });

    it("should find Samsung models", () => {
      const model = findPhoneModelByName("Samsung Galaxy S24");
      expect(model).toBeDefined();
      expect(model?.category).toBe("Samsung");
    });
  });

  describe("findResolutionByName", () => {
    it("should find existing resolution", () => {
      const resolution = findResolutionByName("393x852 (iPhone 15 Pro)");
      expect(resolution).toBeDefined();
      expect(resolution?.width).toBe(393);
      expect(resolution?.height).toBe(852);
    });

    it("should return undefined for non-existent resolution", () => {
      const resolution = findResolutionByName("999x999 (Fake)");
      expect(resolution).toBeUndefined();
    });
  });

  describe("validateDimensions", () => {
    it("should accept valid dimensions", () => {
      expect(validateDimensions(390, 844)).toBe(true);
      expect(validateDimensions(280, 500)).toBe(true);
      expect(validateDimensions(500, 1000)).toBe(true);
    });

    it("should reject dimensions that are too small", () => {
      expect(validateDimensions(279, 844)).toBe(false);
      expect(validateDimensions(390, 499)).toBe(false);
    });

    it("should reject dimensions that are too large", () => {
      expect(validateDimensions(501, 844)).toBe(false);
      expect(validateDimensions(390, 1001)).toBe(false);
    });

    it("should reject non-integer dimensions", () => {
      expect(validateDimensions(390.5, 844)).toBe(false);
      expect(validateDimensions(390, 844.5)).toBe(false);
    });

    it("should reject negative dimensions", () => {
      expect(validateDimensions(-100, 844)).toBe(false);
      expect(validateDimensions(390, -100)).toBe(false);
    });
  });
});
