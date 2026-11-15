import { PAYMENT_FILTERS } from "./paymentPresentation";

const FILTER_KEYS = [
  "search",
  "financial_status",
  "fulfilment_status",
  "provider",
  "mode",
  "checkout_outcome",
  "needs_review",
  "start_date",
  "end_date",
  "ordering",
];

/** Read safe directory URL state without inventing API filters. */
export function readPaymentState(searchParams) {
  const page = Number(searchParams.get("page"));
  const pageSize = Number(searchParams.get("page_size"));
  const paymentId = Number(searchParams.get("payment_id"));
  return {
    ...Object.fromEntries(
      Object.entries(PAYMENT_FILTERS).map(([key, options]) => {
        const value = searchParams.get(key) || "";
        return [
          key,
          options.some((option) => option.value === value) ? value : "",
        ];
      }),
    ),
    search: (searchParams.get("search") || "").slice(0, 200),
    start_date: searchParams.get("start_date") || "",
    end_date: searchParams.get("end_date") || "",
    ordering: ["oldest", "amount_highest", "amount_lowest"].includes(
      searchParams.get("ordering"),
    )
      ? searchParams.get("ordering")
      : "newest",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    page_size:
      Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 100
        ? pageSize
        : 10,
    paymentId:
      Number.isSafeInteger(paymentId) && paymentId > 0 ? paymentId : null,
  };
}

/** Apply filter changes atomically so the next request always starts on page one. */
export function updatePaymentParams(previous, updates, resetPage = true) {
  const next = new URLSearchParams(previous);
  for (const [key, value] of Object.entries(updates)) {
    if (value === "" || value == null) next.delete(key);
    else next.set(key, String(value));
  }
  if (resetPage) next.delete("page");
  return next;
}

/** Clear only directory criteria while preserving the selected page size. */
export function resetPaymentParams(previous) {
  return updatePaymentParams(
    previous,
    Object.fromEntries(FILTER_KEYS.map((key) => [key, null])),
  );
}

/** Project UI state into the exact list request contract, omitting unset filters. */
export function paymentListParams(state, search = state.search) {
  return {
    ...Object.fromEntries(
      Object.keys(PAYMENT_FILTERS).map((key) => [key, state[key] || undefined]),
    ),
    search: search.trim() || undefined,
    start_date: state.start_date || undefined,
    end_date: state.end_date || undefined,
    ordering: state.ordering,
    page: state.page,
    page_size: state.page_size,
  };
}
