import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/shared/constants/layout";

/**
 * Returns bottom spacing needed to keep content above the app tab bar.
 *
 * Allows screens to add their own extra breathing room when needed.
 */
export function useTabBarSpacing(extraSpacing = 12) {
  const insets = useSafeAreaInsets();

  return TAB_BAR_HEIGHT + insets.bottom + extraSpacing;
}
