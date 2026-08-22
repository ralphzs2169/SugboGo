import { theme } from "@/constants/theme";

export const specialtyTagColors = {
  blue: {
    background: "bg-blue-500",

    selectedBorder: "border-blue-500",
    text: "text-white",
    icon: "#ffffff",
  },
  green: {
    background: "bg-green-600",

    selectedBorder: "border-green-600",
    text: "text-white",
    icon: "#ffffff",
  },
  purple: {
    background: "bg-purple-600",
    selectedBorder: "border-purple-600",
    text: "text-white",
    icon: "#ffffff",
  },
  yellow: {
    background: "bg-yellow-500",
    selectedBorder: theme.extends.colors.brand,
    text: "text-white",
    icon: "#ffffff",
  },
  red: {
    background: "bg-rose-600",
    selectedBorder: theme.extends.colors.brand,
    text: "text-white",
    icon: "#ffffff",
  },
  teal: {
    background: "bg-teal-700",

    selectedBorder: theme.extends.colors.brand,
    text: "text-white",
    icon: "#ffffff",
  },
} as const;

export type SpecialtyTagColor = keyof typeof specialtyTagColors;

export function getSpecialtyTagColor(color: string) {
  return (
    specialtyTagColors[color as SpecialtyTagColor] ?? specialtyTagColors.blue
  );
}
