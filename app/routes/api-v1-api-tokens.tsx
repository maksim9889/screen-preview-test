import { ErrorCode } from "../lib/api-types";

interface LoaderArgs {
  request: Request;
  params: Record<string, string>;
  context: Record<string, unknown>;
  unstable_pattern?: string;
}

interface ActionArgs {
  request: Request;
  params: Record<string, string>;
  context: Record<string, unknown>;
  unstable_pattern?: string;
}

/**
 * GET /api/v1/api-tokens
 * List all API tokens for the authenticated user (masked)
 *
 * Authentication: Bearer token (API token)
 */
export async function loader({ request }: LoaderArgs) {
  const API_VERSION = "v1";
  const { validateBearerToken } = await import("../lib/auth.server");
  const { listApiTokens } = await import("../lib/db.server");
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

  const tokens = listApiTokens(authResult.userId);

  return ok({
    tokens,
    apiVersion: API_VERSION,
  });
}

/**
 * POST /api/v1/api-tokens
 * Generate a new API token
 *
 * Authentication: Cookie-based (must be logged in via browser)
 * Body: { name: string } - User-defined name for the token
 *
 * Note: Uses cookie auth intentionally - API tokens should only be
 * created from the browser UI, not via API (prevents token escalation).
 *
 * Returns the full token value ONCE - it cannot be retrieved again!
 */
export async function action({ request }: ActionArgs) {
  const API_VERSION = "v1";
  const { validateAuthToken, generateApiToken } = await import("../lib/auth.server");
  const { validateCsrfToken, getCsrfTokenFromFormData } = await import("../lib/csrf.server");
  const { unauthorized, forbidden, badRequest, created, tooManyRequests } = await import("../lib/api-responses.server");
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");

  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (!authResult.authenticated || !authResult.userId) {
    return unauthorized("Authentication required", ErrorCode.UNAUTHORIZED);
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

  const formData = await request.formData();

  // Validate CSRF token
  const csrfToken = getCsrfTokenFromFormData(formData);
  if (!validateCsrfToken(cookieHeader, csrfToken)) {
    return forbidden("Invalid security token", ErrorCode.INVALID_CSRF);
  }

  const name = formData.get("name") as string;

  if (!name || name.trim().length === 0) {
    return badRequest("Token name is required", ErrorCode.MISSING_FIELD);
  }

  if (name.length > 100) {
    return badRequest("Token name must be 100 characters or less", ErrorCode.VALIDATION_ERROR);
  }

  const token = generateApiToken(authResult.userId, name.trim());

  return created({
    success: true as const,
    token: {
      id: token.id,
      name: token.name,
      token: token.token, // Full token - only returned once!
      createdAt: token.createdAt,
    },
    message: "API token created. Save this token now - it cannot be retrieved again!",
    apiVersion: API_VERSION,
  });
}
