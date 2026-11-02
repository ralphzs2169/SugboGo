import { fetchBusinessOverview } from "../services/businessService";

export const businessOverviewQueryKey = ["admin", "businesses", "overview"];

/** Share one cancellable overview request across mounted consumers. */
export function businessOverviewQueryOptions() {
  return {
    queryKey: businessOverviewQueryKey,
    queryFn: ({ signal }) => fetchBusinessOverview({ signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  };
}
