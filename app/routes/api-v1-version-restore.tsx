import { validateConfigId } from "../lib/validation";
import { ErrorCode } from "../lib/api-types";

interface ActionArgs {
  request: Request;
  params: { versionNumber: string };
  context: Record<string, unknown>;
  unstable_pattern?: string;
}

/**
 * POST /api/v1/versions/{versionNumber}/restore
 * Restore a configuration to a specific version
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 */
export async function action({ request, params }: ActionArgs) {
  const API_VERSION = "v1";

  const { validateBearerToken } = await import("../lib/auth.server");
  const { restoreConfigVersion, updateLoadedVersion } = await import("../lib/db.server");
  const { validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { unauthorized, badRequest, ok, tooManyRequests } = await import("../lib/api-responses.server");
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

  const sizeValidation = await validateDefaultRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  const formData = await request.formData();

  const configId = (formData.get("configId") as string) || "default";

  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return badRequest(configIdValidation.error!, ErrorCode.INVALID_CONFIG_ID);
  }

  const versionNumber = parseInt(params.versionNumber, 10);

  if (isNaN(versionNumber) || versionNumber < 1) {
    return badRequest("Invalid version number", ErrorCode.VALIDATION_ERROR);
  }

  const success = restoreConfigVersion(userId, configId, versionNumber);

  if (!success) {
    return badRequest("Version not found", ErrorCode.CONFIG_NOT_FOUND);
  }

  updateLoadedVersion(userId, configId, versionNumber);

  return ok({
    success: true as const,
    restoredVersion: versionNumber,
    configId,
    apiVersion: API_VERSION,
  });
}
