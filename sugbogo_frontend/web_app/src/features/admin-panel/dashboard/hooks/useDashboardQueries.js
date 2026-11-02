import { useQuery } from "@tanstack/react-query";
import { dashboardQueryOptions } from "../queries/dashboardQueryOptions";

/** Expose authoritative server queries with their native loading and error states. */
function useDashboardResource(resource, enabled) {
  return useQuery({
    ...dashboardQueryOptions[resource](),
    enabled,
  });
}

/** Expose the operational summary's native query state and targeted recovery. */
export function useDashboardSummary({ enabled = true } = {}) {
  return useDashboardResource("summary", enabled);
}

/** Keep recent administrative decisions independently loadable and retryable. */
export function useDashboardRecentDecisions({ enabled = true } = {}) {
  return useDashboardResource("recentDecisions", enabled);
}

/** Retain the platform overview's server-defined window and account-composition contract. */
export function useDashboardPlatformOverview({ enabled = true } = {}) {
  return useDashboardResource("platformOverview", enabled);
}

/** Keep pending work independently loadable, cancellable, and retryable. */
export function useDashboardPriorityWorklist({ enabled = true } = {}) {
  return useDashboardResource("priorityWorklist", enabled);
}
