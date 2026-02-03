import { redirect } from "react-router";
import { validateConfigId } from "../lib/validation";
import { sanitizeFilename } from "../lib/request-utils.server";

interface LoaderArgs {
  request: Request;
  params: { configId: string };
  context: Record<string, unknown>;
  unstable_pattern?: string;
}

/**
 * GET /home/export/:configId
 * Export configuration as downloadable JSON file (browser route with cookie auth)
 *
 * Authentication: Cookie-based (auth_token cookie)
 * This is the browser-facing export endpoint. For programmatic API access,
 * use GET /api/v1/configs/:configId/export with Bearer token.
 */
export async function loader({ request, params }: LoaderArgs) {
  const { needsSetup, validateAuthToken } = await import("../lib/auth.server");
  const { getFullConfigRecord } = await import("../lib/db.server");

  // Check if setup is needed
  if (needsSetup()) {
    return redirect("/setup");
  }

  // Validate authentication via cookie
  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (!authResult.authenticated || !authResult.userId) {
    return redirect("/login");
  }

  const { configId } = params;
  const userId = authResult.userId;
  const username = authResult.username || "user";

  // Validate config ID
  const configIdValidation = validateConfigId(configId);
  if (!configIdValidation.valid) {
    return redirect("/home");
  }

  const fullRecord = getFullConfigRecord(userId, configId);

  if (!fullRecord) {
    return redirect("/home");
  }

  const exportData = JSON.stringify(fullRecord, null, 2);
  // Sanitize filename components for defense-in-depth (prevents header injection)
  const safeUsername = sanitizeFilename(username);
  const safeConfigId = sanitizeFilename(configId);
  const filename = `config-export-${safeUsername}-${safeConfigId}-${new Date().toISOString().split('T')[0]}.json`;

  return new Response(exportData, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
