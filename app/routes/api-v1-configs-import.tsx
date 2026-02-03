import type { Route } from "./+types/api.v1.configs.import";
import { validateConfig, validateConfigId, normalizeConfigColors } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";

/**
 * POST /api/v1/configs/import
 * Import configuration from JSON file
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function action({ request }: Route.ActionArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { importConfigRecord, updateLoadedVersion } = await import("../lib/db.server");
  const { validateConfigRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { unauthorized, badRequest, ok, tooManyRequests } = await import("../lib/api-responses.server");
  const { importAndMigrateConfig, validateSchemaVersion } = await import("../lib/schema-migrations.server");
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");

  const authResult = await validateBearerToken(request);

  if (!authResult.authenticated || !authResult.userId) {
    return unauthorized(authResult.error || "Authentication required", ErrorCode.UNAUTHORIZED);
  }

  // Check API rate limit
  const clientIp = getClientIp(request);
  const rateLimit = checkApiRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return tooManyRequests(
      "Too many requests. Please try again later.",
      ErrorCode.RATE_LIMIT_EXCEEDED,
      undefined,
      createRateLimitHeaders(rateLimit)
    );
  }

  const userId = authResult.userId;

  // Validate request size
  const sizeValidation = await validateConfigRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  const formData = await request.formData();

  const importJson = formData.get("importData") as string;

  if (!importJson) {
    return badRequest("Import data is required", ErrorCode.MISSING_FIELD);
  }

  try {
    const importedRecord = JSON.parse(importJson);

    // Support both old format (id) and new format (config_id)
    const configId = importedRecord.config_id || importedRecord.id;

    // Validate required fields
    if (!configId || !importedRecord.schemaVersion || !importedRecord.updatedAt || !importedRecord.data) {
      return badRequest(
        "Invalid import file: missing required fields (id or config_id, schemaVersion, updatedAt, data)",
        ErrorCode.INVALID_IMPORT_FILE
      );
    }

    // Validate config ID
    const configIdValidation = validateConfigId(configId);
    if (!configIdValidation.valid) {
      return badRequest(
        `Invalid config ID in import: ${configIdValidation.error}`,
        ErrorCode.INVALID_CONFIG_ID
      );
    }

    // Validate schema version
    const schemaVersionError = validateSchemaVersion(importedRecord.schemaVersion);
    if (schemaVersionError) {
      return badRequest(schemaVersionError, ErrorCode.VALIDATION_ERROR);
    }

    // Migrate configuration to current schema version
    const migratedConfig = importAndMigrateConfig(importedRecord.data, importedRecord.schemaVersion);

    // Validate the migrated configuration data
    const validation = validateConfig(migratedConfig);

    if (!validation.valid) {
      return badRequest(
        `Invalid configuration in import: ${validation.errors.join(", ")}`,
        ErrorCode.INVALID_CONFIG_DATA
      );
    }

    // Normalize hex colors before saving
    const normalizedConfig = normalizeConfigColors(migratedConfig);

    // Import the configuration with config_id for this user
    importConfigRecord(userId, {
      config_id: configId,
      schemaVersion: importedRecord.schemaVersion,
      updatedAt: importedRecord.updatedAt,
      data: normalizedConfig,
    });

    // Clear loaded_version since imported config becomes the main config
    updateLoadedVersion(userId, configId, null);

    return ok({
      success: true as const,
      imported: true as const,
      importedAt: new Date().toISOString(),
      configId,
      config: normalizedConfig,
      apiVersion: API_VERSION,
    });
  } catch (e) {
    return badRequest(
      "Invalid import file",
      ErrorCode.INVALID_IMPORT_FILE,
      e instanceof Error ? e.message : "Unknown error"
    );
  }
}
