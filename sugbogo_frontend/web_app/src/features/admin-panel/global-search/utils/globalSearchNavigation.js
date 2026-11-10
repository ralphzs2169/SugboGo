/** Resolve only existing Admin record destinations, including URL-selected workspaces. */
export function getGlobalSearchDestination(type, id) {
  const recordId = encodeURIComponent(id);

  switch (type) {
    case "business":
      return `/admin-panel/businesses/${recordId}`;
    case "user":
      return `/admin-panel/users/${recordId}`;
    case "application":
      return `/admin-panel/business/application/${recordId}`;
    case "business_name_request":
      return `/admin-panel/businesses/update-requests/${recordId}`;
    case "classification_request":
      return `/admin-panel/businesses/update-requests/classification/${recordId}`;
    case "location_request":
      return `/admin-panel/businesses/update-requests/location/${recordId}`;
    case "review":
      return `/admin-panel/reviews?review_id=${recordId}`;
    case "review_dispute":
      return `/admin-panel/moderation-integrity?tab=disputes&dispute_id=${recordId}&status=all`;
    default:
      return null;
  }
}
