export type MerchantRecentActivityType = "review" | "vouch" | "save";

export type MerchantRecentActivityItem = {
  id: string;
  type: MerchantRecentActivityType;
  occurred_at: string;
  date: string;
  time_basis:
    "published_at" | "created_at_fallback" | "latest_vouch" | "latest_save";
  title: string;
  description: string;
  actor_name: string | null;
  count: number;
  specialties: { id: number; name: string }[];
  remaining_specialties: number;
  target: { type: "business_review"; id: number } | null;
};

export type MerchantRecentActivity = {
  business: { id: number; name: string; status: string };
  items: MerchantRecentActivityItem[];
  snapshot_as_of: string;
  is_partial: boolean;
  timezone: "Asia/Manila";
  grouping: { vouches: "explorer_day"; saves: "day" };
  sources: {
    saves: {
      availability: "available" | "unavailable";
      coverage: "recorded_events_only";
    };
  };
};
