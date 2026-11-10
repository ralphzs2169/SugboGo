// These values mirror UnifiedActivityService.MODULES/ACTIONS and AdminActivity.Action.
export const ACTIVITY_CATEGORIES = [
  { id: "all", label: "All Activity" },
  { id: "administrative", label: "Administrative" },
  { id: "merchant", label: "Merchant" },
  { id: "explorer", label: "Explorer" },
  { id: "authentication", label: "Authentication" },
];

export const ACTIVITY_MODULES = [
  { value: "merchant_application", label: "Merchant applications" },
  { value: "business", label: "Business management" },
  { value: "user", label: "User management" },
  { value: "review_moderation", label: "Review moderation and disputes" },
  { value: "taxonomy", label: "Taxonomy management" },
  { value: "discovery", label: "Discovery configuration" },
  { value: "transit", label: "Transit management" },
  { value: "system_configuration", label: "System configuration" },
  { value: "reviews", label: "Reviews" },
  { value: "pocket", label: "Pocket" },
  { value: "community", label: "Community" },
  { value: "authentication", label: "Authentication" },
];

const ADMIN_ACTIONS = [
  "admin_created",
  "user_suspended",
  "user_reactivated",
  "business_suspended",
  "business_reactivated",
  "review_dispute_upheld",
  "review_dispute_dismissed",
  "review_report_approved",
  "review_report_rejected",
  "reported_review_kept",
  "reported_review_rejected",
  "review_moderation_approved",
  "review_moderation_rejected",
  "review_deleted_by_author",
  "business_name_change_approved",
  "business_name_change_rejected",
  "business_classification_change_approved",
  "business_classification_change_rejected",
  "business_location_change_approved",
  "business_location_change_rejected",
];

const SOURCE_ACTIONS = [
  "analytics_policy_revision",
  "merchant_application_submitted",
  ...[
    "business_name_change_request",
    "business_classification_change_request",
    "business_location_change_request",
  ].flatMap((source) => [
    `${source}_submitted`,
    `${source}_withdrawn`,
  ]),
  "merchant_review_dispute_filed",
  "merchant_review_dispute_withdrawn",
  "merchant_review_dispute_closed",
  "review_submitted",
  "business_vouch_submitted",
  "business_vouch_withdrawn",
  "business_saved",
  "review_liked",
  "login_succeeded",
  "login_failed",
  "login_unavailable",
];

export const ACTIVITY_ACTIONS = [...ADMIN_ACTIONS, ...SOURCE_ACTIONS].map(
  (value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " "),
  }),
);

export const STATE_LABELS = {
  status: "Status",
  role: "Role",
  is_active: "Active",
  name: "Name",
  category_id: "Category ID",
  cluster_id: "Cluster ID",
  specialty_tag_ids: "Specialty tag IDs",
  closure_reason: "Closure reason",
  sentiment_min_classified_reviews: "Minimum classified reviews for sentiment",
  narrative_min_eligible_reviews: "Minimum reviews for narrative",
  mention_min_supporting_reviews: "Minimum reviews supporting a mention",
  peer_min_businesses: "Minimum peer businesses",
  peer_positive_share_min_reviews: "Minimum reviews for peer comparisons",
  low_exposure_max_profile_visits: "Maximum low-exposure profile visits",
  low_exposure_min_distinct_supporters: "Minimum low-exposure supporters",
  onboarding_comparison_min_sample: "Minimum onboarding comparison sample",
};

export const CONTEXT_LABELS = {
  application_id: "Application ID",
  submission_id: "Submission ID",
  business_id: "Business ID",
  review_id: "Review ID",
  report_id: "Report ID",
  dispute_id: "Dispute ID",
  request_id: "Request ID",
  previous_transition_id: "Previous transition ID",
  report_count: "Report count",
  report_ids: "Report IDs",
  request_type: "Request type",
  decision: "Decision",
};

export const PROVENANCE_LABELS = {
  model: "Source model",
  domain_source_type: "Domain source type",
  domain_source_id: "Domain source ID",
  version: "Policy version",
  submission_number: "Submission number",
  business_id: "Business ID",
  requester_id: "Requester ID",
  review_id: "Review ID",
  specialty_tag_id: "Specialty tag ID",
  method: "Authentication method",
};
