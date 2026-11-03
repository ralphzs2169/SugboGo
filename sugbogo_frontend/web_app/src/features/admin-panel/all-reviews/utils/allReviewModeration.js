const DESTINATIONS = [
  {
    key: "under_review",
    label: "Review moderation",
    pattern: /^\/api\/admin\/under-review\/([1-9]\d*)\/$/,
    tab: "under-review",
    selection: "under_review_id",
  },
  {
    key: "reported_review",
    label: "Pending reports",
    pattern: /^\/api\/admin\/review-reports\/reviews\/([1-9]\d*)\/$/,
    tab: "reported",
    selection: "reported_id",
  },
  {
    key: "review_dispute",
    label: "Merchant dispute",
    pattern: /^\/api\/admin\/review-disputes\/([1-9]\d*)\/$/,
    tab: "disputes",
    selection: "dispute_id",
  },
];

/** Map only supplied, recognized API detail links to existing Moderation selections. */
export function allReviewModerationDestinations(links) {
  return DESTINATIONS.flatMap((destination) => {
    const link = links?.[destination.key];
    const match =
      typeof link === "string" ? link.match(destination.pattern) : null;
    if (!match) return [];
    const params = new URLSearchParams({
      tab: destination.tab,
      [destination.selection]: match[1],
    });
    return [
      {
        key: destination.key,
        label: destination.label,
        to: `/admin-panel/moderation-integrity?${params}`,
      },
    ];
  });
}
