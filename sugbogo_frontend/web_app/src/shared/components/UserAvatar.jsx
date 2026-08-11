import { User } from "lucide-react";

/**
 * Displays a user's profile avatar.
 *
 * Uses the provided profile image when available and falls back
 * to a neutral user icon when no avatar exists.
 */
export default function UserAvatar({ avatarUrl, size = "md", className = "" }) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  };

  const iconSizes = {
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
        className={`${sizeClass} border border-text-secondary shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} border border-text-secondary shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary ${className}`}
    >
      <User size={iconSize} />
    </div>
  );
}
