import { useState, useEffect, useRef, useMemo } from "react";
import { data, redirect, useLoaderData, useNavigate, useFetcher } from "react-router";
import type { Route } from "./+types/home";
import type { AppConfig } from "../lib/types";
import { CSRF_FIELD_NAME, DEFAULT_SECTION_ORDER } from "../lib/constants";
import Editor from "../components/Editor/Editor";
import Preview from "../components/Preview/Preview";
import { useSidebarResize } from "../hooks/useSidebarResize";
import { useConfigForm } from "../hooks/useConfigForm";
import { NewConfigDialog } from "../components/organisms/NewConfigDialog";
import { PhoneSizeSelector } from "../components/organisms/PhoneSizeSelector";
import { DEFAULT_PHONE_SIZE } from "../lib/phone-presets";
import { LogoutConfirmDialog } from "../components/organisms/LogoutConfirmDialog";

export function meta() {
  return [{ title: "Home Screen Editor" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const { needsSetup, validateAuthToken } = await import("../lib/auth.server");
    const { ensureCsrfToken } = await import("../lib/csrf.server");
    const { getConfig, initializeDefaultConfig } = await import("../lib/db.server");

    // Check if setup is needed
    if (needsSetup()) {
      return redirect("/setup");
    }

  // Validate authentication token
  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (!authResult.authenticated || !authResult.username || !authResult.userId) {
    return redirect("/login");
  }

  const username = authResult.username;
  const userId = authResult.userId;

  // Get config_id from user's last viewed config in database
  const { getUserById } = await import("../lib/db.server");
  const user = getUserById(userId);
  let configId = user?.last_config_id || "default";

  // Initialize default config if it doesn't exist
  initializeDefaultConfig(userId);

  // Load the requested config (or default if it doesn't exist)
  let config = getConfig(userId, configId);
  let configFallbackUsed = false;
  let originalRequestedConfig: string | null = null;

  // If requested config doesn't exist, fall back to default
  if (!config && configId !== "default") {
    originalRequestedConfig = configId;
    configId = "default";
    config = getConfig(userId, "default");
    configFallbackUsed = true;

    // Update user's last config to default
    const { updateUserLastConfig: updateToDefault } = await import("../lib/db.server");
    updateToDefault(userId, "default");
  }

  // Load version history for this user's config
  const { getConfigVersions, getLatestVersionNumber, getLoadedVersion, updateUserLastConfig, getUserConfigs } = await import("../lib/db.server");
  const versions = getConfigVersions(userId, configId, 20);
  const latestVersionNumber = getLatestVersionNumber(userId, configId);
  const loadedVersion = getLoadedVersion(userId, configId);

  // Get all configs for this user
  const allConfigs = getUserConfigs(userId);

  // Update user's last viewed config
  updateUserLastConfig(userId, configId);

  // Ensure CSRF token exists
  const { token: csrfToken, setCookie } = ensureCsrfToken(cookieHeader);

  if (setCookie) {
    return data(
      {
        username: username,
        configId: configId,
        config,
        csrfToken,
        versions,
        latestVersionNumber,
        loadedVersion,
        allConfigs,
        configFallbackUsed,
        originalRequestedConfig,
      },
      {
        headers: {
          "Set-Cookie": setCookie,
        },
      }
    );
  }

  return {
    username: username,
    configId: configId,
    config,
    csrfToken,
    versions,
    latestVersionNumber,
    loadedVersion,
    allConfigs,
    configFallbackUsed,
    originalRequestedConfig,
  };
  } catch (error) {
    // Log the error for debugging
    console.error("Home loader error:", error);

    // Return a user-friendly error response
    // In production, don't expose internal error details
    const message = process.env.NODE_ENV === "production"
      ? "Failed to load the editor. Please try again."
      : error instanceof Error ? error.message : "Unknown error";

    throw new Response(message, { status: 500, statusText: "Internal Server Error" });
  }
}

/**
 * Action handler for all configuration operations
 *
 * Per spec requirements (Section 5 & 6):
 * - Browser communicates only with this page route
 * - This action internally accesses the configuration service
 * - No direct browser-to-API calls
 *
 * Supported intents:
 * - save: Update existing configuration
 * - saveVersion: Save and create version snapshot
 * - createConfig: Create new configuration
 * - restoreVersion: Restore a version
 * - import: Import configuration from JSON
 * - logout: Logout user
 */
export async function action({ request }: Route.ActionArgs) {
  const { validateAuthToken, deleteAuthToken, getAuthTokenFromCookie, clearAuthTokenCookie } = await import("../lib/auth.server");
  const { validateCsrfToken, getCsrfTokenFromFormData } = await import("../lib/csrf.server");
  const {
    saveConfig,
    getConfig,
    getFullConfigRecord,
    restoreConfigVersion,
    updateLoadedVersion,
    createConfigVersion,
    getConfigVersions,
    getLatestVersionNumber,
    importConfigRecord,
    updateUserLastConfig,
  } = await import("../lib/db.server");
  const { validateConfig, validateConfigId, normalizeConfigColors } = await import("../lib/validation");
  const { importAndMigrateConfig, validateSchemaVersion } = await import("../lib/schema-migrations.server");
  const { ACTION_INTENTS } = await import("../hooks/useConfigForm");
  const { config: appConfig } = await import("../lib/config.server");

  // Validate authentication
  const cookieHeader = request.headers.get("Cookie");
  const authResult = await validateAuthToken(cookieHeader);

  if (!authResult.authenticated || !authResult.userId) {
    return data({ error: "Authentication required", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const userId = authResult.userId;

  // Check rate limit to prevent abuse
  const { checkApiRateLimit, getClientIp, createRateLimitHeaders } = await import("../lib/rate-limit.server");
  const clientIp = getClientIp(request);
  const rateLimit = checkApiRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return data(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMIT_EXCEEDED" },
      { status: 429, headers: createRateLimitHeaders(rateLimit) }
    );
  }

  // Validate request size to prevent DoS attacks
  const { validateConfigRequestSize } = await import("../lib/request-size.server");
  const sizeValidation = await validateConfigRequestSize(request);
  if (!sizeValidation.valid) {
    return data(
      { error: sizeValidation.error, code: "PAYLOAD_TOO_LARGE" },
      { status: 413 }
    );
  }

  // Parse form data
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

  // Handle logout
  if (intent === ACTION_INTENTS.LOGOUT) {
    const token = getAuthTokenFromCookie(cookieHeader);
    if (token) {
      deleteAuthToken(token);
    }
    return redirect("/login", {
      headers: { "Set-Cookie": clearAuthTokenCookie() },
    });
  }

  // Handle save
  if (intent === ACTION_INTENTS.SAVE) {
    const configId = formData.get("configId") as string;
    const configJson = formData.get("config") as string;

    if (!configId) {
      return data({ error: "configId is required", code: "MISSING_FIELD" }, { status: 400 });
    }
    if (!configJson) {
      return data({ error: "Configuration data is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    const configIdValidation = validateConfigId(configId);
    if (!configIdValidation.valid) {
      return data({ error: configIdValidation.error, code: "INVALID_CONFIG_ID" }, { status: 400 });
    }

    const existingRecord = getFullConfigRecord(userId, configId);
    if (!existingRecord) {
      return data({ error: "Configuration not found", code: "CONFIG_NOT_FOUND" }, { status: 404 });
    }

    try {
      const config: AppConfig = JSON.parse(configJson);
      const validation = validateConfig(config);

      if (!validation.valid) {
        return data({ error: validation.errors.join(", "), code: "VALIDATION_ERROR" }, { status: 400 });
      }

      const normalizedConfig = normalizeConfigColors(config);
      saveConfig(userId, configId, normalizedConfig, "v1");
      updateLoadedVersion(userId, configId, null);

      return data({ success: true, savedAt: new Date().toISOString() });
    } catch (e) {
      return data(
        { error: "Invalid configuration data", code: "INVALID_CONFIG_DATA" },
        { status: 400 }
      );
    }
  }

  // Handle save with version
  if (intent === ACTION_INTENTS.SAVE_VERSION) {
    const configId = formData.get("configId") as string;
    const configJson = formData.get("config") as string;

    if (!configId) {
      return data({ error: "configId is required", code: "MISSING_FIELD" }, { status: 400 });
    }
    if (!configJson) {
      return data({ error: "Configuration data is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    const configIdValidation = validateConfigId(configId);
    if (!configIdValidation.valid) {
      return data({ error: configIdValidation.error, code: "INVALID_CONFIG_ID" }, { status: 400 });
    }

    const existingRecord = getFullConfigRecord(userId, configId);
    if (!existingRecord) {
      return data({ error: "Configuration not found", code: "CONFIG_NOT_FOUND" }, { status: 404 });
    }

    try {
      const config: AppConfig = JSON.parse(configJson);
      const validation = validateConfig(config);

      if (!validation.valid) {
        return data({ error: validation.errors.join(", "), code: "VALIDATION_ERROR" }, { status: 400 });
      }

      const normalizedConfig = normalizeConfigColors(config);
      saveConfig(userId, configId, normalizedConfig, "v1");
      updateLoadedVersion(userId, configId, null);

      // Create version snapshot
      const versionRecord = createConfigVersion(userId, configId, normalizedConfig);
      const versions = getConfigVersions(userId, configId, 20);
      const latestVersionNumber = getLatestVersionNumber(userId, configId);

      return data({
        success: true,
        savedAt: new Date().toISOString(),
        versionCreated: true,
        versionNumber: versionRecord.version,
        versions,
        latestVersionNumber,
      });
    } catch (e) {
      return data(
        { error: "Invalid configuration data", code: "INVALID_CONFIG_DATA" },
        { status: 400 }
      );
    }
  }

  // Handle create new config
  if (intent === ACTION_INTENTS.CREATE_CONFIG) {
    const configId = formData.get("configId") as string;
    const configJson = formData.get("config") as string;

    if (!configId) {
      return data({ error: "configId is required", code: "MISSING_FIELD" }, { status: 400 });
    }
    if (!configJson) {
      return data({ error: "Configuration data is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    const configIdValidation = validateConfigId(configId);
    if (!configIdValidation.valid) {
      return data({ error: configIdValidation.error, code: "INVALID_CONFIG_ID" }, { status: 400 });
    }

    // Check if config already exists
    const existingConfig = getConfig(userId, configId);
    if (existingConfig) {
      return data({ error: "Configuration already exists", code: "CONFIG_ALREADY_EXISTS" }, { status: 409 });
    }

    try {
      const config: AppConfig = JSON.parse(configJson);
      const validation = validateConfig(config);

      if (!validation.valid) {
        return data({ error: validation.errors.join(", "), code: "VALIDATION_ERROR" }, { status: 400 });
      }

      const normalizedConfig = normalizeConfigColors(config);
      saveConfig(userId, configId, normalizedConfig, "v1");
      updateUserLastConfig(userId, configId);

      // Create initial version
      const versionRecord = createConfigVersion(userId, configId, normalizedConfig);
      const versions = getConfigVersions(userId, configId, 20);
      const latestVersionNumber = getLatestVersionNumber(userId, configId);

      return data({
        success: true,
        savedAt: new Date().toISOString(),
        configCreated: true,
        versionCreated: true,
        versionNumber: versionRecord.version,
        configId,
        versions,
        latestVersionNumber,
      });
    } catch (e) {
      return data(
        { error: "Invalid configuration data", code: "INVALID_CONFIG_DATA" },
        { status: 400 }
      );
    }
  }

  // Handle restore version
  if (intent === ACTION_INTENTS.RESTORE_VERSION) {
    const configId = formData.get("configId") as string;
    const loadedVersionStr = formData.get("loadedVersion") as string;

    if (!configId) {
      return data({ error: "configId is required", code: "MISSING_FIELD" }, { status: 400 });
    }
    if (!loadedVersionStr) {
      return data({ error: "loadedVersion is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    const versionNumber = parseInt(loadedVersionStr, 10);
    if (isNaN(versionNumber) || versionNumber < 1) {
      return data({ error: "Invalid version number", code: "INVALID_VERSION_NUMBER" }, { status: 400 });
    }

    const success = restoreConfigVersion(userId, configId, versionNumber);
    if (!success) {
      return data({ error: "Version not found", code: "VERSION_NOT_FOUND" }, { status: 404 });
    }

    updateLoadedVersion(userId, configId, versionNumber);
    const restoredConfig = getConfig(userId, configId);

    return data({
      success: true,
      restored: true,
      restoredVersion: versionNumber,
      config: restoredConfig,
    });
  }

  // Handle import
  if (intent === ACTION_INTENTS.IMPORT) {
    const importJson = formData.get("importData") as string;

    if (!importJson) {
      return data({ error: "Import data is required", code: "MISSING_FIELD" }, { status: 400 });
    }

    try {
      const importedRecord = JSON.parse(importJson);
      const configId = importedRecord.config_id || importedRecord.id;

      if (!configId || !importedRecord.schemaVersion || !importedRecord.updatedAt || !importedRecord.data) {
        return data(
          { error: "Invalid import file: missing required fields", code: "INVALID_IMPORT_FILE" },
          { status: 400 }
        );
      }

      const configIdValidation = validateConfigId(configId);
      if (!configIdValidation.valid) {
        return data({ error: configIdValidation.error, code: "INVALID_CONFIG_ID" }, { status: 400 });
      }

      const schemaVersionError = validateSchemaVersion(importedRecord.schemaVersion);
      if (schemaVersionError) {
        return data({ error: schemaVersionError, code: "VALIDATION_ERROR" }, { status: 400 });
      }

      const migratedConfig = importAndMigrateConfig(importedRecord.data, importedRecord.schemaVersion);
      const validation = validateConfig(migratedConfig);

      if (!validation.valid) {
        return data(
          { error: `Invalid configuration: ${validation.errors.join(", ")}`, code: "INVALID_CONFIG_DATA" },
          { status: 400 }
        );
      }

      const normalizedConfig = normalizeConfigColors(migratedConfig);

      importConfigRecord(userId, {
        config_id: configId,
        schemaVersion: importedRecord.schemaVersion,
        updatedAt: importedRecord.updatedAt,
        data: normalizedConfig,
      });

      updateLoadedVersion(userId, configId, null);

      // Switch to the imported config so user sees it after reload
      updateUserLastConfig(userId, configId);

      return data({
        success: true,
        imported: true,
        importedAt: new Date().toISOString(),
        configId: configId,
        config: normalizedConfig,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      console.error("Import error:", errorMessage);
      return data(
        { error: `Failed to import: ${errorMessage}`, code: "INVALID_IMPORT_FILE" },
        { status: 400 }
      );
    }
  }

  // Handle set last config (user preference)
  if (intent === ACTION_INTENTS.SET_LAST_CONFIG) {
    const lastConfigId = formData.get("lastConfigId") as string;

    if (!lastConfigId) {
      return data({ error: "Missing lastConfigId", code: "MISSING_FIELD" }, { status: 400 });
    }

    const configIdValidation = validateConfigId(lastConfigId);
    if (!configIdValidation.valid) {
      return data({ error: configIdValidation.error, code: "INVALID_CONFIG_ID" }, { status: 400 });
    }

    // Check if config exists for this user
    const configExists = getConfig(userId, lastConfigId);
    if (!configExists) {
      return data({ error: "Configuration not found", code: "CONFIG_NOT_FOUND" }, { status: 404 });
    }

    updateUserLastConfig(userId, lastConfigId);

    return data({ success: true, lastConfigId });
  }

  return data({ error: "Unknown intent", code: "INVALID_INTENT" }, { status: 400 });
}

// Type alias for action response data
type ActionData =
  | { success: true; savedAt: string }
  | { success: true; savedAt: string; versionCreated: true; versionNumber: number; versions: any[]; latestVersionNumber: number }
  | { success: true; savedAt: string; configCreated: true; versionCreated: true; versionNumber: number; configId: string; versions: any[]; latestVersionNumber: number }
  | { success: true; imported: true; importedAt: string; config: AppConfig }
  | { success: true; restored: true; restoredVersion: number; config: AppConfig }
  | { error: string; code: string; details?: string };

export default function HomePage() {
  const loaderData = useLoaderData<typeof loader>();
  const { username, configId, config: serverConfig, csrfToken } = loaderData;
  const navigate = useNavigate();
  const configSwitchFetcher = useFetcher({ key: "config-switch" });

  // Local state for real-time preview
  const [config, setConfig] = useState<AppConfig>(serverConfig!);
  const [currentConfigId, setCurrentConfigId] = useState(configId!);
  const [versions, setVersions] = useState(loaderData.versions || []);
  const [latestVersionNumber, setLatestVersionNumber] = useState(loaderData.latestVersionNumber || 0);
  const [currentlyLoadedVersion, setCurrentlyLoadedVersion] = useState<number | null>(
    loaderData.loadedVersion ?? loaderData.latestVersionNumber ?? null
  );
  const [showNewConfigDialog, setShowNewConfigDialog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingLogoutAfterSave, setPendingLogoutAfterSave] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [phoneWidth, setPhoneWidth] = useState(DEFAULT_PHONE_SIZE.width);
  const [phoneHeight, setPhoneHeight] = useState(DEFAULT_PHONE_SIZE.height);
  const [showPhoneSizeSelector, setShowPhoneSizeSelector] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<string[]>(
    serverConfig?.sectionOrder || DEFAULT_SECTION_ORDER
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Track last saved config as state to properly trigger re-renders
  const [lastSavedConfig, setLastSavedConfig] = useState<string>(JSON.stringify(serverConfig));

  // Compute hasUnsavedChanges directly from config comparison
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(config) !== lastSavedConfig;
  }, [config, lastSavedConfig]);

  // Notification states - persist independently of saveResult
  const [notificationSaveError, setNotificationSaveError] = useState<string | undefined>(undefined);
  const [notificationSavedAt, setNotificationSavedAt] = useState<string | undefined>(undefined);
  const [notificationVersionCreated, setNotificationVersionCreated] = useState<boolean>(false);
  const [notificationVersionNumber, setNotificationVersionNumber] = useState<number | undefined>(undefined);
  const [notificationConfigCreated, setNotificationConfigCreated] = useState<boolean>(false);
  const [notificationImportSuccess, setNotificationImportSuccess] = useState<boolean>(false);
  const [notificationImportedAt, setNotificationImportedAt] = useState<string | undefined>(undefined);
  const [notificationRestoredVersion, setNotificationRestoredVersion] = useState<number | undefined>(undefined);
  const [notificationFallbackWarning, setNotificationFallbackWarning] = useState<string | undefined>(undefined);

  // Custom hooks
  const {
    sidebarWidth,
    isCollapsed,
    setIsCollapsed,
    isResizing,
    startResize,
    isMobile,
  } = useSidebarResize(420);

  const {
    handleSave,
    handleSaveVersion,
    handleSaveAsNewConfig,
    handleRestoreVersion,
    handleLogout,
    handleImport,
    isSaving,
    result: saveResult,
    formMethod,
  } = useConfigForm(config, currentConfigId, csrfToken);

  // Track the last synced server config to avoid unnecessary resets
  const lastSyncedServerConfigRef = useRef<string>(JSON.stringify(serverConfig));

  // Sync with server config only when switching configs or on initial load
  // Don't reset local state on every revalidation (which happens after saves)
  useEffect(() => {
    const serverConfigStr = JSON.stringify(serverConfig);
    const isSwitchingConfig = configId !== currentConfigId;
    const serverConfigActuallyChanged = serverConfigStr !== lastSyncedServerConfigRef.current;

    // Only sync config/lastSavedConfig when switching configs or server data actually changed
    if (isSwitchingConfig || serverConfigActuallyChanged) {
      lastSyncedServerConfigRef.current = serverConfigStr;
      setLastSavedConfig(serverConfigStr);
      setConfig(serverConfig!);
      setSectionOrder(serverConfig?.sectionOrder || DEFAULT_SECTION_ORDER);
    }

    // Update config ID and version info
    if (isSwitchingConfig) {
      setCurrentConfigId(configId!);
    }

    // Always update versions list from server
    setVersions(loaderData.versions || []);
    setLatestVersionNumber(loaderData.latestVersionNumber || 0);
    setCurrentlyLoadedVersion(loaderData.loadedVersion ?? loaderData.latestVersionNumber ?? null);
  }, [serverConfig, configId, loaderData.versions, loaderData.latestVersionNumber, loaderData.loadedVersion, currentConfigId]);

  // Keep a ref to the latest handleSave function
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  // Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but returnValue is still required
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Show warning if config fallback was used
  useEffect(() => {
    if (loaderData.configFallbackUsed && loaderData.originalRequestedConfig) {
      setNotificationFallbackWarning(
        `Configuration "${loaderData.originalRequestedConfig}" not found. Loaded default configuration instead.`
      );
      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => setNotificationFallbackWarning(undefined), 8000);
      return () => clearTimeout(timer);
    }
  }, [loaderData.configFallbackUsed, loaderData.originalRequestedConfig]);

  // Track if current save was triggered by autosave
  const [isAutosaving, setIsAutosaving] = useState(false);
  const isAutosavingRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave: triggers 3 seconds after the last change
  useEffect(() => {
    // Clear any pending autosave timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    // Don't set up autosave if no changes or currently saving
    if (!hasUnsavedChanges || isSaving) {
      return;
    }

    // Set up debounced autosave
    autosaveTimerRef.current = setTimeout(() => {
      if (hasUnsavedChanges && !isSaving) {
        isAutosavingRef.current = true;
        setIsAutosaving(true);
        handleSaveRef.current();
      }
    }, 3000); // 3 seconds after last change

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [config, hasUnsavedChanges, isSaving]);

  // Reset autosaving flag when save completes
  useEffect(() => {
    if (!isSaving && isAutosavingRef.current) {
      isAutosavingRef.current = false;
      // Keep isAutosaving true briefly to show "Autosaved" message
      const timer = setTimeout(() => setIsAutosaving(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSaving]);

  // Track the last processed saveResult to avoid re-processing on config changes
  const lastProcessedSaveResultRef = useRef<typeof saveResult>(null);

  // Update state based on v1 API responses
  useEffect(() => {
    if (!saveResult) return;

    // Skip if we've already processed this exact saveResult
    if (saveResult === lastProcessedSaveResultRef.current) {
      return;
    }
    lastProcessedSaveResultRef.current = saveResult;

    // Clear all notification states first
    setNotificationSaveError(undefined);
    setNotificationSavedAt(undefined);
    setNotificationVersionCreated(false);
    setNotificationVersionNumber(undefined);
    setNotificationConfigCreated(false);
    setNotificationImportSuccess(false);
    setNotificationImportedAt(undefined);
    setNotificationRestoredVersion(undefined);

    // Type guard: check if it's an error response
    if ('error' in saveResult) {
      setNotificationSaveError(saveResult.error);
      return;
    }

    // Handle logout success - redirect to login page
    if ('message' in saveResult && saveResult.message === "Logout successful") {
      window.location.href = "/login";
      return;
    }

    // Type guard: check if it's an import response
    if ('imported' in saveResult && saveResult.imported) {
      // Reload the page to fully sync all state with imported config
      window.location.reload();
      return;
    }

    // Type guard: check if it's a restore response
    if ('restored' in saveResult && saveResult.restored) {
      setLastSavedConfig(JSON.stringify(saveResult.config));
      setConfig(saveResult.config);
      setSectionOrder(saveResult.config.sectionOrder || DEFAULT_SECTION_ORDER);
      setCurrentlyLoadedVersion(saveResult.restoredVersion);
      setNotificationRestoredVersion(saveResult.restoredVersion);
      return;
    }

    // Type guard: check if it's a new config creation response
    // Only switch configs if this was a POST request (new config), not a PUT (regular save)
    if ('configId' in saveResult && saveResult.configId && !('lastConfigId' in saveResult) && formMethod === 'post') {
      // Switch to the new config using intent
      configSwitchFetcher.submit(
        {
          intent: "setLastConfig",
          lastConfigId: saveResult.configId,
          [CSRF_FIELD_NAME]: csrfToken,
        },
        { method: "post" }
      );
      setNotificationConfigCreated(true);
      if ('versionNumber' in saveResult && saveResult.versionNumber !== undefined) {
        setNotificationVersionNumber(saveResult.versionNumber);
      }
      return;
    }

    // Type guard: check if it's a version creation response
    if ('versionCreated' in saveResult && saveResult.versionCreated) {
      setLastSavedConfig(JSON.stringify(config));
      if (saveResult.versions) setVersions(saveResult.versions as typeof versions);
      if (saveResult.latestVersionNumber !== undefined) {
        setLatestVersionNumber(saveResult.latestVersionNumber);
        setCurrentlyLoadedVersion(saveResult.latestVersionNumber);
      }
      if (saveResult.savedAt) setLastSavedAt(saveResult.savedAt);
      setNotificationVersionCreated(true);
      if (saveResult.versionNumber !== undefined) setNotificationVersionNumber(saveResult.versionNumber);
      return;
    }

    // Regular save response
    if ('savedAt' in saveResult) {
      setLastSavedConfig(JSON.stringify(config));
      setLastSavedAt(saveResult.savedAt);
      setNotificationSavedAt(saveResult.savedAt);
    }
  }, [saveResult, navigate, csrfToken, configSwitchFetcher, config]);

  const handleConfigSelect = (selectedConfigId: string) => {
    // Submit using intent to update last config preference
    configSwitchFetcher.submit(
      {
        intent: "setLastConfig",
        lastConfigId: selectedConfigId,
        [CSRF_FIELD_NAME]: csrfToken,
      },
      { method: "post" }
    );
  };

  // Logout wrapper that checks for unsaved changes
  const handleLogoutClick = () => {
    if (hasUnsavedChanges) {
      setShowLogoutConfirm(true);
    } else {
      handleLogout();
    }
  };

  // Handle "Save & Logout" - save first, then logout after save completes
  const handleSaveAndLogout = () => {
    setPendingLogoutAfterSave(true);
    setShowLogoutConfirm(false);
    handleSave();
  };

  // Handle "Logout without saving" - just logout
  const handleLogoutWithoutSave = () => {
    setShowLogoutConfirm(false);
    handleLogout();
  };

  // Execute pending logout after save completes
  useEffect(() => {
    if (pendingLogoutAfterSave && !isSaving && saveResult && 'savedAt' in saveResult) {
      setPendingLogoutAfterSave(false);
      handleLogout();
    }
  }, [pendingLogoutAfterSave, isSaving, saveResult, handleLogout]);

  // Watch for successful config switch and reload page
  useEffect(() => {
    if (
      configSwitchFetcher.state === "idle" &&
      configSwitchFetcher.data &&
      'lastConfigId' in configSwitchFetcher.data &&
      configSwitchFetcher.data.success === true
    ) {
      // Reload the page to load the new config
      window.location.href = "/";
    }
  }, [configSwitchFetcher.state, configSwitchFetcher.data]);

  const handlePhoneSizeChange = (width: number, height: number) => {
    setPhoneWidth(width);
    setPhoneHeight(height);
  };

  const handleSectionOrderChange = (newOrder: string[]) => {
    setSectionOrder(newOrder);
    setConfig((prev) => ({
      ...prev,
      sectionOrder: newOrder,
    }));
  };

  return (
    <div className={`flex h-screen overflow-hidden relative ${isResizing ? 'select-none' : ''}`}>
      {/* Sidebar with attached collapse button */}
      <div
        className="flex h-full md:relative fixed inset-y-0 left-0 z-20 transition-all duration-300"
        style={{
          width: isCollapsed ? '0px' : isMobile ? '85vw' : `${sidebarWidth}px`,
          minWidth: isCollapsed ? '0px' : isMobile ? '0px' : '320px',
          maxWidth: isCollapsed ? '0px' : isMobile ? '85vw' : '800px',
        }}
      >
        {/* Sidebar content */}
        <aside className="flex-1 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
          {!isCollapsed && (
            <Editor
              username={username!}
              configId={currentConfigId}
              config={config}
              sectionOrder={sectionOrder}
              onConfigChange={setConfig}
              onSave={handleSave}
              onSaveVersion={handleSaveVersion}
              onSaveAsNewConfig={() => setShowNewConfigDialog(true)}
              onRestoreVersion={handleRestoreVersion}
              onConfigSelect={handleConfigSelect}
              onLogout={handleLogoutClick}
              onImport={handleImport}
              onModalOpenChange={setEditorModalOpen}
              onSectionOrderChange={handleSectionOrderChange}
              csrfToken={csrfToken}
              isSaving={isSaving}
              saveError={notificationSaveError}
              savedAt={notificationSavedAt}
              versionCreated={notificationVersionCreated}
              versionNumber={notificationVersionNumber}
              configCreated={notificationConfigCreated}
              importSuccess={notificationImportSuccess}
              importedAt={notificationImportedAt}
              restoredVersion={notificationRestoredVersion}
              versions={versions}
              latestVersionNumber={latestVersionNumber}
              currentlyLoadedVersion={currentlyLoadedVersion}
              allConfigs={loaderData.allConfigs || []}
              lastSavedAt={lastSavedAt}
              hasUnsavedChanges={hasUnsavedChanges}
              isAutosaving={isAutosaving}
              fallbackWarning={notificationFallbackWarning}
            />
          )}
        </aside>

        {/* Resize Handle - Hidden on mobile */}
        {!isCollapsed && (
          <div
            className="hidden md:block w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors relative group active:bg-blue-500"
            onMouseDown={startResize}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}
      </div>

      {/* Collapse/Expand Button - Attached to sidebar edge */}
      {!editorModalOpen && !showNewConfigDialog && !showLogoutConfirm && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
            fixed md:absolute top-1/2 -translate-y-1/2 z-30
            flex items-center justify-center
            w-6 h-12
            bg-white border border-l-0 border-gray-200
            rounded-r-full
            shadow-sm hover:shadow-md
            hover:bg-gray-50
            transition-all duration-300
            group
          `}
          style={{
            left: isCollapsed ? '0px' : isMobile ? '85vw' : `${sidebarWidth}px`,
          }}
          title={isCollapsed ? 'Show configuration panel' : 'Hide configuration panel'}
        >
          <svg
            className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-all duration-300"
            style={{
              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-10 backdrop-blur-sm"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Main Preview Area */}
      <main className="flex-1 overflow-hidden relative h-full">
        <Preview
          config={config}
          phoneWidth={phoneWidth}
          phoneHeight={phoneHeight}
          sectionOrder={sectionOrder}
        />

        {/* Phone Size Selector Toggle Button - iOS style */}
        <button
          onClick={() => setShowPhoneSizeSelector(!showPhoneSizeSelector)}
          className="fixed bottom-6 right-6 z-20 bg-gray-900 hover:bg-gray-800 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 p-4"
          title="Adjust phone size"
        >
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Phone Size Selector Panel */}
        {showPhoneSizeSelector && (
          <div className="fixed bottom-20 right-6 z-20 w-80 animate-in slide-in-from-bottom-4">
            <PhoneSizeSelector
              currentWidth={phoneWidth}
              currentHeight={phoneHeight}
              onSizeChange={handlePhoneSizeChange}
            />
          </div>
        )}
      </main>

      {/* Save as New Configuration Dialog - Rendered at root level */}
      <NewConfigDialog
        isOpen={showNewConfigDialog}
        onClose={() => setShowNewConfigDialog(false)}
        onConfirm={(newConfigId) => {
          handleSaveAsNewConfig(newConfigId);
          setShowNewConfigDialog(false);
        }}
        currentConfigId={currentConfigId}
        isSaving={isSaving}
      />

      {/* Logout Confirmation Dialog - Shows when logging out with unsaved changes */}
      <LogoutConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onSaveAndLogout={handleSaveAndLogout}
        onLogoutWithoutSave={handleLogoutWithoutSave}
        isSaving={isSaving || pendingLogoutAfterSave}
      />
    </div>
  );
}
