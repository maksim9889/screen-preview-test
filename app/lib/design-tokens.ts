/**
 * Design Tokens - Centralized design system values
 * Use these constants throughout the app for consistency
 */

export const SIZING = {
  sidebar: {
    min: 320,
    default: 420,
    max: 800,
    mobilePercent: 85,
  },
  input: {
    height: {
      sm: "h-8",
      md: "h-10",
      lg: "h-12",
    },
  },
  button: {
    height: {
      xs: "h-6",
      sm: "h-8",
      md: "h-10",
      lg: "h-12",
    },
  },
} as const;

// Material Design color palette
export const COLORS = {
  brand: {
    primary: "blue-600",
    primaryDark: "blue-700",
    primaryLight: "blue-500",
    secondary: "pink-500",
    secondaryDark: "pink-600",
    gradient: "from-blue-50 via-blue-100 to-indigo-100",
    accent: "indigo-500",
  },
  status: {
    success: "green-600",
    error: "red-600",
    warning: "orange-600",
    info: "blue-600",
  },
  background: {
    success: "bg-green-50",
    error: "bg-red-50",
    warning: "bg-orange-50",
    info: "bg-blue-50",
    primary: "bg-white",
    secondary: "bg-gray-50",
    tertiary: "bg-gray-100",
    surface: "bg-white",
  },
  text: {
    success: "text-green-700",
    error: "text-red-700",
    warning: "text-orange-700",
    info: "text-blue-700",
    primary: "text-gray-900",
    secondary: "text-gray-600",
    tertiary: "text-gray-400",
    onPrimary: "text-white",
  },
  border: {
    success: "border-green-200",
    error: "border-red-200",
    warning: "border-orange-200",
    info: "border-blue-200",
    light: "border-gray-100",
    medium: "border-gray-200",
    dark: "border-gray-300",
  },
} as const;

export const SPACING = {
  xs: "gap-1.5",
  sm: "gap-3",
  md: "gap-5",
  lg: "gap-8",
  xl: "gap-12",
} as const;

// Material Design uses 4dp border radius as standard
export const BORDER_RADIUS = {
  none: "rounded-none",
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
} as const;

// Material Design elevation levels
export const ELEVATION = {
  0: "",
  1: "shadow-sm",
  2: "shadow",
  3: "shadow-md",
  4: "shadow-lg",
  6: "shadow-xl",
  8: "shadow-2xl",
  12: "shadow-2xl",
  16: "shadow-2xl",
  24: "shadow-2xl",
} as const;

export const SHADOWS = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  "2xl": "shadow-2xl",
} as const;

export const TYPOGRAPHY = {
  size: {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
    xl: "text-xl",
    "2xl": "text-2xl",
  },
  weight: {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  },
} as const;

export const TRANSITIONS = {
  default: "transition-colors",
  all: "transition-all",
  fast: "transition-all duration-150",
  slow: "transition-all duration-300",
} as const;
