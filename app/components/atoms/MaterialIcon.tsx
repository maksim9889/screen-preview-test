export interface MaterialIconProps {
  icon: string;
  className?: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

const sizeClasses = {
  small: "text-lg",
  medium: "text-2xl",
  large: "text-4xl",
};

export function MaterialIcon({
  icon,
  className = "",
  size = "medium",
  onClick,
}: MaterialIconProps) {
  return (
    <span
      className={`material-icons ${sizeClasses[size]} ${className} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {icon}
    </span>
  );
}
