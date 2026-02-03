/**
 * OpenAPI 3.0 Specification for Home Screen Editor API
 *
 * MAINTENANCE NOTE:
 * This specification is manually maintained alongside the TypeScript types in api-types.ts.
 * When updating API contracts:
 * 1. Update TypeScript types in api-types.ts (source of truth for code)
 * 2. Update this OpenAPI spec (source of truth for documentation)
 * 3. Run the sync validation test: npm test -- openapi-sync
 *
 * Future consideration: Use zod-to-openapi or similar to generate this spec
 * automatically from runtime validation schemas.
 *
 * @see api-types.ts for TypeScript interface definitions
 * @see validation.ts for runtime validation logic
 */

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Home Screen Editor API",
    version: "1.0.0",
    description: `REST API for managing home screen configurations with versioning, import/export, and multi-config support.

## API Architecture

The API has two layers:

### Page Routes (Browser-facing)
- \`/\`, \`/login\`, \`/setup\` - Server-rendered pages
- Use cookie-based authentication (HttpOnly auth_token)
- Browser clients use these via form submissions

### REST API (External Access)
- \`/api/v1/*\` - Programmatic API endpoints
- Use Bearer token authentication: \`Authorization: Bearer <token>\`
- Intended for CLI tools, scripts, mobile apps, external integrations

## Token Types

The API uses two separate token types for security:

### Session Tokens (Browser)
- Created on login, stored in HttpOnly cookie
- Short-lived (7 days), bound to IP address
- Used automatically by browser via cookies
- Cannot be used as Bearer tokens

### API Tokens (Programmatic Access)
- Generated via \`POST /api/v1/api-tokens\` (requires browser login)
- Long-lived, not bound to IP
- Used as Bearer token: \`Authorization: Bearer <token>\`
- Can be revoked via \`DELETE /api/v1/api-tokens/:id\`

## Authentication Flow

1. Login via browser to create session
2. Generate API token: \`POST /api/v1/api-tokens\` with token name
3. Save the returned token (shown only once!)
4. Use token in API requests: \`Authorization: Bearer <token>\`
5. Revoke when needed: \`DELETE /api/v1/api-tokens/:id\``,
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:5175",
      description: "Development server",
    },
  ],
  tags: [
    {
      name: "Authentication",
      description: "User authentication and session management",
    },
    {
      name: "API Tokens",
      description: "Manage API tokens for programmatic access. Tokens are created/revoked via browser (cookie auth) to prevent token escalation attacks.",
    },
    {
      name: "User",
      description: "User preferences and settings",
    },
    {
      name: "Configuration",
      description: "Configuration management operations",
    },
    {
      name: "Versioning",
      description: "Configuration version control",
    },
    {
      name: "Import/Export",
      description: "Configuration import and export",
    },
  ],
  paths: {
    "/login": {
      post: {
        tags: ["Authentication"],
        summary: "User login",
        description: "Authenticate user and create session",
        operationId: "login",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["username", "password", "csrf_token"],
                properties: {
                  username: {
                    type: "string",
                    description: "Username",
                    example: "admin",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    description: "Password",
                    minLength: 8,
                  },
                  csrf_token: {
                    type: "string",
                    description: "CSRF protection token",
                  },
                },
              },
            },
          },
        },
        responses: {
          "302": {
            description: "Login successful, redirecting to last viewed configuration",
            headers: {
              "Set-Cookie": {
                description: "Authentication token cookie",
                schema: {
                  type: "string",
                  example: "auth_token=abc123; HttpOnly; Secure; SameSite=Strict",
                },
              },
              Location: {
                description: "Redirect URL to user's last configuration",
                schema: {
                  type: "string",
                  example: "/?config=mobile",
                },
              },
            },
          },
          "400": {
            description: "Validation error or rate limit exceeded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  rateLimitExceeded: {
                    summary: "Rate limit exceeded",
                    value: {
                      error: "Too many login attempts. Please try again in 60 seconds.",
                      code: "VALIDATION_ERROR",
                    },
                  },
                  invalidCredentials: {
                    summary: "Invalid credentials",
                    value: {
                      error: "Invalid username or password",
                      code: "UNAUTHORIZED",
                    },
                  },
                },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "413": {
            description: "Request payload too large",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/setup": {
      post: {
        tags: ["Authentication"],
        summary: "Initial setup",
        description: "Create the first admin user (only available when no users exist)",
        operationId: "setup",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["username", "password", "confirmPassword", "csrf_token"],
                properties: {
                  username: {
                    type: "string",
                    description: "Admin username",
                    minLength: 3,
                    example: "admin",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    description: "Admin password",
                    minLength: 8,
                  },
                  confirmPassword: {
                    type: "string",
                    format: "password",
                    description: "Password confirmation",
                    minLength: 8,
                  },
                  csrf_token: {
                    type: "string",
                    description: "CSRF protection token",
                  },
                },
              },
            },
          },
        },
        responses: {
          "302": {
            description: "Setup successful, user created and logged in",
            headers: {
              "Set-Cookie": {
                schema: { type: "string" },
              },
              Location: {
                schema: { type: "string", example: "/" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Setup already completed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/": {
      get: {
        tags: ["Configuration"],
        summary: "Load configuration",
        description: "Load a specific configuration or the user's last viewed configuration",
        operationId: "loadConfig",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "config",
            in: "query",
            description: "Configuration ID to load",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
              example: "mobile",
            },
          },
        ],
        responses: {
          "200": {
            description: "Configuration loaded successfully",
            content: {
              "text/html": {
                schema: {
                  type: "string",
                  description: "HTML page with embedded configuration data",
                },
              },
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    username: { type: "string" },
                    configId: { type: "string" },
                    config: { $ref: "#/components/schemas/AppConfig" },
                    csrfToken: { type: "string" },
                    versions: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ConfigVersion" },
                    },
                    latestVersionNumber: { type: "integer" },
                    allConfigs: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ConfigListItem" },
                    },
                  },
                },
              },
            },
          },
          "302": {
            description: "Redirecting to login or default config",
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Login user",
        description: "Authenticate user credentials and create session",
        operationId: "loginV1",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            headers: {
              "Set-Cookie": {
                description: "Authentication cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "message", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    message: { type: "string", example: "Login successful" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Too many login attempts",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register new user",
        description: "Create a new user account",
        operationId: "registerV1",
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: {
                    type: "string",
                    minLength: 3,
                    maxLength: 50,
                  },
                  password: {
                    type: "string",
                    format: "password",
                    minLength: 8,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Registration successful",
            headers: {
              "Set-Cookie": {
                description: "Authentication cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "message", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    message: { type: "string", example: "Registration successful" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error or username already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Too many requests",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Logout user",
        description: "End user session and clear authentication",
        operationId: "logoutV1",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["csrf_token"],
                properties: {
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Logout successful",
            headers: {
              "Set-Cookie": {
                description: "Cleared authentication cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "message", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    message: { type: "string", example: "Logout successful" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Too many requests",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/user/preferences": {
      patch: {
        tags: ["User"],
        summary: "Update user preferences",
        description: "Update user preferences such as last viewed configuration. Used for switching between configs.",
        operationId: "updateUserPreferencesV1",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["csrf_token"],
                properties: {
                  lastConfigId: {
                    type: "string",
                    description: "Configuration ID to set as last viewed",
                    pattern: "^[a-zA-Z0-9_-]{1,50}$",
                    example: "mobile",
                  },
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Preferences updated successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "lastConfigId", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    lastConfigId: {
                      type: "string",
                      description: "Updated last config ID",
                    },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/api-tokens": {
      get: {
        tags: ["API Tokens"],
        summary: "List API tokens",
        description: "List all API tokens for the authenticated user. Token values are masked for security - only a preview is shown.",
        operationId: "listApiTokensV1",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Tokens listed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tokens", "apiVersion"],
                  properties: {
                    tokens: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["id", "name", "createdAt", "tokenPreview"],
                        properties: {
                          id: { type: "integer", description: "Token ID" },
                          name: { type: "string", description: "User-defined token name" },
                          createdAt: { type: "string", format: "date-time" },
                          lastUsedAt: { type: "string", format: "date-time", nullable: true },
                          tokenPreview: { type: "string", description: "Masked token preview (e.g., 'abc123...xyz')" },
                        },
                      },
                    },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid or missing API token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["API Tokens"],
        summary: "Create API token (Browser only)",
        description: "Generate a new API token. **Requires browser login (cookie auth)** - cannot be called with Bearer token to prevent token escalation attacks. The full token value is returned ONCE - save it immediately.",
        operationId: "createApiTokenV1",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["name", "csrf_token"],
                properties: {
                  name: {
                    type: "string",
                    description: "User-defined name for the token (e.g., 'CI/CD Pipeline', 'Mobile App')",
                    maxLength: 100,
                    example: "My Script Token",
                  },
                  csrf_token: { type: "string", description: "CSRF protection token" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Token created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "token", "message", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    token: {
                      type: "object",
                      required: ["id", "name", "token", "createdAt"],
                      properties: {
                        id: { type: "integer" },
                        name: { type: "string" },
                        token: { type: "string", description: "Full token value - SAVE THIS! Only shown once." },
                        createdAt: { type: "string", format: "date-time" },
                      },
                    },
                    message: { type: "string" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error (missing or invalid name)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required (must be logged in via browser)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/api-tokens/{tokenId}": {
      delete: {
        tags: ["API Tokens"],
        summary: "Revoke API token",
        description: "Delete/revoke an API token. A token can revoke itself or any other token belonging to the same user.",
        operationId: "deleteApiTokenV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "tokenId",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "ID of the token to revoke",
          },
        ],
        responses: {
          "200": {
            description: "Token revoked successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "message", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    message: { type: "string" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid or missing API token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Token not found or already deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/configs": {
      get: {
        tags: ["Configuration"],
        summary: "List all configurations",
        description: "Get all configurations for the authenticated user",
        operationId: "listConfigsV1",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Configurations listed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["configs", "apiVersion"],
                  properties: {
                    configs: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["configId", "schemaVersion", "apiVersion", "updatedAt"],
                        properties: {
                          configId: { type: "string" },
                          schemaVersion: { type: "integer" },
                          apiVersion: { type: "string" },
                          updatedAt: { type: "string", format: "date-time" },
                          loadedVersion: { type: "integer", nullable: true },
                        },
                      },
                    },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Configuration"],
        summary: "Create a new configuration",
        description: "Create a new configuration. Returns 409 if configuration already exists.",
        operationId: "createConfigV1",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["config", "configId", "csrf_token"],
                properties: {
                  config: {
                    type: "string",
                    description: "JSON-stringified AppConfig",
                  },
                  configId: {
                    type: "string",
                    pattern: "^[a-zA-Z0-9_-]{1,50}$",
                  },
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Configuration created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "savedAt", "configId", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    savedAt: { type: "string", format: "date-time" },
                    configId: { type: "string" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Configuration already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: "Configuration already exists. Use PUT to update.",
                  code: "CONFIG_ALREADY_EXISTS",
                },
              },
            },
          },
          "413": {
            description: "Request payload too large",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/configs/import": {
      post: {
        tags: ["Import/Export"],
        summary: "Import configuration",
        description: "Import a configuration from exported JSON file. Supports schema migration. The configuration is imported to the currently authenticated user's account, regardless of the user_id in the import file.",
        operationId: "importConfigV1",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["importData", "csrf_token"],
                properties: {
                  importData: {
                    type: "string",
                    description: "JSON-stringified export data (includes config_id, schemaVersion, updatedAt, data)",
                  },
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Configuration imported successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "imported", "importedAt", "configId", "config", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    imported: { type: "boolean", enum: [true] },
                    importedAt: { type: "string", format: "date-time" },
                    configId: { type: "string" },
                    config: { $ref: "#/components/schemas/AppConfig" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid import file or validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                examples: {
                  invalidFile: {
                    value: {
                      error: "Invalid import file: missing required fields",
                      code: "INVALID_IMPORT_FILE",
                    },
                  },
                  invalidConfig: {
                    value: {
                      error: "Invalid configuration in import",
                      code: "INVALID_CONFIG_DATA",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "413": {
            description: "Request payload too large",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/configs/{configId}": {
      get: {
        tags: ["Configuration"],
        summary: "Get a specific configuration",
        description: "Retrieve a configuration by ID",
        operationId: "getConfigV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
        ],
        responses: {
          "200": {
            description: "Configuration retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["configId", "config", "apiVersion"],
                  properties: {
                    configId: { type: "string" },
                    config: { $ref: "#/components/schemas/AppConfig" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid configuration ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Configuration"],
        summary: "Update an existing configuration",
        description: "Update a configuration. Returns 404 if configuration doesn't exist. Supports optimistic concurrency via expectedUpdatedAt parameter.",
        operationId: "updateConfigV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["config", "csrf_token"],
                properties: {
                  config: {
                    type: "string",
                    description: "JSON-stringified AppConfig",
                  },
                  createVersion: {
                    type: "string",
                    description: "Set to 'true' to create a version snapshot after saving",
                    enum: ["true", "false"],
                  },
                  expectedUpdatedAt: {
                    type: "string",
                    format: "date-time",
                    description: "For optimistic concurrency: the updatedAt value from your last GET. If provided and doesn't match, returns 409 Conflict.",
                  },
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Configuration updated successfully. If createVersion=true, also includes version metadata.",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      required: ["success", "savedAt", "configId", "apiVersion"],
                      properties: {
                        success: { type: "boolean", enum: [true] },
                        savedAt: { type: "string", format: "date-time" },
                        configId: { type: "string" },
                        apiVersion: { type: "string", example: "v1" },
                      },
                    },
                    {
                      type: "object",
                      required: ["success", "savedAt", "versionCreated", "versionNumber", "versions", "latestVersionNumber", "configId", "apiVersion"],
                      properties: {
                        success: { type: "boolean", enum: [true] },
                        savedAt: { type: "string", format: "date-time" },
                        versionCreated: { type: "boolean", enum: [true] },
                        versionNumber: { type: "integer" },
                        versions: {
                          type: "array",
                          items: { $ref: "#/components/schemas/ConfigVersion" },
                        },
                        latestVersionNumber: { type: "integer" },
                        configId: { type: "string" },
                        apiVersion: { type: "string", example: "v1" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: "Configuration not found. Use POST to create.",
                  code: "CONFIG_NOT_FOUND",
                },
              },
            },
          },
          "409": {
            description: "Optimistic concurrency conflict - configuration was modified since last read",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: "Configuration has been modified by another request. Please refresh and try again.",
                  code: "STALE_DATA",
                  details: "Expected: 2024-01-15T10:00:00Z, Current: 2024-01-15T10:05:00Z",
                  requestId: "550e8400-e29b-41d4-a716-446655440000",
                },
              },
            },
          },
          "413": {
            description: "Request payload too large",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Configuration"],
        summary: "Restore configuration to a version",
        description: "Restore a configuration to a specific version using loadedVersion parameter",
        operationId: "patchConfigV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["loadedVersion", "csrf_token"],
                properties: {
                  loadedVersion: {
                    type: "string",
                    description: "Version number to restore (as string)",
                    example: "1",
                  },
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Version restored successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "restored", "restoredVersion", "config", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    restored: { type: "boolean", enum: [true] },
                    restoredVersion: { type: "integer" },
                    config: { $ref: "#/components/schemas/AppConfig" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Version not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/configs/{configId}/export": {
      get: {
        tags: ["Import/Export"],
        summary: "Export configuration",
        description: "Export configuration as downloadable JSON file with metadata",
        operationId: "exportConfigV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID to export",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
        ],
        responses: {
          "200": {
            description: "Configuration exported successfully",
            headers: {
              "Content-Type": {
                schema: {
                  type: "string",
                  example: "application/json",
                },
              },
              "Content-Disposition": {
                schema: {
                  type: "string",
                  example: 'attachment; filename="config-export-username-configId-2026-01-31.json"',
                },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["config_id", "schemaVersion", "updatedAt", "data"],
                  properties: {
                    config_id: {
                      type: "string",
                      description: "Configuration ID",
                    },
                    schemaVersion: {
                      type: "string",
                      description: "Schema version",
                      example: "1.0",
                    },
                    updatedAt: {
                      type: "string",
                      format: "date-time",
                      description: "Last update timestamp",
                    },
                    data: {
                      $ref: "#/components/schemas/AppConfig",
                      description: "Full configuration data",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid configuration ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/configs/{configId}/versions": {
      get: {
        tags: ["Versioning"],
        summary: "List configuration versions",
        description: "Get all versions for a specific configuration",
        operationId: "listVersionsV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
        ],
        responses: {
          "200": {
            description: "Versions listed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["configId", "versions", "apiVersion"],
                  properties: {
                    configId: { type: "string" },
                    versions: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["id", "version", "createdAt", "data"],
                        properties: {
                          id: { type: "integer" },
                          version: { type: "integer" },
                          createdAt: { type: "string", format: "date-time" },
                          data: { $ref: "#/components/schemas/AppConfig" },
                        },
                      },
                    },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid configuration ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Versioning"],
        summary: "Create version snapshot",
        description: "Create a new version snapshot of the current configuration",
        operationId: "createVersionV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                required: ["csrf_token"],
                properties: {
                  csrf_token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Version created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "versionNumber", "configId", "apiVersion"],
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    versionNumber: { type: "integer" },
                    configId: { type: "string" },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "403": {
            description: "CSRF token validation failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/configs/{configId}/versions/{versionNumber}": {
      get: {
        tags: ["Versioning"],
        summary: "Get a specific version",
        description: "Retrieve a specific version of a configuration",
        operationId: "getVersionV1",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "configId",
            in: "path",
            required: true,
            description: "Configuration ID",
            schema: {
              type: "string",
              pattern: "^[a-zA-Z0-9_-]{1,50}$",
            },
          },
          {
            name: "versionNumber",
            in: "path",
            required: true,
            description: "Version number",
            schema: {
              type: "integer",
              minimum: 1,
            },
          },
        ],
        responses: {
          "200": {
            description: "Version retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["configId", "version", "apiVersion"],
                  properties: {
                    configId: { type: "string" },
                    version: {
                      type: "object",
                      required: ["id", "version", "createdAt", "data"],
                      properties: {
                        id: { type: "integer" },
                        version: { type: "integer" },
                        createdAt: { type: "string", format: "date-time" },
                        data: { $ref: "#/components/schemas/AppConfig" },
                      },
                    },
                    apiVersion: { type: "string", example: "v1" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid configuration ID or version number",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Authentication required",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Configuration or version not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "auth_token",
        description: "Session cookie set during browser login. Used for browser-based operations including API token management. Session tokens are IP-bound and cannot be used as Bearer tokens.",
      },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API token authentication for programmatic access. Generate tokens via POST /api/v1/api-tokens (requires browser login first). API tokens are long-lived and not IP-bound.",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error", "code"],
        properties: {
          error: {
            type: "string",
            description: "Human-readable error message",
            example: "Configuration not found",
          },
          code: {
            type: "string",
            description: "Machine-readable error code",
            enum: [
              "UNAUTHORIZED",
              "INVALID_TOKEN",
              "SESSION_EXPIRED",
              "INVALID_CREDENTIALS",
              "FORBIDDEN",
              "INVALID_CSRF",
              "VALIDATION_ERROR",
              "INVALID_CONFIG_ID",
              "INVALID_CONFIG_DATA",
              "INVALID_VERSION_NUMBER",
              "INVALID_IMPORT_FILE",
              "MISSING_FIELD",
              "NOT_FOUND",
              "CONFIG_NOT_FOUND",
              "VERSION_NOT_FOUND",
              "USER_NOT_FOUND",
              "TOKEN_NOT_FOUND",
              "CONFIG_ALREADY_EXISTS",
              "USERNAME_TAKEN",
              "STALE_DATA",
              "PAYLOAD_TOO_LARGE",
              "RATE_LIMIT_EXCEEDED",
              "INTERNAL_ERROR",
              "UNKNOWN_ACTION",
            ],
            example: "CONFIG_NOT_FOUND",
          },
          details: {
            type: "string",
            description: "Optional additional details about the error",
            example: "Config ID 'nonexistent' does not exist for user",
          },
          requestId: {
            type: "string",
            format: "uuid",
            description: "Unique request ID for tracing and debugging",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
        },
      },
      AppConfig: {
        type: "object",
        required: ["carousel", "textSection", "cta"],
        properties: {
          carousel: {
            type: "object",
            required: ["images", "aspectRatio"],
            properties: {
              images: {
                type: "array",
                items: {
                  type: "string",
                  format: "uri",
                  example: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
                },
                minItems: 0,
                maxItems: 50,
                description: "Array of image URLs. Empty array is allowed (displays placeholder). Maximum 50 images.",
              },
              aspectRatio: {
                type: "string",
                enum: ["portrait", "landscape", "square"],
                description: "Image aspect ratio",
              },
            },
          },
          textSection: {
            type: "object",
            required: ["title", "titleColor", "description", "descriptionColor"],
            properties: {
              title: {
                type: "string",
                example: "Welcome to Our App",
              },
              titleColor: {
                type: "string",
                pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
                example: "#000000",
                description: "Hex color code. Accepts #RGB or #RRGGBB format. Server normalizes to uppercase #RRGGBB.",
              },
              description: {
                type: "string",
                example: "Discover amazing features and start your journey with us today.",
              },
              descriptionColor: {
                type: "string",
                pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
                example: "#666666",
                description: "Hex color code. Accepts #RGB or #RRGGBB format. Server normalizes to uppercase #RRGGBB.",
              },
            },
          },
          cta: {
            type: "object",
            required: ["label", "url", "backgroundColor", "textColor"],
            properties: {
              label: {
                type: "string",
                example: "Get Started",
              },
              url: {
                type: "string",
                format: "uri",
                example: "https://example.com",
              },
              backgroundColor: {
                type: "string",
                pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
                example: "#007AFF",
                description: "Hex color code. Accepts #RGB or #RRGGBB format. Server normalizes to uppercase #RRGGBB.",
              },
              textColor: {
                type: "string",
                pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
                example: "#FFFFFF",
                description: "Hex color code. Accepts #RGB or #RRGGBB format. Server normalizes to uppercase #RRGGBB.",
              },
            },
          },
        },
      },
      ConfigVersion: {
        type: "object",
        required: ["id", "version", "createdAt", "data"],
        properties: {
          id: {
            type: "integer",
            description: "Version record ID",
          },
          version: {
            type: "integer",
            description: "Version number",
            example: 1,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "ISO 8601 timestamp",
            example: "2026-01-31T12:00:00.000Z",
          },
          data: {
            $ref: "#/components/schemas/AppConfig",
          },
        },
      },
      ConfigListItem: {
        type: "object",
        required: ["config_id", "updatedAt", "versionCount"],
        properties: {
          config_id: {
            type: "string",
            example: "mobile",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2026-01-31T12:00:00.000Z",
          },
          versionCount: {
            type: "integer",
            description: "Number of saved versions",
            example: 3,
          },
        },
      },
    },
  },
} as const;
