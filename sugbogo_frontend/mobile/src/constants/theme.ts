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
      background: "#ffffff",
      surface: "#f3f4f6",

      text: {
        secondary: "#6b7280",
        tertiary: "#999999",
      },
      error: "#DC2626",
    },
  },
};
