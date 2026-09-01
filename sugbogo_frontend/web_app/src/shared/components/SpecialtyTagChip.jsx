import { Heart } from "lucide-react";

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
 * Supports a compact variant for dense layouts and optionally displays
 * the number of vouches associated with the specialty.
 */
export default function SpecialtyTagChip({
  tag,
  size = "default",
  vouchCount,
  chipStyle = true,
}) {
  const isSmall = size === "small";
  const hasVouchCount = vouchCount !== undefined;

  return (
    <span
      className={`inline-flex items-center ${chipStyle ? "rounded-full" : "rounded-md"} font-medium ${
        isSmall ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      } ${colorClasses[tag.color] ?? colorClasses.blue}`}
    >
      <span>{tag.name}</span>

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
