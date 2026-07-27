/**
 * Shared navigation options used across feature stack layouts.
 *
 * These options provide a consistent header appearance throughout the app,
 * reducing duplicated configuration in individual stack layouts.
 */
export const defaultStackScreenOptions = {
  headerShadowVisible: false,
  headerTitleAlign: "center" as const,
  headerTitleStyle: {
    fontWeight: "700" as const,
    fontSize: 16,
  },
};

export const slideFromRight = {
  animation: "slide_from_right" as const,
};
