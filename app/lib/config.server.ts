import { z } from "zod";
import path from "path";

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database configuration
  DATABASE_PATH: z
    .string()
    .default(path.join(process.cwd(), "data", "database.db"))
    .describe("Path to SQLite database file"),

  // Authentication token configuration
  AUTH_TOKEN_COOKIE_NAME: z
    .string()
    .min(1)
    .default("auth_token")
    .describe("Name of the authentication token cookie"),

  AUTH_TOKEN_DURATION_DAYS: z
    .string()
    .default("7")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(365))
    .describe("Authentication token duration in days (1-365)"),

  // Security configuration
  PASSWORD_HASH_ITERATIONS: z
    .string()
    .default("100000")
    .transform((val) => parseInt(val, 10))
    .pipe(
      z
        .number()
        .min(10000, "Password hash iterations must be at least 10,000 for security")
        .max(1000000, "Password hash iterations too high, may cause performance issues")
    )
    .describe("PBKDF2 iterations for password hashing"),

  // CSRF protection
  CSRF_TOKEN_LENGTH: z
    .string()
    .default("32")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(16).max(64))
    .describe("Length of CSRF tokens in bytes (16-64)"),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("900000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(60000).max(3600000))
    .describe("Rate limit window in milliseconds (1-60 minutes)"),

  RATE_LIMIT_MAX_LOGIN_ATTEMPTS: z
    .string()
    .default("5")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(100))
    .describe("Maximum login attempts per window"),

  RATE_LIMIT_MAX_API_REQUESTS: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(10).max(10000))
    .describe("Maximum API requests per window"),

  // Request size limits (in bytes)
  MAX_REQUEST_SIZE_AUTH: z
    .string()
    .default("10240")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1024).max(102400))
    .describe("Maximum request size for auth endpoints in bytes (1KB-100KB)"),

  MAX_REQUEST_SIZE_CONFIG: z
    .string()
    .default("102400")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(10240).max(1048576))
    .describe("Maximum request size for config save in bytes (10KB-1MB)"),

  MAX_REQUEST_SIZE_DEFAULT: z
    .string()
    .default("1048576")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(102400).max(10485760))
    .describe("Maximum default request size in bytes (100KB-10MB)"),

  // Logging configuration
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "fatal"])
    .optional()
    .describe("Log level (debug, info, warn, error, fatal)"),

  LOG_TO_CONSOLE: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true")
    .describe("Enable console logging"),

  LOG_TO_FILE: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true")
    .describe("Enable file logging to logs/app.log"),

  // Audit logging configuration
  AUDIT_LOG_TO_DATABASE: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true")
    .describe("Enable audit logging to database"),

  AUDIT_LOG_TO_FILE: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true")
    .describe("Enable audit logging to file"),

  // Proxy trust configuration
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((val) => val.toLowerCase() === "true")
    .describe("Trust X-Forwarded-For and similar headers (enable when behind a reverse proxy)"),
});

/**
 * Validates and parses environment variables
 * @throws {Error} if validation fails with detailed error messages
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.format();

    console.error("❌ Configuration validation failed:");
    console.error(JSON.stringify(errors, null, 2));

    const errorMessages = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
    );

    throw new Error(
      `Invalid environment configuration:\n${errorMessages.join("\n")}\n\nPlease check your .env file.`
    );
  }

  return result.data;
}

// Validate environment variables on module load
const env = validateEnv();

/**
 * Type-safe, validated application configuration
 * All values are guaranteed to be valid and properly typed
 */
export const config = {
  /**
   * Node environment (development, production, or test)
   */
  nodeEnv: env.NODE_ENV,

  /**
   * Whether running in production mode
   */
  isProduction: env.NODE_ENV === "production",

  /**
   * Whether running in development mode
   */
  isDevelopment: env.NODE_ENV === "development",

  /**
   * Database configuration
   */
  database: {
    /**
     * Path to SQLite database file
     */
    path: env.DATABASE_PATH,
  },

  /**
   * Authentication token configuration
   */
  auth: {
    /**
     * Name of the authentication token cookie
     */
    tokenCookieName: env.AUTH_TOKEN_COOKIE_NAME,

    /**
     * Token duration in days
     */
    tokenDurationDays: env.AUTH_TOKEN_DURATION_DAYS,

    /**
     * Token duration in milliseconds (computed value)
     */
    tokenDurationMs: env.AUTH_TOKEN_DURATION_DAYS * 24 * 60 * 60 * 1000,
  },

  /**
   * Security configuration
   */
  security: {
    /**
     * Number of PBKDF2 iterations for password hashing
     * Higher = more secure but slower
     */
    passwordHashIterations: env.PASSWORD_HASH_ITERATIONS,

    /**
     * Length of CSRF tokens in bytes
     */
    csrfTokenLength: env.CSRF_TOKEN_LENGTH,
  },

  /**
   * Rate limiting configuration
   */
  rateLimit: {
    /**
     * Rate limit window duration in milliseconds
     */
    windowMs: env.RATE_LIMIT_WINDOW_MS,

    /**
     * Maximum login attempts per window
     */
    maxLoginAttempts: env.RATE_LIMIT_MAX_LOGIN_ATTEMPTS,

    /**
     * Maximum API requests per window
     */
    maxApiRequests: env.RATE_LIMIT_MAX_API_REQUESTS,
  },

  /**
   * Request size limits configuration (in bytes)
   */
  requestSizeLimits: {
    /**
     * Maximum request size for authentication endpoints (login, register)
     */
    auth: env.MAX_REQUEST_SIZE_AUTH,

    /**
     * Maximum request size for config save operations
     */
    config: env.MAX_REQUEST_SIZE_CONFIG,

    /**
     * Default maximum request size for all other endpoints
     */
    default: env.MAX_REQUEST_SIZE_DEFAULT,
  },

  /**
   * Logging configuration
   */
  logging: {
    /**
     * Log level (debug, info, warn, error, fatal)
     * Defaults to 'debug' in development, 'info' in production
     */
    level: env.LOG_LEVEL || (env.NODE_ENV === "development" ? "debug" : "info"),

    /**
     * Whether to log to console
     */
    toConsole: env.LOG_TO_CONSOLE,

    /**
     * Whether to log to file (logs/app.log)
     */
    toFile: env.LOG_TO_FILE,
  },

  /**
   * Audit logging configuration
   */
  auditLog: {
    /**
     * Whether to log audit events to the database
     * Enables queryable audit trail
     */
    toDatabase: env.AUDIT_LOG_TO_DATABASE,

    /**
     * Whether to log audit events to file
     * Provides tamper-resistant logging
     */
    toFile: env.AUDIT_LOG_TO_FILE,
  },

  /**
   * Proxy trust configuration
   */
  proxy: {
    /**
     * Whether to trust proxy headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP)
     *
     * SECURITY: Only enable this when the app is behind a trusted reverse proxy.
     * When false, these headers are ignored to prevent IP spoofing attacks.
     */
    trustProxy: env.TRUST_PROXY,
  },
} as const;

/**
 * Type of the configuration object
 */
export type Config = typeof config;

/**
 * Get the configuration object
 * Useful for dynamic imports where the config export may not be directly accessible
 */
export function getConfig(): Config {
  return config;
}
