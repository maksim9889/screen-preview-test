export type StatusType = "success" | "error" | "info" | "warning";

export interface StatusMessageProps {
  type: StatusType;
  message: string;
  onDismiss?: () => void;
}

// Material Design status styles
const statusStyles: Record<
  StatusType,
  { bg: string; text: string; border: string; weight: string }
> = {
  success: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    weight: "font-medium",
  },
  error: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    weight: "font-medium",
  },
  info: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    weight: "font-normal",
  },
  warning: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    weight: "font-medium",
  },
};

export function StatusMessage({
  type,
  message,
  onDismiss,
}: StatusMessageProps) {
  const styles = statusStyles[type];

  return (
    <div
      className={`px-4 py-2.5 ${styles.bg} ${styles.text} ${styles.weight} text-xs border-b ${styles.border} flex items-center justify-between tracking-wide`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 hover:opacity-70 transition-opacity text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
