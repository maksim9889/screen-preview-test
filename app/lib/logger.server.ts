/**
 * Structured Logger Module
 *
 * Provides consistent, structured JSON logging for the application.
 * Uses pino for high-performance, production-ready logging.
 *
 * Log Levels:
 * - fatal: Application crash, unrecoverable errors
 * - error: Operation failed, needs attention
 * - warn: Unexpected but handled, potential issues
 * - info: Normal operations (CRUD, auth events)
 * - debug: Detailed debugging info (disabled in production)
 * - trace: Very detailed tracing (disabled in production)
 *
 * Configuration (via .env):
 * - LOG_LEVEL: debug, info, warn, error, fatal (default: debug in dev, info in prod)
 * - LOG_TO_CONSOLE: true/false (default: true)
 * - LOG_TO_FILE: true/false (default: true)
 *
 * Log Output:
 * - Console: Pretty-printed in development, JSON in production
 * - File: JSON to logs/app.log
 * - Test: Silent (no output)
 *
 * @module logger.server
 */

import pino from "pino";
import fs from "fs";
import path from "path";

const isDevelopment = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

// Read logging config directly from env (avoids circular dependency with config.server.ts)
const LOG_LEVEL = process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info");
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== "false"; // default true
const LOG_TO_FILE = process.env.LOG_TO_FILE !== "false"; // default true

// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), "logs");
if (!isTest && LOG_TO_FILE && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Log file path
const LOG_FILE = path.join(LOGS_DIR, "app.log");

/**
 * Create transport configuration based on environment and config
 */
function getTransport(): pino.TransportSingleOptions | pino.TransportMultiOptions | undefined {
  if (isTest) {
    return undefined; // Silent in tests
  }

  const targets: pino.TransportTargetOptions[] = [];

  // Console logging
  if (LOG_TO_CONSOLE) {
    if (isDevelopment) {
      // Pretty-printed console in development
      targets.push({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname,service,env,component",
        },
        level: LOG_LEVEL,
      });
    } else {
      // JSON to stdout in production
      targets.push({
        target: "pino/file",
        options: { destination: 1 }, // stdout
        level: LOG_LEVEL,
      });
    }
  }

  // File logging
  if (LOG_TO_FILE) {
    targets.push({
      target: "pino/file",
      options: { destination: LOG_FILE },
      level: LOG_LEVEL,
    });
  }

  // If no targets, return undefined (silent)
  if (targets.length === 0) {
    return undefined;
  }

  // Single target doesn't need multi-target wrapper
  if (targets.length === 1) {
    return targets[0];
  }

  return { targets };
}

/**
 * Base logger instance
 *
 * Configuration via environment variables:
 * - LOG_LEVEL: Log level (debug, info, warn, error, fatal)
 * - LOG_TO_CONSOLE: Enable console output (default: true)
 * - LOG_TO_FILE: Enable file output to logs/app.log (default: true)
 *
 * Note: Custom formatters are not supported with multi-target transports,
 * so we use pino's default level format (numeric) which transports handle.
 */
export const logger = pino({
  level: isTest ? "silent" : LOG_LEVEL,
  transport: getTransport(),
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "screen-preview-api",
    env: process.env.NODE_ENV || "development",
  },
});

/**
 * Child logger for API operations
 * Includes common fields for all API logs
 */
export const apiLogger = logger.child({ component: "api" });

/**
 * Child logger for authentication operations
 */
export const authLogger = logger.child({ component: "auth" });

/**
 * Child logger for database operations
 */
export const dbLogger = logger.child({ component: "db" });

// ============ Audit Logger ============
// Separate logger for security audit events
// Writes to a dedicated audit.log file for tamper-resistance

const AUDIT_LOG_FILE = path.join(LOGS_DIR, "audit.log");

/**
 * Create audit-specific transport
 * Always writes to a dedicated file, separate from main app logs
 */
function getAuditTransport(): pino.TransportSingleOptions | pino.TransportMultiOptions | undefined {
  if (isTest) {
    return undefined; // Silent in tests
  }

  // Audit logs always go to file (append-only for security)
  // In development, also pretty-print to console
  if (isDevelopment) {
    return {
      targets: [
        {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname,service,env",
            messageFormat: "[AUDIT] {msg}",
          },
          level: "info",
        },
        {
          target: "pino/file",
          options: { destination: AUDIT_LOG_FILE },
          level: "info",
        },
      ],
    };
  }

  // Production: JSON to dedicated audit file only
  return {
    target: "pino/file",
    options: { destination: AUDIT_LOG_FILE },
  };
}

/**
 * Dedicated audit logger for security events
 *
 * Writes to logs/audit.log separately from main application logs.
 * This separation provides:
 * - Tamper-resistance (can be shipped to external storage)
 * - Easier compliance auditing
 * - Clear separation of security events from operational logs
 */
export const auditLogger = pino({
  level: isTest ? "silent" : "info",
  transport: getAuditTransport(),
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "screen-preview-api",
    logType: "audit",
  },
});

// ============ Structured Log Helpers ============

/**
 * Log context for API requests
 */
export interface ApiLogContext {
  requestId: string;
  method: string;
  path: string;
  userId?: number;
  configId?: string;
  duration?: number;
  status?: number;
  error?: string;
  errorCode?: string;
}

/**
 * Log an API request start
 */
export function logRequestStart(ctx: Pick<ApiLogContext, "requestId" | "method" | "path" | "userId">): void {
  apiLogger.info(ctx, `${ctx.method} ${ctx.path} started`);
}

/**
 * Log a successful API response
 */
export function logRequestSuccess(ctx: ApiLogContext): void {
  apiLogger.info(
    {
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      userId: ctx.userId,
      configId: ctx.configId,
      durationMs: ctx.duration,
      status: ctx.status,
      outcome: "success",
    },
    `${ctx.method} ${ctx.path} completed`
  );
}

/**
 * Log a failed API response
 */
export function logRequestError(ctx: ApiLogContext): void {
  apiLogger.error(
    {
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      userId: ctx.userId,
      configId: ctx.configId,
      durationMs: ctx.duration,
      status: ctx.status,
      error: ctx.error,
      errorCode: ctx.errorCode,
      outcome: "error",
    },
    `${ctx.method} ${ctx.path} failed: ${ctx.error}`
  );
}

/**
 * Log a client error (4xx) - less severe than server errors
 */
export function logClientError(ctx: ApiLogContext): void {
  apiLogger.warn(
    {
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      userId: ctx.userId,
      configId: ctx.configId,
      durationMs: ctx.duration,
      status: ctx.status,
      error: ctx.error,
      errorCode: ctx.errorCode,
      outcome: "client_error",
    },
    `${ctx.method} ${ctx.path} client error: ${ctx.error}`
  );
}

// ============ Config CRUD Specific Loggers ============

export interface ConfigCrudLogContext {
  requestId: string;
  operation: "create" | "read" | "update" | "delete" | "list" | "restore";
  userId: number;
  configId?: string;
  versionNumber?: number;
  durationMs: number;
  outcome: "success" | "not_found" | "conflict" | "validation_error" | "error";
  error?: string;
}

/**
 * Log a config CRUD operation
 */
export function logConfigOperation(ctx: ConfigCrudLogContext): void {
  const logFn = ctx.outcome === "success" ? apiLogger.info : apiLogger.warn;
  logFn.call(
    apiLogger,
    {
      requestId: ctx.requestId,
      operation: ctx.operation,
      userId: ctx.userId,
      configId: ctx.configId,
      versionNumber: ctx.versionNumber,
      durationMs: ctx.durationMs,
      outcome: ctx.outcome,
      error: ctx.error,
    },
    `config.${ctx.operation} ${ctx.outcome}${ctx.configId ? ` [${ctx.configId}]` : ""}`
  );
}

// ============ Auth Specific Loggers ============

export interface AuthLogContext {
  requestId: string;
  operation: "login" | "logout" | "register" | "validate";
  username?: string;
  userId?: number;
  outcome: "success" | "invalid_credentials" | "rate_limited" | "error";
  durationMs?: number;
  error?: string;
}

/**
 * Log an authentication operation
 */
export function logAuthOperation(ctx: AuthLogContext): void {
  const logFn = ctx.outcome === "success" ? authLogger.info : authLogger.warn;
  logFn.call(
    authLogger,
    {
      requestId: ctx.requestId,
      operation: ctx.operation,
      username: ctx.username,
      userId: ctx.userId,
      durationMs: ctx.durationMs,
      outcome: ctx.outcome,
      // Don't log error details for auth to avoid leaking info
    },
    `auth.${ctx.operation} ${ctx.outcome}${ctx.username ? ` [${ctx.username}]` : ""}`
  );
}
