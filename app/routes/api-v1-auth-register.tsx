import type { Route } from "./+types/api.v1.auth.register";
import { ErrorCode } from "../lib/api-types";

/**
 * POST /api/v1/auth/register
 * Create a new user account
 */
export async function action({ request }: Route.ActionArgs) {
  const API_VERSION = "v1";
  const { register } = await import("../lib/auth.server");
  const { validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");
  const { created, badRequest, tooManyRequests } = await import("../lib/api-responses.server");

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

  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return badRequest(
      "Username and password are required",
      ErrorCode.VALIDATION_ERROR
    );
  }

  if (username.length < 3 || username.length > 50) {
    return badRequest(
      "Username must be between 3 and 50 characters",
      ErrorCode.VALIDATION_ERROR
    );
  }

  if (password.length < 8) {
    return badRequest(
      "Password must be at least 8 characters",
      ErrorCode.VALIDATION_ERROR
    );
  }

  try {
    const { headers } = await register(username, password, clientIp);

    return created(
      {
        success: true as const,
        message: "Registration successful",
        apiVersion: API_VERSION,
      },
      headers
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Username already exists") {
      return badRequest("Username already exists", ErrorCode.VALIDATION_ERROR);
    }
    return badRequest(
      "Registration failed",
      ErrorCode.VALIDATION_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
}
