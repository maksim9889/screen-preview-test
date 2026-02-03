/**
 * API Contract Types
 *
 * This file defines explicit TypeScript types for all API requests and responses.
 * These types serve as the single source of truth for the API contract between
 * the client and server.
 */

import type { AppConfig } from "./types";

// ============ Error Codes ============

export const ErrorCode = {
  // Authentication errors (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_TOKEN: "INVALID_TOKEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // Authorization errors (403)
  FORBIDDEN: "FORBIDDEN",
  INVALID_CSRF: "INVALID_CSRF",

  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_CONFIG_ID: "INVALID_CONFIG_ID",
  INVALID_CONFIG_DATA: "INVALID_CONFIG_DATA",
  INVALID_VERSION_NUMBER: "INVALID_VERSION_NUMBER",
  INVALID_IMPORT_FILE: "INVALID_IMPORT_FILE",
  MISSING_FIELD: "MISSING_FIELD",

  // Not found errors (404)
  NOT_FOUND: "NOT_FOUND",
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  VERSION_NOT_FOUND: "VERSION_NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  TOKEN_NOT_FOUND: "TOKEN_NOT_FOUND",

  // Conflict errors (409)
  CONFIG_ALREADY_EXISTS: "CONFIG_ALREADY_EXISTS",
  USERNAME_TAKEN: "USERNAME_TAKEN",
  STALE_DATA: "STALE_DATA",

  // Request errors (413)
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",

  // Rate limit errors (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

// ============ Configuration Version ============

export interface ConfigVersion {
  id: number;
  version: number;
  createdAt: string;
  data: AppConfig;
}

// ============ Base Response Types ============

export interface ErrorResponse {
  error: string;
  code: ErrorCodeType;
  details?: string;
  requestId?: string;
}

export interface SuccessResponse {
  success: true;
}

// ============ V1 API Response Types ============
// All requests now use v1 API endpoints at /api/v1/*

export interface V1SaveConfigResponse extends SuccessResponse {
  savedAt: string;
  configId: string;
  apiVersion: string;
}

export interface V1SaveVersionResponse extends SuccessResponse {
  savedAt: string;
  versionCreated: true;
  versionNumber: number;
  versions: ConfigVersion[];
  latestVersionNumber: number;
  configId: string;
  apiVersion: string;
}

export interface V1CreateConfigResponse extends SuccessResponse {
  savedAt: string;
  configId: string;
  apiVersion: string;
}

export interface V1ImportConfigResponse extends SuccessResponse {
  imported: true;
  importedAt: string;
  configId: string;
  config: AppConfig;
  apiVersion: string;
}

export interface V1RestoreVersionResponse extends SuccessResponse {
  restored: true;
  restoredVersion: number;
  config: AppConfig;
  apiVersion: string;
}

export interface V1LogoutResponse extends SuccessResponse {
  message: string;
  apiVersion: string;
}

export interface V1UpdatePreferencesResponse extends SuccessResponse {
  lastConfigId: string;
  apiVersion: string;
}

// ============ Login Types ============

export interface LoginRequest {
  username: string;
  password: string;
  csrf_token: string;
}

export interface LoginSuccessResponse extends SuccessResponse {
  redirectTo: string;
}

export type LoginActionResponse = LoginSuccessResponse | ErrorResponse;

// ============ Setup Types ============

export interface SetupRequest {
  username: string;
  password: string;
  confirmPassword: string;
  csrf_token: string;
}

export interface SetupSuccessResponse extends SuccessResponse {
  redirectTo: string;
}

export type SetupActionResponse = SetupSuccessResponse | ErrorResponse;
