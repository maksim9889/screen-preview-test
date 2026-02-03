import type { Route } from "./+types/api.v1.auth.logout";
import { ErrorCode } from "../lib/api-types";

/**
 * POST /api/v1/auth/logout
 * End user session and invalidate authentication token
 *
 * Authentication: Bearer token in Authorization header
 * Example: Authorization: Bearer <token>
 *
 * The token provided in the Authorization header will be invalidated.
 */
export async function action({ request }: Route.ActionArgs) {
  const API_VERSION = "v1";
  const { logout, getBearerToken } = await import("../lib/auth.server");
  const { validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");
  const { unauthorized, ok, tooManyRequests } = await import("../lib/api-responses.server");

  const sizeValidation = await validateDefaultRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  // Check rate limit
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

  // Get token from Bearer header and invalidate it
  const token = getBearerToken(request);
  if (!token) {
    return unauthorized("Missing or invalid Authorization header. Expected: Bearer <token>", ErrorCode.UNAUTHORIZED);
  }

  await logout(token);

  return ok({
    success: true as const,
    message: "Logout successful",
    apiVersion: API_VERSION,
  });
}
