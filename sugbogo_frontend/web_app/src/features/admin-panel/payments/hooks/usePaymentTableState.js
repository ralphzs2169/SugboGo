import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import useDebounce from "@/shared/hooks/useDebounce";
import {
  paymentListParams,
  readPaymentState,
  resetPaymentParams,
  updatePaymentParams,
} from "../utils/paymentTableState";

/** Keep directory criteria and selection in URL state with the shared 400ms debounce. */
export default function usePaymentTableState() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Stable column callbacks keep the drawer's View-button focus target connected.
  const updateParams = useRef(setSearchParams);
  useEffect(() => {
    updateParams.current = setSearchParams;
  }, [setSearchParams]);
  const state = readPaymentState(searchParams);
  const search = useDebounce(state.search);
  const isSearching = state.search !== search;

  const changeFilters = useCallback((updates) => {
    updateParams.current((previous) => updatePaymentParams(previous, updates), {
      replace: true,
    });
  }, []);

  const selectPayment = useCallback((paymentId) => {
    updateParams.current(
      (previous) =>
        updatePaymentParams(previous, { payment_id: paymentId }, false),
      { replace: true },
    );
  }, []);

  function changePagination(next) {
    const current = { pageIndex: state.page - 1, pageSize: state.page_size };
    const value = typeof next === "function" ? next(current) : next;
    setSearchParams((previous) =>
      updatePaymentParams(
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
    setSearchParams(resetPaymentParams, { replace: true });
  }

  return {
    state,
    params: paymentListParams(state, search),
    isSearching,
    hasActiveFilters: Boolean(
      state.search ||
      state.financial_status ||
      state.fulfilment_status ||
      state.provider ||
      state.mode ||
      state.checkout_outcome ||
      state.needs_review ||
      state.start_date ||
      state.end_date ||
      state.ordering !== "newest",
    ),
    changeFilters,
    changePagination,
    selectPayment,
    resetFilters,
  };
}
