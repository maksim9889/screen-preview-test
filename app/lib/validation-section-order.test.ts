import { describe, it, expect } from "vitest";
import { validateConfig } from "./validation";
import type { AppConfig } from "./types";

describe("validateConfig - sectionOrder", () => {
  const baseConfig: AppConfig = {
    carousel: {
      images: ["https://example.com/image.jpg"],
      aspectRatio: "landscape",
    },
    textSection: {
      title: "Test",
      titleColor: "#000000",
      description: "Test description",
      descriptionColor: "#666666",
    },
    cta: {
      label: "Click",
      url: "https://example.com",
      backgroundColor: "#007AFF",
      textColor: "#FFFFFF",
    },
  };

  it("should accept valid config without sectionOrder", () => {
    const result = validateConfig(baseConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept valid config with correct sectionOrder", () => {
    const config = {
      ...baseConfig,
      sectionOrder: ["carousel", "textSection", "cta"],
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should accept different valid order", () => {
    const config = {
      ...baseConfig,
      sectionOrder: ["textSection", "carousel", "cta"],
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject sectionOrder that is not an array", () => {
    const config = {
      ...baseConfig,
      sectionOrder: "invalid" as any,
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Section order must be an array");
  });

  it("should reject sectionOrder with duplicates", () => {
    const config = {
      ...baseConfig,
      sectionOrder: ["carousel", "carousel", "textSection"],
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Section order must not contain duplicates");
  });

  it("should reject sectionOrder with invalid section", () => {
    const config = {
      ...baseConfig,
      sectionOrder: ["carousel", "invalid", "cta"],
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid section"))).toBe(true);
  });

  it("should reject sectionOrder with missing sections", () => {
    const config = {
      ...baseConfig,
      sectionOrder: ["carousel", "textSection"],
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Section order must contain all sections");
  });

  it("should reject sectionOrder with extra sections", () => {
    const config = {
      ...baseConfig,
      sectionOrder: ["carousel", "textSection", "cta", "extra"] as any,
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
