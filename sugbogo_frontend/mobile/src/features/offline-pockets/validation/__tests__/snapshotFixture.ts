import type { ExploreBusinessDetail } from "@/features/explore/types/exploreBusiness.types";

import { createOfflineBusinessSnapshot } from "../offlineBusinessSnapshot";

export function businessFixture(id = 21): ExploreBusinessDetail {
  return {
    id,
    business_name: "Sugbo Cafe",
    cluster: { id: 1, name: "Food", icon: "restaurant" },
    category: { id: 2, name: "Cafe" },
    specialty_tags: [
      {
        id: 3,
        name: "Coffee",
        color: "blue",
        icon: null,
        vouch_count: 9,
        is_vouched: true,
      },
    ],
    description: "Local coffee and pastries.",
    location: {
      address: "Cebu street",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.3157,
      longitude: 123.8854,
    },
    contact_number: "09123456789",
    email: "hello@example.com",
    website: "https://example.com",
    cover_photo_url: "https://example.com/cover.jpg",
    display_cover_photo_url: null,
    photos: [
      {
        id: 4,
        photo_url: "https://example.com/front.jpg",
        category: "storefront",
      },
    ],
    operating_hours: [
      {
        id: 5,
        day: "monday",
        is_open: true,
        is_24_hours: false,
        open_time: "08:00:00",
        close_time: "18:00:00",
      },
    ],
    review_count: 10,
    overall_vibe: null,
    is_pocketed: true,
    is_own_business: false,
    has_own_review: false,
    review_insights: null,
  };
}

export function snapshotFixture(
  id = 21,
  fetchedAt = "2026-10-22T01:00:00.000Z",
) {
  return createOfflineBusinessSnapshot(businessFixture(id), fetchedAt);
}
