export const summaryFixture = {
  total_reviews: 32,
  published: 20,
  under_review: 7,
  reported: 9,
};

export function reviewFixture(id = 41, overrides = {}) {
  return {
    id,
    text: `Review ${id} praises the food and friendly staff at Sugbo Bistro.`,
    author: {
      id: 7,
      first_name: "Ana",
      last_name: "Cruz",
      name: "Ana Cruz",
      email: "ana@example.com",
      role: "explorer",
      avatar_url: null,
      avatar_key: null,
    },
    business: {
      id: 9,
      name: "Sugbo Bistro",
      cover_photo_url: null,
      category_name: "Restaurants",
      cluster_name: "Food and Dining",
    },
    status: "published",
    submitted_at: "2026-10-10T17:30:00Z",
    first_photo_url: null,
    photo_count: 0,
    report_count: 3,
    pending_report_count: 1,
    ...overrides,
  };
}

export function listFixture(
  params = {},
  items = [reviewFixture(), reviewFixture(42, { status: "under_review" })],
) {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 10;
  return {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total_items: 32,
      total_pages: Math.ceil(32 / pageSize),
      has_next: page < Math.ceil(32 / pageSize),
      has_previous: page > 1,
    },
  };
}

export function detailFixture(id = 41, overrides = {}) {
  return {
    ...reviewFixture(id),
    text: `Full review ${id}: delicious food, thoughtful service, and a comfortable place to visit.\nWe would come back with friends.`,
    photos: [
      { id: 1, photo_url: "https://example.com/review-1.jpg" },
      { id: 2, photo_url: "https://example.com/review-2.jpg" },
    ],
    first_photo_url: "https://example.com/review-1.jpg",
    photo_count: 2,
    reports: [
      {
        id: 10,
        type: "spam",
        status: "pending",
        created_at: "2026-10-11T01:00:00Z",
        updated_at: "2026-10-11T02:00:00Z",
        withdrawn_at: null,
        explanation: "Concern about repeated review text.",
        admin_notes: "Existing report inspection notes.",
      },
      {
        id: 11,
        type: "off_topic",
        status: "withdrawn",
        created_at: "2026-10-10T23:00:00Z",
        updated_at: "2026-10-11T02:00:00Z",
        withdrawn_at: "2026-10-11T02:00:00Z",
        explanation: null,
        admin_notes: null,
      },
      {
        id: 12,
        type: "other",
        status: "rejected",
        created_at: "2026-10-10T22:00:00Z",
        updated_at: "2026-10-11T02:00:00Z",
        withdrawn_at: null,
        explanation: null,
        admin_notes: null,
      },
    ],
    updated_at: "2026-10-11T03:00:00Z",
    edited_at: "2026-10-11T02:30:00Z",
    published_at: "2026-10-10T17:31:00Z",
    sentiment: { label: "positive", score: 0.75 },
    moderation: {
      outcome: "safe",
      provider_unavailable: false,
      checked_at: "2026-10-10T17:31:00Z",
    },
    history: [
      {
        id: 20,
        action: "review_moderation_approved",
        created_at: "2026-10-11T02:00:00Z",
        actor: { id: 2, first_name: "Cebu", last_name: "Admin" },
        previous_review_status: "under_review",
        review_status: "published",
        notes: "Inspected the content and approved publication.",
      },
    ],
    moderation_links: {
      under_review: `/api/admin/under-review/${id}/`,
      reported_review: `/api/admin/review-reports/reviews/${id}/`,
      review_dispute: "/api/admin/review-disputes/73/",
    },
    ...overrides,
  };
}
