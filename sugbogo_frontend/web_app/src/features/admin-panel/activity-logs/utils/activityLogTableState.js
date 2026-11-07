import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_MODULES,
} from "../constants/activityLogOptions";

const FILTER_KEYS = [
  "category", "module", "action", "actor_id", "start_date", "end_date",
];

/** Read supported filter values and bounded pagination without coercing large actor identifiers. */
export function readActivityLogState(searchParams) {
  const category = searchParams.get("category");
  const module = searchParams.get("module");
  const action = searchParams.get("action");
  const page = Number(searchParams.get("page"));
  const pageSize = Number(searchParams.get("page_size"));
  return {
    category: ACTIVITY_CATEGORIES.some((item) => item.id === category) ? category : "all",
    module: ACTIVITY_MODULES.some((item) => item.value === module) ? module : "",
    action: ACTIVITY_ACTIONS.some((item) => item.value === action) ? action : "",
    actor_id: searchParams.get("actor_id") || "",
    start_date: searchParams.get("start_date") || "",
    end_date: searchParams.get("end_date") || "",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    page_size: Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100 ? pageSize : 10,
    event_id: searchParams.get("event_id") || null,
  };
}

/** Apply URL changes atomically and reset only pagination affected by changed criteria. */
export function updateActivityLogParams(
  previous,
  updates,
  resetPage = true,
) {
  const next = new URLSearchParams(previous);
  for (const [key, value] of Object.entries(updates)) {
    if (value === "" || value == null || (key === "category" && value === "all")) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  if (resetPage) next.delete("page");
  return next;
}

/** Clear criteria while keeping page size and the independently selected occurrence intact. */
export function resetActivityLogParams(previous) {
  return updateActivityLogParams(
    previous,
    Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
  );
}

/** Project URL state into only the backend list query parameters. */
export function activityLogListParams(state) {
  return {
    category: state.category,
    module: state.module || undefined,
    action: state.action || undefined,
    actor_id: state.actor_id || undefined,
    start_date: state.start_date || undefined,
    end_date: state.end_date || undefined,
    page: state.page,
    page_size: state.page_size,
  };
}
