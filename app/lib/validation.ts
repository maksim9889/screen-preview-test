/**
 * Validation Utilities Module
 *
 * Provides comprehensive validation functions for app configurations, user inputs,
 * and data integrity checks. All validation functions return clear error messages
 * to help users understand and fix validation failures.
 *
 * @module validation
 */

import type { AppConfig } from "./types";
import {
  MAX_CAROUSEL_IMAGES,
  MAX_CONFIG_ID_LENGTH,
  MIN_CONFIG_ID_LENGTH,
  VALID_SECTIONS,
} from "./constants";

/**
 * Validates a hexadecimal color code
 *
 * Accepts both 3-digit (#RGB) and 6-digit (#RRGGBB) hex color formats.
 * The hash symbol (#) is required.
 *
 * @param {string} color - The color string to validate
 * @returns {boolean} True if valid hex color, false otherwise
 *
 * @example
 * isValidHexColor("#FF0000")  // true
 * isValidHexColor("#F00")     // true
 * isValidHexColor("FF0000")   // false (missing #)
 * isValidHexColor("#GGGGGG")  // false (invalid hex digits)
 */
export function isValidHexColor(color: string): boolean {
  if (typeof color !== "string") return false;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Normalizes a hex color to uppercase 6-digit format (#RRGGBB)
 *
 * Converts 3-digit hex colors to 6-digit format and uppercases all letters.
 * Returns the original string if it's not a valid hex color.
 *
 * @param {string} color - The color string to normalize
 * @returns {string} Normalized color in #RRGGBB format, or original if invalid
 *
 * @example
 * normalizeHexColor("#F00")     // "#FF0000"
 * normalizeHexColor("#ff0000")  // "#FF0000"
 * normalizeHexColor("#ABC")     // "#AABBCC"
 * normalizeHexColor("invalid")  // "invalid" (unchanged)
 */
export function normalizeHexColor(color: string): string {
  if (!isValidHexColor(color)) {
    return color;
  }

  // Remove # and uppercase
  const hex = color.slice(1).toUpperCase();

  // Expand 3-digit to 6-digit
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }

  return `#${hex}`;
}

/**
 * Validates a URL string with protocol whitelist for security
 *
 * Accepts both absolute URLs (with protocol) and relative URLs (starting with /).
 * For absolute URLs, only allows http, https, mailto, and tel protocols
 * to prevent XSS attacks via javascript:, data:, etc.
 *
 * @param {string} url - The URL string to validate
 * @returns {boolean} True if valid URL with safe protocol or valid relative URL
 *
 * @example
 * // Absolute URLs
 * isValidUrl("https://example.com")           // true
 * isValidUrl("http://localhost:3000/path")    // true
 * isValidUrl("mailto:user@example.com")       // true
 * isValidUrl("tel:+1234567890")               // true
 *
 * // Relative URLs (for internal navigation)
 * isValidUrl("/pricing")                      // true
 * isValidUrl("/about/team")                   // true
 * isValidUrl("/path?query=1")                 // true
 *
 * // Invalid/dangerous URLs
 * isValidUrl("javascript:alert('xss')")       // false (XSS prevention)
 * isValidUrl("data:text/html,<script>")       // false (XSS prevention)
 * isValidUrl("not-a-url")                     // false
 * isValidUrl("//evil.com")                    // false (protocol-relative, ambiguous)
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== "string") return false;
  if (url.length === 0) return false;

  // Allow relative URLs starting with single /
  // But reject protocol-relative URLs (//example.com) which could be exploited
  if (url.startsWith('/') && !url.startsWith('//')) {
    // Basic validation: no javascript: or other schemes embedded
    // A relative URL shouldn't contain : before the first / or ?
    const pathEnd = url.indexOf('?');
    const pathPart = pathEnd === -1 ? url : url.slice(0, pathEnd);
    if (pathPart.includes(':')) {
      return false;
    }
    return true;
  }

  // Absolute URL validation
  try {
    const parsed = new URL(url);

    // Whitelist of safe protocols (prevents XSS via javascript:, data:, vbscript:, etc.)
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];

    if (!allowedProtocols.includes(parsed.protocol)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and type-guards an aspect ratio string
 *
 * This is a type predicate function that narrows the type to the union
 * of valid aspect ratio literals. Use this for TypeScript type safety.
 *
 * @param {string} ratio - The aspect ratio string to validate
 * @returns {boolean} True if ratio is a valid aspect ratio type
 *
 * @example
 * const ratio: string = getUserInput();
 * if (isValidAspectRatio(ratio)) {
 *   // TypeScript now knows ratio is "portrait" | "landscape" | "square"
 *   saveAspectRatio(ratio);
 * }
 */
export function isValidAspectRatio(
  ratio: string
): ratio is "portrait" | "landscape" | "square" {
  return ["portrait", "landscape", "square"].includes(ratio);
}

/**
 * Validates a configuration ID format
 *
 * Configuration IDs must:
 * - Contain only alphanumeric characters, hyphens, and underscores
 * - Be 1-50 characters in length
 * - Not contain spaces or special characters
 *
 * @param {string} configId - The configuration ID to validate
 * @returns {boolean} True if valid format, false otherwise
 *
 * @example
 * isValidConfigId("default")         // true
 * isValidConfigId("mobile-config")   // true
 * isValidConfigId("config_v2")       // true
 * isValidConfigId("my config")       // false (contains space)
 * isValidConfigId("")                // false (empty)
 * isValidConfigId("a".repeat(51))    // false (too long)
 */
export function isValidConfigId(configId: string): boolean {
  if (typeof configId !== "string") return false;
  // Must contain only alphanumeric characters, hyphens, and underscores
  // Length: MIN_CONFIG_ID_LENGTH to MAX_CONFIG_ID_LENGTH characters
  const pattern = new RegExp(`^[a-zA-Z0-9_-]{${MIN_CONFIG_ID_LENGTH},${MAX_CONFIG_ID_LENGTH}}$`);
  return pattern.test(configId);
}

/**
 * Validates a configuration ID with detailed error messages
 *
 * Provides user-friendly error messages for validation failures.
 * Use this when you need to display errors to users.
 *
 * @param {string} configId - The configuration ID to validate
 * @returns {Object} Validation result with optional error message
 * @returns {boolean} return.valid - Whether the ID is valid
 * @returns {string} [return.error] - Error message if invalid
 *
 * @example
 * const result = validateConfigId("my config");
 * if (!result.valid) {
 *   console.error(result.error);
 *   // "Configuration ID must contain only letters, numbers, hyphens..."
 * }
 */
export function validateConfigId(configId: string): {
  valid: boolean;
  error?: string;
} {
  if (!configId || typeof configId !== "string") {
    return { valid: false, error: "Configuration ID is required" };
  }

  if (configId.trim() === "") {
    return { valid: false, error: "Configuration ID cannot be empty" };
  }

  if (!isValidConfigId(configId)) {
    return {
      valid: false,
      error: `Configuration ID must contain only letters, numbers, hyphens, and underscores (${MIN_CONFIG_ID_LENGTH}-${MAX_CONFIG_ID_LENGTH} characters)`,
    };
  }

  return { valid: true };
}

/**
 * Validates a complete app configuration
 *
 * Performs comprehensive validation of all configuration sections:
 * - Carousel: image URLs and aspect ratio
 * - Text Section: title, description, and color codes
 * - CTA: label, URL, and color codes
 * - Section Order: uniqueness and completeness
 *
 * Returns all validation errors found, allowing users to fix multiple
 * issues at once instead of one at a time.
 *
 * @param {AppConfig} config - The configuration object to validate
 * @returns {Object} Validation result with all errors
 * @returns {boolean} return.valid - Whether the configuration is valid
 * @returns {string[]} return.errors - Array of error messages (empty if valid)
 *
 * @example
 * const result = validateConfig(userConfig);
 * if (!result.valid) {
 *   result.errors.forEach(error => console.error(error));
 *   // "Carousel image 1 has invalid URL"
 *   // "Title color must be a valid hex color (e.g., #000000)"
 * }
 */
export function validateConfig(config: AppConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate carousel section
  if (!config.carousel) {
    errors.push("Carousel section is required");
  } else {
    if (!Array.isArray(config.carousel.images)) {
      errors.push("Carousel images must be an array");
    } else {
      // Limit maximum number of images to prevent memory issues
      if (config.carousel.images.length > MAX_CAROUSEL_IMAGES) {
        errors.push(`Carousel cannot have more than ${MAX_CAROUSEL_IMAGES} images`);
      }

      config.carousel.images.forEach((url, index) => {
        if (!isValidUrl(url)) {
          errors.push(`Carousel image ${index + 1} has invalid URL`);
        }
      });
    }
    if (!isValidAspectRatio(config.carousel.aspectRatio)) {
      errors.push(
        "Invalid aspect ratio. Must be portrait, landscape, or square"
      );
    }
  }

  // Validate text section
  if (!config.textSection) {
    errors.push("Text section is required");
  } else {
    if (typeof config.textSection.title !== "string") {
      errors.push("Title must be a string");
    }
    if (!isValidHexColor(config.textSection.titleColor)) {
      errors.push("Title color must be a valid hex color (e.g., #000000)");
    }
    if (typeof config.textSection.description !== "string") {
      errors.push("Description must be a string");
    }
    if (!isValidHexColor(config.textSection.descriptionColor)) {
      errors.push(
        "Description color must be a valid hex color (e.g., #666666)"
      );
    }
  }

  // Validate CTA
  if (!config.cta) {
    errors.push("CTA section is required");
  } else {
    if (typeof config.cta.label !== "string" || config.cta.label.trim() === "") {
      errors.push("CTA label is required");
    }
    if (!isValidUrl(config.cta.url)) {
      errors.push("CTA URL must be a valid URL");
    }
    if (!isValidHexColor(config.cta.backgroundColor)) {
      errors.push("CTA background color must be a valid hex color");
    }
    if (!isValidHexColor(config.cta.textColor)) {
      errors.push("CTA text color must be a valid hex color");
    }
  }

  // Validate section order (optional field)
  if (config.sectionOrder !== undefined) {
    if (!Array.isArray(config.sectionOrder)) {
      errors.push("Section order must be an array");
    } else {
      const validSections = VALID_SECTIONS;
      const uniqueSections = new Set(config.sectionOrder);

      // Check for duplicate sections using Set size comparison
      if (uniqueSections.size !== config.sectionOrder.length) {
        errors.push("Section order must not contain duplicates");
      }

      // Validate each section name
      config.sectionOrder.forEach((section) => {
        if (!validSections.includes(section)) {
          errors.push(`Invalid section in order: ${section}`);
        }
      });

      // Ensure all sections are included (no omissions)
      if (config.sectionOrder.length !== validSections.length) {
        errors.push("Section order must contain all sections");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes all hex colors in a configuration to #RRGGBB format
 *
 * Converts 3-digit hex colors to 6-digit and uppercases all color values.
 * This ensures consistent storage and comparison of colors.
 *
 * @param {AppConfig} config - The configuration to normalize
 * @returns {AppConfig} New configuration with normalized colors
 *
 * @example
 * const normalized = normalizeConfigColors({
 *   ...config,
 *   textSection: { titleColor: "#f00", ... }
 * });
 * // normalized.textSection.titleColor === "#FF0000"
 */
export function normalizeConfigColors(config: AppConfig): AppConfig {
  return {
    ...config,
    textSection: {
      ...config.textSection,
      titleColor: normalizeHexColor(config.textSection.titleColor),
      descriptionColor: normalizeHexColor(config.textSection.descriptionColor),
    },
    cta: {
      ...config.cta,
      backgroundColor: normalizeHexColor(config.cta.backgroundColor),
      textColor: normalizeHexColor(config.cta.textColor),
    },
  };
}
