import { keepPreviousData } from "@tanstack/react-query";
import { fetchDiscoveryShortcuts } from "../../cluster-category/services/clusterCategoryService";

export const discoveryShortcutQueryKey = [
  "admin",
  "explore-configuration",
  "discovery-shortcuts",
];

/** Cache shortcut pages independently of business taxonomy counts and inventories. */
export function discoveryShortcutQueryOptions(params) {
  return {
    queryKey: [...discoveryShortcutQueryKey, params],
    queryFn: ({ signal }) => fetchDiscoveryShortcuts(params, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  };
}
