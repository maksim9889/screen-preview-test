import { ErrorCode } from "../lib/api-types";

interface ActionArgs {
  request: Request;
  params: { tokenId: string };
  context: Record<string, unknown>;
  unstable_pattern?: string;
}

/**
 * DELETE /api/v1/api-tokens/:tokenId
 * Revoke an API token
 *
 * Authentication: Bearer token (API token)
 * Note: Allows programmatic token revocation. A token can revoke itself or other tokens.
 */
export async function action({ request, params }: ActionArgs) {
  const API_VERSION = "v1";

  // Only allow DELETE method
  if (request.method !== "DELETE") {
    const { badRequest } = await import("../lib/api-responses.server");
    return badRequest("Method not allowed. Use DELETE.", ErrorCode.VALIDATION_ERROR);
  }

  const { validateBearerToken } = await import("../lib/auth.server");
  const { deleteApiToken } = await import("../lib/db.server");
  const { unauthorized, notFound, ok, tooManyRequests } = await import("../lib/api-responses.server");
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

  const { tokenId } = params;

  if (!tokenId) {
    return notFound("Token ID is required", ErrorCode.MISSING_FIELD);
  }

  const tokenIdNum = parseInt(tokenId, 10);
  if (isNaN(tokenIdNum)) {
    return notFound("Invalid token ID", ErrorCode.VALIDATION_ERROR);
  }

  const deleted = deleteApiToken(tokenIdNum, authResult.userId);

  if (!deleted) {
    return notFound("Token not found or already deleted", ErrorCode.NOT_FOUND);
  }

  return ok({
    success: true as const,
    message: "API token revoked",
    apiVersion: API_VERSION,
  });
}
