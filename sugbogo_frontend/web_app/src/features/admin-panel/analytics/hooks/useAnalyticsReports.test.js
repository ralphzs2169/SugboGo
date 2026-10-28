import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let hooks;
let Page;
let createRoot;
let root;
let container;
let client;
let results;
let reads;
let transport;

const hookNames = [
  "usePlatformAnalytics", "usePlatformGrowthAnalytics", "useDiscoveryTrend",
  "useOnboardingAnalytics", "useAttentionQueueAnalytics", "useCoverageAnalytics",
  "useBusinessAttention", "useLowExposureBusinesses", "useCommunityHealthAnalytics",
  "useSpecialtySupportAnalytics", "useChangeRequestAnalytics", "useDiscoveryHeatmap",
  "useDiscoveryScoreAnalytics",
];

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost", pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "analytics-transport-fixture",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__analyticsTransport(...args) };";
        }
      },
    }],
  });
  hooks = await server.ssrLoadModule("/src/features/admin-panel/analytics/hooks/useAnalyticsReports.js");
  ({ default: Page } = await server.ssrLoadModule("/src/features/admin-panel/pages/Analytics.jsx"));
});

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity } },
  });
  results = new Map();
  reads = [];
  transport = async (url) => ({ data: { data: { url, value: 0, previous_value: null } } });
  globalThis.__analyticsTransport = (url, options) => {
    reads.push({ url, ...options });
    return transport(url, options);
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

after(async () => {
  await server?.close();
  dom.window.close();
  delete globalThis.__analyticsTransport;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.HTMLElement;
});

function Probe({ name, params, enabled = true }) {
  const useReport = hooks[name];
  const query = useReport(params, { enabled });
  // Read observable states during render, as a section displaying these states would.
  results.set(name, { ...query });
  return null;
}

async function render(children) {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client }, children),
  ));
}

async function until(predicate) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Analytics query did not reach its expected state.");
}

test("every report hook exposes normalized data, loading/error state and section refetch", async () => {
  await render(hookNames.map((name) => React.createElement(Probe, { key: name, name })));
  await until(() => hookNames.every((name) => results.get(name)?.isSuccess));
  assert.equal(reads.length, 13);
  for (const name of hookNames) {
    const query = results.get(name);
    assert.equal(query.data.value, 0);
    assert.equal(query.data.previous_value, null);
    assert.equal(query.error, null);
    assert.equal(query.isLoading, false);
    assert.equal(query.isFetching, false);
    assert.equal(typeof query.refetch, "function");
  }
});

test("a failed discovery section leaves healthy reports usable and retries only itself", async () => {
  const failure = new Error("Discovery transport failed");
  let failing = true;
  transport = async (url) => {
    if (url.endsWith("discovery-trend/") && failing) throw failure;
    return { data: { data: { url, value: 0 } } };
  };
  const names = ["usePlatformAnalytics", "useDiscoveryTrend", "useOnboardingAnalytics", "useCommunityHealthAnalytics"];
  await render(names.map((name) => React.createElement(Probe, { key: name, name })));
  await until(() => results.get("useDiscoveryTrend")?.isError && results.get("useCommunityHealthAnalytics")?.isSuccess);
  assert.equal(results.get("useDiscoveryTrend").error, failure);
  for (const name of names.filter((name) => name !== "useDiscoveryTrend")) {
    assert.equal(results.get(name).isSuccess, true);
  }
  const previousReads = reads.length;
  failing = false;
  await act(async () => { await results.get("useDiscoveryTrend").refetch(); });
  await until(() => results.get("useDiscoveryTrend")?.isSuccess);
  assert.equal(reads.length, previousReads + 1);
  assert.equal(reads.at(-1).url, "/admin/analytics/discovery-trend/");
});

test("partial and unavailable sources remain successful data, preserving nulls and labels", async () => {
  const report = {
    value: null, previous_value: 0, items: null, pagination: null,
    series: [{ date: "2026-10-01", value: 0 }, { date: "2026-10-02", value: null }],
    label: "Discovery-active accounts (not total app MAU)",
    meta: { availability: "unavailable", is_partial: true, data_through: null, coverage_verified: false },
    sources: { visibility: { availability: "unavailable" }, domain: { availability: "available" } },
  };
  transport = async () => ({ data: { data: report } });
  await render(React.createElement(Probe, { name: "useLowExposureBusinesses" }));
  await until(() => results.get("useLowExposureBusinesses")?.isSuccess);
  assert.deepEqual(results.get("useLowExposureBusinesses").data, report);
  assert.equal(results.get("useLowExposureBusinesses").error, null);
});

test("page/filter changes request server data without showing old rows under new filters", async () => {
  let complete;
  transport = async (url, { params }) => {
    if (params.page === 2) {
      return new Promise((done) => { complete = done; });
    }
    return { data: { data: { items: [{ business_id: 1 }], pagination: { page: 1, total_items: 50 } } } };
  };
  await render(React.createElement(Probe, { name: "useBusinessAttention", params: { page: 1 } }));
  await until(() => results.get("useBusinessAttention")?.isSuccess);
  await render(React.createElement(Probe, {
    name: "useBusinessAttention",
    params: { page: 2, page_size: 25, category: 3, ordering: "-valid_vouches" },
  }));
  assert.equal(results.get("useBusinessAttention").data, undefined);
  assert.equal(results.get("useBusinessAttention").isPending, true);
  assert.deepEqual(reads.at(-1).params, {
    period: "30", category: 3, page: 2, page_size: 25, ordering: "-valid_vouches",
  });
  const report = { items: [{ business_id: 42 }], pagination: { page: 2, total_items: 50 } };
  await act(async () => complete({ data: { data: report } }));
  await until(() => results.get("useBusinessAttention")?.isSuccess);
  assert.deepEqual(results.get("useBusinessAttention").data, report);
});

test("background refresh keeps loaded data and failed refresh exposes error alongside data", async () => {
  await render(React.createElement(Probe, { name: "usePlatformGrowthAnalytics" }));
  await until(() => results.get("usePlatformGrowthAnalytics")?.isSuccess);
  const loaded = results.get("usePlatformGrowthAnalytics").data;
  let reject;
  transport = () => new Promise((resolveRequest, rejectRequest) => { reject = rejectRequest; });
  let refresh;
  await act(async () => { refresh = results.get("usePlatformGrowthAnalytics").refetch(); });
  await until(() => results.get("usePlatformGrowthAnalytics")?.isFetching);
  assert.equal(results.get("usePlatformGrowthAnalytics").isLoading, false);
  assert.equal(results.get("usePlatformGrowthAnalytics").data, loaded);
  const error = new Error("Refresh failed");
  await act(async () => { reject(error); await refresh; });
  await until(() => results.get("usePlatformGrowthAnalytics")?.isError);
  assert.equal(results.get("usePlatformGrowthAnalytics").data, loaded);
  assert.equal(results.get("usePlatformGrowthAnalytics").error, error);
});

test("disabled sections do not fetch and new selected periods request their own report", async () => {
  await render(React.createElement(Probe, { name: "useCommunityHealthAnalytics", enabled: false }));
  assert.equal(reads.length, 0);
  await render(React.createElement(Probe, { name: "useCommunityHealthAnalytics", params: { period: "7" } }));
  await until(() => results.get("useCommunityHealthAnalytics")?.isSuccess);
  await render(React.createElement(Probe, { name: "useCommunityHealthAnalytics", params: { period: "90", interval: "weekly" } }));
  await until(() => reads.length === 2 && results.get("useCommunityHealthAnalytics")?.isSuccess);
  assert.deepEqual(reads.map((request) => request.params), [
    { period: "7", interval: "daily" }, { period: "90", interval: "weekly" },
  ]);
});

test("Analytics shell mounts only overview and offers persistent section Retry after failure", async () => {
  let failing = true;
  transport = async () => {
    if (failing) throw new Error("Overview unavailable");
    return { data: { data: { kpis: {} } } };
  };
  await render(React.createElement(Page));
  await until(() => container.querySelector("[role='alert']"));
  assert.match(container.textContent, /Platform overview is unavailable/);
  assert.equal(container.querySelector("h1").textContent, "Analytics");
  assert.equal(reads.length, 1);
  failing = false;
  await act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry").click());
  await until(() => !container.querySelector("[role='alert']"));
  assert.equal(reads.length, 2);
  assert.ok(reads.every(({ url }) => url === "/admin/analytics/"));
  assert.equal(container.querySelector("h1").textContent, "Analytics");
});

test("Analytics applied presets update only the overview request while custom input stays draft", async () => {
  await render(React.createElement(Page));
  await until(() => reads.length === 1 && !container.querySelector("[role='status']"));
  const findButton = (label) => [...container.querySelectorAll("button")].find((item) => item.textContent === label);
  await act(async () => findButton("7D").click());
  await until(() => reads.length === 2 && !container.querySelector("[role='status']"));
  assert.deepEqual(reads[1].params, { period: "7" });
  await act(async () => findButton("Custom").click());
  assert.equal(reads.length, 2);
  assert.equal(findButton("Apply range").disabled, true);
  assert.ok(reads.every(({ url }) => url === "/admin/analytics/"));
});
