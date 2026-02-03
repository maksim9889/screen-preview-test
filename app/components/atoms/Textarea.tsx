import type { TextareaHTMLAttributes } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({
  error = false,
  className = "",
  ...props
}: TextareaProps) {
  const baseStyles =
    "w-full px-2 py-1.5 border rounded text-xs resize-y text-gray-900 bg-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const errorStyles = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-500"
    : "border-gray-300";

  return (
    <textarea
      className={`${baseStyles} ${errorStyles} ${className}`}
      {...props}
    />
  );
}
