import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getDiscoveryShortcuts } from "../api/exploreBusiness.service";

export const DISCOVERY_SHORTCUTS_QUERY_KEY = ["discovery-shortcuts"] as const;

export default function useDiscoveryShortcuts() {
  const query = useQuery({
    queryKey: DISCOVERY_SHORTCUTS_QUERY_KEY,
    queryFn: async () => {
      const response = await getDiscoveryShortcuts();

      return throwOnApiError(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    shortcuts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
