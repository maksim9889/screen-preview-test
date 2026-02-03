import type { Route } from "./+types/api.v1.configs.$configId";
import { validateConfig, validateConfigId, normalizeConfigColors } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";
import type { AppConfig } from "../lib/types";

/**
 * GET /api/v1/configs/:configId
 * Get a specific configuration
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const startTime = performance.now();
  const API_VERSION = "v1";
  const path = `/api/v1/configs/${params.configId}`;

  const { validateBearerToken } = await import("../lib/auth.server");
  const { getFullConfigRecord } = await import("../lib/db.server");
  const { unauthorized, badRequest, notFound, ok, tooManyRequests } = await import("../lib/api-responses.server");
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");

  const authResult = await validateBearerToken(request);

  const { configId } = params;
  const logCtx = { method: "GET", path, configId };

  if (!authResult.authenticated || !authResult.userId) {
    return unauthorized(authResult.error || "Authentication required", ErrorCode.UNAUTHORIZED, undefined, {
      ...logCtx,
      durationMs: Math.round(performance.now() - startTime),
    });
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
  const logCtxWithUser = { ...logCtx, userId };

  // Validate config ID
  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID, undefined, {
      ...logCtxWithUser,
      durationMs: Math.round(performance.now() - startTime),
    });
  }

  const configRecord = getFullConfigRecord(userId, configId);

  if (!configRecord) {
    return notFound("Configuration not found", ErrorCode.CONFIG_NOT_FOUND, undefined, {
      ...logCtxWithUser,
      durationMs: Math.round(performance.now() - startTime),
    });
  }

  return ok({
    configId,
    config: configRecord.data,
    schemaVersion: configRecord.schemaVersion,
    updatedAt: configRecord.updatedAt,
    apiVersion: API_VERSION,
  }, undefined, {
    ...logCtxWithUser,
    durationMs: Math.round(performance.now() - startTime),
  });
}

/**
 * PUT /api/v1/configs/:configId - Update existing configuration
 * PATCH /api/v1/configs/:configId - Restore version
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function action({ request, params }: Route.ActionArgs) {
  const startTime = performance.now();
  const API_VERSION = "v1";
  const method = request.method;
  const path = `/api/v1/configs/${params.configId}`;

  const { validateBearerToken } = await import("../lib/auth.server");
  const { saveConfig, getConfig, restoreConfigVersion, updateLoadedVersion } = await import("../lib/db.server");
  const { validateConfigRequestSize, validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { unauthorized, badRequest, notFound, ok, tooManyRequests } = await import("../lib/api-responses.server");
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");

  const authResult = await validateBearerToken(request);

  const { configId } = params;
  const logCtx = { method, path, configId };

  if (!authResult.authenticated || !authResult.userId) {
    return unauthorized(authResult.error || "Authentication required", ErrorCode.UNAUTHORIZED, undefined, {
      ...logCtx,
      durationMs: Math.round(performance.now() - startTime),
    });
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
  const logCtxWithUser = { ...logCtx, userId };

  // Validate config ID
  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID, undefined, {
      ...logCtxWithUser,
      durationMs: Math.round(performance.now() - startTime),
    });
  }

  // Handle PUT - Update existing configuration
  if (method === "PUT") {
    const { getFullConfigRecord } = await import("../lib/db.server");
    const { conflict } = await import("../lib/api-responses.server");

    // Enforce REST: Check if config exists
    const existingRecord = getFullConfigRecord(userId, configId);
    if (!existingRecord) {
      return notFound(
        "Configuration not found. Use POST to create.",
        ErrorCode.CONFIG_NOT_FOUND,
        undefined,
        { ...logCtxWithUser, durationMs: Math.round(performance.now() - startTime) }
      );
    }

    // Validate request size
    const sizeValidation = await validateConfigRequestSize(request);
    if (!sizeValidation.valid) {
      return createPayloadTooLargeResponse(sizeValidation.error);
    }

    const formData = await request.formData();

    const configJson = formData.get("config") as string;
    const createVersion = formData.get("createVersion") === "true";
    const expectedUpdatedAt = formData.get("expectedUpdatedAt") as string | null;

    if (!configJson) {
      return badRequest("Configuration data is required", ErrorCode.MISSING_FIELD, undefined, {
        ...logCtxWithUser,
        durationMs: Math.round(performance.now() - startTime),
      });
    }

    // Optimistic concurrency check
    if (expectedUpdatedAt && expectedUpdatedAt !== existingRecord.updatedAt) {
      return conflict(
        "Configuration has been modified by another request. Please refresh and try again.",
        ErrorCode.STALE_DATA,
        `Expected: ${expectedUpdatedAt}, Current: ${existingRecord.updatedAt}`,
        { ...logCtxWithUser, durationMs: Math.round(performance.now() - startTime) }
      );
    }

    try {
      const config: AppConfig = JSON.parse(configJson);
      const validation = validateConfig(config);

      if (!validation.valid) {
        return badRequest(validation.errors.join(", "), ErrorCode.VALIDATION_ERROR, undefined, {
          ...logCtxWithUser,
          durationMs: Math.round(performance.now() - startTime),
        });
      }

      // Normalize hex colors before saving
      const normalizedConfig = normalizeConfigColors(config);

      saveConfig(userId, configId, normalizedConfig, API_VERSION);

      // Clear loaded_version since we're now working on the main config
      updateLoadedVersion(userId, configId, null);

      // Optionally create a version snapshot after saving
      if (createVersion) {
        const { createConfigVersion, getConfigVersions, getLatestVersionNumber } = await import("../lib/db.server");
        const versionRecord = createConfigVersion(userId, configId, normalizedConfig);
        const versions = getConfigVersions(userId, configId, 20);
        const latestVersionNumber = getLatestVersionNumber(userId, configId);

        return ok({
          success: true as const,
          savedAt: new Date().toISOString(),
          versionCreated: true as const,
          versionNumber: versionRecord.version,
          versions,
          latestVersionNumber,
          configId,
          apiVersion: API_VERSION,
        }, undefined, {
          ...logCtxWithUser,
          durationMs: Math.round(performance.now() - startTime),
        });
      }

      return ok({
        success: true as const,
        savedAt: new Date().toISOString(),
        configId,
        apiVersion: API_VERSION,
      }, undefined, {
        ...logCtxWithUser,
        durationMs: Math.round(performance.now() - startTime),
      });
    } catch (e) {
      return badRequest(
        "Invalid configuration data",
        ErrorCode.INVALID_CONFIG_DATA,
        e instanceof Error ? e.message : undefined,
        { ...logCtxWithUser, durationMs: Math.round(performance.now() - startTime) }
      );
    }
  }

  // Handle PATCH - Restore version
  if (method === "PATCH") {
    const sizeValidation = await validateDefaultRequestSize(request);
    if (!sizeValidation.valid) {
      return createPayloadTooLargeResponse(sizeValidation.error);
    }

    const formData = await request.formData();

    const loadedVersion = formData.get("loadedVersion");

    if (loadedVersion) {
      const versionNumber = parseInt(loadedVersion as string, 10);

      if (isNaN(versionNumber) || versionNumber < 1) {
        return badRequest("Invalid version number", ErrorCode.INVALID_VERSION_NUMBER, undefined, {
          ...logCtxWithUser,
          durationMs: Math.round(performance.now() - startTime),
        });
      }

      // Restore version to main config
      const success = restoreConfigVersion(userId, configId, versionNumber);
      if (!success) {
        return notFound("Version not found", ErrorCode.VERSION_NOT_FOUND, undefined, {
          ...logCtxWithUser,
          durationMs: Math.round(performance.now() - startTime),
        });
      }

      // Update metadata
      updateLoadedVersion(userId, configId, versionNumber);

      // Return restored config
      const restoredConfig = getConfig(userId, configId);
      return ok({
        success: true,
        restored: true,
        restoredVersion: versionNumber,
        config: restoredConfig,
        apiVersion: API_VERSION,
      }, undefined, {
        ...logCtxWithUser,
        durationMs: Math.round(performance.now() - startTime),
      });
    }

    return badRequest("No valid patch fields provided", ErrorCode.VALIDATION_ERROR, undefined, {
      ...logCtxWithUser,
      durationMs: Math.round(performance.now() - startTime),
    });
  }

  return badRequest("Method not allowed", ErrorCode.VALIDATION_ERROR, undefined, {
    ...logCtxWithUser,
    durationMs: Math.round(performance.now() - startTime),
  });
}
