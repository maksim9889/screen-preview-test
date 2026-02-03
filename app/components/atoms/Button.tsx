import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "ghost";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
}

// Material Design button styles with elevation
const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 border-transparent shadow-md hover:shadow-lg active:shadow-sm",
  secondary:
    "text-blue-600 bg-transparent hover:bg-blue-50 active:bg-blue-100 border-blue-600",
  success:
    "text-white bg-green-600 hover:bg-green-700 active:bg-green-800 border-transparent shadow-md hover:shadow-lg active:shadow-sm",
  info: "text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border-blue-200",
  warning:
    "text-gray-900 bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 border-transparent shadow-md hover:shadow-lg active:shadow-sm",
  danger:
    "text-white bg-red-600 hover:bg-red-700 active:bg-red-800 border-transparent shadow-md hover:shadow-lg active:shadow-sm",
  ghost:
    "text-gray-700 bg-transparent hover:bg-gray-100 active:bg-gray-200 border-transparent",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "font-medium border rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide";
  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
