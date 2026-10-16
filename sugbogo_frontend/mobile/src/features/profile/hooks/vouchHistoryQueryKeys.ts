import type { VouchHistoryOrdering } from "../types/vouchHistory.types";

export const VOUCH_HISTORY_QUERY_KEY = ["explorer-vouch-history"] as const;

/** Separates authenticated users and server ordering variants under one prefix. */
export function vouchHistoryQueryKey(
  userId: number | undefined,
  ordering: VouchHistoryOrdering,
) {
  return [...VOUCH_HISTORY_QUERY_KEY, userId, ordering] as const;
}
