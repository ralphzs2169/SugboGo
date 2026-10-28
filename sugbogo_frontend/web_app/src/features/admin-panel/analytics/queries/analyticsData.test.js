import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let apiClient;
let originalGet;
let service;
let keys;
let options;
let serialize;
let normalize;
let globalDefaults;

before(async () => {
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: apiClient } = await server.ssrLoadModule("/src/shared/api/apiClient.js"));
  originalGet = apiClient.get;
  const base = "/src/features/admin-panel/";
  service = await server.ssrLoadModule(`${base}services/analyticsService.js`);
  ({ analyticsQueryKeys: keys } = await server.ssrLoadModule(`${base}analytics/queries/analyticsQueryKeys.js`));
  ({ analyticsQueryOptions: options } = await server.ssrLoadModule(`${base}analytics/queries/analyticsQueryOptions.js`));
  ({ serializeReportingPeriod: serialize } = await server.ssrLoadModule(`${base}analytics/utils/reportingPeriod.js`));
  ({ normalizeAnalyticsParams: normalize } = await server.ssrLoadModule(`${base}analytics/utils/reportParameters.js`));
  const { default: queryClient } = await server.ssrLoadModule("/src/lib/queryClient.js");
  globalDefaults = queryClient.getDefaultOptions().queries;
});

after(async () => {
  if (apiClient) apiClient.get = originalGet;
  await server?.close();
});

const custom = { period: "custom", start_date: "2026-10-01", end_date: "2026-10-07" };
const cell = "cebu-utm51n-1000m-origin0-floor-v1:1:2";
const dated = { period: "30" };
const series = { ...dated, interval: "daily" };
const table = { page: 1, page_size: 10, ordering: "-profile_visits" };

const reports = [
  ["platformOverview", "fetchPlatformAnalytics", "", dated],
  ["platformGrowth", "fetchPlatformGrowthAnalytics", "platform-growth/", series],
  ["discoverySummary", "fetchDiscoveryActivitySummary", "discovery-summary/", dated],
  ["discoveryTrend", "fetchDiscoveryTrend", "discovery-trend/", { ...series, metric: "profile_visits" }],
  ["onboarding", "fetchOnboardingAnalytics", "onboarding/", dated],
  ["attentionQueue", "fetchAttentionQueueAnalytics", "attention-queue/", dated],
  ["coverage", "fetchCoverageAnalytics", "coverage/", dated],
  ["businessAttention", "fetchBusinessAttention", "business-attention/", { ...dated, ...table }],
  ["lowExposure", "fetchLowExposureBusinesses", "low-exposure/", { ...table, ordering: "profile_visits" }],
  ["communityHealth", "fetchCommunityHealthAnalytics", "community-health/", series],
  ["specialtySupport", "fetchSpecialtySupportAnalytics", "specialty-support/", dated],
  ["changeRequests", "fetchChangeRequestAnalytics", "change-requests/", dated],
  ["discoveryHeatmap", "fetchDiscoveryHeatmap", "discovery-heatmap/", { ...dated, metric: "profile_visits" }],
  ["discoveryScores", "fetchDiscoveryScoreAnalytics", "discovery-scores/", { ...table, ordering: "-computed_at" }],
];

test("reporting periods serialize calendar dates only for custom selections", () => {
  assert.deepEqual(serialize(), dated);
  for (const period of [7, "30", 90]) {
    assert.deepEqual(serialize({ ...custom, period }), { period: String(period) });
  }
  assert.deepEqual(serialize(custom), custom);
  for (const invalid of [{ period: "365" }, { period: "custom" }, { ...custom, end_date: "10/07/2026" }]) {
    assert.throws(() => serialize(invalid), RangeError);
  }
});

test("canonical period defaults and custom dates define cache identity", () => {
  for (const [report] of reports.filter(([report]) => !["lowExposure", "discoveryScores"].includes(report))) {
    assert.deepEqual(keys[report](), keys[report]({ period: 30 }));
    assert.notDeepEqual(keys[report]({ period: 7 }), keys[report]({ period: 90 }));
    assert.notDeepEqual(keys[report](custom), keys[report]({ ...custom, end_date: "2026-10-08" }));
    assert.notDeepEqual(keys[report](custom), keys[report]({ ...custom, start_date: "2026-10-02" }));
  }
  assert.equal(new Set(reports.map(([report]) => JSON.stringify(keys[report]()))).size, 14);
});

test("discovery metric and interval and growth/community interval affect keys", () => {
  assert.notDeepEqual(keys.discoveryTrend({ metric: "saves" }), keys.discoveryTrend({ metric: "impressions" }));
  for (const report of ["discoveryTrend", "platformGrowth", "communityHealth"]) {
    assert.notDeepEqual(keys[report]({ interval: "daily" }), keys[report]({ interval: "weekly" }));
  }
  assert.throws(() => normalize("discoveryTrend", { metric: "ctr" }), RangeError);
  assert.throws(() => normalize("platformGrowth", { interval: "monthly" }), RangeError);
});

test("table keys include pagination, taxonomy and ordering without aliases", () => {
  for (const report of ["businessAttention", "lowExposure", "discoveryScores"]) {
    for (const params of [{ page: 2 }, { page_size: 25 }, { cluster: 2 }, { category: 3 }, { ordering: "business_name" }]) {
      assert.notDeepEqual(keys[report](), keys[report](params));
    }
    assert.deepEqual(keys[report]({ cluster: "2" }), keys[report]({ cluster: 2 }));
    assert.throws(() => keys[report]({ page_size: 101 }), RangeError);
    assert.throws(() => keys[report]({ page: 0 }), RangeError);
    assert.throws(() => keys[report]({ category: -1 }), RangeError);
    assert.throws(() => keys[report]({ ordering: "unsupported" }), RangeError);
  }
});

test("fixed-window reports ignore global dates and unsupported specialty/interval filters", () => {
  assert.deepEqual(keys.lowExposure(), keys.lowExposure({
    ...custom, interval: "weekly", specialty_id: 3, specialty_tag: 3, metric: "saves",
  }));
  assert.deepEqual(normalize("lowExposure", { ...custom, cluster: 2 }), {
    cluster: 2, page: 1, page_size: 10, ordering: "profile_visits",
  });
  assert.deepEqual(keys.platformOverview(), keys.platformOverview({ cluster: 2, category: 3, interval: "weekly" }));
  assert.deepEqual(keys.coverage({ cluster: "2", category: "3" }), [
    "admin", "analytics", "coverage", { period: "30", cluster: 2, category: 3 },
  ]);
});

test("heatmap cell and every supported score filter affect the appropriate key", () => {
  assert.notDeepEqual(keys.discoveryHeatmap(), keys.discoveryHeatmap({ cell }));
  for (const params of [{ search: "Cafe" }, { status: "suspended" }, { specialty_tag: 2 }, { score_state: "STALE" }]) {
    assert.notDeepEqual(keys.discoveryScores(), keys.discoveryScores(params));
  }
  assert.deepEqual(keys.discoveryScores(), keys.discoveryScores({ ...custom, interval: "weekly" }));
});

test("every service uses the correct endpoint, canonical defaults and unwrapped report", async () => {
  const report = {
    value: 0, previous_value: null, series: [{ date: "2026-10-01", value: null }],
    meta: { availability: "partial", data_through: null, coverage_verified: false },
    inventory: { measurement_type: "current_snapshot", selected_period_applies: false },
  };
  for (const [key, fetcher, path, params] of reports) {
    let request;
    apiClient.get = async (url, config) => {
      request = { url, config };
      return { data: { success: true, data: report } };
    };
    const signal = new AbortController().signal;
    assert.equal(await service[fetcher](undefined, { signal }), report);
    assert.equal(request.url, `/admin/analytics/${path}`);
    assert.deepEqual(request.config.params, params);
    assert.equal(request.config.signal, signal);
    assert.deepEqual(keys[key]()[3], request.config.params);
  }
});

test("custom/report filters are sent unchanged and pagination unavailability stays null", async () => {
  const calls = [];
  const report = { items: null, pagination: null, selection_status: "unavailable" };
  apiClient.get = async (url, config) => {
    calls.push({ url, ...config });
    return { data: { data: report } };
  };
  const params = { ...custom, cluster: 2, category: 3, page: 2, page_size: 25, ordering: "-valid_vouches" };
  assert.equal(await service.fetchBusinessAttention(params), report);
  assert.deepEqual(calls[0].params, params);
  await service.fetchLowExposureBusinesses(params);
  assert.deepEqual(calls[1].params, {
    cluster: 2, category: 3, page: 2, page_size: 25, ordering: "-valid_vouches",
  });
  await service.fetchDiscoveryTrend({ ...custom, metric: "saves", interval: "weekly", cluster: 3 });
  assert.deepEqual(calls[2].params, { ...custom, metric: "saves", interval: "weekly" });
  const scoreParams = {
    search: "Cafe", status: "active", cluster: 2, category: 3,
    specialty_tag: 4, score_state: "STALE", page: 2, page_size: 20, ordering: "-discovery_score",
  };
  await service.fetchDiscoveryScoreAnalytics({ ...custom, ...scoreParams });
  assert.deepEqual(calls[3].params, scoreParams);
  const heatmapParams = { ...custom, cluster: 2, category: 3, metric: "profile_visits", cell };
  await service.fetchDiscoveryHeatmap(heatmapParams);
  assert.deepEqual(calls[4].params, heatmapParams);
});

test("transport failures retain shared API error identity and legacy service keeps its contract", async () => {
  const error = new Error("Unavailable");
  error.response = { data: { code: "NETWORK_ERROR", message: "Try again" } };
  apiClient.get = async () => { throw error; };
  await assert.rejects(service.fetchCommunityHealthAnalytics(), (caught) => caught === error);
  const response = { data: { data: { kpis: {} } } };
  apiClient.get = async () => response;
  assert.equal(await service.getAnalyticsData(), response);
});

test("query options preserve global retry/focus behavior and avoid polling or old-filter placeholders", async () => {
  assert.equal(globalDefaults.retry, 1);
  assert.equal(globalDefaults.refetchOnWindowFocus, false);
  for (const [report] of reports) {
    const query = options[report]();
    assert.equal(query.staleTime, 60_000);
    for (const name of ["retry", "refetchOnWindowFocus", "refetchOnReconnect", "refetchInterval", "placeholderData"]) {
      assert.equal(query[name], undefined);
    }
    let requested;
    apiClient.get = async (url, config) => {
      requested = config;
      return { data: { data: { value: 0 } } };
    };
    const signal = new AbortController().signal;
    assert.deepEqual(await query.queryFn({ signal }), { value: 0 });
    assert.deepEqual(requested.params, query.queryKey[3]);
    assert.equal(requested.signal, signal);
  }
});


test("discovery summary keys ignore metric and interval while preserving reporting dates", () => {
  assert.deepEqual(keys.discoverySummary(dated), keys.discoverySummary({ ...dated, metric: "saves", interval: "weekly" }));
  assert.notDeepEqual(keys.discoverySummary(dated), keys.discoverySummary({ period: "7" }));
  assert.deepEqual(normalize("discoverySummary", { ...custom, metric: "impressions", interval: "daily" }), custom);
});
