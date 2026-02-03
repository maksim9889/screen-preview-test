import { Button } from "../atoms/Button";
import { Modal } from "../molecules/Modal";

export interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAndLogout: () => void;
  onLogoutWithoutSave: () => void;
  isSaving?: boolean;
}

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  onSaveAndLogout,
  onLogoutWithoutSave,
  isSaving = false,
}: LogoutConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unsaved Changes" maxWidth="sm" showCloseButton={false}>
      <div className="py-2">
        <div className="flex items-start gap-4 mb-8">
          <div className="flex-shrink-0 text-amber-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-600 flex-1 leading-relaxed">
            You have unsaved changes. Would you like to save before logging out?
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="ghost" size="xs" disabled={isSaving} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onLogoutWithoutSave} variant="secondary" size="xs" disabled={isSaving} className="flex-1 !text-red-600 !border-red-200 hover:!bg-red-50">
            Discard
          </Button>
          <Button onClick={onSaveAndLogout} variant="primary" size="xs" disabled={isSaving} className="flex-1">
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
