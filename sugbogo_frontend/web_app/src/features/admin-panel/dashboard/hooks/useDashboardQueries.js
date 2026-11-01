import { useQuery } from "@tanstack/react-query";
import { dashboardQueryOptions } from "../queries/dashboardQueryOptions";

/** Expose the operational summary's native query state and targeted recovery. */
export function useDashboardSummary({ enabled = true } = {}) {
  return useQuery({ ...dashboardQueryOptions.summary(), enabled });
}

/** Keep recent administrative decisions independently loadable and retryable. */
export function useDashboardRecentDecisions({ enabled = true } = {}) {
  return useQuery({ ...dashboardQueryOptions.recentDecisions(), enabled });
}

/** Retain the platform overview's server-defined window and account-composition contract. */
export function useDashboardPlatformOverview({ enabled = true } = {}) {
  return useQuery({ ...dashboardQueryOptions.platformOverview(), enabled });
}

/** Keep pending work independently loadable, cancellable, and retryable. */
export function useDashboardPriorityWorklist({ enabled = true } = {}) {
  return useQuery({ ...dashboardQueryOptions.priorityWorklist(), enabled });
}
