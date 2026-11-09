const destinations = {
  admin_merchant_application: (id) => `/admin-panel/business/application/${id}`,
  admin_review_moderation: (id) =>
    `/admin-panel/moderation-integrity?tab=under-review&under_review_id=${id}`,
  admin_reported_review: (id) =>
    `/admin-panel/moderation-integrity?tab=reported&reported_id=${id}`,
  admin_review_dispute: (id) =>
    `/admin-panel/moderation-integrity?tab=disputes&dispute_id=${id}&status=all`,
};

/** Resolve only supported backend target types and positive integer record IDs. */
export function getNotificationDestination({ target_type, target_id }) {
  if (
    !Object.prototype.hasOwnProperty.call(destinations, target_type) ||
    !Number.isSafeInteger(target_id) || target_id <= 0
  ) {
    return null;
  }
  return destinations[target_type](target_id);
}
