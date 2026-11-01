import { dashboardQueryKeys } from "./dashboardQueryKeys.js";

/** Refresh pending work and decisions, plus overview when publication or assigned roles change. */
export function invalidateDashboardDecision(
  queryClient,
  { publication = false, roleComposition = false } = {},
) {
  const keys = [
    dashboardQueryKeys.summary,
    dashboardQueryKeys.recentDecisions,
    dashboardQueryKeys.priorityWorklist,
  ];
  if (publication || roleComposition) {
    keys.push(dashboardQueryKeys.platformOverview);
  }

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({
      queryKey,
      exact: true,
    })),
  );
}
