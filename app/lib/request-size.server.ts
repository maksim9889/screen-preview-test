import { config } from "./config.server";
import { ErrorCode } from "./api-types";
import { createPayloadTooLargeResponse as createPayloadTooLargeResponseHelper } from "./api-responses.server";

/**
 * Validates request size against specified limit
 *
 * SECURITY: Uses Content-Length header for validation to prevent DoS attacks.
 * Does NOT read the entire body into memory, which could cause memory exhaustion.
 *
 * For requests without Content-Length that have a body, reads in chunks and
 * aborts early if the limit is exceeded.
 *
 * @param request The incoming request
 * @param maxSize Maximum allowed size in bytes
 * @returns Object with validation result and error message if applicable
 */
export async function validateRequestSize(
  request: Request,
  maxSize: number
): Promise<{ valid: true } | { valid: false; error: string; size: number }> {
  const contentLength = request.headers.get("content-length");

  // Check Content-Length header (fast path - doesn't read body)
  if (contentLength) {
    const size = parseInt(contentLength, 10);

    if (isNaN(size)) {
      return {
        valid: false,
        error: "Invalid Content-Length header",
        size: 0,
      };
    }

    if (size > maxSize) {
      return {
        valid: false,
        error: `Request size ${formatBytes(size)} exceeds maximum allowed size of ${formatBytes(maxSize)}`,
        size,
      };
    }

    // Content-Length is valid and within limit
    return { valid: true };
  }

  // No Content-Length header - for GET/HEAD requests with no body, this is fine
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { valid: true };
  }

  // For POST/PUT/PATCH without Content-Length, read body in chunks with limit
  // This prevents memory exhaustion from streaming attacks
  const clonedRequest = request.clone();
  const body = clonedRequest.body;

  if (!body) {
    // No body stream means empty body
    return { valid: true };
  }

  try {
    const reader = body.getReader();
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalSize += value.length;

      // Abort early if we exceed the limit (don't read more)
      if (totalSize > maxSize) {
        reader.cancel(); // Stop reading
        return {
          valid: false,
          error: `Request size exceeds maximum allowed size of ${formatBytes(maxSize)}`,
          size: totalSize,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: "Failed to read request body",
      size: 0,
    };
  }
}

/**
 * Validates request size for authentication endpoints (login, register)
 */
export async function validateAuthRequestSize(request: Request) {
  return validateRequestSize(request, config.requestSizeLimits.auth);
}

/**
 * Validates request size for configuration save operations
 */
export async function validateConfigRequestSize(request: Request) {
  return validateRequestSize(request, config.requestSizeLimits.config);
}

/**
 * Validates request size with default limit
 */
export async function validateDefaultRequestSize(request: Request) {
  return validateRequestSize(request, config.requestSizeLimits.default);
}

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Creates a 413 Payload Too Large response
 */
export function createPayloadTooLargeResponse(error: string) {
  return createPayloadTooLargeResponseHelper(error, ErrorCode.PAYLOAD_TOO_LARGE);
}
