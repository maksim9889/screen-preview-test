import { useState, useEffect } from "react";
import { Button } from "../atoms/Button";
import { ConfirmDialog } from "./ConfirmDialog";
import type { AppConfig } from "../../lib/types";

export interface VersionHistoryProps {
  versions: Array<{
    id: number;
    version: number;
    createdAt: string;
    data: AppConfig;
  }>;
  onRestore: (version: number) => void;
  onClose: () => void;
  onModalOpenChange?: (isOpen: boolean) => void;
}

export function VersionHistory({
  versions,
  onRestore,
  onClose,
  onModalOpenChange,
}: VersionHistoryProps) {
  const [versionToRestore, setVersionToRestore] = useState<number | null>(null);

  // Notify parent when modal state changes
  useEffect(() => {
    onModalOpenChange?.(versionToRestore !== null);
  }, [versionToRestore, onModalOpenChange]);

  const handleRestoreClick = (version: number) => {
    setVersionToRestore(version);
  };

  const handleConfirmRestore = () => {
    if (versionToRestore !== null) {
      onRestore(versionToRestore);
      setVersionToRestore(null);
      onClose();
    }
  };

  if (versions.length === 0) return null;

  return (
    <>
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 max-h-52 overflow-y-auto">
        <h3 className="text-xs font-semibold text-gray-900 mb-2">
          Version History
        </h3>
        <div className="flex flex-col gap-1.5">
          {versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:border-gray-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900">
                  v{version.version}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {new Date(version.createdAt).toLocaleString()}
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleRestoreClick(version.version)}
                className="ml-2 flex-shrink-0"
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={versionToRestore !== null}
        onClose={() => setVersionToRestore(null)}
        onConfirm={handleConfirmRestore}
        title="Restore Version"
        message={`Are you sure you want to restore to version ${versionToRestore}? Your current unsaved changes will be overwritten.`}
        confirmLabel="Restore"
        cancelLabel="Cancel"
        variant="warning"
      />
    </>
  );
}
