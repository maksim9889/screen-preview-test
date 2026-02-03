import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Page routes
  index("routes/home.tsx"),
  route("home/export/:configId", "routes/home-export.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("setup", "routes/setup.tsx"),
  route("settings", "routes/settings.tsx"),
  route("api-docs", "routes/api-docs.tsx"),
  route("openapi", "routes/openapi.tsx"),

  // API v1 Routes - Configs
  route("api/v1/configs", "routes/api-v1-configs.tsx"),
  route("api/v1/configs/import", "routes/api-v1-configs-import.tsx"),
  route("api/v1/configs/:configId", "routes/api-v1-config.tsx"),
  route("api/v1/configs/:configId/export", "routes/api-v1-config-export.tsx"),
  route("api/v1/configs/:configId/versions", "routes/api-v1-config-versions.tsx"),
  route("api/v1/configs/:configId/versions/:versionNumber", "routes/api-v1-config-version.tsx"),

  // API v1 Routes - Auth
  route("api/v1/auth/login", "routes/api-v1-auth-login.tsx"),
  route("api/v1/auth/register", "routes/api-v1-auth-register.tsx"),
  route("api/v1/auth/logout", "routes/api-v1-auth-logout.tsx"),

  // API v1 Routes - User
  route("api/v1/user/preferences", "routes/api-v1-user-preferences.tsx"),

  // API v1 Routes - API Tokens
  route("api/v1/api-tokens", "routes/api-v1-api-tokens.tsx"),
  route("api/v1/api-tokens/:tokenId", "routes/api-v1-api-token.tsx"),

  // API v1 Routes - Versions
  route("api/v1/versions/:versionNumber/restore", "routes/api-v1-version-restore.tsx"),
] satisfies RouteConfig;
