/**
 * Global theme constants.
 *
 * Purpose:
 * - Provides color values for APIs that cannot use NativeWind/Tailwind classes.
 * - Keeps hardcoded hex values out of components.
 *
 * Use this for Icon components(e.g. MaterialCommunityIcons)
 * ActivityIndicator, StatusBar, and other APIs that require color strings.
 *
 * Do NOT use this for styling components. Styling should be done with NativeWind classes.
 * e.g: bg-surface, text-text-primary, border-border
 *
 */

export const theme = {
  extends: {
    colors: {
      brand: "#F27F0D",

      brandLight: "#F27F0D33",
      brandDark: "#F27F0D99",
      brandMuted: "#F27F0D24",

      background: "#F8F9FA", // screen bg
      surface: "#FFFFFF", // card/top bar bg
      surfaceMuted: "#F3F4F6",
      surfaceMutedStrong: "#D1D5DB",

      text: {
        primary: "#111827",
        secondary: "#6b7280",
        tertiary: "#999999",
        disabled: "#B5B5B5",
        info: "#2563EB",
      },

      border: {
        primary: "#E5E7EB",
        secondary: "#AEB4BC",
        disabled: "#E5E7EB",
        error: "#ef4444",
        success: "#16A34A",
        info: "#DBEAFE",
      },

      info: "#EFF6FF",
      success: "#22C55E",
      error: "#DC2626",
    },
  },
};
