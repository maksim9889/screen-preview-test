import { Button } from "../atoms/Button";
import { Modal } from "../molecules/Modal";

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: "info" | "error" | "warning" | "success";
}

export function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  variant = "info",
}: AlertDialogProps) {
  const variantColors = {
    info: "text-blue-600",
    error: "text-red-600",
    warning: "text-orange-600",
    success: "text-green-600",
  };

  const variantIcons = {
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
    error: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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
    success: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
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
      <div className="flex justify-end">
        <Button onClick={onClose} variant="primary" size="md">
          OK
        </Button>
      </div>
    </Modal>
  );
}
