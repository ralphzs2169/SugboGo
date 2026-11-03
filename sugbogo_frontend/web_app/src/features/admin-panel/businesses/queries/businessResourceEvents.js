import appQueryClient from "@/lib/queryClient";
import { businessListKeys } from "./businessListQuery";

export const BUSINESS_CHANGED_EVENT = "admin-business-changed";

/** Refresh existing consumers after decisions; null scopes an unknown affected business to all. */
export function notifyBusinessChanged(businessId, queryClient = appQueryClient) {
  const refresh = queryClient.cancelQueries({
    queryKey: businessListKeys.all,
  }).then(() => queryClient.invalidateQueries({
    queryKey: businessListKeys.all,
  }));
  window.dispatchEvent(
    new window.CustomEvent(BUSINESS_CHANGED_EVENT, {
      detail: { businessId },
    }),
  );
  return refresh;
}
