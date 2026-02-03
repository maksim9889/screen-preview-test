/**
 * Request Utilities
 *
 * Shared helpers for processing HTTP requests.
 * Used by auth, rate limiting, and other server modules.
 *
 * @module request-utils.server
 */

import { config } from "./config.server";

/**
 * Extracts the client IP address from a request
 *
 * SECURITY: Only trusts proxy headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
 * when TRUST_PROXY=true is set in the environment. This prevents IP spoofing attacks
 * where attackers inject fake headers to bypass rate limiting or IP-bound sessions.
 *
 * When TRUST_PROXY is enabled, checks headers in order of priority:
 * 1. X-Forwarded-For (standard proxy header, takes first IP)
 * 2. X-Real-IP (nginx)
 * 3. CF-Connecting-IP (Cloudflare)
 *
 * Note: HTTP headers are case-insensitive per RFC 7230, but we use
 * consistent casing for readability.
 *
 * @param request - The incoming HTTP request
 * @returns The client IP address, or "unknown" if not determinable
 *
 * @example
 * const ip = getClientIp(request);
 * // "192.168.1.1" or "unknown"
 */
export function getClientIp(request: Request): string {
  // Only trust proxy headers when explicitly configured
  // This prevents IP spoofing when not behind a trusted proxy
  if (config.proxy.trustProxy) {
    // X-Forwarded-For: standard header set by proxies/load balancers
    // Can contain multiple IPs: "client, proxy1, proxy2" - take the first
    const forwardedFor = request.headers.get("X-Forwarded-For");
    if (forwardedFor) {
      const firstIp = forwardedFor.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }

    // X-Real-IP: commonly set by nginx
    const realIp = request.headers.get("X-Real-IP");
    if (realIp) return realIp;

    // CF-Connecting-IP: set by Cloudflare
    const cfIp = request.headers.get("CF-Connecting-IP");
    if (cfIp) return cfIp;
  }

  // Fallback: In a real deployment, this would come from the connection's
  // remote address. The Web Fetch API doesn't expose socket info, so we
  // return "unknown". Framework adapters (Express, Fastify, etc.) can
  // provide the real connection IP through their request objects.
  return "unknown";
}

/**
 * Sanitizes a string for safe use in Content-Disposition filenames
 *
 * Defense-in-depth measure to prevent header injection attacks.
 * Even though usernames and configIds are validated at input, this provides
 * an extra safety layer in case validation is bypassed or weakened.
 *
 * @param name - The filename or component to sanitize
 * @returns Sanitized string with only safe characters (a-z, A-Z, 0-9, _, -, .)
 *
 * @example
 * sanitizeFilename("user@evil.com")     // "user_evil.com"
 * sanitizeFilename('file"name')         // "file_name"
 * sanitizeFilename("config\r\ninjection") // "config__injection"
 */
export function sanitizeFilename(name: string): string {
  if (typeof name !== "string") {
    return "invalid";
  }

  // Replace any character that's not alphanumeric, underscore, hyphen, or period
  // This prevents:
  // - Quote injection (breaks Content-Disposition parsing)
  // - CRLF injection (HTTP header injection)
  // - Path traversal (../)
  // - Shell metacharacters
  return name.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
}

/**
 * Parses a cookie header string into a key-value object
 *
 * Handles edge cases gracefully:
 * - Malformed cookies (missing =) are skipped
 * - URL-encoded values are decoded
 * - Whitespace around keys and values is trimmed
 *
 * @param cookieHeader - The Cookie header string (e.g., "name=value; other=123")
 * @returns Object with cookie names as keys and decoded values
 *
 * @example
 * parseCookies("auth_token=abc123; theme=dark")
 * // { auth_token: "abc123", theme: "dark" }
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const cookie of cookieHeader.split(";")) {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf("=");

    if (eqIndex === -1) continue; // Skip malformed cookies

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();

    // URL decode the value to handle encoded characters
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      // If decoding fails, use raw value
      cookies[key] = rawValue;
    }
  }

  return cookies;
}
