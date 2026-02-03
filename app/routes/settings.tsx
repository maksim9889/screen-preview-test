import { useState, useEffect } from "react";
import { data, redirect, useLoaderData, useFetcher, Link } from "react-router";
import type { Route } from "./+types/settings";
import { CSRF_FIELD_NAME } from "../lib/constants";
import { Button } from "../components/atoms/Button";
import { FormField } from "../components/molecules/FormField";
import { Modal } from "../components/molecules/Modal";
import { MaterialIcon } from "../components/atoms/MaterialIcon";

export function meta() {
  return [{ title: "Settings - Home Screen Editor" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { needsSetup, validateAuthToken } = await import("../lib/auth.server");
  const { ensureCsrfToken } = await import("../lib/csrf.server");
  const { listApiTokens } = await import("../lib/db.server");

  // Check if setup is needed
  if (needsSetup()) {
    return redirect("/setup");
  }

  // Validate authentication token
  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (!authResult.authenticated || !authResult.userId) {
    return redirect("/login");
  }

  // Load existing API tokens
  const tokens = listApiTokens(authResult.userId);

  // Ensure CSRF token exists
  const { token: csrfToken, setCookie } = ensureCsrfToken(cookieHeader);

  if (setCookie) {
    return data(
      {
        username: authResult.username,
        tokens,
        csrfToken,
      },
      {
        headers: {
          "Set-Cookie": setCookie,
        },
      }
    );
  }

  return {
    username: authResult.username,
    tokens,
    csrfToken,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { validateAuthToken, generateApiToken } = await import("../lib/auth.server");
  const { validateCsrfToken, getCsrfTokenFromFormData } = await import("../lib/csrf.server");
  const { deleteApiToken } = await import("../lib/db.server");

  // Validate authentication
  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (!authResult.authenticated || !authResult.userId) {
    return data({ error: "Authentication required", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // Validate request size to prevent DoS attacks
  const { validateAuthRequestSize } = await import("../lib/request-size.server");
  const sizeValidation = await validateAuthRequestSize(request);
  if (!sizeValidation.valid) {
    return data(
      { error: sizeValidation.error, code: "PAYLOAD_TOO_LARGE" },
      { status: 413 }
    );
  }

  const formData = await request.formData();

  // Validate CSRF token
  const csrfToken = getCsrfTokenFromFormData(formData);
  if (!validateCsrfToken(cookieHeader, csrfToken)) {
    return data(
      { error: "Invalid security token. Please refresh the page.", code: "INVALID_CSRF" },
      { status: 403 }
    );
  }

  const intent = formData.get("intent") as string;

  // Handle create token
  if (intent === "createToken") {
    const name = formData.get("name") as string;

    if (!name || name.trim().length === 0) {
      return data({ error: "Token name is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    if (name.length > 100) {
      return data({ error: "Token name must be 100 characters or less", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const token = generateApiToken(authResult.userId, name.trim());

    return data({
      success: true,
      intent: "createToken",
      token: {
        id: token.id,
        name: token.name,
        token: token.token, // Full token - only returned once!
        createdAt: token.createdAt,
      },
    });
  }

  // Handle delete token
  if (intent === "deleteToken") {
    const tokenId = formData.get("tokenId") as string;

    if (!tokenId) {
      return data({ error: "Token ID is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    const tokenIdNum = parseInt(tokenId, 10);
    if (isNaN(tokenIdNum)) {
      return data({ error: "Invalid token ID", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const deleted = deleteApiToken(tokenIdNum, authResult.userId);

    if (!deleted) {
      return data({ error: "Token not found or already deleted", code: "NOT_FOUND" }, { status: 404 });
    }

    return data({
      success: true,
      intent: "deleteToken",
      deletedTokenId: tokenIdNum,
    });
  }

  return data({ error: "Unknown intent", code: "INVALID_INTENT" }, { status: 400 });
}

interface ApiToken {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  tokenPreview: string;
}

interface NewlyCreatedToken {
  id: number;
  name: string;
  token: string;
  createdAt: string;
}

/**
 * Type definitions for action responses
 * Used to properly type fetcher.data instead of using 'as any'
 */
type ActionSuccessCreateToken = {
  success: true;
  intent: "createToken";
  token: NewlyCreatedToken;
};

type ActionSuccessDeleteToken = {
  success: true;
  intent: "deleteToken";
  deletedTokenId: number;
};

type ActionError = {
  error: string;
  code: string;
};

type ActionData = ActionSuccessCreateToken | ActionSuccessDeleteToken | ActionError;

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  } else {
    return "Just now";
  }
}

export default function SettingsPage() {
  const { username, tokens: initialTokens, csrfToken } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [tokenName, setTokenName] = useState("");
  const [tokens, setTokens] = useState<ApiToken[]>(initialTokens);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<NewlyCreatedToken | null>(null);
  const [copied, setCopied] = useState(false);

  const isSubmitting = fetcher.state === "submitting";

  // Handle fetcher responses
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const result = fetcher.data as ActionData;

      if ("success" in result && result.success) {
        if (result.intent === "createToken") {
          // Show the token modal
          setNewlyCreatedToken(result.token);
          setTokenName("");

          // Add to tokens list (with preview instead of full token)
          const newToken: ApiToken = {
            id: result.token.id,
            name: result.token.name,
            createdAt: result.token.createdAt,
            lastUsedAt: null,
            tokenPreview: result.token.token.slice(0, 8) + "..." + result.token.token.slice(-4),
          };
          setTokens((prev) => [newToken, ...prev]);
        }

        if (result.intent === "deleteToken") {
          // Remove from tokens list
          setTokens((prev) => prev.filter((t) => t.id !== result.deletedTokenId));
        }
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleCreateToken = () => {
    if (!tokenName.trim()) return;

    fetcher.submit(
      {
        intent: "createToken",
        name: tokenName.trim(),
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleDeleteToken = (tokenId: number) => {
    fetcher.submit(
      {
        intent: "deleteToken",
        tokenId: tokenId.toString(),
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleCopyToken = async () => {
    if (newlyCreatedToken) {
      await navigator.clipboard.writeText(newlyCreatedToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseModal = () => {
    setNewlyCreatedToken(null);
    setCopied(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <MaterialIcon icon="arrow_back" size="small" />
              <span className="text-sm font-medium">Back to Editor</span>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
            <span className="text-sm text-gray-500">{username}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* API Tokens Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">API Tokens</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create tokens to access the API programmatically. Tokens are shown only once when created.
            </p>
          </div>

          {/* Create Token Form */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Create New Token</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <FormField
                  label=""
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Token name (e.g., CI/CD, Local Dev)"
                  inputSize="md"
                  maxLength={100}
                  disabled={isSubmitting}
                />
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleCreateToken}
                disabled={!tokenName.trim() || isSubmitting}
                className="whitespace-nowrap h-[38px]"
              >
                {isSubmitting ? "Creating..." : "Create Token"}
              </Button>
            </div>
          </div>

          {/* Tokens List */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Your Tokens</h3>

            {tokens.length === 0 ? (
              <div className="text-center py-8">
                <MaterialIcon icon="key_off" size="large" className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No API tokens yet</p>
                <p className="text-xs text-gray-400 mt-1">Create a token to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Token</th>
                      <th className="pb-3 pr-4">Created</th>
                      <th className="pb-3 pr-4">Last Used</th>
                      <th className="pb-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tokens.map((token) => (
                      <tr key={token.id} className="group">
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-900 text-sm">{token.name}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
                            {token.tokenPreview}
                          </code>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm text-gray-500">
                            {formatRelativeTime(token.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm text-gray-500">
                            {token.lastUsedAt ? formatRelativeTime(token.lastUsedAt) : "Never"}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleDeleteToken(token.id)}
                            disabled={isSubmitting}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Revoke token"
                          >
                            <MaterialIcon icon="delete" size="small" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {fetcher.data && 'error' in fetcher.data && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 text-sm">
            {(fetcher.data as ActionError).error}
          </div>
        )}
      </div>

      {/* Token Created Modal */}
      <Modal
        isOpen={!!newlyCreatedToken}
        onClose={handleCloseModal}
        title="Token Created Successfully"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <MaterialIcon icon="warning" size="small" className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Make sure to copy your token now. You won't be able to see it again!
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Your API Token
            </label>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-gray-100 rounded-lg text-sm font-mono text-gray-900 break-all select-all">
                {newlyCreatedToken?.token}
              </code>
              <Button
                variant={copied ? "success" : "secondary"}
                size="md"
                onClick={handleCopyToken}
                className="flex-shrink-0"
              >
                <MaterialIcon icon={copied ? "check" : "content_copy"} size="small" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="md" onClick={handleCloseModal}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
