import { dashboardQueryKeys } from "./dashboardQueryKeys.js";

/** Refresh operational queues and decisions, plus activity when a review is first published. */
export function invalidateDashboardDecision(queryClient, { publication = false } = {}) {
  const keys = [
    dashboardQueryKeys.summary,
    dashboardQueryKeys.recentDecisions,
  ];
  if (publication) {
    keys.push(dashboardQueryKeys.platformOverview);
  }

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({
      queryKey,
      exact: true,
    })),
  );
}
