import { createContext, useContext } from "react";

export const DashboardPreviewContext = createContext(null);

/** Read isolated development previews without touching authoritative query caches. */
export function useDashboardPreview() {
  return useContext(DashboardPreviewContext);
}
