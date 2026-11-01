/** Synthetic API responses used only by focused Dashboard presentation tests. */
export function dashboardFixture(url) {
  if (url === "/admin/dashboard/") {
    return {
      as_of: "2026-11-01T04:00:00Z",
      applications: {
        pending_review: 17,
        aging: { on_time: 6, approaching: 4, overdue: 5, unknown_age: 2 },
      },
      change_requests: {
        pending_total: 19,
        by_type: { business_name: 3, classification: 7, location: 9 },
      },
      reviews_under_review: 23,
      reported_review_cases: 29,
      pending_disputes: 31,
      active_businesses: 137,
    };
  }
  if (url === "/admin/dashboard/priority-worklist/") {
    return {
      as_of: "2026-11-01T04:01:00Z",
      items: [
        {
          id: "merchant_application:12",
          type: "merchant_application",
          title: "Merchant application awaiting review",
          entity: { id: 12, label: "Fixture application" },
          status: "submitted",
          priority: "overdue",
          timestamp: "2026-10-20T02:00:00Z",
          timestamp_source: "application_submitted_at",
          application_aging: { status: "overdue", business_days: 8 },
          pending_report_count: null,
        },
        {
          id: "reported_review:18",
          type: "reported_review",
          title: "Reported review awaiting resolution",
          entity: { id: 18, label: "Fixture reported business" },
          status: "pending",
          priority: "pending",
          timestamp: "2026-10-25T02:00:00Z",
          timestamp_source: "first_pending_report_created_at",
          application_aging: null,
          pending_report_count: 3,
        },
      ],
    };
  }
  if (url === "/admin/dashboard/recent-decisions/") {
    return {
      items: [
        {
          id: "application_review:23",
          action: "application_approved",
          action_label: "Application approved",
          entity: {
            type: "merchant_application",
            id: 12,
            label: "Fixture approved business",
          },
          administrator_name: "Fixture administrator",
          timestamp: "2026-11-01T02:30:00Z",
        },
      ],
    };
  }
  if (url === "/admin/dashboard/platform-overview/") {
    return {
      as_of: "2026-11-01T04:00:00Z",
      activity: {
        window: {
          start: "2026-10-25T16:00:00Z",
          end_exclusive: "2026-11-01T04:00:00Z",
          timezone: "Asia/Manila",
          includes_partial_day: true,
        },
        applications_submitted: 41,
        reviews_published: 43,
        vouches_created: 47,
        daily: Array.from({ length: 7 }, (_, index) => ({
          date: new Date(Date.UTC(2026, 9, 26 + index))
            .toISOString()
            .slice(0, 10),
          applications_submitted: [2, 3, 4, 5, 6, 7, 14][index],
          reviews_published: [1, 2, 3, 4, 5, 6, 22][index],
          vouches_created: [0, 2, 3, 4, 5, 6, 27][index],
        })),
        definitions: {
          applications_submitted: "Retained latest submissions",
          reviews_published: "Persisted first publications",
          vouches_created: "Retained vouch creations",
        },
      },
      user_distribution: {
        explorer: 53,
        merchant: 59,
        admin: 2,
        super_admin: 1,
        unknown_role: 3,
        total: 118,
        scope: "All retained accounts by current role",
      },
    };
  }
  if (url === "/admin/analytics/discovery-scores/") {
    return {
      coverage: {
        failed: 11,
        active_businesses: 137,
        snapshot_at: "2026-11-01T04:00:00Z",
      },
      results: [],
    };
  }
  return {};
}
