import { Button } from "../atoms/Button";
import { Modal } from "../molecules/Modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  isProcessing?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "warning",
  isProcessing = false,
}: ConfirmDialogProps) {
  const variantColors = {
    danger: "text-red-600",
    warning: "text-orange-600",
    info: "text-blue-600",
  };

  const variantButtonVariants: Record<typeof variant, "danger" | "warning" | "info"> = {
    danger: "danger",
    warning: "warning",
    info: "info",
  };

  const variantIcons = {
    danger: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    warning: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm" showCloseButton={false}>
      <div className="flex items-start gap-3 mb-6">
        <div className={`flex-shrink-0 ${variantColors[variant]}`}>
          {variantIcons[variant]}
        </div>
        <p className="text-sm text-gray-600 flex-1">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <Button onClick={onClose} variant="secondary" size="md" disabled={isProcessing}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant={variantButtonVariants[variant]}
          size="md"
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
