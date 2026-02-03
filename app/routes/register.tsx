import { data, Form, redirect, useActionData, useNavigation, useLoaderData } from "react-router";
import type { Route } from "./+types/register";
import { CSRF_FIELD_NAME } from "../lib/constants";
import { AuthLayout } from "../components/layouts/AuthLayout";
import { FormField } from "../components/molecules/FormField";
import { Button } from "../components/atoms/Button";

export function meta() {
  return [{ title: "Register - Home Screen Editor" }];
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
  const { register, createAuthTokenCookie, getClientIp } = await import("../lib/auth.server");
  const { validateCsrfToken, getCsrfTokenFromFormData } = await import("../lib/csrf.server");
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
  const confirmPassword = formData.get("confirmPassword") as string;

  // Validate username
  if (!username || username.trim().length < 3) {
    return badRequest("Username must be at least 3 characters long", ErrorCode.VALIDATION_ERROR);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return badRequest("Username can only contain letters, numbers, hyphens, and underscores", ErrorCode.VALIDATION_ERROR);
  }

  // Validate password
  if (!password || password.length < 8) {
    return badRequest("Password must be at least 8 characters long", ErrorCode.VALIDATION_ERROR);
  }

  // Validate password confirmation
  if (password !== confirmPassword) {
    return badRequest("Passwords do not match", ErrorCode.VALIDATION_ERROR);
  }

  const clientIp = getClientIp(request);

  try {
    const result = await register(username, password, clientIp);

    // Redirect to home page with auth cookie
    return redirect("/", {
      headers: {
        "Set-Cookie": createAuthTokenCookie(result.token, result.expiresAt),
      },
    });
  } catch (error) {
    // Handle validation errors from register()
    const message = error instanceof Error ? error.message : "Registration failed";
    return badRequest(message, ErrorCode.VALIDATION_ERROR);
  }
}

// Type alias for action response data
type ActionData = { error: string; code: string; details?: string };

export default function RegisterPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <AuthLayout title="Home Screen Editor" subtitle="Create your account">
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
          placeholder="Re-enter password"
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

        <div className="text-center text-sm text-gray-600 mt-2">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </a>
        </div>
      </Form>
    </AuthLayout>
  );
}
