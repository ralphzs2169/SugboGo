export const BUSINESS_CHANGED_EVENT = "admin-business-changed";

/** Bridge lifecycle mutations to the existing manually fetched list, detail and map. */
export function notifyBusinessChanged(businessId) {
  window.dispatchEvent(
    new CustomEvent(BUSINESS_CHANGED_EVENT, {
      detail: { businessId },
    }),
  );
}
