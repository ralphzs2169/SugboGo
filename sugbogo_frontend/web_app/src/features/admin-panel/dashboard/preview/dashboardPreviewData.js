const DAY = 86400000;
const workflows = ["merchant_application", "business_name_change", "classification_change", "reported_review", "review_dispute"];
const actions = ["review_moderation_approved", "review_moderation_rejected", "user_suspended", "review_dispute_upheld", "user_reactivated"];
const actionLabels = ["Review published", "Review rejected", "User suspended", "Dispute upheld", "User reactivated"];

/** Build synthetic records with coherent calendar buckets and no dependence on test fixtures. */
export function createPreviewData() {
  const now = new Date();
  const asOf = now.toISOString();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const midnight = Date.parse(`${today}T00:00:00+08:00`);
  const start = midnight - 6 * DAY;
  const daily = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(start + index * DAY + 8 * 3600000).toISOString().slice(0, 10),
    applications_submitted: [2, 0, 4, 1, 3, 0, 1][index],
    reviews_published: [1, 2, 0, 3, 0, 1, 1][index],
    vouches_created: [0, 1, 0, 2, 1, 0, 1][index],
  }));
  const window = { start: new Date(start).toISOString(), end_exclusive: asOf, timezone: "Asia/Manila", includes_partial_day: true };
  return {
    summary: {
      as_of: asOf,
      applications: { pending_review: 12, aging: { on_time: 4, approaching: 3, overdue: 4, unknown_age: 1 } },
      change_requests: { pending_total: 6, by_type: { business_name: 1, classification: 2, location: 3 } },
      reviews_under_review: 3, reported_review_cases: 4, pending_disputes: 2,
      active_businesses: 10,
      business_status: { total: 12, active: 10, suspended: 2, unknown_status: 0 },
    },
    platformOverview: {
      as_of: asOf, active_accounts: 85,
      user_distribution: { total: 103, explorer: 70, merchant: 30, admin: 2, super_admin: 1, unknown_role: 0 },
      activity: {
        window, daily,
        applications_submitted: 11, reviews_published: 8, vouches_created: 5,
        previous: {
          window: { ...window, start: new Date(start - 7 * DAY).toISOString(), end_exclusive: new Date(now.getTime() - 7 * DAY).toISOString() },
          reviews_published: 4, vouches_created: 9,
        },
        definitions: {
          applications_submitted: "Retained submission events, including resubmissions.",
          reviews_published: "First publications of retained reviews; missing publication timestamps are excluded.",
          vouches_created: "Original creation of retained vouches, including withdrawn records.",
        },
      },
    },
    priorityWorklist: {
      as_of: asOf,
      items: workflows.map((type, index) => ({
        id: `preview:${type}`, type, title: "Sample pending case",
        status: "pending", timestamp: new Date(now.getTime() - (index + 1) * DAY).toISOString(),
        entity: { id: 900000 + index, label: `Preview business ${index + 1}` },
        application_aging: index === 0 ? { status: "overdue", business_days: 6 } : null,
        pending_report_count: type === "reported_review" ? 3 : null,
      })),
    },
    recentDecisions: {
      items: actions.map((action, index) => ({
        id: `preview:${action}`, action, action_label: actionLabels[index],
        entity: { type: index === 2 ? "user" : index === 3 ? "review_dispute" : "review", id: 900000 + index, label: `Preview entity ${index + 1}` },
        administrator_name: "Preview Administrator",
        timestamp: new Date(now.getTime() - index * 3600000).toISOString(),
      })),
    },
    scores: { coverage: { active_businesses: 10, fresh: 6, stale: 2, pending: 2, failed: 1, missing: 1, provisional: 1, snapshot_at: asOf } },
  };
}

/** Alter only sample values, preserving the response shapes consumed by real components. */
export function previewData(base, resource, state) {
  const data = structuredClone(base[resource]);
  if (state === "unavailable") {
    return { as_of: data.as_of, activity: {}, applications: {}, change_requests: {} };
  }
  if (state === "empty" || state === "zero-active") {
    if (resource === "summary") {
      data.applications = { pending_review: 0, aging: { on_time: 0, approaching: 0, overdue: 0, unknown_age: 0 } };
      data.change_requests = { pending_total: 0, by_type: { business_name: 0, classification: 0, location: 0 } };
      data.reviews_under_review = 0;
      data.reported_review_cases = 0;
      data.pending_disputes = 0;
      data.active_businesses = 0;
      data.business_status = { total: state === "zero-active" ? 12 : 0, active: 0, suspended: state === "zero-active" ? 12 : 0, unknown_status: 0 };
    }
    if (resource === "platformOverview") {
      data.active_accounts = 0;
      for (const key of Object.keys(data.user_distribution)) data.user_distribution[key] = 0;
      if (state === "zero-active") data.user_distribution = { total: 10, explorer: 8, merchant: 2, admin: 0, super_admin: 0, unknown_role: 0 };
      for (const key of ["applications_submitted", "reviews_published", "vouches_created"]) {
        data.activity[key] = 0;
        data.activity.previous[key] = 0;
        data.activity.daily.forEach((row) => { row[key] = 0; });
      }
    }
    if (data.items) data.items = [];
    if (data.coverage) Object.keys(data.coverage).forEach((key) => { if (key !== "snapshot_at") data.coverage[key] = 0; });
  }
  if (state === "single") {
    if (data.items) data.items = data.items.slice(0, 1);
    if (resource === "summary") data.applications = { pending_review: 1, aging: { on_time: 1, approaching: 0, overdue: 0, unknown_age: 0 } };
  }
  if (state === "long-labels" && data.items) data.items.forEach((item) => {
    item.entity.label = "Preview Café Niño & Sons — very long business name without truncating important details 東京 ".repeat(4);
    if (item.administrator_name) item.administrator_name = "Preview Administrator with a long recorded name";
  });
  if (state === "deleted" && data.items) data.items.forEach((item) => {
    item.entity = { ...item.entity, id: null, label: "Entity unavailable" };
    item.timestamp = null;
    if (item.administrator_name) item.administrator_name = "Administrator unavailable";
  });
  if (resource === "summary" && ["on-time", "approaching", "overdue", "unknown-age", "invalid-aging"].includes(state)) {
    const key = { "on-time": "on_time", approaching: "approaching", overdue: "overdue", "unknown-age": "unknown_age" }[state];
    data.applications.aging = { on_time: 0, approaching: 0, overdue: 0, unknown_age: 0 };
    if (key) data.applications.aging[key] = data.applications.pending_review;
  }
  if (resource === "platformOverview") {
    if (state === "missing-chart") data.activity.daily = null;
    if (state === "sparse") {
      for (const key of ["applications_submitted", "reviews_published", "vouches_created"]) {
        data.activity.daily.forEach((row, index) => { row[key] = index === 5 ? 1 : 0; });
        data.activity[key] = 1;
      }
    }
    if (state === "missing-comparison") delete data.activity.previous;
    if (["increase", "decrease", "unchanged"].includes(state)) {
      for (const key of ["reviews_published", "vouches_created"]) {
        data.activity.previous[key] = data.activity[key] + (state === "increase" ? -2 : state === "decrease" ? 2 : 0);
      }
    }
    if (state === "large-counts") {
      data.activity.daily.forEach((row) => { row.reviews_published *= 100000; row.vouches_created *= 100000; });
      data.activity.reviews_published *= 100000;
      data.activity.vouches_created *= 100000;
    }
    if (state === "single-status") {
      data.active_accounts = 100;
      data.user_distribution = { total: 100, explorer: 100, merchant: 0, admin: 0, super_admin: 0, unknown_role: 0 };
    }
  }
  if (state === "single-status" && resource === "summary") {
    data.active_businesses = 12;
    data.business_status = { total: 12, active: 12, suspended: 0, unknown_status: 0 };
  }
  if (state === "all-fresh" && data.coverage) data.coverage = { ...data.coverage, fresh: 10, stale: 0, pending: 0, failed: 0, missing: 0, provisional: 0 };
  if (state === "score-alerts" && data.coverage) data.coverage = { ...data.coverage, fresh: 0, stale: 7, pending: 6, failed: 4, missing: 2, provisional: 1 };
  if (state === "stale") {
    if (data.as_of) data.as_of = new Date(Date.parse(data.as_of) - 3 * DAY).toISOString();
    if (data.coverage) data.coverage.snapshot_at = new Date(Date.parse(data.coverage.snapshot_at) - 3 * DAY).toISOString();
  }
  return data;
}
