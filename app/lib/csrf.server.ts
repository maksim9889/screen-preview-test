import crypto from "crypto";
import { config } from "./config.server";
import { CSRF_COOKIE_NAME, CSRF_FIELD_NAME } from "./constants";
import { parseCookies } from "./request-utils.server";

const CSRF_FORM_FIELD = CSRF_FIELD_NAME;

/**
 * Generates a cryptographically secure random CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(config.security.csrfTokenLength).toString("hex");
}

/**
 * Creates a Set-Cookie header for the CSRF token
 */
export function createCsrfCookie(token: string): string {
  const parts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "Path=/",
    "SameSite=Strict",
  ];

  if (config.isProduction) {
    parts.push("Secure");
  }

  // CSRF cookies don't need to be HttpOnly - they need to be read by JavaScript
  // But we verify by comparing cookie value with form field value
  // This is the "Double Submit Cookie" pattern

  return parts.join("; ");
}

/**
 * Extracts CSRF token from cookie header
 */
export function getCsrfTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  return cookies[CSRF_COOKIE_NAME] || null;
}

/**
 * Validates CSRF token from form data against cookie
 * Uses the Double Submit Cookie pattern
 */
export function validateCsrfToken(
  cookieHeader: string | null,
  formToken: string | null
): boolean {
  if (!cookieHeader || !formToken) {
    return false;
  }

  const cookieToken = getCsrfTokenFromCookie(cookieHeader);

  if (!cookieToken) {
    return false;
  }

  // Tokens must be the same length for timingSafeEqual
  // If lengths differ, the token is invalid
  if (cookieToken.length !== formToken.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(formToken)
  );
}

/**
 * Extracts CSRF token from form data
 */
export function getCsrfTokenFromFormData(formData: FormData): string | null {
  return formData.get(CSRF_FORM_FIELD) as string | null;
}

/**
 * Returns the CSRF form field name for use in forms
 */
export function getCsrfFormFieldName(): string {
  return CSRF_FORM_FIELD;
}

/**
 * Helper to get or create CSRF token from request
 * Returns both the token and Set-Cookie header if a new token was created
 */
export function ensureCsrfToken(cookieHeader: string | null): {
  token: string;
  setCookie?: string;
} {
  const existingToken = getCsrfTokenFromCookie(cookieHeader);

  if (existingToken) {
    return { token: existingToken };
  }

  // Generate new token
  const newToken = generateCsrfToken();
  return {
    token: newToken,
    setCookie: createCsrfCookie(newToken),
  };
}
