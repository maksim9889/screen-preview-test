/**
 * API Response Helpers
 *
 * This file provides helper functions for creating consistent API responses
 * with proper HTTP status codes and error handling.
 */

import crypto from "crypto";
import type { ErrorResponse, ErrorCodeType } from "./api-types";
import { apiLogger } from "./logger.server";

// ============ Error Sanitization ============

/**
 * Checks if we're running in production mode
 */
const isProduction = process.env.NODE_ENV === "production";

/**
 * Pattern to detect stack traces and internal error details
 * Matches:
 * - "at Function.X" patterns (stack traces)
 * - File paths with line numbers
 * - "Error:" prefixes
 */
const UNSAFE_ERROR_PATTERNS = [
  /at\s+[\w.<>]+\s+\(/i,           // Stack trace lines
  /\/[\w/.-]+\.(?:ts|js|tsx|jsx):\d+/i,  // File paths with line numbers
  /node_modules/i,                  // Node modules paths
  /internal\//i,                    // Internal node paths
  /^\s*Error:\s*/i,                 // "Error:" prefix
];

/**
 * List of known safe error messages that can be passed through
 * These are user-friendly validation errors
 */
const SAFE_ERROR_PREFIXES = [
  "Invalid",
  "Missing",
  "Password must",
  "Username must",
  "Username can only",
  "This username is not available",
  "Configuration not found",
  "Version not found",
  "Token",
  "Passwords do not match",
  "Too many",
  "Request size",
  "Payload",
  "already exists",
  "are required",
  "CSRF",
  "security token",
  "authorization",
  "credentials",
  "Unauthorized",
  "Forbidden",
  "not found",
  "Session",
];

/**
 * Sanitizes an error message for safe display to users
 *
 * In production:
 * - Removes stack traces and internal file paths
 * - Returns generic message for unexpected errors
 * - Keeps user-friendly validation errors intact
 *
 * In development:
 * - Returns the original error message for debugging
 *
 * @param {unknown} error - The error to sanitize (string, Error, or unknown)
 * @param {string} [fallbackMessage] - Message to use if error is not safe to display
 * @returns {string} A safe error message for user display
 */
export function sanitizeError(
  error: unknown,
  fallbackMessage: string = "An unexpected error occurred"
): string {
  // In development, show full error details
  if (!isProduction) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return fallbackMessage;
  }

  // In production, sanitize the error
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    return fallbackMessage;
  }

  // Check if the message contains unsafe patterns
  for (const pattern of UNSAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      // Log the original error for debugging
      apiLogger.error({ originalError: message }, "Sanitized unsafe error message");
      return fallbackMessage;
    }
  }

  // Check if it's a known safe error message
  const isSafe = SAFE_ERROR_PREFIXES.some(prefix =>
    message.toLowerCase().includes(prefix.toLowerCase())
  );

  if (isSafe) {
    return message;
  }

  // For unknown messages, use fallback in production
  apiLogger.warn({ originalError: message }, "Unknown error message sanitized");
  return fallbackMessage;
}

/**
 * Creates a safe error response for exceptions
 *
 * Logs the full error internally but returns a sanitized message to the user.
 * Useful for catch blocks in route handlers.
 *
 * @param {unknown} error - The caught exception
 * @param {string} fallbackMessage - User-friendly fallback message
 * @param {ErrorCodeType} code - Error code for the response
 * @param {ResponseLogContext} [logCtx] - Optional logging context
 * @returns {Response} A sanitized error response
 */
export function safeErrorResponse(
  error: unknown,
  fallbackMessage: string,
  code: ErrorCodeType,
  logCtx?: ResponseLogContext
): Response {
  // Always log the full error internally
  const originalMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  apiLogger.error({
    originalError: originalMessage,
    stack,
    ...logCtx,
  }, "Exception caught in route handler");

  // Return sanitized message to user
  const safeMessage = sanitizeError(error, fallbackMessage);
  return internalError(safeMessage, code, undefined, logCtx);
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Log context attached to response helpers for structured logging
 */
export interface ResponseLogContext {
  method?: string;
  path?: string;
  userId?: number;
  configId?: string;
  durationMs?: number;
}

/**
 * Internal helper to log error responses
 */
function logErrorResponse(
  requestId: string,
  status: number,
  error: string,
  code: ErrorCodeType,
  ctx?: ResponseLogContext
): void {
  const isClientError = status >= 400 && status < 500;
  const logFn = isClientError ? apiLogger.warn : apiLogger.error;

  logFn.call(apiLogger, {
    requestId,
    status,
    error,
    errorCode: code,
    method: ctx?.method,
    path: ctx?.path,
    userId: ctx?.userId,
    configId: ctx?.configId,
    durationMs: ctx?.durationMs,
    outcome: isClientError ? "client_error" : "server_error",
  }, `API error ${status}: ${error}`);
}

// ============ Error Response Helpers ============

/**
 * Create a 400 Bad Request response
 * Use for validation errors, malformed requests, invalid input
 */
export function badRequest(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 400, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a 401 Unauthorized response
 * Use for authentication failures, missing/invalid credentials
 */
export function unauthorized(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 401, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a 403 Forbidden response
 * Use for authorization failures, CSRF token validation failures
 */
export function forbidden(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 403, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a 404 Not Found response
 * Use when requested resource doesn't exist
 */
export function notFound(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 404, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a 409 Conflict response
 * Use for duplicate resources, conflicting state, or stale data
 */
export function conflict(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 409, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 409,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a 413 Payload Too Large response
 * Use when request body exceeds size limits
 */
export function payloadTooLarge(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 413, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 413,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a 413 Payload Too Large response with proper error formatting
 * This is a convenience wrapper used by request-size validation
 */
export function createPayloadTooLargeResponse(error: string, code: ErrorCodeType = "PAYLOAD_TOO_LARGE" as ErrorCodeType): Response {
  return payloadTooLarge("Payload Too Large", code, error);
}

/**
 * Create a 500 Internal Server Error response
 * Use for unexpected server errors
 */
export function internalError(error: string, code: ErrorCodeType, details?: string, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 500, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };
  return new Response(JSON.stringify(body), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

// ============ Success Response Helpers ============

/**
 * Internal helper to log successful responses
 */
function logSuccessResponse(
  status: number,
  ctx?: ResponseLogContext
): void {
  if (!ctx) return;

  apiLogger.info({
    status,
    method: ctx.method,
    path: ctx.path,
    userId: ctx.userId,
    configId: ctx.configId,
    durationMs: ctx.durationMs,
    outcome: "success",
  }, `API success ${status}${ctx.path ? `: ${ctx.method} ${ctx.path}` : ""}`);
}

/**
 * Create a 200 OK response with JSON body
 */
export function ok<T>(data: T, additionalHeaders?: HeadersInit, logCtx?: ResponseLogContext): Response {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (additionalHeaders) {
    const additional = new Headers(additionalHeaders);
    additional.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  logSuccessResponse(200, logCtx);

  return new Response(JSON.stringify(data), {
    status: 200,
    headers,
  });
}

/**
 * Create a 201 Created response with JSON body
 * Use when a new resource is created
 */
export function created<T>(data: T, additionalHeaders?: HeadersInit, logCtx?: ResponseLogContext): Response {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (additionalHeaders) {
    const additional = new Headers(additionalHeaders);
    additional.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  logSuccessResponse(201, logCtx);

  return new Response(JSON.stringify(data), {
    status: 201,
    headers,
  });
}

/**
 * Create a 429 Too Many Requests response
 * Use for rate limiting
 */
export function tooManyRequests(error: string, code: ErrorCodeType, details?: string, additionalHeaders?: HeadersInit, logCtx?: ResponseLogContext): Response {
  const requestId = generateRequestId();
  logErrorResponse(requestId, 429, error, code, logCtx);
  const body: ErrorResponse = { error, code, details, requestId };

  const headers = new Headers({ "Content-Type": "application/json" });
  if (additionalHeaders) {
    const additional = new Headers(additionalHeaders);
    additional.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return new Response(JSON.stringify(body), {
    status: 429,
    headers,
  });
}
