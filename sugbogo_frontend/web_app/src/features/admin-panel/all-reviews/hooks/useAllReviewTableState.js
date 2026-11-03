import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import useDebounce from "@/shared/hooks/useDebounce";
import {
  allReviewListParams,
  readAllReviewState,
  resetAllReviewParams,
  updateAllReviewParams,
} from "../utils/allReviewTableState";

/** Keep directory criteria and selection in URL state with the shared 400ms debounce. */
export default function useAllReviewTableState() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Stable column callbacks keep the drawer's View-button focus target connected.
  const updateParams = useRef(setSearchParams);
  useEffect(() => {
    updateParams.current = setSearchParams;
  }, [setSearchParams]);
  const state = readAllReviewState(searchParams);
  const search = useDebounce(state.search);
  const isSearching = state.search !== search;

  const changeFilters = useCallback((updates) => {
    updateParams.current(
      (previous) => updateAllReviewParams(previous, updates),
      { replace: true },
    );
  }, []);

  const selectReview = useCallback((reviewId) => {
    updateParams.current(
      (previous) =>
        updateAllReviewParams(previous, { review_id: reviewId }, false),
      { replace: true },
    );
  }, []);

  function changePagination(next) {
    const current = { pageIndex: state.page - 1, pageSize: state.page_size };
    const value = typeof next === "function" ? next(current) : next;
    setSearchParams((previous) =>
      updateAllReviewParams(
        previous,
        {
          page: value.pageIndex + 1,
          page_size: value.pageSize,
        },
        value.pageSize !== state.page_size,
      ),
    );
  }

  function resetFilters() {
    setSearchParams(resetAllReviewParams, { replace: true });
  }

  return {
    state,
    params: allReviewListParams(state, search),
    isSearching,
    hasActiveFilters: Boolean(
      state.search ||
      state.status ||
      state.reported ||
      state.start_date ||
      state.end_date ||
      state.ordering !== "newest",
    ),
    changeFilters,
    changePagination,
    selectReview,
    resetFilters,
  };
}
