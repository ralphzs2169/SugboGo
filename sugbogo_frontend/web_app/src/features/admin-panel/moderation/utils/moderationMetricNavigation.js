const SELECTION_KEYS = {
  "under-review": "under_review_id",
  reported: "reported_id",
  disputes: "dispute_id",
  "suspicious-reviews": "suspicious_id",
  "suspicious-vouches": "suspicious_vouch_id",
};

/** Open metric cases without retaining a conflicting selection or status filter. */
export function moderationMetricParams(
  searchParams,
  action,
  oldest,
) {
  const next = new URLSearchParams(searchParams);
  for (const key of [...Object.values(SELECTION_KEYS), "status"]) {
    next.delete(key);
  }
  next.set("queue_scope", action === "aging" ? "aging" : "pending");
  if (action === "oldest" && oldest && SELECTION_KEYS[oldest.queue]) {
    next.set(SELECTION_KEYS[oldest.queue], String(oldest.id));
    if (next.get("tab") === "suspicious") {
      next.set(
        "suspicious_type",
        oldest.queue === "suspicious-vouches" ? "vouches" : "reviews",
      );
    }
  }
  return next;
}
