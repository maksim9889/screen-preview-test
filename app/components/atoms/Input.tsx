import type { InputHTMLAttributes } from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  inputSize?: InputSize;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "px-2 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
};

export function Input({
  error = false,
  inputSize = "md",
  className = "",
  ...props
}: InputProps) {
  const baseStyles =
    "w-full border rounded text-gray-900 bg-white transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const errorStyles = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-500"
    : "border-gray-300";

  return (
    <input
      className={`${baseStyles} ${errorStyles} ${sizeStyles[inputSize]} ${className}`}
      {...props}
    />
  );
}
