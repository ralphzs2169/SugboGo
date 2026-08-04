export const specialtyTagColors = {
  blue: {
    background: "bg-blue-100",
    border: "border-blue-200",
    selectedBorder: "border-blue-500",
    text: "text-blue-700",
    icon: "#1d4ed8",
  },
  green: {
    background: "bg-green-100",
    border: "border-green-200",
    selectedBorder: "border-green-500",
    text: "text-green-700",
    icon: "#15803d",
  },
  purple: {
    background: "bg-purple-100",
    border: "border-purple-200",
    selectedBorder: "border-purple-500",
    text: "text-purple-700",
    icon: "#7e22ce",
  },
  yellow: {
    background: "bg-yellow-100",
    border: "border-yellow-200",
    selectedBorder: "border-yellow-500",
    text: "text-yellow-700",
    icon: "#a16207",
  },
  red: {
    background: "bg-red-100",
    border: "border-red-200",
    selectedBorder: "border-red-500",
    text: "text-red-700",
    icon: "#b91c1c",
  },
  teal: {
    background: "bg-teal-100",
    border: "border-teal-200",
    selectedBorder: "border-teal-500",
    text: "text-teal-700",
    icon: "#0f766e",
  },
} as const;

export type SpecialtyTagColor = keyof typeof specialtyTagColors;

export function getSpecialtyTagColor(color: string) {
  return (
    specialtyTagColors[color as SpecialtyTagColor] ?? specialtyTagColors.blue
  );
}
