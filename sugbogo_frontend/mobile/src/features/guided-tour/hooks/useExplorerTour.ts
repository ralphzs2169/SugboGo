import { createContext, useContext } from "react";
import type { View } from "react-native";

import type { useBookmarkTourTargets } from "./useBookmarkTourTargets";

export const ExplorerTourContext = createContext<{
  requestReplay: () => void | false;
  setExploreLocationReady: (ready: boolean) => void;
  setTarget: (name: string, node: View | null) => void;
  invalidateLayout: () => void;
  bookmark?: Omit<ReturnType<typeof useBookmarkTourTargets>, "candidate">;
} | null>(null);

/** Gives Explorer routes access to their tour without requiring a global store. */
export function useExplorerTour() {
  return useContext(ExplorerTourContext);
}
