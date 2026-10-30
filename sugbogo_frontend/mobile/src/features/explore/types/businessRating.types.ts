/** Exact optional Explorer snapshot; absence also supports disabled/older servers. */
export type BusinessSentimentRating = {
  value: number | null;
  contributing_review_count: number | null;
  state: "pending" | "ready" | "insufficient_data" | "unavailable";
  experimental: boolean;
  provenance: "legacy_unverified" | "versioned" | null;
  scoring_version: string | null;
  calculation_version: string;
  computed_at: string | null;
  automatic_updates_enabled: boolean;
};
