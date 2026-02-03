import type { Route } from "./+types/api.v1.configs";
import { validateConfig, validateConfigId, normalizeConfigColors } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";
import type { AppConfig } from "../lib/types";

/**
 * GET /api/v1/configs
 * List all configurations for the authenticated user
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function loader({ request }: Route.LoaderArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { getUserConfigs } = await import("../lib/db.server");
  const { unauthorized, ok, tooManyRequests } = await import("../lib/api-responses.server");
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

  const configs = getUserConfigs(authResult.userId);

  return ok({
    configs: configs.map((config) => ({
      configId: config.config_id,
      schemaVersion: config.schemaVersion,
      apiVersion: config.api_version,
      updatedAt: config.updatedAt,
      loadedVersion: config.loaded_version,
    })),
    apiVersion: API_VERSION,
  });
}

/**
 * POST /api/v1/configs
 * Create a new configuration
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 *
 * Note: CSRF validation is not required for Bearer token auth
 * (tokens must be explicitly added to requests, unlike cookies)
 */
export async function action({ request }: Route.ActionArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { getConfig, saveConfig } = await import("../lib/db.server");
  const { validateConfigRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { unauthorized, created, conflict, badRequest, tooManyRequests } = await import("../lib/api-responses.server");
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

  const configJson = formData.get("config") as string;
  const configId = formData.get("configId") as string;

  if (!configId) {
    return badRequest("configId is required", ErrorCode.MISSING_FIELD);
  }

  if (!configJson) {
    return badRequest("Configuration data is required", ErrorCode.MISSING_FIELD);
  }

  // Validate config ID
  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
  }

  // Enforce REST: Check if exists
  const existingConfig = getConfig(userId, configId);
  if (existingConfig) {
    return conflict(
      "Configuration already exists. Use PUT to update.",
      ErrorCode.CONFIG_ALREADY_EXISTS
    );
  }

  try {
    const config: AppConfig = JSON.parse(configJson);
    const validation = validateConfig(config);

    if (!validation.valid) {
      return badRequest(validation.errors.join(", "), ErrorCode.VALIDATION_ERROR);
    }

    // Normalize hex colors before saving
    const normalizedConfig = normalizeConfigColors(config);

    saveConfig(userId, configId, normalizedConfig, API_VERSION);

    // Set the new config as the user's default
    const { updateUserLastConfig } = await import("../lib/db.server");
    updateUserLastConfig(userId, configId);

    return created({
      success: true as const,
      savedAt: new Date().toISOString(),
      configId,
      apiVersion: API_VERSION,
    });
  } catch (e) {
    return badRequest(
      "Invalid configuration data",
      ErrorCode.INVALID_CONFIG_DATA,
      e instanceof Error ? e.message : undefined
    );
  }
}
