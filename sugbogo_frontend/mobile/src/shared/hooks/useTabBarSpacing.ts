// src/shared/hooks/useTabBarSpacing.ts
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/shared/constants/layout";

export function useTabBarSpacing() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + (insets.bottom || 12) + 42; // +12 gap above the bar
}
