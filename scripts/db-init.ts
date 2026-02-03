#!/usr/bin/env npx tsx
/**
 * Database Initialization & Schema Management Script
 *
 * Usage:
 *   npx tsx scripts/db-init.ts          # Initialize database (creates if not exists)
 *   npx tsx scripts/db-init.ts --status # Show schema status
 *   npx tsx scripts/db-init.ts --reset  # Reset database (DESTRUCTIVE)
 *
 * This script can be used to:
 * - Initialize a fresh database
 * - Check current schema status
 * - Reset the database for development
 *
 * The same schema is applied automatically when the app starts,
 * so this script is optional for normal operation.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// ============ Configuration ============

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "database.db");

// ============ Schema Definition ============

/**
 * Current database schema (v1)
 *
 * Tables:
 * - users: User accounts with hashed passwords
 * - auth_tokens: Opaque authentication tokens (stateful sessions)
 * - configurations: User app configurations (JSON data)
 * - configuration_versions: Version history for configurations
 */
const SCHEMA_SQL = `
-- Users table: stores user accounts
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,          -- PBKDF2-HMAC-SHA512 hash
  salt TEXT NOT NULL,                  -- Random salt for password hashing
  createdAt TEXT NOT NULL,             -- ISO 8601 timestamp
  last_config_id TEXT DEFAULT 'default' -- Last accessed config
);

-- Auth tokens table: opaque token authentication
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,              -- Cryptographically secure random token
  user_id INTEGER NOT NULL,
  createdAt TEXT NOT NULL,             -- ISO 8601 timestamp
  expiresAt TEXT NOT NULL,             -- ISO 8601 timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Configurations table: stores app configurations as JSON
CREATE TABLE IF NOT EXISTS configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_id TEXT NOT NULL,             -- User-defined config name (e.g., "default", "mobile")
  schemaVersion INTEGER NOT NULL DEFAULT 1, -- For config data migrations
  api_version TEXT NOT NULL DEFAULT 'v1',   -- API version used to save
  updatedAt TEXT NOT NULL,             -- ISO 8601 timestamp (for optimistic concurrency)
  data TEXT NOT NULL,                  -- JSON stringified AppConfig
  loaded_version INTEGER DEFAULT NULL, -- Currently loaded version number
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, config_id)
);

-- Configuration versions table: version history
CREATE TABLE IF NOT EXISTS configuration_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  configuration_id INTEGER NOT NULL,
  version INTEGER NOT NULL,            -- Sequential version number (1, 2, 3, ...)
  createdAt TEXT NOT NULL,             -- ISO 8601 timestamp
  data TEXT NOT NULL,                  -- JSON stringified AppConfig snapshot
  FOREIGN KEY (configuration_id) REFERENCES configurations(id) ON DELETE CASCADE,
  UNIQUE (configuration_id, version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expiresAt ON auth_tokens(expiresAt);
CREATE INDEX IF NOT EXISTS idx_configurations_user_id ON configurations(user_id, config_id);
CREATE INDEX IF NOT EXISTS idx_configuration_versions_configuration_id ON configuration_versions(configuration_id, version DESC);
`;

// ============ Helper Functions ============

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`✓ Created data directory: ${DATA_DIR}`);
  }
}

function initializeDatabase(): Database.Database {
  ensureDataDir();

  const isNew = !fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrency
  db.pragma("journal_mode = WAL");

  // Apply schema
  db.exec(SCHEMA_SQL);

  // Apply column migrations for existing databases
  applyMigrations(db);

  if (isNew) {
    console.log(`✓ Created new database: ${DB_PATH}`);
  } else {
    console.log(`✓ Database initialized: ${DB_PATH}`);
  }

  return db;
}

function applyMigrations(db: Database.Database): void {
  // Migration 1: Add loaded_version column if missing
  const columns = db.prepare("PRAGMA table_info(configurations)").all() as Array<{name: string}>;

  if (!columns.some(col => col.name === 'loaded_version')) {
    db.exec(`ALTER TABLE configurations ADD COLUMN loaded_version INTEGER DEFAULT NULL;`);
    console.log("  → Applied migration: added loaded_version column");
  }

  if (!columns.some(col => col.name === 'api_version')) {
    db.exec(`ALTER TABLE configurations ADD COLUMN api_version TEXT DEFAULT 'v1';`);
    console.log("  → Applied migration: added api_version column");
  }
}

function showStatus(db: Database.Database): void {
  console.log("\n📊 Database Status");
  console.log("─".repeat(50));
  console.log(`Path: ${DB_PATH}`);

  // Get table info
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{name: string}>;

  console.log(`\nTables (${tables.length}):`);

  for (const table of tables) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as {count: number};
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as Array<{name: string, type: string}>;

    console.log(`\n  ${table.name} (${count.count} rows)`);
    for (const col of columns) {
      console.log(`    - ${col.name}: ${col.type}`);
    }
  }

  // Get indexes
  const indexes = db.prepare(`
    SELECT name, tbl_name FROM sqlite_master
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY tbl_name, name
  `).all() as Array<{name: string, tbl_name: string}>;

  console.log(`\nIndexes (${indexes.length}):`);
  for (const idx of indexes) {
    console.log(`  - ${idx.name} on ${idx.tbl_name}`);
  }

  // WAL status
  const journalMode = db.pragma("journal_mode", { simple: true });
  console.log(`\nJournal mode: ${journalMode}`);
}

function resetDatabase(): void {
  const filesToRemove = [
    DB_PATH,
    `${DB_PATH}-shm`,
    `${DB_PATH}-wal`,
  ];

  for (const file of filesToRemove) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✓ Removed: ${file}`);
    }
  }

  console.log("\n⚠️  Database reset complete. Run without --reset to recreate.");
}

// ============ Main ============

function main(): void {
  const args = process.argv.slice(2);

  console.log("🗄️  Database Schema Manager\n");

  if (args.includes("--reset")) {
    console.log("⚠️  RESET MODE - This will delete all data!\n");
    resetDatabase();
    return;
  }

  const db = initializeDatabase();

  if (args.includes("--status")) {
    showStatus(db);
  } else {
    console.log("\nRun with --status to see schema details");
    console.log("Run with --reset to delete and recreate (DESTRUCTIVE)");
  }

  db.close();
}

main();
