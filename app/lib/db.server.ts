/**
 * Database Server Module
 *
 * This module provides the data access layer for the Home Editor application.
 * It manages user accounts, authentication tokens, app configurations, and version history
 * using SQLite with better-sqlite3.
 *
 * Features:
 * - User management (create, read, update)
 * - Authentication token management
 * - Configuration storage with JSON serialization
 * - Version history tracking
 * - Graceful error handling with fallbacks
 * - WAL (Write-Ahead Logging) mode for better concurrency
 *
 * @module db.server
 */

import Database from "better-sqlite3";
import crypto from "crypto";
import { DEFAULT_SECTION_ORDER } from "./constants";
import fs from "fs";
import path from "path";
import { config } from "./config.server";
import { getSchemaVersionFromApiVersion } from "./schema-migrations.server";
import { auditLogger, dbLogger } from "./logger.server";

// Import and re-export AppConfig from shared types
import type { AppConfig } from "./types";
export type { AppConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * Maximum number of versions allowed per configuration
 * Prevents DoS attacks by limiting storage consumption
 */
const MAX_VERSIONS_PER_CONFIG = 100;

/**
 * Gets the database path, allowing override via environment variable for tests
 */
function getDatabasePath(): string {
  // Check for test override first
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }
  return config.database.path;
}

/**
 * User database record
 */
interface User {
  /** Unique user ID (auto-increment) */
  id: number;
  /** Unique username */
  username: string;
  /** Hashed password using PBKDF2 */
  passwordHash: string;
  /** Random salt for password hashing */
  salt: string;
  /** ISO 8601 timestamp of user creation */
  createdAt: string;
  /** ID of the last accessed configuration */
  last_config_id: string;
}

/**
 * Authentication token database record
 *
 * SECURITY: Session tokens are hashed (SHA-256) before storage.
 * The plaintext token is returned to the client but never stored.
 */
interface AuthToken {
  /** Hashed token string (SHA-256, primary key) */
  token: string;
  /** Foreign key to users table */
  user_id: number;
  /** ISO 8601 timestamp when token was created */
  createdAt: string;
  /** ISO 8601 timestamp when token expires */
  expiresAt: string;
  /** IP address that created this session (for IP binding) */
  ip_address?: string;
}

/**
 * API token for programmatic access (separate from session tokens)
 */
export interface ApiToken {
  /** Unique auto-increment ID */
  id: number;
  /** The token string (hashed for storage, but returned on creation) */
  token: string;
  /** Foreign key to users table */
  user_id: number;
  /** User-defined name for the token */
  name: string;
  /** ISO 8601 timestamp when token was created */
  createdAt: string;
  /** ISO 8601 timestamp when token was last used */
  lastUsedAt: string | null;
  /** ISO 8601 timestamp when token expires (null = never expires) */
  expiresAt: string | null;
}

/**
 * Configuration database record (internal representation)
 */
interface ConfigRecord {
  /** Unique configuration ID (auto-increment primary key) */
  id: number;
  /** Foreign key to users table */
  user_id: number;
  /** User-defined configuration identifier */
  config_id: string;
  /** Schema version for migrations */
  schemaVersion: number;
  /** API version used to create/update this config */
  api_version: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** JSON stringified AppConfig data */
  data: string;
}

/**
 * Configuration version database record
 */
interface ConfigurationVersion {
  /** Unique version ID (auto-increment primary key) */
  id: number;
  /** Foreign key to configurations.id */
  configuration_id: number;
  /** Sequential version number starting from 1 */
  version: number;
  /** ISO 8601 timestamp when version was created */
  createdAt: string;
  /** JSON stringified AppConfig snapshot */
  data: string;
}

// AppConfig type is imported from ./types and re-exported above

/**
 * Singleton database connection
 * Uses Write-Ahead Logging (WAL) for better concurrency
 */
let db: Database.Database | null = null;

/**
 * Resets the database connection (for testing purposes)
 * This allows tests to reinitialize the database with a fresh connection
 */
export function resetDatabaseConnection(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Gets or creates the singleton database connection
 *
 * This function implements the singleton pattern to ensure only one database
 * connection exists throughout the application lifecycle. On first call, it:
 * 1. Creates the data directory if it doesn't exist
 * 2. Opens the SQLite database file
 * 3. Enables WAL (Write-Ahead Logging) mode for better concurrency
 * 4. Initializes the database schema
 *
 * @returns {Database.Database} The active database connection
 * @throws {Error} If database file cannot be created or opened
 */
function getDatabase(): Database.Database {
  // Return existing connection if already initialized
  if (db) return db;

  // Ensure data directory exists (creates parent directories if needed)
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Create database connection
  const dbPath = getDatabasePath();
  db = new Database(dbPath);

  // Enable Write-Ahead Logging for better concurrent read/write performance
  // WAL allows readers to continue while a write is in progress
  db.pragma("journal_mode = WAL");

  // Create tables and indexes if they don't exist
  initializeSchema();

  return db;
}

/**
 * Initializes the database schema
 *
 * Creates all required tables and indexes if they don't exist:
 * - users: User accounts with credentials
 * - auth_tokens: Session tokens for authentication
 * - configurations: App configurations with JSON data
 * - configuration_versions: Version history for configurations
 *
 * Also performs schema migrations (e.g., adding loaded_version column)
 *
 * @returns {void}
 */
function initializeSchema() {
  if (!db) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      last_config_id TEXT DEFAULT 'default'
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      ip_address TEXT,
      token_prefix TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL DEFAULT '',
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      lastUsedAt TEXT,
      expiresAt TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      config_id TEXT NOT NULL,
      schemaVersion INTEGER NOT NULL DEFAULT 1,
      api_version TEXT NOT NULL DEFAULT 'v1',
      updatedAt TEXT NOT NULL,
      data TEXT NOT NULL,
      loaded_version INTEGER DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id, config_id)
    );

    CREATE TABLE IF NOT EXISTS configuration_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      configuration_id INTEGER NOT NULL,
      version INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY (configuration_id) REFERENCES configurations(id) ON DELETE CASCADE,
      UNIQUE (configuration_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiresAt ON auth_tokens(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_configurations_user_id ON configurations(user_id, config_id);
    CREATE INDEX IF NOT EXISTS idx_configuration_versions_configuration_id ON configuration_versions(configuration_id, version DESC);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      ip_address TEXT,
      details TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);
  `);

  // Migrations for existing databases
  // Note: These migrations are wrapped in individual try-catch blocks to handle cases
  // where columns already exist or the database is new

  // Migration 1: Add loaded_version column if it doesn't exist
  try {
    const columns1 = db.prepare("PRAGMA table_info(configurations)").all() as Array<{name: string}>;
    const hasLoadedVersion = columns1.some(col => col.name === 'loaded_version');
    if (!hasLoadedVersion) {
      db.exec(`ALTER TABLE configurations ADD COLUMN loaded_version INTEGER DEFAULT NULL;`);
    }
  } catch (e) {
    // Column already exists or error occurred, safely ignore
  }

  // Migration 2: Add api_version column if it doesn't exist
  try {
    const columns2 = db.prepare("PRAGMA table_info(configurations)").all() as Array<{name: string}>;
    const hasApiVersion = columns2.some(col => col.name === 'api_version');
    if (!hasApiVersion) {
      db.exec(`ALTER TABLE configurations ADD COLUMN api_version TEXT DEFAULT 'v1';`);
    }
  } catch (e) {
    // Column already exists or error occurred, safely ignore
  }

  // Migration 3: Add ip_address column to auth_tokens if it doesn't exist
  try {
    const columns3 = db.prepare("PRAGMA table_info(auth_tokens)").all() as Array<{name: string}>;
    const hasIpAddress = columns3.some(col => col.name === 'ip_address');
    if (!hasIpAddress) {
      db.exec(`ALTER TABLE auth_tokens ADD COLUMN ip_address TEXT;`);
    }
  } catch (e) {
    // Column already exists or error occurred, safely ignore
  }

  // Migration 4: Create api_tokens table if it doesn't exist
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        token_prefix TEXT NOT NULL DEFAULT '',
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastUsedAt TEXT,
        expiresAt TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
    `);
  } catch (e) {
    // Table already exists or error occurred, safely ignore
  }

  // Migration 5: Add token_prefix column to api_tokens (for hashed token display)
  try {
    db.exec(`ALTER TABLE api_tokens ADD COLUMN token_prefix TEXT NOT NULL DEFAULT ''`);
  } catch (e) {
    // Column already exists or error occurred, safely ignore
  }

  // Migration 6: Convert plaintext tokens to hashed format
  // Tokens with empty token_prefix are old plaintext tokens that need migration
  // Uses a transaction to ensure all tokens are migrated atomically
  try {
    const oldTokens = db.prepare(
      "SELECT id, token FROM api_tokens WHERE token_prefix = ''"
    ).all() as Array<{ id: number; token: string }>;

    if (oldTokens.length > 0) {
      const database = db; // Capture non-null reference for closure
      const migrateTokensTransaction = database.transaction(() => {
        const updateStmt = database.prepare(
          "UPDATE api_tokens SET token = ?, token_prefix = ? WHERE id = ?"
        );

        for (const oldToken of oldTokens) {
          // Old token column contains plaintext
          const plaintext = oldToken.token;
          const tokenHash = crypto.createHash('sha256').update(plaintext).digest('hex');
          // Use random prefix (does NOT leak token content)
          const tokenPrefix = crypto.randomBytes(4).toString('hex');
          updateStmt.run(tokenHash, tokenPrefix, oldToken.id);
        }
      });

      migrateTokensTransaction();
    }
  } catch (e) {
    // Migration failed - log but don't crash
    dbLogger.error({ error: e }, 'Migration 6 (token hashing) failed');
  }

  // Migration 7: Add expiresAt column to api_tokens (for token expiration)
  try {
    db.exec(`ALTER TABLE api_tokens ADD COLUMN expiresAt TEXT`);
  } catch (e) {
    // Column already exists or error occurred, safely ignore
  }

  // Migration 8: Add token_prefix column to auth_tokens (for hashed token support)
  try {
    db.exec(`ALTER TABLE auth_tokens ADD COLUMN token_prefix TEXT NOT NULL DEFAULT ''`);
  } catch (e) {
    // Column already exists or error occurred, safely ignore
  }

  // Migration 9: Convert plaintext auth tokens to hashed format
  // Tokens with empty token_prefix are old plaintext tokens that need migration
  // Uses a transaction to ensure all tokens are migrated atomically
  try {
    const oldAuthTokens = db.prepare(
      "SELECT token FROM auth_tokens WHERE token_prefix = ''"
    ).all() as Array<{ token: string }>;

    if (oldAuthTokens.length > 0) {
      const database = db; // Capture non-null reference for closure
      const migrateAuthTokensTransaction = database.transaction(() => {
        // We need to create new rows with hashed tokens and delete old ones
        // because token is the primary key
        const insertStmt = database.prepare(
          "INSERT OR REPLACE INTO auth_tokens (token, user_id, createdAt, expiresAt, ip_address, token_prefix) SELECT ?, user_id, createdAt, expiresAt, ip_address, ? FROM auth_tokens WHERE token = ?"
        );
        const deleteStmt = database.prepare(
          "DELETE FROM auth_tokens WHERE token = ? AND token_prefix = ''"
        );

        for (const oldToken of oldAuthTokens) {
          // Old token column contains plaintext
          const plaintext = oldToken.token;
          const tokenHash = crypto.createHash('sha256').update(plaintext).digest('hex');
          // Use random prefix (does NOT leak token content)
          const tokenPrefix = crypto.randomBytes(4).toString('hex');

          // Insert new hashed token row
          insertStmt.run(tokenHash, tokenPrefix, plaintext);
          // Delete old plaintext token row (only if prefix is still empty, to avoid deleting newly inserted)
          deleteStmt.run(plaintext);
        }
      });

      migrateAuthTokensTransaction();
    }
  } catch (e) {
    // Migration failed - log but don't crash
    dbLogger.error({ error: e }, 'Migration 9 (auth token hashing) failed');
  }
}

// ============================================================================
// Transaction Utilities
// Helper functions for atomic database operations
// ============================================================================

/**
 * Executes a function within a database transaction
 *
 * Ensures atomicity: either all operations succeed or all are rolled back.
 * Uses better-sqlite3's transaction() method for optimal performance.
 *
 * @param {Function} fn - The function to execute within the transaction
 * @returns {T} The return value of the function
 * @throws {Error} If the transaction fails (all changes are rolled back)
 *
 * @example
 * const result = runInTransaction(() => {
 *   insertUser(...);
 *   insertConfig(...);
 *   return { success: true };
 * });
 */
export function runInTransaction<T>(fn: () => T): T {
  const database = getDatabase();
  const transaction = database.transaction(fn);
  return transaction();
}

// ============================================================================
// Configuration Management
// Functions for creating, reading, updating, and deleting app configurations
// ============================================================================

/**
 * Retrieves a configuration for a specific user
 *
 * Fetches the app configuration data from the database and parses the JSON.
 * Includes graceful error handling for corrupted data.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier (e.g., "default", "mobile", etc.)
 * @returns {AppConfig | null} The parsed configuration object, or null if not found or corrupted
 *
 * @example
 * const config = getConfig(1, "default");
 * if (config) {
 *   console.log(config.carousel.images);
 * }
 */
export function getConfig(userId: number, configId: string): AppConfig | null {
  const database = getDatabase();

  try {
    const stmt = database.prepare("SELECT data FROM configurations WHERE user_id = ? AND config_id = ?");
    const row = stmt.get(userId, configId) as { data: string } | undefined;

    if (!row) return null;

    try {
      return JSON.parse(row.data) as AppConfig;
    } catch (parseError) {
      dbLogger.error({ userId, configId, error: parseError }, 'Failed to parse config data');
      return null;
    }
  } catch (dbError) {
    dbLogger.error({ userId, configId, error: dbError }, 'Database error in getConfig');
    return null;
  }
}

/**
 * Retrieves the complete configuration record with metadata
 *
 * Returns the full database record including id, timestamps, and schema version
 * in addition to the parsed configuration data. Useful for exports and debugging.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @returns {Object | null} Complete record with metadata, or null if not found
 * @returns {number} return.id - Database primary key
 * @returns {number} return.user_id - User ID foreign key
 * @returns {string} return.config_id - Configuration identifier
 * @returns {number} return.schemaVersion - Schema version for migrations
 * @returns {string} return.updatedAt - ISO 8601 timestamp of last update
 * @returns {AppConfig} return.data - Parsed configuration object
 */
export function getFullConfigRecord(userId: number, configId: string): { id: number; user_id: number; config_id: string; schemaVersion: number; updatedAt: string; data: AppConfig } | null {
  const database = getDatabase();

  try {
    const stmt = database.prepare("SELECT id, user_id, config_id, schemaVersion, updatedAt, data FROM configurations WHERE user_id = ? AND config_id = ?");
    const row = stmt.get(userId, configId) as { id: number; user_id: number; config_id: string; schemaVersion: number; updatedAt: string; data: string } | undefined;

    if (!row) return null;

    try {
      return {
        id: row.id,
        user_id: row.user_id,
        config_id: row.config_id,
        schemaVersion: row.schemaVersion,
        updatedAt: row.updatedAt,
        data: JSON.parse(row.data) as AppConfig,
      };
    } catch (parseError) {
      dbLogger.error({ userId, configId, error: parseError }, 'Failed to parse full config record');
      return null;
    }
  } catch (dbError) {
    dbLogger.error({ userId, configId, error: dbError }, 'Database error in getFullConfigRecord');
    return null;
  }
}

/**
 * Saves or updates a configuration
 *
 * Uses INSERT ... ON CONFLICT to perform an "upsert" operation:
 * - If the config doesn't exist, creates a new record
 * - If the config exists, updates the data and timestamp
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @param {AppConfig} data - The configuration object to save
 * @returns {ConfigRecord} The saved configuration record from database
 * @throws {Error} If database operation fails or JSON serialization fails
 *
 * @example
 * const saved = saveConfig(1, "default", {
 *   carousel: { images: [], aspectRatio: "landscape" },
 *   textSection: { title: "Welcome", ... },
 *   cta: { label: "Start", ... }
 * });
 */
export function saveConfig(userId: number, configId: string, data: AppConfig, apiVersion: string = 'v1'): ConfigRecord {
  const database = getDatabase();
  const schemaVersion = getSchemaVersionFromApiVersion(apiVersion);
  const updatedAt = new Date().toISOString();

  try {
    const dataJson = JSON.stringify(data);

    const stmt = database.prepare(`
      INSERT INTO configurations (user_id, config_id, schemaVersion, api_version, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, config_id) DO UPDATE SET
        schemaVersion = excluded.schemaVersion,
        api_version = excluded.api_version,
        updatedAt = excluded.updatedAt,
        data = excluded.data
    `);

    stmt.run(userId, configId, schemaVersion, apiVersion, updatedAt, dataJson);

    // Get the record to return with its id
    const record = database.prepare("SELECT id, user_id, config_id, schemaVersion, api_version, updatedAt, data FROM configurations WHERE user_id = ? AND config_id = ?").get(userId, configId) as ConfigRecord;

    return record;
  } catch (error) {
    dbLogger.error({ userId, configId, error }, 'Database error saving config');
    throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Imports a configuration from an exported record
 *
 * Used when restoring configurations from exported JSON files.
 * Supports backward compatibility with older export formats that may not
 * include id or user_id fields.
 *
 * @param {number} userId - The user ID to import the configuration for
 * @param {Object} record - The exported configuration record
 * @param {number} [record.id] - Original database ID (optional, for compatibility)
 * @param {number} [record.user_id] - Original user ID (optional, for compatibility)
 * @param {string} record.config_id - Configuration identifier
 * @param {number} record.schemaVersion - Schema version from export
 * @param {string} record.updatedAt - Original update timestamp (preserved)
 * @param {AppConfig} record.data - Configuration object
 * @returns {ConfigRecord} The imported configuration record
 * @throws {Error} If database operation fails
 *
 * @example
 * const imported = importConfigRecord(1, {
 *   config_id: "mobile",
 *   schemaVersion: 1,
 *   updatedAt: "2024-01-01T00:00:00Z",
 *   data: configObject
 * });
 */
export function importConfigRecord(userId: number, record: {
  id?: number; // Optional - may not be in old export format
  user_id?: number; // Ignored - imported configs always use the authenticated userId parameter for security
  config_id: string;
  schemaVersion: number;
  api_version?: string; // Optional - inferred from schemaVersion if not present
  updatedAt: string;
  data: AppConfig;
}): ConfigRecord {
  const database = getDatabase();

  try {
    const dataJson = JSON.stringify(record.data);
    // Use api_version from record if present, otherwise infer from schemaVersion
    const apiVersion = record.api_version || `v${record.schemaVersion}`;

    const stmt = database.prepare(`
      INSERT INTO configurations (user_id, config_id, schemaVersion, api_version, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, config_id) DO UPDATE SET
        schemaVersion = excluded.schemaVersion,
        api_version = excluded.api_version,
        updatedAt = excluded.updatedAt,
        data = excluded.data
    `);

    stmt.run(userId, record.config_id, record.schemaVersion, apiVersion, record.updatedAt, dataJson);

    // Get the record to return with its id
    const insertedRecord = database.prepare("SELECT id, user_id, config_id, schemaVersion, updatedAt, data FROM configurations WHERE user_id = ? AND config_id = ?").get(userId, record.config_id) as ConfigRecord;

    return insertedRecord;
  } catch (error) {
    dbLogger.error({ userId, configId: record.config_id, error }, 'Database error importing config');
    throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// User Management
// Functions for creating and retrieving user accounts
// ============================================================================

/**
 * Retrieves a user by username
 *
 * @param {string} username - The username to search for (case-sensitive)
 * @returns {User | null} The user record if found, null otherwise
 *
 * @example
 * const user = getUser("johndoe");
 * if (user) {
 *   console.log(`User ID: ${user.id}`);
 * }
 */
export function getUser(username: string): User | null {
  const database = getDatabase();
  const stmt = database.prepare(
    "SELECT id, username, passwordHash, salt, createdAt, last_config_id FROM users WHERE username = ?"
  );
  const row = stmt.get(username) as User | undefined;
  return row || null;
}

/**
 * Retrieves a user by their unique ID
 *
 * @param {number} id - The user's unique ID
 * @returns {User | null} The user record if found, null otherwise
 */
export function getUserById(id: number): User | null {
  const database = getDatabase();
  const stmt = database.prepare(
    "SELECT id, username, passwordHash, salt, createdAt, last_config_id FROM users WHERE id = ?"
  );
  const row = stmt.get(id) as User | undefined;
  return row || null;
}

/**
 * Creates a new user account
 *
 * Checks if the username is already taken before creating the user.
 * Sets the default configuration ID to "default".
 *
 * @param {string} username - Desired username (must be unique)
 * @param {string} passwordHash - PBKDF2 hashed password
 * @param {string} salt - Random salt used for password hashing
 * @returns {User | null} The created user record, or null if username exists or creation fails
 *
 * @example
 * const user = createUser("johndoe", hashedPassword, salt);
 * if (!user) {
 *   console.error("Username already exists or creation failed");
 * }
 */
export function createUser(
  username: string,
  passwordHash: string,
  salt: string
): User | null {
  const database = getDatabase();

  // Check if user already exists
  const existing = getUser(username);
  if (existing) {
    return null;
  }

  const createdAt = new Date().toISOString();
  const lastConfigId = "default";

  try {
    const stmt = database.prepare(`
      INSERT INTO users (username, passwordHash, salt, createdAt, last_config_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, passwordHash, salt, createdAt, lastConfigId);

    return {
      id: result.lastInsertRowid as number,
      username,
      passwordHash,
      salt,
      createdAt,
      last_config_id: lastConfigId,
    };
  } catch (error) {
    dbLogger.error({ username, error }, 'Database error creating user');
    return null;
  }
}

/**
 * Checks if any users exist in the database
 *
 * Used to determine if initial setup is required.
 *
 * @returns {boolean} True if at least one user exists, false otherwise
 */
export function userExists(): boolean {
  const database = getDatabase();
  const stmt = database.prepare("SELECT COUNT(*) as count FROM users");
  const row = stmt.get() as { count: number };
  return row.count > 0;
}

/**
 * Updates the user's last accessed configuration ID
 *
 * Tracks which configuration the user was last working on,
 * allowing the app to restore their session on next login.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration ID to set as last accessed
 * @returns {boolean} True if update successful, false if user not found
 */
export function updateUserLastConfig(userId: number, configId: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare("UPDATE users SET last_config_id = ? WHERE id = ?");
  const result = stmt.run(configId, userId);
  return result.changes > 0;
}

// ============================================================================
// Authentication Token Management
// Functions for creating, validating, and revoking session tokens
//
// SECURITY: Session tokens are hashed before storage (like GitHub's approach).
// The plaintext token is only sent to the client and cannot be recovered from DB.
// ============================================================================

/**
 * Hashes an auth token for secure storage
 * Uses SHA-256 which is fast enough for token lookups while being secure.
 *
 * @param {string} token - The plaintext token
 * @returns {string} The hashed token (hex encoded)
 */
function hashAuthToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates or updates an authentication token (session token)
 *
 * Uses INSERT ... ON CONFLICT to ensure idempotent token creation.
 * If a token with the same value already exists, it updates the expiration.
 * Session tokens are bound to IP address for security.
 *
 * SECURITY: The token is hashed before storage. The plaintext is returned
 * to the caller (for sending to client via cookie) but never stored in the database.
 *
 * @param {string} token - The cryptographically secure token string (plaintext)
 * @param {number} userId - The user ID this token belongs to
 * @param {string} expiresAt - ISO 8601 timestamp when token expires
 * @param {string} [ipAddress] - IP address that created this session
 * @returns {AuthToken} The created/updated token record (with plaintext token for client)
 *
 * @example
 * const token = createAuthToken("abc123...", 1, "2024-12-31T23:59:59Z", "192.168.1.1");
 */
export function createAuthToken(
  token: string,
  userId: number,
  expiresAt: string,
  ipAddress?: string
): AuthToken {
  const database = getDatabase();
  const createdAt = new Date().toISOString();

  // Hash the token for secure storage
  const tokenHash = hashAuthToken(token);
  // Store random prefix for identification (does NOT leak token content)
  const tokenPrefix = crypto.randomBytes(4).toString('hex');

  const stmt = database.prepare(`
    INSERT INTO auth_tokens (token, user_id, createdAt, expiresAt, ip_address, token_prefix)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      user_id = excluded.user_id,
      createdAt = excluded.createdAt,
      expiresAt = excluded.expiresAt,
      ip_address = excluded.ip_address,
      token_prefix = excluded.token_prefix
  `);

  stmt.run(tokenHash, userId, createdAt, expiresAt, ipAddress || null, tokenPrefix);

  // Return with plaintext token (for sending to client via cookie)
  return {
    token, // Plaintext - only returned to caller, never stored
    user_id: userId,
    createdAt,
    expiresAt,
    ip_address: ipAddress,
  };
}

/**
 * Retrieves and validates an authentication token
 *
 * Checks if the token exists and hasn't expired. Automatically deletes
 * expired tokens for cleanup.
 *
 * SECURITY: Hashes the provided token and compares against stored hash.
 *
 * @param {string} token - The plaintext token string to validate
 * @returns {AuthToken | null} The token record if valid, null if not found or expired
 *
 * @example
 * const authToken = getAuthToken("abc123...");
 * if (authToken) {
 *   const user = getUserById(authToken.user_id);
 * }
 */
export function getAuthToken(token: string): AuthToken | null {
  const database = getDatabase();

  // Hash the incoming token to compare with stored hash
  const tokenHash = hashAuthToken(token);

  const stmt = database.prepare(
    "SELECT token, user_id, createdAt, expiresAt, ip_address FROM auth_tokens WHERE token = ?"
  );
  const authToken = stmt.get(tokenHash) as AuthToken | undefined;

  if (!authToken) return null;

  // Check if token has expired
  if (new Date(authToken.expiresAt) < new Date()) {
    // Automatically cleanup expired token (pass plaintext, function will hash)
    deleteAuthToken(token);
    return null;
  }

  return authToken;
}

/**
 * Deletes an authentication token
 *
 * Used for logout operations or cleanup of expired tokens.
 *
 * SECURITY: Hashes the provided token before deletion lookup.
 *
 * @param {string} token - The plaintext token string to delete
 * @returns {boolean} True if token was deleted, false if not found
 */
export function deleteAuthToken(token: string): boolean {
  const database = getDatabase();

  // Hash the incoming token to match stored hash
  const tokenHash = hashAuthToken(token);

  const stmt = database.prepare("DELETE FROM auth_tokens WHERE token = ?");
  const result = stmt.run(tokenHash);
  return result.changes > 0;
}

// ============================================================================
// API Token Management
// Functions for creating, validating, and revoking API tokens (separate from sessions)
//
// SECURITY: API tokens are hashed before storage (like GitHub's approach).
// The plaintext token is only shown once at creation and cannot be recovered.
// ============================================================================

/**
 * Hashes an API token for secure storage
 * Uses SHA-256 which is fast enough for token lookups while being secure.
 *
 * @param {string} token - The plaintext token
 * @returns {string} The hashed token (hex encoded)
 */
function hashApiToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new API token for programmatic access
 *
 * API tokens are used for external API access with Bearer authentication.
 * They can optionally have an expiration date.
 *
 * SECURITY: The token is hashed before storage. The plaintext is returned
 * only once and cannot be recovered from the database.
 *
 * @param {string} token - The cryptographically secure token string (plaintext)
 * @param {number} userId - The user ID this token belongs to
 * @param {string} name - User-defined name for the token
 * @param {string} [expiresAt] - Optional ISO 8601 expiration timestamp (null = never expires)
 * @returns {ApiToken} The created token record (with plaintext token for one-time display)
 */
export function createApiToken(
  token: string,
  userId: number,
  name: string,
  expiresAt?: string
): ApiToken {
  const database = getDatabase();
  const createdAt = new Date().toISOString();

  // Hash the token for secure storage
  const tokenHash = hashApiToken(token);
  // Store random prefix for display (does NOT leak token content, unlike GitHub's approach)
  const tokenPrefix = crypto.randomBytes(4).toString('hex');

  const stmt = database.prepare(`
    INSERT INTO api_tokens (token, token_prefix, user_id, name, createdAt, expiresAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(tokenHash, tokenPrefix, userId, name, createdAt, expiresAt || null);

  // Return with plaintext token (shown only once to user)
  return {
    id: result.lastInsertRowid as number,
    token, // Plaintext - for one-time display only
    user_id: userId,
    name,
    createdAt,
    lastUsedAt: null,
    expiresAt: expiresAt ?? null,
  };
}

/**
 * Retrieves an API token by its token string
 *
 * SECURITY: Hashes the provided token and compares against stored hash.
 * Also updates the lastUsedAt timestamp for tracking.
 *
 * @param {string} token - The plaintext token string to verify
 * @returns {ApiToken | null} The token record if found, null otherwise
 */
// Threshold for updating lastUsedAt (1 hour in milliseconds)
// Only update if the last recorded usage is older than this
const LAST_USED_UPDATE_THRESHOLD_MS = 60 * 60 * 1000;

export function getApiToken(token: string): ApiToken | null {
  const database = getDatabase();

  // Hash the incoming token to compare with stored hash
  const tokenHash = hashApiToken(token);

  const stmt = database.prepare(
    "SELECT id, token, user_id, name, createdAt, lastUsedAt, expiresAt FROM api_tokens WHERE token = ?"
  );
  const apiToken = stmt.get(tokenHash) as ApiToken | undefined;

  if (!apiToken) return null;

  // Check if token has expired
  if (apiToken.expiresAt) {
    const expirationTime = new Date(apiToken.expiresAt).getTime();
    if (Date.now() > expirationTime) {
      // Token has expired - delete it and return null
      const deleteStmt = database.prepare("DELETE FROM api_tokens WHERE id = ?");
      deleteStmt.run(apiToken.id);
      return null;
    }
  }

  // Update lastUsedAt only if it's older than threshold (reduces write amplification)
  // This provides useful "last used" info without a DB write on every request
  const now = Date.now();
  const lastUsed = apiToken.lastUsedAt ? new Date(apiToken.lastUsedAt).getTime() : 0;
  const shouldUpdate = (now - lastUsed) > LAST_USED_UPDATE_THRESHOLD_MS;

  if (shouldUpdate) {
    const updateStmt = database.prepare(
      "UPDATE api_tokens SET lastUsedAt = ? WHERE id = ?"
    );
    updateStmt.run(new Date().toISOString(), apiToken.id);
  }

  return apiToken;
}

/**
 * Lists all API tokens for a user (without exposing token values)
 *
 * SECURITY: Returns tokens with only the stored prefix for display.
 * The full token cannot be recovered from the database.
 *
 * @param {number} userId - The user ID to list tokens for
 * @returns {Array<Omit<ApiToken, 'token'> & { tokenPreview: string }>} Array of tokens with prefix only
 */
export function listApiTokens(userId: number): Array<Omit<ApiToken, 'token'> & { tokenPreview: string }> {
  const database = getDatabase();
  const stmt = database.prepare(
    "SELECT id, token_prefix, user_id, name, createdAt, lastUsedAt, expiresAt FROM api_tokens WHERE user_id = ? ORDER BY createdAt DESC"
  );
  const tokens = stmt.all(userId) as Array<{
    id: number;
    token_prefix: string;
    user_id: number;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
  }>;

  return tokens.map(t => ({
    id: t.id,
    user_id: t.user_id,
    name: t.name,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt,
    expiresAt: t.expiresAt,
    tokenPreview: t.token_prefix + "...",
  }));
}

/**
 * Deletes an API token by ID
 *
 * @param {number} tokenId - The token ID to delete
 * @param {number} userId - The user ID (for ownership verification)
 * @returns {boolean} True if token was deleted, false if not found or not owned by user
 */
export function deleteApiToken(tokenId: number, userId: number): boolean {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?");
  const result = stmt.run(tokenId, userId);
  return result.changes > 0;
}

/**
 * Deletes all API tokens for a user
 *
 * @param {number} userId - The user ID to delete tokens for
 * @returns {number} Number of tokens deleted
 */
export function deleteAllApiTokens(userId: number): number {
  const database = getDatabase();
  const stmt = database.prepare("DELETE FROM api_tokens WHERE user_id = ?");
  const result = stmt.run(userId);
  return result.changes;
}

// ============================================================================
// Default Configuration
// Provides sensible defaults for new configurations
// ============================================================================

/**
 * Default application configuration
 *
 * Used as the starting point for new configurations and as a fallback
 * when configuration data is corrupted. Contains sample images from Unsplash,
 * placeholder text, and a standard blue call-to-action button.
 *
 * @constant
 * @type {AppConfig}
 */
export const DEFAULT_CONFIG: AppConfig = {
  carousel: {
    images: [
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800",
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800",
    ],
    aspectRatio: "landscape",
  },
  textSection: {
    title: "Welcome to Our App",
    titleColor: "#000000",
    description:
      "Discover amazing features and start your journey with us today.",
    descriptionColor: "#666666",
  },
  cta: {
    label: "Get Started",
    url: "https://example.com",
    backgroundColor: "#007AFF",
    textColor: "#FFFFFF",
  },
  sectionOrder: DEFAULT_SECTION_ORDER,
};

/**
 * Initializes the default configuration for a user if it doesn't exist
 *
 * Ensures every user has at least one configuration to work with.
 * Should be called after user creation or on first login.
 *
 * @param {number} userId - The user's unique ID
 * @returns {void}
 */
export function initializeDefaultConfig(userId: number) {
  const existing = getConfig(userId, "default");
  if (!existing) {
    saveConfig(userId, "default", DEFAULT_CONFIG);
  }
}

/**
 * Retrieves all configurations for a user with version counts
 *
 * Returns a list of all configurations ordered by most recently updated.
 * Includes the count of saved versions for each configuration.
 *
 * @param {number} userId - The user's unique ID
 * @returns {Array<Object>} Array of configuration summaries
 * @returns {string} return[].config_id - Configuration identifier
 * @returns {string} return[].updatedAt - ISO 8601 timestamp of last update
 * @returns {number} return[].versionCount - Number of saved versions
 * @returns {number} return[].schemaVersion - Schema version number
 * @returns {string} return[].api_version - API version used
 * @returns {number | null} return[].loaded_version - Currently loaded version number
 *
 * @example
 * const configs = getUserConfigs(1);
 * // [{ config_id: "default", updatedAt: "2024-01-15...", versionCount: 5, schemaVersion: 1, api_version: "v1", loaded_version: null }, ...]
 */
export function getUserConfigs(userId: number): Array<{
  config_id: string;
  updatedAt: string;
  versionCount: number;
  schemaVersion: number;
  api_version: string;
  loaded_version: number | null;
}> {
  const database = getDatabase();

  // Get all configs for this user with their version counts
  const stmt = database.prepare(`
    SELECT
      c.config_id,
      c.updatedAt,
      c.schemaVersion,
      c.api_version,
      c.loaded_version,
      COUNT(v.id) as versionCount
    FROM configurations c
    LEFT JOIN configuration_versions v ON c.id = v.configuration_id
    WHERE c.user_id = ?
    GROUP BY c.id, c.config_id, c.updatedAt, c.schemaVersion, c.api_version, c.loaded_version
    ORDER BY c.config_id ASC
  `);

  const rows = stmt.all(userId) as Array<{
    config_id: string;
    updatedAt: string;
    versionCount: number;
    schemaVersion: number;
    api_version: string;
    loaded_version: number | null;
  }>;

  return rows;
}

// ============================================================================
// Configuration Version History
// Functions for managing version snapshots of configurations
// ============================================================================

/**
 * Gets the latest version number for a configuration
 *
 * Returns the highest version number saved for a configuration, or 0 if no versions exist.
 * Version numbers start at 1 and increment sequentially.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @returns {number} The latest version number (0 if no versions exist)
 */
export function getLatestVersionNumber(userId: number, configId: string): number {
  const database = getDatabase();

  // Get the integer id from user_id and config_id
  const configRecord = database.prepare("SELECT id FROM configurations WHERE user_id = ? AND config_id = ?").get(userId, configId) as { id: number } | undefined;
  if (!configRecord) return 0;

  const stmt = database.prepare("SELECT MAX(version) as maxVersion FROM configuration_versions WHERE configuration_id = ?");
  const row = stmt.get(configRecord.id) as { maxVersion: number | null } | undefined;
  return row?.maxVersion ?? 0;
}

/**
 * Creates a new version snapshot of a configuration
 *
 * Saves the current state of a configuration as a new version, incrementing
 * the version number. Also updates the loaded_version column to track which
 * version is currently displayed.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @param {AppConfig} data - The configuration data to save as a version
 * @returns {ConfigurationVersion} The created version record
 * @throws {Error} If the configuration doesn't exist in the database
 *
 * @example
 * const version = createConfigVersion(1, "default", configData);
 * console.log(`Created version ${version.version}`);
 */
export function createConfigVersion(userId: number, configId: string, data: AppConfig): ConfigurationVersion {
  const database = getDatabase();

  // Get the integer id from user_id and config_id
  const configRecord = database.prepare("SELECT id FROM configurations WHERE user_id = ? AND config_id = ?").get(userId, configId) as { id: number } | undefined;
  if (!configRecord) {
    throw new Error(`Configuration not found for user_id: ${userId}, config_id: ${configId}`);
  }

  const version = getLatestVersionNumber(userId, configId) + 1;

  // Enforce version limit to prevent DoS - auto-prune oldest versions
  const versionCount = database.prepare(
    "SELECT COUNT(*) as count FROM configuration_versions WHERE configuration_id = ?"
  ).get(configRecord.id) as { count: number };

  if (versionCount.count >= MAX_VERSIONS_PER_CONFIG) {
    // Delete oldest versions to make room (keep MAX_VERSIONS_PER_CONFIG - 1 to allow new one)
    const versionsToDelete = versionCount.count - MAX_VERSIONS_PER_CONFIG + 1;
    database.prepare(`
      DELETE FROM configuration_versions
      WHERE id IN (
        SELECT id FROM configuration_versions
        WHERE configuration_id = ?
        ORDER BY version ASC
        LIMIT ?
      )
    `).run(configRecord.id, versionsToDelete);
  }

  const createdAt = new Date().toISOString();
  const dataJson = JSON.stringify(data);

  // Use transaction to ensure version insert and loaded_version update are atomic
  const createVersionTransaction = database.transaction(() => {
    const stmt = database.prepare(`
      INSERT INTO configuration_versions (configuration_id, version, createdAt, data)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(configRecord.id, version, createdAt, dataJson);

    // Update the loaded_version to the newly created version
    const updateStmt = database.prepare("UPDATE configurations SET loaded_version = ? WHERE user_id = ? AND config_id = ?");
    updateStmt.run(version, userId, configId);
  });

  createVersionTransaction();

  const lastInsert = database.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
  return {
    id: lastInsert.id,
    configuration_id: configRecord.id,
    version,
    createdAt,
    data: dataJson,
  };
}

/**
 * Retrieves version history for a configuration
 *
 * Returns a list of version snapshots ordered by version number (newest first).
 * Includes graceful handling of corrupted version data with fallback to DEFAULT_CONFIG.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @param {number} [limit=20] - Maximum number of versions to return
 * @returns {Array<Object>} Array of version records
 * @returns {number} return[].id - Version database ID
 * @returns {number} return[].version - Sequential version number
 * @returns {string} return[].createdAt - ISO 8601 timestamp when version was created
 * @returns {AppConfig} return[].data - Parsed configuration snapshot
 *
 * @example
 * const versions = getConfigVersions(1, "default", 10);
 * versions.forEach(v => console.log(`v${v.version}: ${v.createdAt}`));
 */
export function getConfigVersions(userId: number, configId: string, limit: number = 20): Array<{
  id: number;
  version: number;
  createdAt: string;
  data: AppConfig;
}> {
  const database = getDatabase();

  try {
    // Get the integer id from user_id and config_id
    const configRecord = database.prepare("SELECT id FROM configurations WHERE user_id = ? AND config_id = ?").get(userId, configId) as { id: number } | undefined;
    if (!configRecord) return [];

    const stmt = database.prepare(`
      SELECT id, version, createdAt, data
      FROM configuration_versions
      WHERE configuration_id = ?
      ORDER BY version DESC
      LIMIT ?
    `);

    const rows = stmt.all(configRecord.id, limit) as Array<{
      id: number;
      version: number;
      createdAt: string;
      data: string;
    }>;

    return rows.map(row => {
      try {
        return {
          id: row.id,
          version: row.version,
          createdAt: row.createdAt,
          data: JSON.parse(row.data) as AppConfig,
        };
      } catch (parseError) {
        dbLogger.error({ configId, version: row.version, error: parseError }, 'Failed to parse version data');
        // Return with default config as fallback
        return {
          id: row.id,
          version: row.version,
          createdAt: row.createdAt,
          data: DEFAULT_CONFIG,
        };
      }
    });
  } catch (dbError) {
    dbLogger.error({ userId, configId, error: dbError }, 'Database error in getConfigVersions');
    return [];
  }
}

/**
 * Retrieves a specific version of a configuration
 *
 * Fetches a particular version snapshot by its version number.
 * Returns null if the version doesn't exist or data is corrupted.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @param {number} version - The version number to retrieve
 * @returns {Object | null} The version record, or null if not found
 * @returns {number} return.id - Version database ID
 * @returns {number} return.version - Version number
 * @returns {string} return.createdAt - ISO 8601 creation timestamp
 * @returns {AppConfig} return.data - Parsed configuration snapshot
 *
 * @example
 * const v3 = getConfigVersion(1, "default", 3);
 * if (v3) {
 *   console.log(v3.data.carousel.images);
 * }
 */
export function getConfigVersion(userId: number, configId: string, version: number): {
  id: number;
  version: number;
  createdAt: string;
  data: AppConfig;
} | null {
  const database = getDatabase();

  try {
    // Get the integer id from user_id and config_id
    const configRecord = database.prepare("SELECT id FROM configurations WHERE user_id = ? AND config_id = ?").get(userId, configId) as { id: number } | undefined;
    if (!configRecord) return null;

    const stmt = database.prepare(`
      SELECT id, version, createdAt, data
      FROM configuration_versions
      WHERE configuration_id = ? AND version = ?
    `);

    const row = stmt.get(configRecord.id, version) as {
      id: number;
      version: number;
      createdAt: string;
      data: string;
    } | undefined;

    if (!row) return null;

    try {
      return {
        id: row.id,
        version: row.version,
        createdAt: row.createdAt,
        data: JSON.parse(row.data) as AppConfig,
      };
    } catch (parseError) {
      dbLogger.error({ configId, version, error: parseError }, 'Failed to parse version data');
      return null;
    }
  } catch (dbError) {
    dbLogger.error({ userId, configId, version, error: dbError }, 'Database error in getConfigVersion');
    return null;
  }
}

/**
 * Restores a configuration to a previous version
 *
 * Replaces the current configuration data with data from a saved version.
 * Updates the loaded_version column to track which version is now active.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @param {number} version - The version number to restore
 * @returns {boolean} True if restoration successful, false if version not found
 *
 * @example
 * if (restoreConfigVersion(1, "default", 3)) {
 *   console.log("Restored to version 3");
 * }
 */
export function restoreConfigVersion(userId: number, configId: string, version: number): boolean {
  const database = getDatabase();
  const versionData = getConfigVersion(userId, configId, version);

  if (!versionData) {
    return false;
  }

  // Use transaction to ensure config save and loaded_version update are atomic
  const restoreTransaction = database.transaction(() => {
    const updatedAt = new Date().toISOString();
    const dataJson = JSON.stringify(versionData.data);

    const saveStmt = database.prepare(`
      INSERT INTO configurations (user_id, config_id, schemaVersion, api_version, updatedAt, data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, config_id) DO UPDATE SET
        updatedAt = excluded.updatedAt,
        data = excluded.data
    `);
    saveStmt.run(userId, configId, 1, 'v1', updatedAt, dataJson);

    // Update the loaded_version to track which version is currently displayed
    const updateStmt = database.prepare("UPDATE configurations SET loaded_version = ? WHERE user_id = ? AND config_id = ?");
    updateStmt.run(version, userId, configId);
  });

  restoreTransaction();

  return true;
}

/**
 * Gets the currently loaded version number
 *
 * Returns which version is currently displayed in the editor.
 * Used to show version badges and track restoration state.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @returns {number | null} The loaded version number, or null if not set
 */
export function getLoadedVersion(userId: number, configId: string): number | null {
  const database = getDatabase();
  const stmt = database.prepare("SELECT loaded_version FROM configurations WHERE user_id = ? AND config_id = ?");
  const row = stmt.get(userId, configId) as { loaded_version: number | null } | undefined;
  return row?.loaded_version ?? null;
}

/**
 * Updates the currently loaded version tracker
 *
 * Records which version is currently displayed. Set to null to indicate
 * the configuration is newer than any saved version.
 *
 * @param {number} userId - The user's unique ID
 * @param {string} configId - The configuration identifier
 * @param {number | null} version - The version number to set as loaded, or null to clear
 * @returns {boolean} True if update successful, false if configuration not found
 */
export function updateLoadedVersion(userId: number, configId: string, version: number | null): boolean {
  const database = getDatabase();
  const stmt = database.prepare("UPDATE configurations SET loaded_version = ? WHERE user_id = ? AND config_id = ?");
  const result = stmt.run(version, userId, configId);
  return result.changes > 0;
}

// ============================================================================
// Audit Logging
// Functions for logging security-critical operations
// ============================================================================

/**
 * Audit log action types for categorization
 */
export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  REGISTER = "REGISTER",

  // API Token Management
  API_TOKEN_CREATED = "API_TOKEN_CREATED",
  API_TOKEN_DELETED = "API_TOKEN_DELETED",
  API_TOKEN_DELETED_ALL = "API_TOKEN_DELETED_ALL",

  // Session Management
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_IP_MISMATCH = "SESSION_IP_MISMATCH",

  // Configuration Management
  CONFIG_CREATED = "CONFIG_CREATED",
  CONFIG_UPDATED = "CONFIG_UPDATED",
  CONFIG_DELETED = "CONFIG_DELETED",
  CONFIG_EXPORTED = "CONFIG_EXPORTED",
  CONFIG_IMPORTED = "CONFIG_IMPORTED",
  VERSION_CREATED = "VERSION_CREATED",
  VERSION_RESTORED = "VERSION_RESTORED",
}

/**
 * Resource types for audit logs
 */
export enum AuditResourceType {
  USER = "USER",
  SESSION = "SESSION",
  API_TOKEN = "API_TOKEN",
  CONFIG = "CONFIG",
  VERSION = "VERSION",
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Creates an audit log entry for security-critical operations
 *
 * Implements dual logging:
 * - Database: Queryable audit trail (can be disabled via AUDIT_LOG_TO_DATABASE=false)
 * - File: Tamper-resistant log file (can be disabled via AUDIT_LOG_TO_FILE=false)
 *
 * At least one channel should be enabled for security compliance.
 *
 * @param {Object} entry - The audit log entry
 * @param {number | null} entry.userId - The user performing the action (null for failed logins)
 * @param {AuditAction} entry.action - The action being logged
 * @param {AuditResourceType} entry.resourceType - The type of resource affected
 * @param {string | null} entry.resourceId - The ID of the affected resource
 * @param {string | null} entry.ipAddress - The IP address of the request
 * @param {Record<string, unknown> | null} entry.details - Additional details about the action
 * @returns {AuditLogEntry} The created audit log entry
 */
export function createAuditLog(entry: {
  userId: number | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
}): AuditLogEntry {
  const createdAt = new Date().toISOString();
  let dbId: number = 0;

  // Channel 1: Database logging (queryable)
  if (config.auditLog.toDatabase) {
    const database = getDatabase();
    const detailsJson = entry.details ? JSON.stringify(entry.details) : null;

    const stmt = database.prepare(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, details, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entry.userId,
      entry.action,
      entry.resourceType,
      entry.resourceId || null,
      entry.ipAddress || null,
      detailsJson,
      createdAt
    );

    dbId = result.lastInsertRowid as number;
  }

  // Channel 2: File logging (tamper-resistant)
  if (config.auditLog.toFile) {
    auditLogger.info({
      userId: entry.userId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId || null,
      ipAddress: entry.ipAddress || null,
      details: entry.details || null,
      createdAt,
    }, `${entry.action} on ${entry.resourceType}${entry.resourceId ? ` [${entry.resourceId}]` : ""}`);
  }

  return {
    id: dbId,
    user_id: entry.userId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId || null,
    ip_address: entry.ipAddress || null,
    details: entry.details || null,
    createdAt,
  };
}

/**
 * Retrieves audit logs with optional filtering
 *
 * @param {Object} options - Filter options
 * @param {number} [options.userId] - Filter by user ID
 * @param {AuditAction} [options.action] - Filter by action type
 * @param {AuditResourceType} [options.resourceType] - Filter by resource type
 * @param {number} [options.limit=100] - Maximum number of entries to return
 * @param {number} [options.offset=0] - Offset for pagination
 * @returns {Array<AuditLogEntry>} Array of audit log entries
 */
export function getAuditLogs(options: {
  userId?: number;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  limit?: number;
  offset?: number;
} = {}): AuditLogEntry[] {
  const database = getDatabase();
  const { userId, action, resourceType, limit = 100, offset = 0 } = options;

  let query = "SELECT id, user_id, action, resource_type, resource_id, ip_address, details, createdAt FROM audit_logs WHERE 1=1";
  const params: (string | number)[] = [];

  if (userId !== undefined) {
    query += " AND user_id = ?";
    params.push(userId);
  }
  if (action) {
    query += " AND action = ?";
    params.push(action);
  }
  if (resourceType) {
    query += " AND resource_type = ?";
    params.push(resourceType);
  }

  query += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = database.prepare(query);
  const rows = stmt.all(...params) as Array<{
    id: number;
    user_id: number | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    ip_address: string | null;
    details: string | null;
    createdAt: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    action: row.action as AuditAction,
    resource_type: row.resource_type as AuditResourceType,
    resource_id: row.resource_id,
    ip_address: row.ip_address,
    details: row.details ? JSON.parse(row.details) : null,
    createdAt: row.createdAt,
  }));
}
