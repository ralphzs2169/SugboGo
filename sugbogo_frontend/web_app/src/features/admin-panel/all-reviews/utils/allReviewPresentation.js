export const REVIEW_STATUSES = {
  published: { label: "Published", variant: "successSoft" },
  under_review: { label: "Under Review", variant: "warningSoft" },
  flagged: { label: "Flagged", variant: "warningSoft" },
  rejected: { label: "Rejected", variant: "dangerSoft" },
};

export const REPORT_STATUSES = {
  pending: { label: "Pending", variant: "warningSoft" },
  approved: { label: "Approved", variant: "successSoft" },
  rejected: { label: "Rejected", variant: "mutedSoft" },
  withdrawn: { label: "Withdrawn", variant: "mutedSoft" },
};

export const REVIEW_HISTORY_LABELS = {
  review_moderation_approved: "Review approved and published",
  review_moderation_rejected: "Held review rejected",
  review_report_approved: "Report approved",
  review_report_rejected: "Report rejected",
  reported_review_kept: "Reported review kept",
  reported_review_rejected: "Reported review rejected",
  review_dispute_upheld: "Merchant dispute upheld",
  review_dispute_dismissed: "Merchant dispute dismissed",
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
});

/** Format an ISO instant once in Philippine time, independent of the browser zone. */
export function reviewDateParts(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

/** Prefer the Admin display name and use the supplied identity fields as fallback. */
export function reviewAuthorName(author) {
  return (
    author?.name?.trim() ||
    [author?.first_name, author?.last_name].filter(Boolean).join(" ") ||
    "Reviewer unavailable"
  );
}
