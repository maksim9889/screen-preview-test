import { data, Form, redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import type { Route } from "./+types/login";
import { CSRF_FIELD_NAME } from "../lib/constants";
import { AuthLayout } from "../components/layouts/AuthLayout";
import { FormField } from "../components/molecules/FormField";
import { Button } from "../components/atoms/Button";

export function meta() {
  return [{ title: "Login - Home Screen Editor" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { needsSetup, validateAuthToken } = await import("../lib/auth.server");
  const { ensureCsrfToken } = await import("../lib/csrf.server");

  // Check if setup is needed
  if (needsSetup()) {
    return redirect("/setup");
  }

  // Check if already logged in
  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (authResult.authenticated) {
    return redirect("/");
  }

  // Ensure CSRF token exists
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
  const { login, createAuthTokenCookie } = await import("../lib/auth.server");
  const { validateCsrfToken, getCsrfTokenFromFormData } = await import("../lib/csrf.server");
  const { getClientIp, checkLoginRateLimit, resetLoginRateLimit } = await import("../lib/rate-limit.server");
  const { validateAuthRequestSize, createPayloadTooLargeResponse } = await import("../lib/request-size.server");
  const { forbidden, badRequest } = await import("../lib/api-responses.server");
  const { ErrorCode } = await import("../lib/api-types");

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

  // Check rate limit
  const clientIp = getClientIp(request);
  const rateLimit = checkLoginRateLimit(clientIp, username);

  if (!rateLimit.allowed) {
    return badRequest(
      `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
      ErrorCode.VALIDATION_ERROR
    );
  }

  try {
    const result = await login(username, password, clientIp);

    // Reset rate limit on successful login
    resetLoginRateLimit(clientIp, username);

    // Get user's last viewed configuration
    const { getUserById, updateUserLastConfig } = await import("../lib/db.server");
    const user = getUserById(result.userId);
    const lastConfigId = user?.last_config_id || "default";

    // Ensure user's last config is set
    updateUserLastConfig(result.userId!, lastConfigId);

    // Redirect to home
    return redirect("/", {
      headers: {
        "Set-Cookie": createAuthTokenCookie(result.token!, result.expiresAt!),
      },
    });
  } catch (error) {
    // Handle login errors gracefully
    const { unauthorized } = await import("../lib/api-responses.server");
    return unauthorized("Invalid username or password", ErrorCode.INVALID_CREDENTIALS);
  }
}

// Type alias for action response data
type ActionData = { error: string; code: string; details?: string };

export default function LoginPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthLayout title="Home Screen Editor" subtitle="Sign in to continue">
      <Form method="post" className="flex flex-col gap-5">
        <input type="hidden" name={CSRF_FIELD_NAME} value={loaderData.csrfToken} />

        {actionData?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-sm font-semibold">
            {actionData.error}
          </div>
        )}

        <FormField
          label="Username"
          name="username"
          type="text"
          required
          autoFocus
          inputSize="lg"
          className="px-4 py-3"
        />

        <FormField
          label="Password"
          name="password"
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
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>

        <div className="text-center text-sm text-gray-600 mt-2">
          Don't have an account?{" "}
          <a href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
            Create one
          </a>
        </div>
      </Form>
    </AuthLayout>
  );
}
