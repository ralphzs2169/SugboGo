import { User } from "lucide-react";

/**
 * Displays a user's profile avatar.
 *
 * Uses the provided profile image when available and falls back to a polished
 * neutral avatar treatment when no profile image exists.
 */
export default function UserAvatar({ avatarUrl, size = "md", className = "" }) {
  const sizeClasses = {
    xs: "h-4 w-4",
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };

  const iconSizes = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 18,
  };

  const sizeClass = sizeClasses[size] ?? sizeClasses.md;
  const iconSize = iconSizes[size] ?? iconSizes.md;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full border border-stroke object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-secondary ring-1 ring-inset ring-stroke ${className}`}
    >
      <User size={iconSize} strokeWidth={1.8} />
    </div>
  );
}
