// Test-only transport fixtures; production sections contain no static analytics values.
export const meta = {
  period: { start_date: "2026-10-01", end_date: "2026-10-30", timezone: "Asia/Manila", start: "2026-09-30T16:00:00Z", end_exclusive: "2026-10-30T04:00:00Z", previous_start: "2026-09-01T04:00:00Z", previous_end_exclusive: "2026-09-30T16:00:00Z" },
  generated_at: "2026-10-30T04:00:00Z", data_through: "2026-10-30T04:00:00Z",
  availability: "partial", is_partial: true, coverage_verified: false,
};
const point = (date, values) => ({ date, start: `${date}T00:00:00+08:00`, end_exclusive: `${date}T23:00:00+08:00`, ...values });
const change = { value: 2, direction: "up", unit: "count", reason: null };
const count = { value: 4, previous_value: 2, change };
const queue = { total: 3, under_1_day: 1, days_1_to_2: 1, days_3_plus: 1, unknown_age: 0 };
const duration = { median_hours: null, mean_hours: null, sample_count: 0, excluded_count: 1, missing_timestamp_count: 1, invalid_chronology_count: 0, unrelated_record_count: 0, missing_decision_timestamp_count: 0 };
const coverage = { eligible_businesses: 4, visited_businesses: 2, zero_recorded_visit_businesses: 2, coverage_percentage: 50 };

export function fixtureReport(route, params = {}) {
  if (route === "discovery-heatmap/") return {
    cells: [
      { id: "grid:1:1", column: 1, row: 1, geometry: { type: "Polygon", coordinates: [[[123.88, 10.3], [123.89, 10.3], [123.89, 10.31], [123.88, 10.3]]] }, eligible_businesses: 2, profile_visits: 0, state: "zero_recorded_visits" },
      { id: "grid:1:2", column: 1, row: 2, geometry: { type: "Polygon", coordinates: [[[123.88, 10.31], [123.89, 10.31], [123.89, 10.32], [123.88, 10.31]]] }, eligible_businesses: 1, profile_visits: null, state: "visibility_unavailable" },
    ],
    sources: { visibility: { ...meta, availability: "unavailable" } },
    reconciliation: { excluded_by_reason: { missing_location: { businesses: 1, profile_visits: null } } },
    meta,
  };
  if (route === "") return {
    kpis: {
      active_businesses: { label: "Active businesses", value: 0, measurement_type: "current_snapshot", description: "Current active inventory", change },
      approved_businesses: { label: "Approved businesses", value: 12, measurement_type: "current_snapshot", description: "Current approved applications" },
      new_explorer_accounts: { label: "New current-Explorer accounts", value: 4, previous_value: 2, measurement_type: "period_current_state", change, description: "Current role at query time" },
      discovery_active_explorers: { label: "Discovery-active accounts (not total app MAU)", value: null, measurement_type: "period", source: "visibility", change: { value: null } },
    }, meta,
  };
  if (route === "platform-growth/") return {
    activity: { new_consumer_accounts: count, new_businesses: count, newly_approved_businesses: count },
    definitions: { consumer_accounts: "Accounts exclude staff and Admin roles using current roles.", new_businesses: "Business records created during the selected period.", newly_approved_businesses: "First recorded approval decisions currently linked to businesses." },
    series: [point("2026-10-01", { new_consumer_accounts: 4, new_businesses: 2, newly_approved_businesses: 1 }), point("2026-10-02", { new_consumer_accounts: null, new_businesses: 0, newly_approved_businesses: 0 }), point("2026-10-03", { new_consumer_accounts: 0, new_businesses: 1, newly_approved_businesses: 0 })], meta,
  };
  if (route === "discovery-summary/") return {
    totals: { profile_visits: 10, impressions: 20, saves: 3 },
    definitions: { profile_visits: "Recorded profile visit events.", impressions: "Recorded impression events.", saves: "Recorded save events, not current Pocket inventory.", deduplication: "UTC-day deduplication is preserved.", comparisons: "Previous-period comparisons are hidden while discovery tracking coverage is not fully verified.", missing_observations: "Unobserved buckets are null, not measured zero." },
    meta,
  };
  if (route === "discovery-trend/") return {
    value: 10, previous_value: 8, change: { value: null, reason: "coverage_unverified" },
    label: "Recorded activity", metric: params.metric, interval: params.interval,
    timeline: Array.from({ length: 30 }, (_, index) => ({
      ...point(`2026-10-${String(index + 1).padStart(2, "0")}`, { value: [10, null, 0][index] ?? null }),
      in_progress: index === 29,
    })),
    series: [point("2026-10-01", { value: 10 }), point("2026-10-02", { value: null }), point("2026-10-03", { value: 0 })], meta,
  };
  if (route === "onboarding/") return {
    legacy_statistics: { pending_review: 8, sla_compliance_rate: 100, resubmission_rate: 50 },
    pending_aging: { on_time: 3, approaching: 2, overdue: 2, unknown_age: 1 },
    aging_meta: { approaching_business_days: 3, overdue_business_days: 5 },
    weekly_activity: [point("2026-10-05", { submissions: 8, completed_reviews: 6 })],
    review_turnaround: duration,
    rejection_insights: { rejected_decisions: 1, distinct_applications: 1, decisions_without_section_feedback: 0, sections: [{ section: "identity", label: "Identity", rejection_decisions: 1, distinct_applications: 1, decision_share_percentage: 100 }, { section: "location", label: "Location", rejection_decisions: 1, distinct_applications: 1, decision_share_percentage: 100 }] },
    meta, processing_meta: meta,
  };
  if (route === "community-health/") return {
    current: { published_review_count: 2, classified_review_count: 1, unclassified_review_count: 1, sentiment: { positive: { count: 1, percentage: 100 }, neutral: { count: 0, percentage: 0 }, negative: { count: 0, percentage: 0 } } },
    published_review_count_change: change, series: [point("2026-10-01", { published_review_count: 2 })], meta,
  };
  if (route === "business-acquisition/") return {
    categories:[{id:2,name:"Cafes",created:1,approved:0}], clusters:[{id:1,name:"Food",created:1,approved:0}],
    totals:{created:1,approved:0},definitions:{classification:"Current category; no historical transitions."},meta,
  };
  if (route === "transportation-planning/") return {
    total_requests: 5, distinct_requesting_accounts: 2, requests_without_account_identity: 0,
    methods: [{method:"ROAD_ROUTE",label:"Road routes",count:3,share_percent:60},{method:"JEEPNEY",label:"Jeepney guidance",count:2,share_percent:40},{method:"OTHER",label:"Other recorded methods",count:0,share_percent:0}],
    series: [{...point("2026-10-01",{road_route:3,jeepney:2,other:null}),observation_start:"2026-10-01T00:00:00+08:00",tracking_started:true}],
    destinations:[{business_id:10,business_name:"Destination business",count:5,road_route:3,jeepney:2,other:0}],
    interval:params.interval,tracking_started_at:"2026-10-01T00:00:00+08:00",destination_limit:10,unavailable_destinations_in_ranking:0,
    definitions:{deduplication:"One recorded request per account, business, method and UTC day; not completed journeys."},meta,
  };
  if (route === "discovery-sources/") return { total_profile_visits: 3, sources: ["EXPLORE_DISCOVERY", "SEARCH_RESULTS", "MAP", "COLLECTION", "SIMILAR_BUSINESSES", "COMMUNITY", "UNKNOWN"].map((source) => ({ source, count: source === "MAP" ? 2 : source === "UNKNOWN" ? 1 : 0, share_percent: source === "MAP" ? 66.67 : source === "UNKNOWN" ? 33.33 : 0 })), definitions: { deduplication: "First persisted source per UTC day." }, meta };
  if (route === "attention-queue/") return { open_reports: queue, open_disputes: queue, completed_dispute_turnaround: { median_hours: 4, sample_count: 2, excluded_invalid_duration_count: 0, missing_resolution_timestamp_count: 0 }, queue_meta: { as_of: meta.generated_at }, turnaround_meta: meta, meta };
  if (route === "change-requests/") return { backlog: queue, backlog_meta: { as_of: meta.generated_at }, turnaround: { ...duration, median_hours: 2, mean_hours: 3, sample_count: 2 }, period_outcomes: { approved: 2, rejected: 1, withdrawn: 1 }, types: [{ type: "name", label: "Business name", backlog: queue }], missing_resolution_timestamp_count: 0, meta };
  if (route === "coverage/") return { overall: coverage, categories: [{ id: 2, name: "Cafes", ...coverage }, { id: 4, name: "Empty category", eligible_businesses: 0, visited_businesses: 0, zero_recorded_visit_businesses: 0, coverage_percentage: null }], clusters: [{ id: 1, name: "Food", ...coverage }], meta, sources: { visibility: meta } };
  if (route === "business-attention/" || route === "low-exposure/") {
    const page = params.page ?? 1;
    return {
      items: [{ business_id: page * 10, business_name: `Recorded business ${page}`, category_name: "Cafes", cluster_name: "Food", profile_visits: 0, saves: null, distinct_savers: 0, valid_vouches: 6, distinct_supporters: 5, has_full_business_window: false }],
      pagination: { page, page_size: 10, total_items: 20, total_pages: 2, has_next: page === 1, has_previous: page > 1 },
      thresholds: route === "low-exposure/" ? { window_days: 30, policy_version: 1, max_profile_visits: 4, min_distinct_supporters: 5 } : null,
      meta: route === "low-exposure/" ? { ...meta, period: { start_date: "2026-09-01", end_date: "2026-09-30" } } : meta,
    };
  }
  if (route === "specialty-support/") return { summary: { valid_vouches: 6, distinct_supporters: 2, supported_businesses: 3, supported_specialties: 2 }, top_supported_specialties: [{ specialty_id: 1, name: "Coffee", valid_vouches: 4, distinct_supporters: 2, supported_businesses: 2 }, { specialty_id: 2, name: "Desserts", valid_vouches: 2, distinct_supporters: 2, supported_businesses: 1 }], as_of: meta.generated_at, meta };
  if (route === "discovery-scores/") return { items: [], pagination: {}, coverage: { active_businesses: 5, fresh: 2, stale: 1, pending: 2, failed: 1, missing: 1, provisional: 1, snapshot_at: meta.generated_at, max_score_age_hours: 24 } };
  throw new Error(`Unexpected fixture route: ${route}`);
}

export function fixtureTaxonomy(url) {
  return {
    items: url.endsWith("clusters/") ? [{ id: 1, name: "Food" }, { id: 3, name: "Arts" }] : [{ id: 2, name: "Cafes", cluster_id: 1 }, { id: 4, name: "Crafts", cluster_id: 3 }],
    pagination: { has_next: false },
  };
}
