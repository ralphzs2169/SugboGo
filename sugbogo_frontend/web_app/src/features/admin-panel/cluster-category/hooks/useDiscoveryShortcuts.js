import { useQuery } from "@tanstack/react-query";
import { discoveryShortcutQueryOptions } from "../../explore-configuration/queries/discoveryShortcutQueries";

/** Expose shortcut pages, retained refresh data, and request-specific recovery. */
export default function useDiscoveryShortcuts(
  params = {},
  { enabled = true } = {},
) {
  const query = useQuery({
    ...discoveryShortcutQueryOptions(params),
    enabled,
  });

  return {
    shortcuts: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
