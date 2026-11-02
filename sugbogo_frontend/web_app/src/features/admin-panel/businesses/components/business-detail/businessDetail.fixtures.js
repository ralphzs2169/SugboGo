/** Representative Task A responses for isolated Admin detail interaction and visual checks. */
export function businessFixture(overrides = {}) {
  const image =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#f2e4d2"/><rect x="95" y="140" width="450" height="270" rx="8" fill="#be7343"/><rect x="75" y="105" width="490" height="70" fill="#f27f0d"/><rect x="145" y="215" width="125" height="195" fill="#70472e"/><rect x="320" y="220" width="165" height="110" fill="#fef3d9"/><text x="320" y="151" text-anchor="middle" font-family="sans-serif" font-size="30" fill="white">Cebu Craft Cafe</text></svg>',
    );
  const specialties = ["Traditional", "Handmade", "Handcrafted"].map(
    (name, index) => ({
      id: index + 1,
      name,
      color: ["blue", "green", "purple"][index],
      icon: "tag",
      vouch_count: [10, 8, 6][index],
    }),
  );
  return {
    id: 41,
    business_name: "Cebu Craft Cafe",
    status: "active",
    cover_photo_url: image,
    description:
      "Locally crafted coffee and handmade Cebuano products. A neighborhood space for visitors and local makers.",
    category_name: "Cafe",
    cluster_name: "Food & Drink",
    cluster_icon: "coffee",
    specialty_tags: specialties,
    location: {
      address: "Unit 4, Gorordo Avenue, Barangay Camputhaw",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.3157,
      longitude: 123.8854,
    },
    landmarks: [],
    contact_number: "09171234567",
    email: "hello@example.com",
    website: "https://example.com",
    operating_hours: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].map((day) => ({
      day,
      is_open: true,
      is_24_hours: false,
      open_time: "08:00",
      close_time: "22:00",
    })),
    owner: {
      id: 12,
      name: "Ana Cruz",
      email: "merchant@example.com",
      status: "active",
      avatar_url: null,
      avatar_key: null,
    },
    current_specialty_vouch_count: 24,
    current_specialty_support: specialties.map((tag) => ({
      specialty_id: tag.id,
      specialty_name: tag.name,
      valid_vouches: tag.vouch_count,
      distinct_supporters: tag.vouch_count,
    })),
    published_review_count: 28,
    current_saved_count: 56,
    // Deliberately different aliases guard against accidentally reviving old field consumption.
    vouch_count: 999,
    review_count: 998,
    pocket_count: 997,
    sentiment_rating_enabled: true,
    sentiment_rating: {
      state: "ready",
      value: 4.3,
      contributing_review_count: 24,
      computed_at: "2026-11-02T03:00:00Z",
      experimental: true,
      automatic_updates_enabled: true,
    },
    review_insight_regeneration: {
      status: "idle",
      is_outstanding: false,
      content_available: true,
      content_is_current: true,
      requested_revision: 2,
      completed_revision: 2,
    },
    review_insights: {
      state: "ready",
      state_message: "Review insights are ready.",
      content_available: true,
      narrative:
        "Reviewers mention attentive service and locally made products.",
      frequent_mentions: [
        { label: "Attentive service", count: 7 },
        { label: "Locally made products", count: 4 },
      ],
      eligible_review_count: 18,
      analyzed_review_count: 18,
      is_sampled: false,
      minimum_eligible_review_count: 5,
      generated_at: "2026-11-02T02:00:00Z",
      coverage_start: "2026-10-03T02:00:00Z",
      coverage_end: "2026-11-02T02:00:00Z",
    },
    latest_reviews: [
      {
        id: 74,
        text: "Friendly staff and lovely handmade pieces.",
        status: "published",
        created_at: "2026-11-01T04:00:00Z",
        photos: [],
        author: { id: 8, first_name: "Maria", last_name: "Santos" },
        like_count: 3,
        report_count: 0,
      },
    ],
    photos: [1, 2, 3, 4].map((id) => ({
      id,
      category: id === 1 ? "storefront" : "interior",
      photo_url: image,
      file_name: "Business photo " + id,
    })),
    application: {
      id: 88,
      status: "approved",
      submission_count: 2,
      submitted_at: "2026-09-20T02:00:00Z",
      reviewed_at: "2026-09-22T02:00:00Z",
      identity: {
        representative_name: "Ana Cruz",
        representative_role: "owner",
      },
    },
    ...overrides,
  };
}

export function visitsFixture(value = 217) {
  return {
    business_id: 41,
    totals: { profile_visits: value, impressions: 800, saves: 3 },
    definitions: {
      profile_visits: "Recorded profile visits, not physical foot traffic.",
      deduplication: "One event per account, business and UTC day.",
    },
    meta: {
      availability: value == null ? "unavailable" : "partial",
      coverage_verified: false,
      generated_at: "2026-11-03T04:30:00Z",
      period: {
        timezone: "Asia/Manila",
        start_date: "2026-10-05",
        end_date: "2026-11-03",
      },
    },
  };
}

export function historyFixture(page = 1) {
  return {
    items: [
      {
        id: page === 1 ? 9 : 8,
        status: page === 1 ? "active" : "suspended",
        previous_status: page === 1 ? "suspended" : "active",
        actor_name: page === 1 ? "Admin Juan" : "Admin Maria",
        created_at:
          page === 1 ? "2026-11-02T06:15:00Z" : "2026-09-30T02:24:00Z",
        reason: page === 1 ? null : "Inaccurate business location.",
      },
    ],
    pagination: { page, has_next: page === 1, total_items: 2, total_pages: 2 },
  };
}
