import { useFetcher } from "react-router";
import { CSRF_FIELD_NAME } from "../lib/constants";
import type { AppConfig } from "../lib/types";

/**
 * Result type for form actions
 * Represents all possible responses from the home page action
 * These must match the actual return values in home.tsx action()
 */
export type ActionResult =
  | { success: true; savedAt: string; configId?: string; version?: number; latestVersionNumber?: number; versionCreated?: boolean; versionNumber?: number; versions?: unknown[] }
  | { success: true; restored: true; restoredVersion: number; config: AppConfig }
  | { success: true; imported: true; importedAt: string; config: AppConfig }
  | { success: true; lastConfigId: string }
  | { error: string; code: string };

/**
 * Intent values for the home page action
 * These are used to distinguish between different operations
 * All operations are handled by the page's action, NOT by /api/v1/* endpoints
 *
 * This ensures the browser never calls the configuration service directly,
 * as required by the spec (Section 5 & 6: Private Authentication & Server-Side API Access)
 */
export const ACTION_INTENTS = {
  SAVE: "save",
  SAVE_VERSION: "saveVersion",
  CREATE_CONFIG: "createConfig",
  RESTORE_VERSION: "restoreVersion",
  IMPORT: "import",
  LOGOUT: "logout",
  SET_LAST_CONFIG: "setLastConfig",
} as const;

export type ActionIntent = (typeof ACTION_INTENTS)[keyof typeof ACTION_INTENTS];

export interface UseConfigFormHandlers {
  handleSave: () => void;
  handleSaveVersion: () => void;
  handleSaveAsNewConfig: (newConfigId: string) => void;
  handleRestoreVersion: (version: number) => void;
  handleLogout: () => void;
  handleImport: (importData: string) => void;
  isSaving: boolean;
  result: ActionResult | undefined;
  formMethod: string | undefined;
}

export function useConfigForm(
  config: AppConfig,
  currentConfigId: string,
  csrfToken: string
): UseConfigFormHandlers {
  const fetcher = useFetcher();
  const isSaving = fetcher.state === "submitting";
  const result = fetcher.data;

  // All operations submit to the current page route (empty action = current route)
  // This ensures browser -> app server -> config service flow
  // Browser never calls /api/v1/* directly

  const handleSave = () => {
    fetcher.submit(
      {
        intent: ACTION_INTENTS.SAVE,
        configId: currentConfigId,
        config: JSON.stringify(config),
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleSaveVersion = () => {
    fetcher.submit(
      {
        intent: ACTION_INTENTS.SAVE_VERSION,
        configId: currentConfigId,
        config: JSON.stringify(config),
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleSaveAsNewConfig = (newConfigId: string) => {
    fetcher.submit(
      {
        intent: ACTION_INTENTS.CREATE_CONFIG,
        configId: newConfigId,
        config: JSON.stringify(config),
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleRestoreVersion = (version: number) => {
    fetcher.submit(
      {
        intent: ACTION_INTENTS.RESTORE_VERSION,
        configId: currentConfigId,
        loadedVersion: version.toString(),
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleLogout = () => {
    fetcher.submit(
      {
        intent: ACTION_INTENTS.LOGOUT,
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  const handleImport = (importData: string) => {
    fetcher.submit(
      {
        intent: ACTION_INTENTS.IMPORT,
        importData,
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  return {
    handleSave,
    handleSaveVersion,
    handleSaveAsNewConfig,
    handleRestoreVersion,
    handleLogout,
    handleImport,
    isSaving,
    result,
    formMethod: fetcher.formMethod,
  };
}
