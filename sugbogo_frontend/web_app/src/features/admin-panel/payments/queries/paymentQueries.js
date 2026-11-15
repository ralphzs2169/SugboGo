import {
  fetchPayment,
  fetchPayments,
  fetchPaymentSummary,
} from "../services/paymentService";

export const paymentKeys = {
  summary: ["admin", "payments", "summary"],
  list: (params) => ["admin", "payments", "list", params],
  detail: (paymentId) => ["admin", "payments", "detail", paymentId],
};

/** Share a cancellable global summary and refresh when returning to Admin inspection. */
export function paymentSummaryOptions() {
  return {
    queryKey: paymentKeys.summary,
    queryFn: ({ signal }) => fetchPaymentSummary({ signal }),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  };
}

/** Keep pages in separate caches without displaying a previous page's rows. */
export function paymentListOptions(params) {
  return {
    queryKey: paymentKeys.list(params),
    queryFn: ({ signal }) => fetchPayments(params, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  };
}

/** Isolate selected-payment data and revalidate cached details whenever reopened. */
export function paymentDetailOptions(paymentId) {
  return {
    queryKey: paymentKeys.detail(paymentId),
    queryFn: ({ signal }) => fetchPayment(paymentId, { signal }),
    enabled: Number.isSafeInteger(paymentId) && paymentId > 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  };
}
