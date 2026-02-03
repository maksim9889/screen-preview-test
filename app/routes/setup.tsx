import { data, Form, redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import type { Route } from "./+types/setup";
import { CSRF_FIELD_NAME } from "../lib/constants";
import { AuthLayout } from "../components/layouts/AuthLayout";
import { FormField } from "../components/molecules/FormField";
import { Button } from "../components/atoms/Button";

export function meta() {
  return [{ title: "Setup - Home Screen Editor" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { needsSetup, validateAuthToken } = await import("../lib/auth.server");
  const { ensureCsrfToken } = await import("../lib/csrf.server");

  // If setup is already done, redirect
  if (!needsSetup()) {
    const cookieHeader = request.headers.get("Cookie");
    const authResult = await validateAuthToken(cookieHeader);

    if (authResult.authenticated) {
      return redirect("/");
    }
    return redirect("/login");
  }

  // Ensure CSRF token exists
  const cookieHeader = request.headers.get("Cookie");
  const { token: csrfToken, setCookie } = ensureCsrfToken(cookieHeader);

  if (setCookie) {
    return data(
      { csrfToken },
      {
        headers: {
          "Set-Cookie": setCookie,
        },
      }
    );
  }

  return { csrfToken };
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  const { needsSetup, register, login, createAuthTokenCookie } = await import("../lib/auth.server");
  const { validateCsrfToken, getCsrfTokenFromFormData } = await import("../lib/csrf.server");
  const { getClientIp, checkLoginRateLimit } = await import("../lib/rate-limit.server");
  const { validateAuthRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { forbidden, badRequest, conflict } = await import("../lib/api-responses.server");
  const { ErrorCode } = await import("../lib/api-types");

  // Only allow setup if no users exist
  if (!needsSetup()) {
    return conflict("Setup already completed", ErrorCode.FORBIDDEN);
  }

  // Validate request size
  const sizeValidation = await validateAuthRequestSize(request);
  if (!sizeValidation.valid) {
    return createPayloadTooLargeResponse(sizeValidation.error);
  }

  const formData = await request.formData();
  const cookieHeader = request.headers.get("Cookie");

  // Validate CSRF token
  const csrfToken = getCsrfTokenFromFormData(formData);
  if (!validateCsrfToken(cookieHeader, csrfToken)) {
    return forbidden("Invalid security token. Please refresh the page.", ErrorCode.INVALID_CSRF);
  }

  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  // Check rate limit
  const clientIp = getClientIp(request);
  const rateLimit = checkLoginRateLimit(clientIp, username);

  if (!rateLimit.allowed) {
    return badRequest(
      `Too many attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
      ErrorCode.VALIDATION_ERROR
    );
  }

  if (password !== confirmPassword) {
    return badRequest("Passwords do not match", ErrorCode.VALIDATION_ERROR);
  }

  try {
    // Register the user (with IP binding for session security)
    await register(username, password, clientIp);

    // Auto-login after registration (with IP binding)
    const loginResult = await login(username, password, clientIp);

    return redirect("/", {
      headers: {
        "Set-Cookie": createAuthTokenCookie(
          loginResult.token,
          loginResult.expiresAt
        ),
      },
    });
  } catch (error) {
    // Handle validation errors from register() or login()
    const message = error instanceof Error ? error.message : "Registration failed";
    return badRequest(message, ErrorCode.VALIDATION_ERROR);
  }
}

// Type alias for action response data
type ActionData = { error: string; code: string; details?: string };

export default function SetupPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthLayout
      title="Welcome!"
      subtitle="Create your admin account to get started"
    >
      <Form method="post" className="flex flex-col gap-5">
        <input type="hidden" name={CSRF_FIELD_NAME} value={loaderData.csrfToken} />

        {actionData?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-sm font-semibold">
            {actionData.error}
          </div>
        )}

        <div>
          <FormField
            label="Username"
            name="username"
            type="text"
            required
            autoFocus
            inputSize="lg"
            className="px-4 py-3"
            placeholder="Enter username"
          />
          <ul className="mt-1.5 text-xs text-slate-500 space-y-0.5 ml-1">
            <li>3-50 characters</li>
            <li>Letters, numbers, and underscores only</li>
          </ul>
        </div>

        <div>
          <FormField
            label="Password"
            name="password"
            type="password"
            required
            inputSize="lg"
            className="px-4 py-3"
            placeholder="Enter password"
          />
          <ul className="mt-1.5 text-xs text-slate-500 space-y-0.5 ml-1">
            <li>At least 8 characters</li>
            <li>At least one uppercase letter (A-Z)</li>
            <li>At least one lowercase letter (a-z)</li>
            <li>At least one number (0-9)</li>
          </ul>
        </div>

        <FormField
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          required
          inputSize="lg"
          className="px-4 py-3"
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </Button>
      </Form>
    </AuthLayout>
  );
}
