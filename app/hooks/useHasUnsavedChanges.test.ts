import { describe, it, expect } from "vitest";

/**
 * Tests for the hasUnsavedChanges computation logic
 *
 * The hasUnsavedChanges state is computed by comparing the current config
 * (JSON stringified) against the last saved config (also JSON stringified).
 *
 * hasUnsavedChanges = JSON.stringify(config) !== lastSavedConfig
 */

interface TestConfig {
  carousel: {
    images: string[];
    aspectRatio: "landscape" | "portrait" | "square";
  };
  textSection: {
    title: string;
    titleColor: string;
    description: string;
    descriptionColor: string;
  };
  cta: {
    label: string;
    url: string;
    backgroundColor: string;
    textColor: string;
  };
  sectionOrder: string[];
}

const createBaseConfig = (): TestConfig => ({
  carousel: {
    images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
    aspectRatio: "landscape",
  },
  textSection: {
    title: "Welcome",
    titleColor: "#000000",
    description: "This is a description",
    descriptionColor: "#666666",
  },
  cta: {
    label: "Click Me",
    url: "https://example.com",
    backgroundColor: "#007bff",
    textColor: "#ffffff",
  },
  sectionOrder: ["carousel", "textSection", "cta"],
});

// Simulates the hasUnsavedChanges computation
const computeHasUnsavedChanges = (config: TestConfig, lastSavedConfig: string): boolean => {
  return JSON.stringify(config) !== lastSavedConfig;
};

describe("hasUnsavedChanges computation", () => {
  describe("should be false when no changes made", () => {
    it("returns false when config matches lastSavedConfig", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(false);
    });

    it("returns false immediately after save", () => {
      const config = createBaseConfig();
      // Simulate saving: lastSavedConfig is updated to current config
      const lastSavedConfig = JSON.stringify(config);

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(false);
    });
  });

  describe("should be true when text is typed", () => {
    it("returns true when title is changed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User types in title field
      config.textSection.title = "New Title";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when description is changed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User types in description field
      config.textSection.description = "New description text";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when CTA label is changed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User types in CTA label field
      config.cta.label = "New Button Label";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when CTA URL is changed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User types in CTA URL field
      config.cta.url = "https://newurl.com";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });
  });

  describe("should be true when images are modified", () => {
    it("returns true when an image is added", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User adds a new image
      config.carousel.images = [...config.carousel.images, "https://example.com/image3.jpg"];

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when an image is removed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User removes an image
      config.carousel.images = config.carousel.images.slice(0, 1);

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when images are reordered", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User reorders images
      config.carousel.images = [config.carousel.images[1], config.carousel.images[0]];

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when image URL is replaced", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User replaces an image URL
      config.carousel.images[0] = "https://example.com/newimage.jpg";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });
  });

  describe("should be true when sections are reordered", () => {
    it("returns true when section order changes", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User reorders sections
      config.sectionOrder = ["textSection", "carousel", "cta"];

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when sections are reversed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User reverses section order
      config.sectionOrder = ["cta", "textSection", "carousel"];

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });
  });

  describe("should be true when colors are changed", () => {
    it("returns true when title color changes", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User changes title color
      config.textSection.titleColor = "#ff0000";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when CTA background color changes", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User changes CTA background color
      config.cta.backgroundColor = "#28a745";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });
  });

  describe("should be true when aspect ratio changes", () => {
    it("returns true when carousel aspect ratio changes to portrait", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User changes aspect ratio
      config.carousel.aspectRatio = "portrait";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when carousel aspect ratio changes to square", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User changes aspect ratio
      config.carousel.aspectRatio = "square";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });
  });

  describe("should return to false after save", () => {
    it("returns false after making changes and saving", () => {
      const config = createBaseConfig();
      let lastSavedConfig = JSON.stringify(config);

      // User makes changes
      config.textSection.title = "Changed Title";
      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);

      // User saves
      lastSavedConfig = JSON.stringify(config);
      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(false);
    });

    it("returns true again when new changes are made after save", () => {
      const config = createBaseConfig();
      let lastSavedConfig = JSON.stringify(config);

      // User makes changes and saves
      config.textSection.title = "Changed Title";
      lastSavedConfig = JSON.stringify(config);
      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(false);

      // User makes more changes
      config.textSection.description = "New description";
      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns true for whitespace-only changes in text fields", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User adds whitespace
      config.textSection.title = "Welcome ";

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("returns true when all images are removed", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);

      // User removes all images
      config.carousel.images = [];

      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);
    });

    it("handles reverting to original value correctly", () => {
      const config = createBaseConfig();
      const lastSavedConfig = JSON.stringify(config);
      const originalTitle = config.textSection.title;

      // User changes title
      config.textSection.title = "New Title";
      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(true);

      // User reverts to original
      config.textSection.title = originalTitle;
      expect(computeHasUnsavedChanges(config, lastSavedConfig)).toBe(false);
    });
  });
});
