import { describe, it, expect } from "vitest";
import {
  validateConfig,
  validateConfigId,
  isValidUrl,
  isValidHexColor,
  normalizeHexColor,
  normalizeConfigColors,
} from "./validation";
import type { AppConfig } from "./types";

describe("validation", () => {
  describe("validateConfigId", () => {
    it("should accept valid config IDs", () => {
      expect(validateConfigId("default").valid).toBe(true);
      expect(validateConfigId("mobile").valid).toBe(true);
      expect(validateConfigId("dark-mode").valid).toBe(true);
      expect(validateConfigId("config_123").valid).toBe(true);
      expect(validateConfigId("a").valid).toBe(true);
      expect(validateConfigId("a" + "b".repeat(49)).valid).toBe(true);
    });

    it("should reject empty config IDs", () => {
      const result = validateConfigId("");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("should reject config IDs that are too short or too long", () => {
      const tooLong = "a".repeat(51);
      const result = validateConfigId(tooLong);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("1-50 characters");
    });

    it("should reject config IDs with invalid characters", () => {
      const invalidChars = ["config!", "config@", "config space", "config/test"];
      invalidChars.forEach((id) => {
        const result = validateConfigId(id);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("letters, numbers, hyphens, and underscores");
      });
    });
  });

  describe("isValidUrl", () => {
    it("should accept valid absolute URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path")).toBe(true);
      expect(isValidUrl("https://sub.example.com")).toBe(true);
      expect(isValidUrl("https://example.com?query=123")).toBe(true);
    });

    it("should accept mailto and tel URLs", () => {
      expect(isValidUrl("mailto:user@example.com")).toBe(true);
      expect(isValidUrl("tel:+1234567890")).toBe(true);
    });

    it("should accept valid relative URLs", () => {
      expect(isValidUrl("/pricing")).toBe(true);
      expect(isValidUrl("/about/team")).toBe(true);
      expect(isValidUrl("/path?query=1")).toBe(true);
      expect(isValidUrl("/path#anchor")).toBe(true);
      expect(isValidUrl("/")).toBe(true);
    });

    it("should reject protocol-relative URLs", () => {
      expect(isValidUrl("//example.com")).toBe(false);
      expect(isValidUrl("//evil.com/path")).toBe(false);
    });

    it("should reject dangerous URLs", () => {
      expect(isValidUrl("javascript:alert('xss')")).toBe(false);
      expect(isValidUrl("data:text/html,<script>")).toBe(false);
      expect(isValidUrl("vbscript:msgbox")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(false);
    });

    it("should reject colons in relative URL paths (potential scheme injection)", () => {
      expect(isValidUrl("/javascript:alert(1)")).toBe(false);
      expect(isValidUrl("/path:with:colons")).toBe(false);
    });
  });

  describe("isValidHexColor", () => {
    it("should accept valid hex colors", () => {
      expect(isValidHexColor("#000000")).toBe(true);
      expect(isValidHexColor("#FFFFFF")).toBe(true);
      expect(isValidHexColor("#ff0000")).toBe(true);
      expect(isValidHexColor("#123abc")).toBe(true);
    });

    it("should reject invalid hex colors", () => {
      expect(isValidHexColor("000000")).toBe(false);
      expect(isValidHexColor("#00")).toBe(false);
      expect(isValidHexColor("#GGGGGG")).toBe(false);
      expect(isValidHexColor("#12345")).toBe(false);
      expect(isValidHexColor("")).toBe(false);
    });
  });

  describe("normalizeHexColor", () => {
    it("should expand 3-digit hex to 6-digit", () => {
      expect(normalizeHexColor("#F00")).toBe("#FF0000");
      expect(normalizeHexColor("#0F0")).toBe("#00FF00");
      expect(normalizeHexColor("#00F")).toBe("#0000FF");
      expect(normalizeHexColor("#ABC")).toBe("#AABBCC");
    });

    it("should uppercase 6-digit hex colors", () => {
      expect(normalizeHexColor("#ff0000")).toBe("#FF0000");
      expect(normalizeHexColor("#aabbcc")).toBe("#AABBCC");
    });

    it("should keep valid uppercase 6-digit colors unchanged", () => {
      expect(normalizeHexColor("#FF0000")).toBe("#FF0000");
      expect(normalizeHexColor("#000000")).toBe("#000000");
    });

    it("should return invalid colors unchanged", () => {
      expect(normalizeHexColor("invalid")).toBe("invalid");
      expect(normalizeHexColor("#GGG")).toBe("#GGG");
      expect(normalizeHexColor("")).toBe("");
    });
  });

  describe("normalizeConfigColors", () => {
    it("should normalize all hex colors in config", () => {
      const config: AppConfig = {
        carousel: {
          images: ["https://example.com/img.jpg"],
          aspectRatio: "portrait",
        },
        textSection: {
          title: "Test",
          titleColor: "#f00",
          description: "Desc",
          descriptionColor: "#abc",
        },
        cta: {
          label: "Click",
          url: "https://example.com",
          backgroundColor: "#00f",
          textColor: "#fff",
        },
      };

      const normalized = normalizeConfigColors(config);

      expect(normalized.textSection.titleColor).toBe("#FF0000");
      expect(normalized.textSection.descriptionColor).toBe("#AABBCC");
      expect(normalized.cta.backgroundColor).toBe("#0000FF");
      expect(normalized.cta.textColor).toBe("#FFFFFF");
    });

    it("should not modify other config fields", () => {
      const config: AppConfig = {
        carousel: {
          images: ["https://example.com/img.jpg"],
          aspectRatio: "landscape",
        },
        textSection: {
          title: "Original Title",
          titleColor: "#000",
          description: "Original Desc",
          descriptionColor: "#666",
        },
        cta: {
          label: "Original Label",
          url: "https://original.com",
          backgroundColor: "#007AFF",
          textColor: "#FFFFFF",
        },
      };

      const normalized = normalizeConfigColors(config);

      expect(normalized.carousel.images).toEqual(["https://example.com/img.jpg"]);
      expect(normalized.carousel.aspectRatio).toBe("landscape");
      expect(normalized.textSection.title).toBe("Original Title");
      expect(normalized.textSection.description).toBe("Original Desc");
      expect(normalized.cta.label).toBe("Original Label");
      expect(normalized.cta.url).toBe("https://original.com");
    });
  });

  describe("validateConfig", () => {
    const validConfig: AppConfig = {
      carousel: {
        images: [
          "https://example.com/1.jpg",
          "https://example.com/2.jpg",
        ],
        aspectRatio: "landscape",
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

    it("should accept a valid config", () => {
      const result = validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject config with missing carousel", () => {
      const config = { ...validConfig, carousel: undefined } as any;
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Carousel"))).toBe(true);
    });

    it("should accept config with empty images array", () => {
      const config = {
        ...validConfig,
        carousel: { ...validConfig.carousel, images: [] },
      };
      const result = validateConfig(config);
      // The validation doesn't check for empty arrays
      expect(result.valid).toBe(true);
    });

    it("should accept config with many images", () => {
      const config = {
        ...validConfig,
        carousel: { ...validConfig.carousel, images: new Array(11).fill("https://example.com/img.jpg") },
      };
      const result = validateConfig(config);
      // The validation doesn't check for max length
      expect(result.valid).toBe(true);
    });

    it("should reject config with invalid image URLs", () => {
      const config = {
        ...validConfig,
        carousel: { ...validConfig.carousel, images: ["not-a-url"] },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("valid URL"))).toBe(true);
    });

    it("should reject config with invalid aspect ratio", () => {
      const config = {
        ...validConfig,
        carousel: { ...validConfig.carousel, aspectRatio: "invalid" as any },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("aspect ratio"))).toBe(true);
    });

    it("should accept config with empty title", () => {
      const config = {
        ...validConfig,
        textSection: { ...validConfig.textSection, title: "" },
      };
      const result = validateConfig(config);
      // The validation only checks if title is a string, not if it's empty
      expect(result.valid).toBe(true);
    });

    it("should reject config with invalid hex colors", () => {
      const config = {
        ...validConfig,
        textSection: { ...validConfig.textSection, titleColor: "red" },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("hex color"))).toBe(true);
    });

    it("should reject config with empty CTA label", () => {
      const config = {
        ...validConfig,
        cta: { ...validConfig.cta, label: "" },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("label"))).toBe(true);
    });

    it("should reject config with invalid CTA URL", () => {
      const config = {
        ...validConfig,
        cta: { ...validConfig.cta, url: "not-a-url" },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("valid URL"))).toBe(true);
    });

    it("should accumulate multiple errors", () => {
      const config = {
        ...validConfig,
        carousel: { ...validConfig.carousel, aspectRatio: "invalid" as any },
        textSection: { ...validConfig.textSection, titleColor: "red", descriptionColor: "blue" },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
