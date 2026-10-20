import type { BusinessReview } from "../types/review.types";

/** Creates a complete review fixture so tests retain the current API contract. */
export function businessReviewFixture(
  overrides: Partial<BusinessReview> = {},
): BusinessReview {
  return {
    id: 1,
    text: "A helpful visit.",
    status: "published",
    like_count: 0,
    sentiment_label: null,
    sentiment_score: null,
    is_liked: false,
    is_liked_by_owner: false,
    is_own_review: false,
    has_reported: false,
    created_at: "2026-09-28T00:00:00Z",
    updated_at: "2026-09-28T00:00:00Z",
    author: { id: 1, first_name: "Ana", last_name: "Cruz", avatar_url: null },
    photos: [],
    vouched_specialties: [],
    reply: null,
    active_dispute_id: null,
    ...overrides,
  };
}
