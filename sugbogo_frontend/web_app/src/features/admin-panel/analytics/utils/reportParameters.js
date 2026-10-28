import { serializeReportingPeriod } from "./reportingPeriod";

const ATTENTION_ORDER_FIELDS = [
  "business_name", "profile_visits", "saves", "distinct_savers",
  "valid_vouches", "distinct_supporters",
];
const SCORE_ORDER_FIELDS = [
  "business_name", "specialty_score", "visibility_gap", "discovery_score", "computed_at",
];

/** Mirrors backend query serializers rather than global dashboard filters. */
export const analyticsReports = {
  platformOverview: { path: "", period: true },
  platformGrowth: { path: "platform-growth/", period: true, interval: true },
  transportationPlanning: { path: "transportation-planning/", period: true, interval: true },
  discoverySources: { path: "discovery-sources/", period: true },
  discoverySummary: { path: "discovery-summary/", period: true },
  discoveryTrend: {
    path: "discovery-trend/", period: true, interval: true,
    metrics: ["impressions", "profile_visits", "saves", "distinct_engaged_explorers"],
  },
  onboarding: { path: "onboarding/", period: true },
  attentionQueue: { path: "attention-queue/", period: true },
  coverage: { path: "coverage/", period: true, taxonomy: true },
  businessAttention: {
    path: "business-attention/", period: true, taxonomy: true,
    paginated: true, ordering: "-profile_visits", orderFields: ATTENTION_ORDER_FIELDS,
  },
  lowExposure: {
    path: "low-exposure/", taxonomy: true,
    paginated: true, ordering: "profile_visits", orderFields: ATTENTION_ORDER_FIELDS,
  },
  communityHealth: { path: "community-health/", period: true, interval: true },
  specialtySupport: { path: "specialty-support/", period: true },
  changeRequests: { path: "change-requests/", period: true },
  discoveryHeatmap: {
    path: "discovery-heatmap/", period: true, taxonomy: true,
    metrics: ["profile_visits"],
  },
  discoveryScores: {
    path: "discovery-scores/", taxonomy: true,
    paginated: true, ordering: "-computed_at", orderFields: SCORE_ORDER_FIELDS,
  },
};

function choice(value, choices, name) {
  if (!choices.includes(value)) {
    throw new RangeError(`Unsupported analytics ${name}.`);
  }
  return value;
}

function positiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new RangeError(`Invalid analytics ${name}.`);
  }
  return number;
}

/** Use the same canonical parameters for HTTP requests and cache identity.
 * Irrelevant filters are omitted; invalid supported controls fail before transport.
 * Report data, source availability and measurement semantics are never transformed.
 */
export function normalizeAnalyticsParams(report, params = {}) {
  const definition = analyticsReports[report];
  if (!definition) throw new RangeError("Unknown analytics report.");
  const result = definition.period ? serializeReportingPeriod(params) : {};

  if (definition.interval) {
    result.interval = choice(params.interval ?? "daily", ["daily", "weekly"], "interval");
  }
  if (definition.metrics) {
    result.metric = choice(params.metric ?? "profile_visits", definition.metrics, "metric");
  }
  if (definition.taxonomy) {
    for (const field of ["cluster", "category"]) {
      if (params[field] !== undefined && params[field] !== null && params[field] !== "") {
        result[field] = positiveInteger(params[field], field);
      }
    }
  }
  if (definition.paginated) {
    result.page = positiveInteger(params.page ?? 1, "page");
    result.page_size = positiveInteger(params.page_size ?? 10, "page_size", 100);
    const orderings = definition.orderFields.flatMap((field) => [field, `-${field}`]);
    result.ordering = choice(params.ordering ?? definition.ordering, orderings, "ordering");
  }
  if (report === "discoveryHeatmap" && params.cell) {
    result.cell = params.cell;
  }
  if (report === "discoveryScores") {
    if (params.search) result.search = params.search;
    if (params.status) {
      result.status = choice(params.status, ["active", "suspended"], "status");
    }
    if (params.score_state) {
      result.score_state = choice(
        params.score_state,
        ["FAILED", "PROVISIONAL", "PENDING", "STALE", "FRESH"],
        "score_state",
      );
    }
    if (params.specialty_tag !== undefined && params.specialty_tag !== null && params.specialty_tag !== "") {
      result.specialty_tag = positiveInteger(params.specialty_tag, "specialty_tag");
    }
  }
  return result;
}
