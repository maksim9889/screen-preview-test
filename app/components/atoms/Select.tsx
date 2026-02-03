import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({
  error = false,
  className = "",
  children,
  ...props
}: SelectProps) {
  const baseStyles =
    "w-full px-3 py-2.5 border rounded-lg text-sm text-gray-900 bg-white cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const errorStyles = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-500"
    : "border-gray-200 hover:border-gray-300";

  return (
    <select
      className={`${baseStyles} ${errorStyles} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
