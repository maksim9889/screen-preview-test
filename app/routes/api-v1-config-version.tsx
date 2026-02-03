import type { Route } from "./+types/api.v1.configs.$configId.versions.$versionNumber";
import { validateConfigId } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";

/**
 * GET /api/v1/configs/:configId/versions/:versionNumber
 * Get a specific version of a configuration
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { getConfig, getConfigVersion } = await import("../lib/db.server");
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

  const { configId, versionNumber } = params;

  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
  }

  // Check if config exists
  const config = getConfig(authResult.userId, configId);
  if (!config) {
    return notFound("Configuration not found", ErrorCode.CONFIG_NOT_FOUND);
  }

  const versionNum = parseInt(versionNumber, 10);
  if (isNaN(versionNum) || versionNum < 1) {
    return badRequest("Invalid version number", ErrorCode.INVALID_VERSION_NUMBER);
  }

  const version = getConfigVersion(authResult.userId, configId, versionNum);

  if (!version) {
    return notFound("Version not found", ErrorCode.VERSION_NOT_FOUND);
  }

  return ok({
    configId,
    version: {
      id: version.id,
      version: version.version,
      createdAt: version.createdAt,
      data: version.data,
    },
    apiVersion: API_VERSION,
  });
}
