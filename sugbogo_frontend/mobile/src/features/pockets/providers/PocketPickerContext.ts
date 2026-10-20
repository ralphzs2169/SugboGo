import { createContext, useContext } from "react";

export const PocketPickerContext = createContext<{
  openPocketPicker: (businessId: number) => void;
  isOpen: boolean;
} | null>(null);

/** Optional context keeps card consumers independent of the native sheet host. */
export function usePocketPicker() {
  return useContext(PocketPickerContext);
}
