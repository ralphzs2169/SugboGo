import { theme } from "@/constants/theme";

export const specialtyTagColors = {
  blue: {
    background: "bg-blue-500",
    borderColor: "#3B82F6",
    text: "text-white",
    accentText: "text-blue-500",
    icon: "#ffffff",
  },

  green: {
    background: "bg-green-600",
    borderColor: "#16A34A",
    text: "text-white",
    accentText: "text-green-600",
    icon: "#ffffff",
  },

  purple: {
    background: "bg-purple-600",
    borderColor: "#9333EA",
    text: "text-white",
    accentText: "text-purple-600",
    icon: "#ffffff",
  },

  yellow: {
    background: "bg-yellow-500",
    borderColor: "#EAB308",
    text: "text-white",
    accentText: "text-yellow-600",
    icon: "#ffffff",
  },

  red: {
    background: "bg-rose-600",
    borderColor: "#E11D48",
    text: "text-white",
    accentText: "text-rose-600",
    icon: "#ffffff",
  },

  teal: {
    background: "bg-teal-700",
    borderColor: "#0F766E",
    text: "text-white",
    accentText: "text-teal-700",
    icon: "#ffffff",
  },
} as const;

export type SpecialtyTagColor = keyof typeof specialtyTagColors;

export function getSpecialtyTagColor(color: string) {
  return (
    specialtyTagColors[color as SpecialtyTagColor] ?? specialtyTagColors.blue
  );
}
