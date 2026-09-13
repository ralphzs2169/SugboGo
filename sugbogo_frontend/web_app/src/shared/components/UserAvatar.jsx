import { resolveAvatarSource } from "@/shared/constants/avatars";

/**
 * Displays a user's profile avatar.
 *
 * Uses an uploaded profile image first, then a selected or default SugboGo
 * built-in avatar.
 */
export default function UserAvatar({
  avatarUrl,
  avatarKey,
  size = "md",
  className = "",
}) {
  const sizeClasses = {
    xs: "h-4 w-4",
    sm: "h-6 w-6",
    md: "h-7 w-7",
    compact: "h-9 w-9",
    lg: "h-10 w-10",
  };

  const sizeClass = sizeClasses[size] ?? sizeClasses.md;
  const source = avatarUrl || resolveAvatarSource(avatarKey);

  return (
    <img
      src={source}
      alt=""
      className={`${sizeClass} shrink-0 rounded-full border border-stroke object-cover ${className}`}
    />
  );
}
