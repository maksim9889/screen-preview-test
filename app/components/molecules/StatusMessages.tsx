import { useEffect, useState } from "react";
import { StatusMessage } from "./StatusMessage";

export interface StatusMessagesProps {
  saveError?: string;
  savedAt?: string;
  versionCreated?: boolean;
  versionNumber?: number;
  configCreated?: boolean;
  importSuccess?: boolean;
  importedAt?: string;
  restoredVersion?: number;
  isAutosaving?: boolean;
  isSaving?: boolean;
  lastSavedAt?: string | null;
  fallbackWarning?: string;
}

interface MessageState {
  visible: boolean;
  fading: boolean;
}

const DISPLAY_DURATION = 5000; // 5 seconds
const FADE_DURATION = 300; // 300ms fade

// Format timestamp for display
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function StatusMessages({
  saveError,
  savedAt,
  versionCreated,
  versionNumber,
  configCreated,
  importSuccess,
  restoredVersion,
  isAutosaving,
  isSaving,
  lastSavedAt,
  fallbackWarning,
}: StatusMessagesProps) {
  const [errorState, setErrorState] = useState<MessageState>({ visible: false, fading: false });
  const [savedState, setSavedState] = useState<MessageState>({ visible: false, fading: false });
  const [versionState, setVersionState] = useState<MessageState>({ visible: false, fading: false });
  const [configState, setConfigState] = useState<MessageState>({ visible: false, fading: false });
  const [importState, setImportState] = useState<MessageState>({ visible: false, fading: false });
  const [restoredState, setRestoredState] = useState<MessageState>({ visible: false, fading: false });

  // Helper to create auto-dismiss effect with fade
  const useAutoDismiss = (
    trigger: boolean,
    setState: React.Dispatch<React.SetStateAction<MessageState>>,
    deps: React.DependencyList
  ) => {
    useEffect(() => {
      if (trigger) {
        setState({ visible: true, fading: false });
        const fadeTimer = setTimeout(() => {
          setState({ visible: true, fading: true });
        }, DISPLAY_DURATION);
        const hideTimer = setTimeout(() => {
          setState({ visible: false, fading: false });
        }, DISPLAY_DURATION + FADE_DURATION);
        return () => {
          clearTimeout(fadeTimer);
          clearTimeout(hideTimer);
        };
      } else {
        setState({ visible: false, fading: false });
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
  };

  // Auto-dismiss error after 5 seconds
  useAutoDismiss(!!saveError, setErrorState, [saveError]);

  // Auto-dismiss saved message (only show if no other success messages)
  useAutoDismiss(!!savedAt && !versionCreated && !configCreated && !importSuccess, setSavedState, [savedAt, versionCreated, configCreated, importSuccess]);

  // Auto-dismiss version created message
  useAutoDismiss(!!versionCreated && !configCreated, setVersionState, [versionCreated, configCreated]);

  // Auto-dismiss config created message
  useAutoDismiss(!!configCreated, setConfigState, [configCreated]);

  // Auto-dismiss import success message
  useAutoDismiss(!!importSuccess, setImportState, [importSuccess]);

  // Auto-dismiss restored message
  useAutoDismiss(!!restoredVersion, setRestoredState, [restoredVersion]);

  const fadeClass = "transition-opacity duration-300";
  const fadingClass = "opacity-0";

  return (
    <>
      {/* Autosave indicator - shows during autosave or briefly after */}
      {isAutosaving && isSaving && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
          <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Saving changes...</span>
        </div>
      )}

      {/* Autosaved confirmation - shows briefly after autosave completes */}
      {isAutosaving && !isSaving && (
        <div className="flex items-center gap-2 text-xs text-green-600 py-3">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved{lastSavedAt ? ` at ${formatTime(lastSavedAt)}` : ''}</span>
        </div>
      )}

      {/* Config fallback warning */}
      {fallbackWarning && (
        <StatusMessage type="warning" message={fallbackWarning} />
      )}

      {saveError && errorState.visible && (
        <div className={`${fadeClass} ${errorState.fading ? fadingClass : "opacity-100"}`}>
          <StatusMessage type="error" message={saveError} />
        </div>
      )}

      {savedAt && !versionCreated && !configCreated && !importSuccess && savedState.visible && (
        <div className={`${fadeClass} ${savedState.fading ? fadingClass : "opacity-100"}`}>
          <StatusMessage type="success" message="Saved" />
        </div>
      )}

      {versionCreated && versionNumber && !configCreated && versionState.visible && (
        <div className={`${fadeClass} ${versionState.fading ? fadingClass : "opacity-100"}`}>
          <StatusMessage
            type="info"
            message={`Version ${versionNumber} created`}
          />
        </div>
      )}

      {configCreated && configState.visible && (
        <div className={`${fadeClass} ${configState.fading ? fadingClass : "opacity-100"}`}>
          <StatusMessage
            type="success"
            message="New configuration created"
          />
        </div>
      )}

      {importSuccess && importState.visible && (
        <div className={`${fadeClass} ${importState.fading ? fadingClass : "opacity-100"}`}>
          <StatusMessage
            type="success"
            message="Configuration imported"
          />
        </div>
      )}

      {restoredVersion && restoredState.visible && (
        <div className={`${fadeClass} ${restoredState.fading ? fadingClass : "opacity-100"}`}>
          <StatusMessage
            type="info"
            message={`Restored to version ${restoredVersion}`}
          />
        </div>
      )}
    </>
  );
}
