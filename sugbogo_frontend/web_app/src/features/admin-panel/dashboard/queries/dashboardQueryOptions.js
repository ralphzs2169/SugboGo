import {
  fetchDashboardPlatformOverview,
  fetchDashboardRecentDecisions,
  fetchDashboardSummary,
} from "../../services/dashboardService";
import { dashboardQueryKeys } from "./dashboardQueryKeys";

/** Give each server-owned snapshot its own cache identity and cancellation signal. */
function resourceOptions(queryKey, fetchResource, staleTime) {
  return {
    queryKey,
    queryFn: ({ signal }) => fetchResource({ signal }),
    staleTime,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  };
}

export const dashboardQueryOptions = {
  summary: () => resourceOptions(
    dashboardQueryKeys.summary,
    fetchDashboardSummary,
    30_000,
  ),
  recentDecisions: () => resourceOptions(
    dashboardQueryKeys.recentDecisions,
    fetchDashboardRecentDecisions,
    30_000,
  ),
  platformOverview: () => resourceOptions(
    dashboardQueryKeys.platformOverview,
    fetchDashboardPlatformOverview,
    60_000,
  ),
};
