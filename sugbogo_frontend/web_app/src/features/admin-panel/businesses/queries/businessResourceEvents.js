export const BUSINESS_CHANGED_EVENT = "admin-business-changed";

/** Refresh existing consumers after decisions; null scopes an unknown affected business to all. */
export function notifyBusinessChanged(businessId) {
  window.dispatchEvent(
    new window.CustomEvent(BUSINESS_CHANGED_EVENT, {
      detail: { businessId },
    }),
  );
}
