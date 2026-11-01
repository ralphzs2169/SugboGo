export const dashboardLinkClass = "cursor-pointer rounded text-sm font-medium text-text-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-info";

export const dashboardQueues = {
  applications: "/admin-panel/businesses/applications?status=submitted",
  changes: "/admin-panel/businesses/update-requests?type=all&status=pending",
  underReview: "/admin-panel/moderation-integrity?tab=under-review",
  reports: "/admin-panel/moderation-integrity?tab=reported",
  disputes: "/admin-panel/moderation-integrity?tab=disputes",
  activeBusinesses: "/admin-panel/businesses?status=active",
};

export const workItemLabels = {
  merchant_application: "Application",
  business_name_change: "Name change",
  classification_change: "Classification change",
  location_change: "Location change",
  under_review: "Review under review",
  reported_review: "Reported review",
  review_dispute: "Dispute",
};

const agingLabels = {
  on_time: "On time",
  approaching: "Approaching",
  overdue: "Overdue",
  unknown_age: "Aging unavailable",
};

/** Map only recorded workflow identities to existing detail and workspace routes. */
export function workItemDestination(type, id) {
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  const destinations = {
    merchant_application: `/admin-panel/business/application/${id}`,
    business_name_change: `/admin-panel/businesses/update-requests/${id}`,
    classification_change: `/admin-panel/businesses/update-requests/classification/${id}`,
    location_change: `/admin-panel/businesses/update-requests/location/${id}`,
    under_review: `${dashboardQueues.underReview}&under_review_id=${id}`,
    reported_review: `${dashboardQueues.reports}&reported_id=${id}`,
    review_dispute: `/admin-panel/review-disputes/${id}`,
  };
  return destinations[type] ?? null;
}

/** Translate server categories without computing ages or assigning synthetic urgency. */
export function workItemStatus(item) {
  if (item.type === "merchant_application") {
    return agingLabels[item.application_aging?.status] ?? "Aging unavailable";
  }
  if (item.status === "under_review") {
    return "Under review";
  }
  if (item.status === "pending") {
    return "Pending";
  }
  return item.status?.replaceAll("_", " ") ?? "Status unavailable";
}

/** Reuse workflow destinations for normalized decisions; missing targets remain plain text. */
export function decisionDestination(event) {
  const type = event.entity?.type;
  const id = event.entity?.id;
  const workflowTypes = {
    merchant_application: "merchant_application",
    business_name_change_request: "business_name_change",
    business_classification_change_request: "classification_change",
    business_location_change_request: "location_change",
    review_dispute: "review_dispute",
  };
  if (type === "user") {
    return Number.isInteger(id) && id > 0 ? `/admin-panel/users/${id}` : null;
  }
  if (type === "review") {
    const reported = event.action.startsWith("reported_review_")
      || event.action.startsWith("review_report_");
    // The Reported workspace requires pending reports and cannot display history.
    return reported ? null : workItemDestination("under_review", id);
  }
  return workItemDestination(workflowTypes[type], id);
}

/** Select a server-provided update time without inventing a client snapshot time. */
export function latestDashboardTimestamp(...values) {
  return values
    .filter((value) => value && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}
