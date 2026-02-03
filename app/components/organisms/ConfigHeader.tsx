import { useState } from "react";
import { Select } from "../atoms/Select";
import { MaterialIcon } from "../atoms/MaterialIcon";

export interface ConfigHeaderProps {
  username: string;
  configId: string;
  latestVersionNumber: number;
  currentlyLoadedVersion: number | null;
  allConfigs: Array<{
    config_id: string;
    updatedAt: string;
    versionCount: number;
  }>;
  isSaving: boolean;
  showVersions: boolean;
  onLogout: () => void;
  onConfigSelect: (configId: string) => void;
  onSave: () => void;
  onSaveVersion: () => void;
  onSaveAsNewConfig: () => void;
  onToggleVersions: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasUnsavedChanges?: boolean;
}

export function ConfigHeader({
  username,
  configId,
  latestVersionNumber,
  currentlyLoadedVersion,
  allConfigs,
  isSaving,
  showVersions,
  onLogout,
  onConfigSelect,
  onSave,
  onSaveVersion,
  onSaveAsNewConfig,
  onToggleVersions,
  onExport,
  onImport,
  hasUnsavedChanges,
}: ConfigHeaderProps) {
  const [configDetailsOpen, setConfigDetailsOpen] = useState(true);

  return (
    <div className="bg-white">
      {/* Sticky Save Section */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        {/* Top bar with user info */}
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-500">{username}</span>
          <div className="flex gap-2">
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="API Docs"
            >
              <MaterialIcon icon="description" size="small" className="text-sm" />
            </a>
            <a
              href="/settings"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Settings"
            >
              <MaterialIcon icon="settings" size="small" className="text-sm" />
            </a>
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Logout"
            >
              <MaterialIcon icon="logout" size="small" className="text-sm" />
            </button>
          </div>
        </div>

        {/* Save buttons */}
        <div className="px-4 py-3 space-y-2">
          {/* Main save button */}
          {hasUnsavedChanges ? (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              <MaterialIcon icon="save" size="small" className="text-base" />
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              <span className="ml-1 inline-block w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
            </button>
          ) : (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg cursor-not-allowed transition-colors"
            >
              <MaterialIcon icon="check_circle" size="small" className="text-base" />
              <span>All changes saved</span>
            </button>
          )}

          {/* Secondary save buttons */}
          <div className="flex gap-2">
            <button
              onClick={onSaveVersion}
              disabled={isSaving}
              className="flex-1 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              New Version
            </button>
            <button
              onClick={onSaveAsNewConfig}
              disabled={isSaving}
              className="flex-1 px-3 py-2 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-100 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              New Config
            </button>
          </div>
        </div>
      </div>

      {/* Config Details Accordion */}
      <div className="border-b border-gray-100">
        <button
          onClick={() => setConfigDetailsOpen(!configDetailsOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MaterialIcon icon="settings" size="small" className="text-gray-400" />
            <span className="text-xs font-medium text-gray-700">
              <span className="text-gray-500">Configuration:</span>{" "}
              {configId}
              {currentlyLoadedVersion !== null && currentlyLoadedVersion > 0 && (
                <span className="text-gray-400 ml-1">v{currentlyLoadedVersion}</span>
              )}
            </span>
          </div>
          <MaterialIcon
            icon={configDetailsOpen ? "expand_less" : "expand_more"}
            size="small"
            className="text-gray-400"
          />
        </button>

        {/* Accordion Content */}
        {configDetailsOpen && (
          <div className="px-4 pb-4 space-y-4 bg-gray-50 border-t border-gray-100">
            {/* Config Selector */}
            <div className="pt-3">
              <label htmlFor="config-selector" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Configuration
              </label>
              <Select
                id="config-selector"
                value={configId}
                onChange={(e) => onConfigSelect(e.target.value)}
                className="w-full font-medium"
              >
                {allConfigs.map((cfg) => (
                  <option key={cfg.config_id} value={cfg.config_id}>
                    {cfg.config_id}{" "}
                    {cfg.versionCount > 0
                      ? `(${cfg.versionCount} versions)`
                      : "(no versions)"}
                  </option>
                ))}
              </Select>
            </div>

            {/* Import/Export */}
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                <MaterialIcon icon="upload" size="small" className="text-sm" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={onImport}
                  className="hidden"
                />
              </label>
              <button
                onClick={onExport}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MaterialIcon icon="download" size="small" className="text-sm" />
                <span>Export</span>
              </button>
            </div>

            {/* Version toggle */}
            {latestVersionNumber > 0 && (
              <button
                onClick={onToggleVersions}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MaterialIcon
                  icon={showVersions ? "visibility_off" : "history"}
                  size="small"
                  className="text-sm"
                />
                <span>{showVersions ? "Hide" : "Show"} Version History ({latestVersionNumber})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
