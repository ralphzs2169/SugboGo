import type {
  MerchantRecentActivity,
  MerchantRecentActivityItem,
} from "../types/merchantRecentActivity.types";

export function recentActivityItem(
  overrides: Partial<MerchantRecentActivityItem> = {},
): MerchantRecentActivityItem {
  return {
    id: "review:123",
    type: "review",
    occurred_at: "2026-10-20T04:30:00Z",
    date: "2026-10-20",
    time_basis: "published_at",
    title: "Angela Cruz left a review",
    description: "Friendly staff and beautifully made gifts.",
    actor_name: "Angela Cruz",
    count: 1,
    specialties: [],
    remaining_specialties: 0,
    target: { type: "business_review", id: 123 },
    ...overrides,
  };
}

export function recentActivitySnapshot(
  overrides: Partial<MerchantRecentActivity> = {},
): MerchantRecentActivity {
  return {
    business: { id: 8, name: "Cebu Coffee", status: "active" },
    items: [
      recentActivityItem(),
      recentActivityItem({
        id: "vouch:7:2026-10-20",
        type: "vouch",
        occurred_at: "2026-10-20T04:00:00Z",
        time_basis: "latest_vouch",
        title: "Miguel Santos vouched for 2 specialties",
        description: "Handmade Crafts, Locally Made",
        actor_name: "Miguel Santos",
        count: 2,
        specialties: [
          { id: 8, name: "Handmade Crafts" },
          { id: 9, name: "Locally Made" },
        ],
        target: null,
      }),
      recentActivityItem({
        id: "save:2026-10-20",
        type: "save",
        occurred_at: "2026-10-20T03:30:00Z",
        time_basis: "latest_save",
        title: "4 explorers saved your business",
        description: "",
        actor_name: null,
        count: 4,
        target: null,
      }),
    ],
    snapshot_as_of: "2026-10-20T05:00:00Z",
    is_partial: false,
    timezone: "Asia/Manila",
    grouping: { vouches: "explorer_day", saves: "day" },
    sources: {
      saves: { availability: "available", coverage: "recorded_events_only" },
    },
    ...overrides,
  };
}
