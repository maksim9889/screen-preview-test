import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { AppConfig } from "../../lib/types";
import { CSRF_FIELD_NAME } from "../../lib/constants";
import { ConfigHeader } from "../organisms/ConfigHeader";
import { CarouselSection } from "../organisms/CarouselSection";
import { TextSection } from "../organisms/TextSection";
import { CTASection } from "../organisms/CTASection";
import { SortableSectionWrapper } from "../organisms/SortableSectionWrapper";
import { StatusMessages } from "../molecules/StatusMessages";
import { VersionHistory } from "../organisms/VersionHistory";
import { AlertDialog } from "../organisms/AlertDialog";
import { ConfirmDialog } from "../organisms/ConfirmDialog";

interface EditorProps {
  username: string;
  configId: string;
  config: AppConfig;
  sectionOrder: string[];
  onConfigChange: (config: AppConfig) => void;
  onSave: () => void;
  onSaveVersion: () => void;
  onSaveAsNewConfig: () => void;
  onRestoreVersion: (version: number) => void;
  onConfigSelect: (configId: string) => void;
  onLogout: () => void;
  onImport: (importData: string) => void;
  onModalOpenChange?: (isOpen: boolean) => void;
  onSectionOrderChange?: (order: string[]) => void;
  csrfToken: string;
  isSaving: boolean;
  saveError?: string;
  savedAt?: string;
  versionCreated?: boolean;
  versionNumber?: number;
  configCreated?: boolean;
  importSuccess?: boolean;
  importedAt?: string;
  restoredVersion?: number;
  versions: Array<{
    id: number;
    version: number;
    createdAt: string;
    data: AppConfig;
  }>;
  latestVersionNumber: number;
  currentlyLoadedVersion: number | null;
  allConfigs: Array<{
    config_id: string;
    updatedAt: string;
    versionCount: number;
  }>;
  lastSavedAt?: string | null;
  hasUnsavedChanges?: boolean;
  isAutosaving?: boolean;
  fallbackWarning?: string;
}

export default function Editor({
  username,
  configId,
  config,
  sectionOrder,
  onSectionOrderChange,
  onConfigChange,
  onSave,
  onSaveVersion,
  onSaveAsNewConfig,
  onRestoreVersion,
  onConfigSelect,
  onLogout,
  onImport,
  onModalOpenChange,
  csrfToken,
  isSaving,
  saveError,
  savedAt,
  versionCreated,
  versionNumber,
  configCreated,
  importSuccess,
  importedAt,
  restoredVersion,
  versions,
  latestVersionNumber,
  currentlyLoadedVersion,
  allConfigs,
  lastSavedAt,
  hasUnsavedChanges,
  isAutosaving,
  fallbackWarning,
}: EditorProps) {
  const [showVersions, setShowVersions] = useState(false);
  const [showImportError, setShowImportError] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);
  const [versionHistoryModalOpen, setVersionHistoryModalOpen] = useState(false);

  // sectionOrder is passed as a prop from parent and managed via onSectionOrderChange

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Use ref to always get latest config (avoids stale closure issues with fast typing)
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const updateCarousel = useCallback((updates: Partial<AppConfig["carousel"]>) => {
    const currentConfig = configRef.current;
    onConfigChange({
      ...currentConfig,
      carousel: { ...currentConfig.carousel, ...updates },
    });
  }, [onConfigChange]);

  const updateText = useCallback((updates: Partial<AppConfig["textSection"]>) => {
    const currentConfig = configRef.current;
    onConfigChange({
      ...currentConfig,
      textSection: { ...currentConfig.textSection, ...updates },
    });
  }, [onConfigChange]);

  const updateCTA = useCallback((updates: Partial<AppConfig["cta"]>) => {
    const currentConfig = configRef.current;
    onConfigChange({
      ...currentConfig,
      cta: { ...currentConfig.cta, ...updates },
    });
  }, [onConfigChange]);

  const handleExport = () => {
    // Navigate to page route export endpoint (uses cookie auth)
    window.location.href = `/home/export/${configId}`;
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importData = event.target?.result as string;
        JSON.parse(importData); // Validate JSON
        // Store the data and show confirmation dialog
        setPendingImportData(importData);
        setShowImportConfirm(true);
      } catch (error) {
        console.error("Failed to parse import file:", error);
        setShowImportError(true);
      }
    };
    reader.onerror = () => {
      console.error("Failed to read import file:", reader.error);
      setShowImportError(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (pendingImportData) {
      onImport(pendingImportData);
    }
    setShowImportConfirm(false);
    setPendingImportData(null);
  };

  const handleCancelImport = () => {
    setShowImportConfirm(false);
    setPendingImportData(null);
  };

  // Notify parent when any modal is open
  useEffect(() => {
    const anyModalOpen = showImportError || showImportConfirm || versionHistoryModalOpen;
    onModalOpenChange?.(anyModalOpen);
  }, [showImportError, showImportConfirm, versionHistoryModalOpen, onModalOpenChange]);

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sectionOrder.indexOf(active.id as string);
      const newIndex = sectionOrder.indexOf(over.id as string);
      const newOrder = arrayMove(sectionOrder, oldIndex, newIndex);
      onSectionOrderChange?.(newOrder);
    }
  };

  const sectionComponents = useMemo(() => ({
    carousel: <CarouselSection config={config} onUpdate={updateCarousel} />,
    textSection: <TextSection config={config} onUpdate={updateText} />,
    cta: <CTASection config={config} onUpdate={updateCTA} />,
  }), [config, updateCarousel, updateText, updateCTA]);

  const sectionTitles = {
    carousel: "Carousel",
    textSection: "Text Section",
    cta: "Call to Action",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable container with sticky header inside */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Header with sticky save section */}
        <ConfigHeader
          username={username}
          configId={configId}
          latestVersionNumber={latestVersionNumber}
          currentlyLoadedVersion={currentlyLoadedVersion}
          allConfigs={allConfigs}
          isSaving={isSaving}
          showVersions={showVersions}
          onLogout={onLogout}
          onConfigSelect={onConfigSelect}
          onSave={onSave}
          onSaveVersion={onSaveVersion}
          onSaveAsNewConfig={onSaveAsNewConfig}
          onToggleVersions={() => setShowVersions(!showVersions)}
          onExport={handleExport}
          onImport={handleImportFile}
          hasUnsavedChanges={hasUnsavedChanges}
        />

        {/* Status messages */}
        <div className="px-4 bg-white">
          <StatusMessages
            saveError={saveError}
            savedAt={savedAt}
            versionCreated={versionCreated}
            versionNumber={versionNumber}
            configCreated={configCreated}
            importSuccess={importSuccess}
            importedAt={importedAt}
            restoredVersion={restoredVersion}
            isAutosaving={isAutosaving}
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            fallbackWarning={fallbackWarning}
          />
        </div>

        {/* Version History Panel */}
        {showVersions && (
          <VersionHistory
            versions={versions}
            onRestore={onRestoreVersion}
            onClose={() => setShowVersions(false)}
            onModalOpenChange={setVersionHistoryModalOpen}
          />
        )}

        {/* Sections */}
        <div className="px-4 py-5 bg-gray-50 min-h-[200px]">
          <DndContext
            id="section-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sectionOrder}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-5">
                {sectionOrder.map((sectionId) => (
                  <SortableSectionWrapper
                    key={sectionId}
                    id={sectionId}
                    title={sectionTitles[sectionId as keyof typeof sectionTitles]}
                  >
                    {sectionComponents[sectionId as keyof typeof sectionComponents]}
                  </SortableSectionWrapper>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Import Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={handleCancelImport}
        onConfirm={handleConfirmImport}
        title="Import Configuration"
        message="This will overwrite your current configuration. Are you sure you want to import?"
        confirmLabel="Import"
        cancelLabel="Cancel"
        variant="warning"
      />

      {/* Import Error Alert */}
      <AlertDialog
        isOpen={showImportError}
        onClose={() => setShowImportError(false)}
        title="Import Error"
        message="The selected file is not a valid JSON configuration file. Please ensure you're importing a properly formatted configuration export."
        variant="error"
      />
    </div>
  );
}
