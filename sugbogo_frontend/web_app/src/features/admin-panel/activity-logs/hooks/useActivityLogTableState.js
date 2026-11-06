import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  activityLogListParams,
  readActivityLogState,
  resetActivityLogParams,
  updateActivityLogParams,
} from "../utils/activityLogTableState";

/** Keep filters, pages, and independent drawer selection in the existing URL-state pattern. */
export default function useActivityLogTableState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const updateParams = useRef(setSearchParams);
  useEffect(() => {
    updateParams.current = setSearchParams;
  }, [setSearchParams]);
  const state = readActivityLogState(searchParams);

  const changeFilters = useCallback((updates) => {
    updateParams.current(
      (previous) => updateActivityLogParams(previous, updates),
      { replace: true },
    );
  }, []);

  const selectEvent = useCallback((eventId) => {
    updateParams.current(
      (previous) => updateActivityLogParams(previous, { event_id: eventId }, false),
      { replace: true },
    );
  }, []);

  function changePagination(next) {
    const current = { pageIndex: state.page - 1, pageSize: state.page_size };
    const value = typeof next === "function" ? next(current) : next;
    setSearchParams((previous) => updateActivityLogParams(
      previous,
      { page: value.pageIndex + 1, page_size: value.pageSize },
      value.pageSize !== state.page_size,
    ));
  }

  function resetFilters() {
    setSearchParams(resetActivityLogParams, { replace: true });
  }

  return {
    state,
    params: activityLogListParams(state),
    hasActiveFilters: Boolean(
      state.category !== "all" || state.module || state.action ||
      state.actor_id || state.start_date || state.end_date,
    ),
    changeFilters,
    changePagination,
    selectEvent,
    resetFilters,
  };
}
