import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/** Reconcile a selected ID without treating a missing list row as deletion. */
export default function useSelectedTransitRecord({
  id,
  fallback,
  list,
  detail,
  field,
  queryKey,
}) {
  const client = useQueryClient();
  const checkedList = useRef(null);
  const unavailable = Boolean(id && detail.error?.response?.status === 404);
  const listed = !list.error && !list.isPlaceholderData
    ? list.items.find((item) => String(item.id) === String(id))
    : null;
  const current = detail[field];
  const useListed = listed && list.dataUpdatedAt > detail.dataUpdatedAt;
  const record = !id || unavailable ? null : (
    useListed ? listed : current ?? listed ?? fallback
  );

  useEffect(() => {
    if (id && useListed && !unavailable && detail.dataUpdatedAt > 0) {
      // Discard an older in-flight detail response before adopting this list result.
      void client.cancelQueries({ queryKey, exact: true });
      client.setQueryData(queryKey, listed, { updatedAt: list.dataUpdatedAt });
    }
  }, [client, id, useListed, unavailable, listed, list.dataUpdatedAt, detail.dataUpdatedAt, queryKey]);

  useEffect(() => {
    const check = String(id) + ":" + list.dataUpdatedAt;
    if (
      id && !listed && !list.error && !list.isPlaceholderData &&
      detail.dataUpdatedAt > 0 && list.dataUpdatedAt > detail.dataUpdatedAt &&
      !detail.isFetching && checkedList.current !== check
    ) {
      checkedList.current = check;
      void detail.refetch();
    }
  }, [id, listed, list.error, list.isPlaceholderData, list.dataUpdatedAt,
    detail.dataUpdatedAt, detail.isFetching, detail.refetch]);

  return {
    record,
    unavailable,
    error: detail.error,
    refetch: detail.refetch,
    canAct: Boolean(record && !detail.error && !detail.isLoading && !detail.isFetching),
  };
}
