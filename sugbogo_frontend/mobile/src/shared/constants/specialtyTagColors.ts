export const specialtyTagColors = {
  blue: {
    background: "bg-blue-500",
    softBackground: "bg-blue-100",
    borderColor: "#3B82F6",
    text: "text-white",
    softText: "text-blue-700",
    accentText: "text-blue-500",
    icon: "#ffffff",
    softIcon: "#1D4ED8",
  },

  green: {
    background: "bg-green-600",
    softBackground: "bg-green-100",
    borderColor: "#16A34A",
    text: "text-white",
    softText: "text-green-700",
    accentText: "text-green-600",
    icon: "#ffffff",
    softIcon: "#15803D",
  },

  purple: {
    background: "bg-purple-600",
    softBackground: "bg-purple-100",
    borderColor: "#9333EA",
    text: "text-white",
    softText: "text-purple-700",
    accentText: "text-purple-600",
    icon: "#ffffff",
    softIcon: "#7E22CE",
  },

  yellow: {
    background: "bg-yellow-500",
    softBackground: "bg-yellow-100",
    borderColor: "#EAB308",
    text: "text-white",
    softText: "text-yellow-800",
    accentText: "text-yellow-600",
    icon: "#ffffff",
    softIcon: "#A16207",
  },

  red: {
    background: "bg-rose-600",
    softBackground: "bg-rose-100",
    borderColor: "#E11D48",
    text: "text-white",
    softText: "text-rose-700",
    accentText: "text-rose-600",
    icon: "#ffffff",
    softIcon: "#BE123C",
  },

  teal: {
    background: "bg-teal-700",
    softBackground: "bg-teal-100",
    borderColor: "#0F766E",
    text: "text-white",
    softText: "text-teal-800",
    accentText: "text-teal-700",
    icon: "#ffffff",
    softIcon: "#0F766E",
  },
} as const;

export type SpecialtyTagColor = keyof typeof specialtyTagColors;

export function getSpecialtyTagColor(color: string) {
  return (
    specialtyTagColors[color as SpecialtyTagColor] ?? specialtyTagColors.blue
  );
}
