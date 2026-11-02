import { useQuery } from "@tanstack/react-query";
import { dashboardQueryOptions } from "../queries/dashboardQueryOptions";
import { useDashboardPreview } from "../preview/DashboardPreviewContext";

/** Keep real query identity intact while development previews supply isolated query state. */
function useDashboardResource(resource, enabled) {
  const preview = useDashboardPreview()?.queries[resource];
  const query = useQuery({
    ...dashboardQueryOptions[resource](),
    enabled: enabled && !preview,
  });
  return preview ?? query;
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
