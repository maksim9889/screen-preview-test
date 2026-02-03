/**
 * Shared constants that can be used by both client and server code
 */

// ============================================================================
// CSRF Protection
// ============================================================================

/**
 * Name of the CSRF form field
 */
export const CSRF_FIELD_NAME = "csrf_token";

/**
 * Name of the CSRF cookie
 */
export const CSRF_COOKIE_NAME = "csrf_token";

// ============================================================================
// Validation Limits
// ============================================================================

/**
 * Maximum number of images allowed in carousel
 */
export const MAX_CAROUSEL_IMAGES = 50;

/**
 * Maximum length of configuration ID
 */
export const MAX_CONFIG_ID_LENGTH = 50;

/**
 * Minimum length of configuration ID
 */
export const MIN_CONFIG_ID_LENGTH = 1;

/**
 * Maximum length of text fields (title, description, button label)
 */
export const MAX_TEXT_LENGTH = 500;

/**
 * Maximum length of URL fields
 */
export const MAX_URL_LENGTH = 2048;

// ============================================================================
// Section Configuration
// ============================================================================

/**
 * Valid section types that can appear in a configuration
 */
export const VALID_SECTIONS = ["carousel", "textSection", "cta"] as const;

/**
 * Default order for sections when not specified
 */
export const DEFAULT_SECTION_ORDER: string[] = ["carousel", "textSection", "cta"];
