export const TAG_COLORS = ["blue", "green", "purple", "yellow", "red", "teal"];

export const colorClasses = {
  blue: "bg-blue-500 text-white",
  green: "bg-green-600 text-white ",
  purple: "bg-purple-600 text-white ",
  yellow: "bg-yellow-500 text-white ",
  red: "bg-rose-600 text-white",
  teal: "bg-teal-700 text-white ",
};

/**
 * Displays a specialty tag using its configured color.
 */
export default function SpecialtyTagChip({ tag, fullWidth = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-full ${fullWidth ? "w-full text-[10px] py-0.5" : "w-auto py-1 text-xs"} px-3  font-medium ${
        colorClasses[tag.color] ?? colorClasses.blue
      }`}
    >
      {tag.name}
    </span>
  );
}
