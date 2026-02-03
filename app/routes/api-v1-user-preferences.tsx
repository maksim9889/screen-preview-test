import type { Route } from "./+types/api.v1.user.preferences";
import { validateConfigId } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";

/**
 * PATCH /api/v1/user/preferences
 * Update user preferences (e.g., last viewed config)
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function action({ request }: Route.ActionArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
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

  const userId = authResult.userId;

  // Validate request size
  const sizeValidation = await validateDefaultRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  const formData = await request.formData();

  // Handle updating last config preference
  const lastConfigId = formData.get("lastConfigId") as string | null;

  if (lastConfigId) {
    // Validate config ID
    const configIdValidation = validateConfigId(lastConfigId);
    if (!configIdValidation.valid) {
      return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
    }

    // Check if config exists
    const { getConfig, updateUserLastConfig } = await import("../lib/db.server");
    const config = getConfig(userId, lastConfigId);

    if (!config) {
      return notFound("Configuration not found", ErrorCode.CONFIG_NOT_FOUND);
    }

    // Update user's last config preference
    updateUserLastConfig(userId, lastConfigId);

    return ok({
      success: true as const,
      lastConfigId,
      apiVersion: API_VERSION,
    });
  }

  return badRequest("No valid preference fields provided", ErrorCode.VALIDATION_ERROR);
}
