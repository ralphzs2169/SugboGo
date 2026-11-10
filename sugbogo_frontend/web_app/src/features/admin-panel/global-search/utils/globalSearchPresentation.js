import { getBusinessStatusConfig } from "@/shared/constants/businessStatus";
import { formatLabel } from "@/shared/utils/stringUtils";
import applicationStatusConfig from "../../business-applications/config/applicationStatus.config";
import {
  UPDATE_REQUEST_STATUS_TABS,
  UPDATE_REQUEST_STATUS_VARIANTS,
} from "../../business-update-requests/constants/businessUpdateRequestStatus";
import { REVIEW_STATUSES } from "../../all-reviews/utils/allReviewPresentation";
import { REVIEW_DISPUTE_STATUS_BADGE_VARIANT } from "../../review-disputes/constants/reviewDisputeStatus";
import {
  USER_STATUS_OPTIONS,
  USER_STATUS_BADGE_VARIANT,
} from "../../users/constants/userManagement";

export const GLOBAL_SEARCH_HEADINGS = {
  business: "Businesses",
  user: "Users",
  application: "Merchant Applications",
  business_name_request: "Business Name Requests",
  classification_request: "Classification Requests",
  location_request: "Location Requests",
  review: "Reviews",
  review_dispute: "Review Disputes",
};

/** Preserve each management module's established status labels and badge variants. */
export function getGlobalSearchStatus(type, status) {
  const fallback = { label: formatLabel(status), variant: "neutral" };

  switch (type) {
    case "business":
      return getBusinessStatusConfig(status);
    case "user":
      return {
        label: USER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? fallback.label,
        variant: USER_STATUS_BADGE_VARIANT[status] ?? fallback.variant,
      };
    case "application":
      return applicationStatusConfig[status] ?? fallback;
    case "business_name_request":
    case "classification_request":
    case "location_request":
      return {
        label: UPDATE_REQUEST_STATUS_TABS.find((tab) => tab.id === status)?.label ?? fallback.label,
        variant: UPDATE_REQUEST_STATUS_VARIANTS[status] ?? fallback.variant,
      };
    case "review":
      return REVIEW_STATUSES[status] ?? fallback;
    case "review_dispute":
      return {
        label: fallback.label,
        variant: REVIEW_DISPUTE_STATUS_BADGE_VARIANT[status] ?? fallback.variant,
      };
    default:
      return fallback;
  }
}
