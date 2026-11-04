import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let Page;
let createRoot;
let root;
let container;
let failure;
let pending;
let approaching;
let overdue;
let oldest;
let reads;
let client;
let hooks;
let hookResult;
let applicationKeys;
let dashboardKeys;
let overviewKey;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
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
      name: "application-statistics-fixture",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__statisticsTransport(...args), post: (...args) => globalThis.__applicationPost(...args) };";
        }
        if (path.endsWith("/BusinessApplicationManagementTable.jsx")) {
          return "export default function Table({ tableState }) { globalThis.__applicationTableState = tableState; return null; }";
        }
      },
    }],
  });
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/BusinessApplicationsPage.jsx",
  ));
  hooks = {};
  for (const name of [
    "useBusinessApplications",
    "useMerchantApplicationReview",
    "useApproveBusinessApplication",
    "useRejectBusinessApplication",
  ]) {
    ({ default: hooks[name] } = await server.ssrLoadModule(
      `/src/features/admin-panel/business-applications/hooks/${name}.js`,
    ));
  }
  ({ adminApplicationKeys: applicationKeys } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-applications/queries/applicationQueryKeys.js",
  ));
  ({ dashboardQueryKeys: dashboardKeys } = await server.ssrLoadModule(
    "/src/features/admin-panel/dashboard/queries/dashboardQueryKeys.js",
  ));
  ({ businessOverviewQueryKey: overviewKey } = await server.ssrLoadModule(
    "/src/features/admin-panel/businesses/queries/businessOverviewQuery.js",
  ));
});

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  mock.method(console, "error", () => {});
  failure = false;
  pending = 0;
  approaching = 0;
  overdue = 0;
  oldest = null;
  reads = [];
  globalThis.__statisticsTransport = async (url) => {
    reads.push(url);
    assert.equal(url, "/admin/businesses/applications/statistics/");
    if (failure) throw new Error("Statistics unavailable");
    return { data: { data: {
      pending_review: pending,
      approaching_sla: approaching,
      overdue,
      oldest_pending_business_days: oldest,
      approved: 0,
      rejected: 0,
      total_applications: pending,
      review_sla_business_days: 5,
      review_sla_approaching_business_days: 3,
    } } };
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  mock.restoreAll();
});

after(async () => {
  await server?.close();
  dom.window.close();
  delete globalThis.__statisticsTransport;
  delete globalThis.__applicationTableState;
  delete globalThis.__applicationPost;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderPage() {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, null, React.createElement(Page))),
  ));
  await settleQueries();
}

async function settleQueries() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    if (client.isFetching() === 0) return;
  }
  assert.fail("Application query did not settle");
}

function HookProbe({ name, args }) {
  hookResult = hooks[name](...args);
  return null;
}

async function renderHook(name, args = []) {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(HookProbe, { name, args })),
  ));
  await settleQueries();
}

function metricCard(title) {
  return [...container.querySelectorAll("h3")]
    .find((heading) => heading.textContent === title)?.closest(".relative.flex");
}

function pendingCard() {
  return metricCard("Pending Review");
}

test("a successful measured zero remains visible as zero", async () => {
  await renderPage();
  assert.ok(pendingCard());
  assert.match(pendingCard().textContent, /Pending Review0/);
  assert.match(metricCard("Approaching SLA").textContent, /Approaching SLA0/);
  assert.match(metricCard("Overdue").textContent, /Overdue0/);
  assert.match(metricCard("Oldest Pending").textContent, /Oldest Pending—/);
  assert.doesNotMatch(container.textContent, /Unable to load application statistics/);
});

test("an initial failure displays a persistent error instead of a pending zero", async () => {
  failure = true;
  await renderPage();
  assert.match(container.textContent, /Unable to load application statistics/);
  assert.equal(pendingCard(), undefined);
  assert.ok([...container.querySelectorAll("button")].some((item) => item.textContent === "Try Again"));
});

test("section Retry recovers values through the existing statistics hook", async () => {
  failure = true;
  await renderPage();
  failure = false;
  pending = 7;
  const retry = [...container.querySelectorAll("button")].find((item) => item.textContent === "Try Again");
  await act(async () => retry.click());
  await settleQueries();
  assert.equal(reads.length, 2);
  assert.doesNotMatch(container.textContent, /Unable to load application statistics/);
  assert.match(pendingCard().textContent, /Pending Review7/);
});

test("four operational cards show backend values without historical indicators", async () => {
  pending = 9;
  approaching = 3;
  overdue = 2;
  oldest = 8;
  await renderPage();

  assert.deepEqual(
    [...container.querySelectorAll("h3")].map((heading) => heading.textContent),
    ["Pending Review", "Approaching SLA", "Overdue", "Oldest Pending"],
  );
  assert.match(pendingCard().textContent, /Pending Review9Applications awaiting a decision/);
  assert.match(metricCard("Approaching SLA").textContent, /Approaching SLA33–4 business days/);
  assert.match(metricCard("Overdue").textContent, /Overdue25\+ business days/);
  assert.match(metricCard("Oldest Pending").textContent, /8 business daysLongest unresolved application/);
  assert.doesNotMatch(container.textContent, /Approval Rate|Resubmission Rate|SLA Compliance|last week|this week/);
  assert.equal(container.querySelector(".recharts-wrapper"), null);
  assert.match(container.textContent, /Current review queue and SLA status · PHT/);
  assert.match(container.textContent, /9 total·0 approved·0 rejected·9 pending/);
  assert.match(container.textContent, /0–2 business days/);
  assert.match(container.textContent, /3–4 business days/);
  assert.match(container.textContent, /5\+ business days/);
  assert.match(container.textContent, /0 approved/);
  assert.match(container.textContent, /0 rejected/);
  assert.match(container.textContent, /9 pending/);
});

test("a newly submitted pending application displays zero business days", async () => {
  pending = 1;
  oldest = 0;
  await renderPage();
  assert.match(metricCard("Oldest Pending").textContent, /0 business days/);
});

test("queue cards reuse table filters and reset pagination", async () => {
  await renderPage();

  for (const [title, queueStatus] of [
    ["Approaching SLA", "approaching"],
    ["Overdue", "overdue"],
    ["Pending Review", undefined],
  ]) {
    await act(async () => {
      globalThis.__applicationTableState.setPagination({ pageIndex: 2, pageSize: 10 });
    });
    const button = container.querySelector(`[aria-label="Filter applications: ${title}"]`);
    await act(async () => button.click());

    assert.equal(globalThis.__applicationTableState.params.status, "submitted");
    assert.equal(globalThis.__applicationTableState.params.queue_status, queueStatus);
    assert.equal(globalThis.__applicationTableState.params.page, 1);
  }
  assert.equal(container.querySelector('[aria-label="Filter applications: Oldest Pending"]'), null);
});

test("application queue keys retain filters, sorting and pagination with authoritative responses", async () => {
  const calls = [];
  globalThis.__statisticsTransport = async (url, { params }) => {
    calls.push({ url, params });
    return { data: { data: {
      items: [{ id: params.page }],
      pagination: { total_items: 25, total_pages: 3 },
    } } };
  };
  const params = {
    page: 1, page_size: 10, search: "Cafe", status: "submitted",
    queue_status: "approaching", cluster: "2", category: "3", ordering: "submitted_at",
  };
  await renderHook("useBusinessApplications", [params]);
  assert.deepEqual(hookResult.applications, [{ id: 1 }]);
  assert.equal(hookResult.totalItems, 25);
  assert.equal(hookResult.pageCount, 3);
  await renderHook("useBusinessApplications", [{ ...params, page: 2 }]);
  assert.deepEqual(hookResult.applications, [{ id: 2 }]);
  assert.deepEqual(calls.map((call) => call.params), [params, { ...params, page: 2 }]);
  assert.ok(client.getQueryData(applicationKeys.list(params)));
  await act(async () => { await hookResult.refetch(); });
  assert.equal(calls.length, 3);
});

test("application detail exposes errors, supports retry and changes records with the ID", async () => {
  let fail = true;
  globalThis.__statisticsTransport = async (url) => {
    if (fail) throw new Error("Detail unavailable");
    return { data: { data: { id: url.split("/").at(-2), status: "submitted" } } };
  };
  await renderHook("useMerchantApplicationReview", ["12"]);
  assert.equal(hookResult.application, null);
  assert.match(hookResult.error.message, /Detail unavailable/);
  fail = false;
  await act(async () => { await hookResult.refetch(); });
  await settleQueries();
  assert.equal(hookResult.application.id, "12");
  await renderHook("useMerchantApplicationReview", ["13"]);
  assert.equal(hookResult.application.id, "13");
});

test("both application decisions invalidate affected caches and preserve errors and payloads", async () => {
  for (const [name, action, payload, suffix, body] of [
    ["useApproveBusinessApplication", "approveApplication", 8, "approve", { expected_submission_id: 8 }],
    ["useRejectBusinessApplication", "rejectApplication", { expected_submission_id: 8, feedback: [] }, "reject", { expected_submission_id: 8, feedback: [] }],
  ]) {
    const affected = [
      applicationKeys.list({ page: 1 }),
      applicationKeys.list({ page: 2 }),
      applicationKeys.statistics,
      applicationKeys.detail(12),
      applicationKeys.duplicates(12),
      dashboardKeys.summary,
      dashboardKeys.recentDecisions,
      dashboardKeys.priorityWorklist,
      ...(suffix === "approve" ? [dashboardKeys.platformOverview, overviewKey] : []),
    ];
    const unrelated = applicationKeys.detail(99);
    for (const key of [...affected, unrelated]) client.setQueryData(key, { value: 1 });
    const posts = [];
    globalThis.__applicationPost = async (...args) => {
      posts.push(args);
      return { data: { data: { id: 12 } } };
    };
    await renderHook(name);
    await act(async () => { await hookResult[action](12, payload); });
    assert.deepEqual(posts, [[`/admin/businesses/applications/12/${suffix}/`, body]]);
    for (const key of affected) {
      assert.equal(client.getQueryState(key).isInvalidated, true);
    }
    assert.equal(client.getQueryState(unrelated).isInvalidated, false);
    for (const key of affected) client.setQueryData(key, { value: 2 });
    const failure = new Error("Decision failed");
    globalThis.__applicationPost = async () => { throw failure; };
    await act(async () => {
      await assert.rejects(hookResult[action](12, payload), (error) => error === failure);
    });
    await settleQueries();
    assert.equal(hookResult.error, failure);
    assert.equal(hookResult.isSubmitting, false);
    for (const key of affected) assert.equal(client.getQueryState(key).isInvalidated, false);
  }
});
