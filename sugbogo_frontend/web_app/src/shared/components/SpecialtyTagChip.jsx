import { Heart, Tag } from "lucide-react";

import { SPECIALTY_TAG_ICONS } from "@/features/admin-panel/specialty-tags/constants/specialtyTagIcons";

export const TAG_COLORS = ["blue", "green", "purple", "yellow", "red", "teal"];

export const colorClasses = {
  blue: "bg-blue-500 text-white",
  green: "bg-green-600 text-white",
  purple: "bg-purple-600 text-white",
  yellow: "bg-yellow-500 text-white",
  red: "bg-rose-600 text-white",
  teal: "bg-teal-700 text-white",
};

export const ringClasses = {
  blue: "ring-blue-600",
  green: "ring-green-700",
  purple: "ring-purple-700",
  yellow: "ring-yellow-600",
  red: "ring-rose-700",
  teal: "ring-teal-800",
};

/**
 * Displays a specialty tag using its configured color.
 *
 * Supports compact sizing, optional specialty icon display, and optional
 * vouch count presentation for reusable tag rendering across the app.
 */
export default function SpecialtyTagChip({
  tag,
  size = "default",
  vouchCount,
  chipStyle = true,
  showIcon = false,
}) {
  const isSmall = size === "small";
  const hasVouchCount = vouchCount !== undefined;

  const selectedIcon = SPECIALTY_TAG_ICONS.find(
    (option) => option.value === tag.icon,
  );

  const Icon = selectedIcon?.icon ?? Tag;

  return (
    <span
      className={`inline-flex items-center ${
        chipStyle ? "rounded-full" : "rounded-md"
      } font-medium ${
        isSmall ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      } ${colorClasses[tag.color] ?? colorClasses.blue}`}
    >
      {/* Specialty icon */}
      {showIcon && (
        <Icon
          className={`shrink-0 ${isSmall ? "mr-1 h-3 w-3" : "mr-1.5 h-3.5 w-3.5"}`}
          strokeWidth={2.25}
        />
      )}

      {/* Specialty name */}
      <span>{tag.name}</span>

      {/* Vouch count */}
      {hasVouchCount && (
        <>
          <span className="mx-1.5 h-3 w-px bg-white/30" />

          <Heart
            className="shrink-0"
            size={isSmall ? 11 : 13}
            fill="currentColor"
          />

          <span className="ml-1 font-bold">{vouchCount}</span>
        </>
      )}
    </span>
  );
}
