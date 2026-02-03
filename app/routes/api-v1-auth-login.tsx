import type { Route } from "./+types/api.v1.auth.login";
import { ErrorCode } from "../lib/api-types";

/**
 * POST /api/v1/auth/login
 * Authenticate user and create session
 */
export async function action({ request }: Route.ActionArgs) {
  const API_VERSION = "v1";
  const { login } = await import("../lib/auth.server");
  const { checkLoginRateLimit, resetLoginRateLimit, getClientIp } = await import("../lib/rate-limit.server");
  const { validateDefaultRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { unauthorized, ok, tooManyRequests, badRequest } = await import("../lib/api-responses.server");

  const sizeValidation = await validateDefaultRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  const formData = await request.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return badRequest(
      "Username and password are required",
      ErrorCode.MISSING_FIELD
    );
  }

  const ipAddress = getClientIp(request);

  // Check rate limit
  const rateLimit = checkLoginRateLimit(ipAddress, username);
  if (!rateLimit.allowed) {
    return tooManyRequests(
      "Too many login attempts. Please try again later.",
      ErrorCode.RATE_LIMIT_EXCEEDED
    );
  }

  try {
    const { headers } = await login(username, password, ipAddress);

    // Reset rate limit on successful login
    resetLoginRateLimit(ipAddress, username);

    return ok(
      {
        success: true as const,
        message: "Login successful",
        apiVersion: API_VERSION,
      },
      headers
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials") {
      return unauthorized(
        "Invalid username or password",
        ErrorCode.INVALID_CREDENTIALS
      );
    }

    return badRequest(
      "Login failed",
      ErrorCode.VALIDATION_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
}
