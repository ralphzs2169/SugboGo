import apiClient from "@/shared/api/apiClient";

/** Read current operational counts without changing unknown ages or reported-case semantics. */
export async function fetchDashboardSummary({ signal } = {}) {
  const response = await apiClient.get("/admin/dashboard/", { signal });
  return response.data.data;
}

/** Read the latest supported administrative decisions independently of other Dashboard data. */
export async function fetchDashboardRecentDecisions({ signal } = {}) {
  const response = await apiClient.get("/admin/dashboard/recent-decisions/", {
    signal,
  });
  return response.data.data;
}

/** Preserve the server's calendar window, partial-day metadata, and all assigned-role categories. */
export async function fetchDashboardPlatformOverview({ signal } = {}) {
  const response = await apiClient.get("/admin/dashboard/platform-overview/", {
    signal,
  });
  return response.data.data;
}

/** Preserve worklist identities, queue timestamps, priorities, and optional metadata unchanged. */
export async function fetchDashboardPriorityWorklist({ signal } = {}) {
  const response = await apiClient.get("/admin/dashboard/priority-worklist/", {
    signal,
  });
  return response.data.data;
}
