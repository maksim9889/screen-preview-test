import type { Route } from "./+types/api.v1.configs.$configId.versions";
import { validateConfigId } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";

/**
 * GET /api/v1/configs/:configId/versions
 * List all versions for a configuration
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { getConfig, getConfigVersions } = await import("../lib/db.server");
  const { unauthorized, badRequest, notFound, ok, tooManyRequests } = await import("../lib/api-responses.server");
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

  const { configId } = params;

  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
  }

  // Check if config exists
  const config = getConfig(authResult.userId, configId);
  if (!config) {
    return notFound("Configuration not found", ErrorCode.CONFIG_NOT_FOUND);
  }

  const versions = getConfigVersions(authResult.userId, configId);

  return ok({
    configId,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      createdAt: v.createdAt,
      data: v.data,
    })),
    apiVersion: API_VERSION,
  });
}

/**
 * POST /api/v1/configs/:configId/versions
 * Create a new version snapshot of the current configuration
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function action({ request, params }: Route.ActionArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { getConfig, createConfigVersion } = await import("../lib/db.server");
  const { validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { unauthorized, badRequest, notFound, created, tooManyRequests } = await import("../lib/api-responses.server");
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
  const { configId } = params;

  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
  }

  const sizeValidation = await validateDefaultRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  const config = getConfig(userId, configId);
  if (!config) {
    return notFound("Configuration not found", ErrorCode.CONFIG_NOT_FOUND);
  }

  const versionRecord = createConfigVersion(userId, configId, config);

  return created({
    success: true as const,
    versionNumber: versionRecord.version,
    configId,
    apiVersion: API_VERSION,
  });
}
