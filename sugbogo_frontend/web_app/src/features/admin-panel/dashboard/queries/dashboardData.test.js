import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createServer } from "vite";

let server;
let apiClient;
let adapter;
let service;
let options;
let keys;
let invalidateDecision;
let queryClient;
let storage;
let calls;
let payload;
const previousStorage = globalThis.localStorage;

before(async () => {
  const entries = new Map();
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: apiClient } = await server.ssrLoadModule("/src/shared/api/apiClient.js"));
  adapter = apiClient.defaults.adapter;
  service = await server.ssrLoadModule("/src/features/admin-panel/services/dashboardService.js");
  ({ dashboardQueryOptions: options } = await server.ssrLoadModule(
    "/src/features/admin-panel/dashboard/queries/dashboardQueryOptions.js",
  ));
  ({ dashboardQueryKeys: keys } = await server.ssrLoadModule(
    "/src/features/admin-panel/dashboard/queries/dashboardQueryKeys.js",
  ));
  ({ invalidateDashboardDecision: invalidateDecision } = await server.ssrLoadModule(
    "/src/features/admin-panel/dashboard/queries/dashboardQueryEffects.js",
  ));
  ({ default: queryClient } = await server.ssrLoadModule("/src/lib/queryClient.js"));
  storage = await server.ssrLoadModule("/src/shared/api/storage.js");
});

beforeEach(() => {
  storage.setTokens({ access: "dashboard-account-a", refresh: "refresh-a" });
  calls = [];
  payload = { zero: 0, missing: null };
  apiClient.defaults.adapter = async (config) => {
    calls.push(config);
    return {
      data: { success: true, message: "Success.", data: payload },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
});

after(async () => {
  queryClient?.clear();
  if (apiClient) apiClient.defaults.adapter = adapter;
  globalThis.localStorage = previousStorage;
  await server?.close();
});

const resources = [
  ["summary", "fetchDashboardSummary", "/admin/dashboard/", 30_000],
  ["recentDecisions", "fetchDashboardRecentDecisions", "/admin/dashboard/recent-decisions/", 30_000],
  ["platformOverview", "fetchDashboardPlatformOverview", "/admin/dashboard/platform-overview/", 60_000],
  ["priorityWorklist", "fetchDashboardPriorityWorklist", "/admin/dashboard/priority-worklist/", 30_000],
];

test("four services unwrap only the success envelope and forward AbortSignal into Axios", async () => {
  for (const [, method, url] of resources) {
    const controller = new AbortController();
    const result = await service[method]({ signal: controller.signal });
    assert.equal(result, payload);
    assert.equal(calls.at(-1).url, url);
    controller.abort();
    assert.equal(calls.at(-1).signal.aborted, true);
  }
});

test("contract values retain unknown ages, distinct cases, server windows and unknown roles", async () => {
  payload = {
    applications: { pending_review: 4, aging: { on_time: 0, approaching: 1, overdue: 1, unknown_age: 2 } },
    reported_review_cases: 2,
    activity: {
      window: {
        start: "2026-10-25T16:00:00Z",
        end_exclusive: "2026-11-01T04:00:00Z",
        timezone: "Asia/Manila",
        includes_partial_day: true,
      },
      reviews_published: 0,
    },
    user_distribution: { explorer: 1, merchant: 1, admin: 1, super_admin: 1, unknown_role: 2, total: 6 },
    as_of: "2026-11-01T04:00:00Z",
    items: [
      {
        id: "merchant_application:12",
        type: "merchant_application",
        title: "Application awaiting review",
        status: "submitted",
        timestamp: null,
        timestamp_source: null,
        priority: "pending",
        entity: { id: 12, label: "Application #12" },
        application_aging: { status: "unknown_age", business_days: null },
        pending_report_count: null,
      },
      {
        id: "reported_review:12",
        type: "reported_review",
        timestamp: "2026-10-30T04:00:00Z",
        timestamp_source: "first_pending_report_created_at",
        priority: "pending",
        entity: { id: 12, label: "Business unavailable" },
        application_aging: null,
        pending_report_count: 3,
      },
    ],
  };
  for (const [, method] of resources) {
    assert.equal(await service[method](), payload);
  }
});

test("canonical Dashboard keys are stable, distinct and separate from Analytics and user history", () => {
  assert.deepEqual(keys.summary, ["admin", "dashboard", "summary"]);
  assert.deepEqual(keys.recentDecisions, ["admin", "dashboard", "recent-decisions"]);
  assert.deepEqual(keys.platformOverview, ["admin", "dashboard", "platform-overview"]);
  assert.deepEqual(keys.priorityWorklist, ["admin", "dashboard", "priority-worklist"]);
  assert.equal(new Set(resources.map(([resource]) => JSON.stringify(keys[resource]))).size, 4);
  for (const [resource] of resources) {
    assert.deepEqual(options[resource]().queryKey, keys[resource]);
    assert.deepEqual(options[resource]().queryKey, options[resource]().queryKey);
    assert.equal(options[resource]().queryKey.length, 3);
  }
});

test("query functions use their own endpoint, cancellation and stale-only focus/reconnect refresh", async () => {
  for (const [resource, , url, staleTime] of resources) {
    const query = options[resource]();
    const controller = new AbortController();
    assert.equal(await query.queryFn({ signal: controller.signal }), payload);
    assert.equal(calls.at(-1).url, url);
    controller.abort();
    assert.equal(calls.at(-1).signal.aborted, true);
    assert.equal(query.staleTime, staleTime);
    assert.equal(query.refetchOnWindowFocus, true);
    assert.equal(query.refetchOnReconnect, true);
    assert.equal(query.refetchInterval, undefined);
  }
});

test("services preserve failures rather than manufacturing empty data", async () => {
  const failure = new Error("Dashboard source unavailable");
  apiClient.defaults.adapter = async () => { throw failure; };
  for (const [, method] of resources) {
    await assert.rejects(service[method](), (error) => error === failure);
  }
});

test("decisions invalidate pending work, adding overview for publication or role composition", async () => {
  const invalidations = [];
  const client = {
    invalidateQueries: async (filters) => invalidations.push(filters),
  };
  await invalidateDecision(client);
  assert.deepEqual(invalidations, [
    { queryKey: keys.summary, exact: true },
    { queryKey: keys.recentDecisions, exact: true },
    { queryKey: keys.priorityWorklist, exact: true },
  ]);
  invalidations.length = 0;
  await invalidateDecision(client, { publication: true });
  assert.deepEqual(invalidations, [
    { queryKey: keys.summary, exact: true },
    { queryKey: keys.recentDecisions, exact: true },
    { queryKey: keys.priorityWorklist, exact: true },
    { queryKey: keys.platformOverview, exact: true },
  ]);
  const publicationInvalidations = [...invalidations];
  invalidations.length = 0;
  await invalidateDecision(client, { roleComposition: true });
  assert.deepEqual(invalidations, publicationInvalidations);
});

test("a new login and token clearing discard cached Dashboard data", () => {
  for (const [resource] of resources) {
    queryClient.setQueryData(keys[resource], { account: "A" });
  }
  storage.setTokens({ access: "dashboard-account-b", refresh: "refresh-b" });
  for (const [resource] of resources) {
    assert.equal(queryClient.getQueryData(keys[resource]), undefined);
    queryClient.setQueryData(keys[resource], { account: "B" });
  }
  storage.clearTokens();
  for (const [resource] of resources) {
    assert.equal(queryClient.getQueryData(keys[resource]), undefined);
  }
});

test("same-session token rotation preserves cached Dashboard data", () => {
  queryClient.setQueryData(keys.summary, payload);
  const generation = storage.getSessionGeneration();
  storage.setTokens(
    { access: "rotated-access", refresh: "rotated-refresh" },
    { preserveSession: true },
  );
  assert.equal(storage.getSessionGeneration(), generation);
  assert.equal(queryClient.getQueryData(keys.summary), payload);
});

for (const resource of ["summary", "priorityWorklist"]) {
  test(`${resource} session clearing aborts Axios and prevents late cache writes`, async () => {
    let finish;
    let started;
    let signal;
    const requestStarted = new Promise((resolve) => { started = resolve; });
    apiClient.defaults.adapter = (config) => new Promise((resolve) => {
      signal = config.signal;
      finish = () => resolve({
        data: { data: { account: "obsolete" } },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      });
      started();
    });
    const pending = queryClient.fetchQuery(options[resource]());
    const rejected = assert.rejects(pending);
    await requestStarted;
    storage.clearTokens();
    assert.equal(signal.aborted, true);
    finish();
    await rejected;
    await Promise.resolve();
    assert.equal(queryClient.getQueryData(keys[resource]), undefined);
    assert.equal(queryClient.getQueryCache().find({ queryKey: keys[resource] }), undefined);
  });
}
