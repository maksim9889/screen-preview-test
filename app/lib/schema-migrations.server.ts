/**
 * Configuration Schema Migration Framework
 *
 * This file provides a framework for handling schema evolution of configuration data.
 * When the configuration structure changes, migration functions can be defined here
 * to transform old configurations to the new format.
 *
 * Schema Version History:
 * - v1: Initial schema with carousel, textSection, and cta
 */

import type { AppConfig } from "./types";

// ============ Schema Version Constants ============

/**
 * The current schema version supported by this application
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * The minimum schema version that can be migrated to the current version
 * Older versions are not supported and will be rejected
 */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1;

// ============ Utility Functions ============

/**
 * Derives the schema version from the API version string
 * @param apiVersion - API version string (e.g., "v1", "v2")
 * @returns The schema version number
 * @example
 * getSchemaVersionFromApiVersion("v1") // returns 1
 * getSchemaVersionFromApiVersion("v2") // returns 2
 */
export function getSchemaVersionFromApiVersion(apiVersion: string): number {
  const match = apiVersion.match(/^v(\d+)$/);
  if (!match) {
    return CURRENT_SCHEMA_VERSION; // Fallback to current version for invalid format
  }
  return parseInt(match[1], 10);
}

// ============ Type Definitions for Schema Versions ============

/**
 * Schema Version 1 - Initial schema
 */
export interface AppConfigV1 {
  carousel: {
    images: string[];
    aspectRatio: "portrait" | "landscape" | "square";
  };
  textSection: {
    title: string;
    titleColor: string;
    description: string;
    descriptionColor: string;
  };
  cta: {
    label: string;
    url: string;
    backgroundColor: string;
    textColor: string;
  };
}

/**
 * Example: Future schema version 2 (not yet implemented)
 *
 * export interface AppConfigV2 extends AppConfigV1 {
 *   // Add new field
 *   footer: {
 *     text: string;
 *     backgroundColor: string;
 *   };
 * }
 */

// ============ Migration Functions ============

/**
 * Example: Migration from v1 to v2 (not yet implemented)
 *
 * function migrateV1toV2(config: AppConfigV1): AppConfigV2 {
 *   return {
 *     ...config,
 *     footer: {
 *       text: "Default footer text",
 *       backgroundColor: "#f5f5f5",
 *     },
 *   };
 * }
 */

// ============ Migration Registry ============

/**
 * Registry of migration functions
 * Key: Target version number
 * Value: Migration function that transforms (version-1) to version
 */
const migrations: Record<number, (config: any) => any> = {
  // Example: 2: migrateV1toV2,
  // Future: 3: migrateV2toV3,
};

// ============ Public API ============

/**
 * Checks if a schema version is supported
 */
export function isSchemVersionSupported(version: number): boolean {
  return version >= MIN_SUPPORTED_SCHEMA_VERSION && version <= CURRENT_SCHEMA_VERSION;
}

/**
 * Validates a schema version
 * Returns error message if invalid, null if valid
 */
export function validateSchemaVersion(version: number): string | null {
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return "Schema version must be a positive integer";
  }

  if (version < MIN_SUPPORTED_SCHEMA_VERSION) {
    return `Schema version ${version} is too old. Minimum supported version is ${MIN_SUPPORTED_SCHEMA_VERSION}`;
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return `Schema version ${version} is too new. Current version is ${CURRENT_SCHEMA_VERSION}. Please update the application`;
  }

  return null;
}

/**
 * Migrates a configuration from its current version to the latest version
 *
 * @param config The configuration data
 * @param fromVersion The current schema version of the config
 * @returns The migrated configuration
 * @throws Error if migration fails or version is unsupported
 */
export function migrateConfigToLatest(config: any, fromVersion: number): AppConfig {
  // Validate version
  const versionError = validateSchemaVersion(fromVersion);
  if (versionError) {
    throw new Error(versionError);
  }

  // If already at current version, return as-is
  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    return config as AppConfig;
  }

  // Apply migrations sequentially
  let migratedConfig = config;
  let currentVersion = fromVersion;

  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const targetVersion = currentVersion + 1;
    const migrator = migrations[targetVersion];

    if (!migrator) {
      throw new Error(
        `No migration path from v${currentVersion} to v${targetVersion}. ` +
        `This is a bug in the migration framework.`
      );
    }

    try {
      migratedConfig = migrator(migratedConfig);
      currentVersion = targetVersion;
    } catch (error) {
      throw new Error(
        `Failed to migrate from v${currentVersion} to v${targetVersion}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return migratedConfig as AppConfig;
}

/**
 * Safely imports a configuration, applying migrations if needed
 *
 * @param data The imported configuration data
 * @param schemaVersion The schema version of the imported data
 * @returns The migrated configuration
 * @throws Error if import fails
 */
export function importAndMigrateConfig(data: any, schemaVersion: number): AppConfig {
  return migrateConfigToLatest(data, schemaVersion);
}
