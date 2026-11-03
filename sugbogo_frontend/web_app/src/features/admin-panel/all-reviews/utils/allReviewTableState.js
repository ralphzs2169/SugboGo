import { REVIEW_STATUSES } from "./allReviewPresentation";

const FILTER_KEYS = [
  "search",
  "status",
  "reported",
  "start_date",
  "end_date",
  "ordering",
];

/** Read safe directory URL state without inventing API filters. */
export function readAllReviewState(searchParams) {
  const status = searchParams.get("status") || "";
  const reported = searchParams.get("reported") || "";
  const page = Number(searchParams.get("page"));
  const pageSize = Number(searchParams.get("page_size"));
  const reviewId = Number(searchParams.get("review_id"));
  return {
    search: (searchParams.get("search") || "").slice(0, 200),
    status: Object.hasOwn(REVIEW_STATUSES, status) ? status : "",
    reported: ["true", "false"].includes(reported) ? reported : "",
    start_date: searchParams.get("start_date") || "",
    end_date: searchParams.get("end_date") || "",
    ordering: searchParams.get("ordering") === "oldest" ? "oldest" : "newest",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    page_size:
      Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100
        ? pageSize
        : 10,
    reviewId: Number.isSafeInteger(reviewId) && reviewId > 0 ? reviewId : null,
  };
}

/** Apply filter changes atomically so the next request always starts on page one. */
export function updateAllReviewParams(previous, updates, resetPage = true) {
  const next = new URLSearchParams(previous);
  for (const [key, value] of Object.entries(updates)) {
    if (value === "" || value == null) next.delete(key);
    else next.set(key, String(value));
  }
  if (resetPage) next.delete("page");
  return next;
}

/** Clear only directory criteria while preserving the selected page size. */
export function resetAllReviewParams(previous) {
  return updateAllReviewParams(
    previous,
    Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
  );
}

/** Project UI state into the exact list request contract, omitting unset filters. */
export function allReviewListParams(state, search = state.search) {
  return {
    search: search.trim() || undefined,
    status: state.status || undefined,
    reported: state.reported || undefined,
    start_date: state.start_date || undefined,
    end_date: state.end_date || undefined,
    ordering: state.ordering,
    page: state.page,
    page_size: state.page_size,
  };
}
