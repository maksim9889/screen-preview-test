import type { Route } from "./+types/api.v1.configs.$configId.export";
import { validateConfigId } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";
import { sanitizeFilename } from "../lib/request-utils.server";

/**
 * GET /api/v1/configs/:configId/export
 * Export configuration as downloadable JSON file
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 *
 * Note: For browser downloads, use the /home route's export functionality
 * which handles cookie auth. This endpoint is for programmatic API access.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const API_VERSION = "v1";
  const { validateBearerToken } = await import("../lib/auth.server");
  const { getFullConfigRecord } = await import("../lib/db.server");
  const { unauthorized, badRequest, notFound, tooManyRequests } = await import("../lib/api-responses.server");
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
  const userId = authResult.userId;
  const username = authResult.username || "user";

  // Validate config ID
  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
  }

  const fullRecord = getFullConfigRecord(userId, configId);

  if (!fullRecord) {
    return notFound("Configuration not found", ErrorCode.CONFIG_NOT_FOUND);
  }

  const exportData = JSON.stringify(fullRecord, null, 2);
  // Sanitize filename components for defense-in-depth (prevents header injection)
  const safeUsername = sanitizeFilename(username);
  const safeConfigId = sanitizeFilename(configId);
  const filename = `config-export-${safeUsername}-${safeConfigId}-${new Date().toISOString().split('T')[0]}.json`;

  return new Response(exportData, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-API-Version": API_VERSION,
    },
  });
}
