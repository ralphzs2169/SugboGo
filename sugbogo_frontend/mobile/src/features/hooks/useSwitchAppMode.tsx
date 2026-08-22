import { useRouter } from "expo-router";

import {
  type AppMode,
  useAppModeStore,
} from "@/features/app-mode/store/appMode.store";

/**
 * Provides the action for switching between SugboGo's Explorer
 * and Merchant experiences.
 *
 * Updates the active application mode and navigates to the
 * corresponding mode's primary screen.
 */
export function useSwitchAppMode() {
  const router = useRouter();
  const setActiveMode = useAppModeStore((state) => state.setActiveMode);

  function switchMode(mode: AppMode) {
    setActiveMode(mode);

    if (mode === "merchant") {
      router.replace("/(merchant)/(tabs)/dashboard");
      return;
    }

    router.replace("/(explorer)/(tabs)/explore");
  }

  return {
    switchMode,
  };
}
