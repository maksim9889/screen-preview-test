import { useState } from "react";
import { Button } from "../atoms/Button";
import { FormField } from "../molecules/FormField";
import { Modal } from "../molecules/Modal";

export interface NewConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newConfigId: string) => void;
  currentConfigId: string;
  isSaving: boolean;
}

export function NewConfigDialog({
  isOpen,
  onClose,
  onConfirm,
  currentConfigId,
  isSaving,
}: NewConfigDialogProps) {
  const [newConfigId, setNewConfigId] = useState("");

  const handleConfirm = () => {
    const trimmedId = newConfigId.trim();
    if (trimmedId) {
      onConfirm(trimmedId);
      setNewConfigId("");
      onClose();
    }
  };

  const handleClose = () => {
    setNewConfigId("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Save as New Configuration">
      <div className="mb-4">
        <FormField
          label="Configuration Name"
          value={newConfigId}
          onChange={(e) => setNewConfigId(e.target.value)}
          placeholder="e.g., mobile, tablet, dark-mode"
          inputSize="md"
          autoFocus
        />
        <p className="mt-1.5 text-xs text-gray-500">
          Use letters, numbers, hyphens, and underscores only (1-50 characters).
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Current config: <span className="font-semibold">{currentConfigId}</span>
        </p>
      </div>

      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={handleClose} size="md">
          Cancel
        </Button>
        <Button
          variant="warning"
          onClick={handleConfirm}
          disabled={!newConfigId.trim() || isSaving}
          size="md"
        >
          {isSaving ? "Saving..." : "Create Configuration"}
        </Button>
      </div>
    </Modal>
  );
}
