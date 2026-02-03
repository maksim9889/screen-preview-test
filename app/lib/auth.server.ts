import crypto from "crypto";
import {
  getUser,
  getUserById,
  createUser,
  userExists,
  createAuthToken,
  getAuthToken,
  deleteAuthToken,
  createApiToken,
  getApiToken,
  listApiTokens,
  deleteApiToken,
  deleteAllApiTokens,
  createAuditLog,
  AuditAction,
  AuditResourceType,
} from "./db.server";
import { config } from "./config.server";
import { parseCookies } from "./request-utils.server";

// Re-export commonly used functions for convenience
// Allows route handlers to import from auth.server instead of multiple modules
export { deleteAuthToken };
export { getClientIp } from "./request-utils.server";

// Configuration from centralized config module
export const AUTH_TOKEN_COOKIE_NAME = config.auth.tokenCookieName;
const TOKEN_DURATION_MS = config.auth.tokenDurationMs;
const PASSWORD_HASH_ITERATIONS = config.security.passwordHashIterations;

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, 64, "sha512")
    .toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateAuthToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Reserved usernames that cannot be registered (security-critical only)
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'moderator',
  'support', 'api', 'null', 'undefined'
]);

/**
 * Validates password strength
 * Requires: 8+ chars, uppercase, lowercase, number
 */
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  return { valid: true };
}

/**
 * Validates username
 * Requires: 3-50 chars, alphanumeric + underscore, not reserved
 */
function validateUsername(username: string): { valid: boolean; error?: string } {
  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > 50) {
    return { valid: false, error: "Username must be 50 characters or less" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { valid: false, error: "This username is not available" };
  }
  return { valid: true };
}

export async function register(username: string, password: string, ipAddress?: string) {
  if (!username || !password) {
    throw new Error("Username and password are required");
  }

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    throw new Error(usernameValidation.error);
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.error);
  }

  const existingUser = getUser(username);
  if (existingUser) {
    throw new Error("Username already exists");
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const user = createUser(username, passwordHash, salt);
  if (!user) {
    throw new Error("Failed to create user");
  }

  // Create auth token for automatic login after registration (with IP binding)
  const token = generateAuthToken();
  const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS).toISOString();

  createAuthToken(token, user.id, expiresAt, ipAddress);

  // Audit log: user registration
  createAuditLog({
    userId: user.id,
    action: AuditAction.REGISTER,
    resourceType: AuditResourceType.USER,
    resourceId: user.id.toString(),
    ipAddress,
    details: { username: user.username },
  });

  const headers = new Headers();
  headers.set("Set-Cookie", createAuthTokenCookie(token, expiresAt));

  return {
    success: true,
    token,
    expiresAt,
    username: user.username,
    userId: user.id,
    headers,
  };
}

export async function login(username: string, password: string, ipAddress?: string) {
  if (!username || !password) {
    // Audit log: failed login (missing credentials)
    createAuditLog({
      userId: null,
      action: AuditAction.LOGIN_FAILED,
      resourceType: AuditResourceType.SESSION,
      ipAddress,
      details: { reason: "Missing credentials" },
    });
    throw new Error("Invalid credentials");
  }

  const user = getUser(username);
  if (!user) {
    // Audit log: failed login (user not found)
    createAuditLog({
      userId: null,
      action: AuditAction.LOGIN_FAILED,
      resourceType: AuditResourceType.SESSION,
      ipAddress,
      details: { reason: "User not found", attemptedUsername: username },
    });
    throw new Error("Invalid credentials");
  }

  const passwordHash = hashPassword(password, user.salt);

  // Use timing-safe comparison to prevent timing attacks
  const hashBuffer = Buffer.from(passwordHash);
  const userHashBuffer = Buffer.from(user.passwordHash);

  // Ensure both buffers are the same length before comparison
  if (hashBuffer.length !== userHashBuffer.length) {
    // Audit log: failed login (password mismatch)
    createAuditLog({
      userId: user.id,
      action: AuditAction.LOGIN_FAILED,
      resourceType: AuditResourceType.SESSION,
      ipAddress,
      details: { reason: "Invalid password" },
    });
    throw new Error("Invalid credentials");
  }

  // Constant-time comparison prevents timing attacks
  if (!crypto.timingSafeEqual(hashBuffer, userHashBuffer)) {
    // Audit log: failed login (password mismatch)
    createAuditLog({
      userId: user.id,
      action: AuditAction.LOGIN_FAILED,
      resourceType: AuditResourceType.SESSION,
      ipAddress,
      details: { reason: "Invalid password" },
    });
    throw new Error("Invalid credentials");
  }

  const token = generateAuthToken();
  const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS).toISOString();

  createAuthToken(token, user.id, expiresAt, ipAddress);

  // Audit log: successful login
  createAuditLog({
    userId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    resourceType: AuditResourceType.SESSION,
    ipAddress,
  });

  const headers = new Headers();
  headers.set("Set-Cookie", createAuthTokenCookie(token, expiresAt));

  return {
    success: true,
    token,
    expiresAt,
    username,
    userId: user.id,
    headers,
  };
}

export async function logout(token: string, userId?: number, ipAddress?: string) {
  if (token) {
    deleteAuthToken(token);

    // Audit log: logout
    if (userId) {
      createAuditLog({
        userId,
        action: AuditAction.LOGOUT,
        resourceType: AuditResourceType.SESSION,
        ipAddress,
      });
    }
  }
  return { success: true };
}

export function getAuthTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  return cookies[AUTH_TOKEN_COOKIE_NAME] || null;
}

export async function validateAuthToken(cookieHeader: string | null, ipAddress?: string) {
  const token = getAuthTokenFromCookie(cookieHeader);

  if (!token) {
    return { authenticated: false };
  }

  const authToken = getAuthToken(token);

  if (!authToken) {
    return { authenticated: false };
  }

  // Verify IP address binding for session security
  // Sessions are bound to the IP address they were created from
  const storedIp = authToken.ip_address || "unknown";
  const currentIp = ipAddress || "unknown";

  // If both are "unknown" (development), allow it
  // Otherwise, IPs must match exactly
  if (storedIp !== "unknown" && currentIp !== "unknown" && storedIp !== currentIp) {
    // IP mismatch - possible session hijacking attempt
    // Delete the compromised token
    deleteAuthToken(token);

    // Audit log: session IP mismatch (potential session hijacking)
    createAuditLog({
      userId: authToken.user_id,
      action: AuditAction.SESSION_IP_MISMATCH,
      resourceType: AuditResourceType.SESSION,
      ipAddress: currentIp,
      details: { storedIp, attemptedIp: currentIp },
    });

    return { authenticated: false, error: "Session IP mismatch" };
  }

  // Get user by id to retrieve username
  const user = getUserById(authToken.user_id);
  if (!user) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    username: user.username,
    userId: user.id,
  };
}

export function needsSetup(): boolean {
  return !userExists();
}

export function createAuthTokenCookie(token: string, expiresAt: string): string {
  const parts = [
    `${AUTH_TOKEN_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
  ];

  if (config.isProduction) {
    parts.push("Secure");
  }

  parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);

  return parts.join("; ");
}

export function clearAuthTokenCookie(): string {
  return `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Extract Bearer token from Authorization header
 * Expected format: "Bearer <token>"
 */
export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Validate Bearer token from Authorization header
 * Used for /api/v1/* endpoints (external API access)
 *
 * IMPORTANT: This function ONLY accepts API tokens, NOT session tokens.
 * Session tokens (stored in cookies) cannot be used for API access.
 */
export async function validateBearerToken(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return { authenticated: false, error: "Missing or invalid Authorization header. Expected: Bearer <token>" };
  }

  // Only accept API tokens, NOT session tokens
  const apiToken = getApiToken(token);

  if (!apiToken) {
    return { authenticated: false, error: "Invalid API token. Session tokens cannot be used for API access. Generate an API token from the settings." };
  }

  const user = getUserById(apiToken.user_id);
  if (!user) {
    return { authenticated: false, error: "User not found" };
  }

  return {
    authenticated: true,
    username: user.username,
    userId: user.id,
  };
}

// ============================================================================
// API Token Management
// Functions for generating and managing API tokens for programmatic access
// ============================================================================

/**
 * Generate a new API token for a user
 * API tokens are used for programmatic API access and don't expire
 *
 * @param {number} userId - The user ID to generate token for
 * @param {string} name - User-defined name for the token
 * @param {string} [ipAddress] - Optional IP address for audit logging
 * @returns {object} The created token (includes full token value - only returned once!)
 */
export function generateApiToken(userId: number, name: string, ipAddress?: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const apiToken = createApiToken(token, userId, name);

  // Audit log: API token created
  createAuditLog({
    userId,
    action: AuditAction.API_TOKEN_CREATED,
    resourceType: AuditResourceType.API_TOKEN,
    resourceId: apiToken.id.toString(),
    ipAddress,
    details: { tokenName: name },
  });

  return {
    id: apiToken.id,
    token: apiToken.token, // Full token - only shown once!
    name: apiToken.name,
    createdAt: apiToken.createdAt,
  };
}

/**
 * List all API tokens for a user (with masked values)
 */
export { listApiTokens } from "./db.server";

/**
 * Delete an API token with audit logging
 *
 * @param {number} tokenId - The token ID to delete
 * @param {number} userId - The user ID (for ownership verification)
 * @param {string} [ipAddress] - Optional IP address for audit logging
 * @returns {boolean} True if token was deleted, false if not found
 */
export function revokeApiToken(tokenId: number, userId: number, ipAddress?: string): boolean {
  const deleted = deleteApiToken(tokenId, userId);

  if (deleted) {
    // Audit log: API token deleted
    createAuditLog({
      userId,
      action: AuditAction.API_TOKEN_DELETED,
      resourceType: AuditResourceType.API_TOKEN,
      resourceId: tokenId.toString(),
      ipAddress,
    });
  }

  return deleted;
}

/**
 * Delete all API tokens for a user with audit logging
 *
 * @param {number} userId - The user ID to delete tokens for
 * @param {string} [ipAddress] - Optional IP address for audit logging
 * @returns {number} Number of tokens deleted
 */
export function revokeAllApiTokens(userId: number, ipAddress?: string): number {
  const count = deleteAllApiTokens(userId);

  if (count > 0) {
    // Audit log: All API tokens deleted
    createAuditLog({
      userId,
      action: AuditAction.API_TOKEN_DELETED_ALL,
      resourceType: AuditResourceType.API_TOKEN,
      ipAddress,
      details: { count },
    });
  }

  return count;
}
