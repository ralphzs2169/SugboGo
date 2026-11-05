import assert from "node:assert/strict";
import { before, beforeEach, afterEach, after, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import toast from "react-hot-toast";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Page;
let useHealth;
let keys;
let gets;
let posts;
let invalidations;
let errors;
let fail;
let version;
let completionStatus;
let successes;
let failDiagnostic;
const globals = [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "IS_REACT_ACT_ENVIRONMENT",
  "__recomputeGet",
  "__recomputePost",
];
const previousGlobals = new Map(globals.map((key) => [key, globalThis[key]]));
const originalSuccess = toast.success;
const originalError = toast.error;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [
      {
        name: "focused-score-recompute-fixtures",
        enforce: "pre",
        load(id) {
          const path = id.replaceAll("\\", "/");
          if (path.endsWith("/shared/api/apiClient.js"))
            return "export default { get: (...args) => globalThis.__recomputeGet(...args), post: (...args) => globalThis.__recomputePost(...args) };";
          if (path.endsWith("/shared/components/actions/Tooltip.jsx"))
            return "export default function Tooltip({children}) { return children; }";
          if (path.endsWith("/shared/components/modals/Modal.jsx"))
            return "import React from 'react'; export default function Modal({isOpen,children}) { return isOpen ? React.createElement('div', {role:'dialog'}, children) : null; }";
          if (path.endsWith("/cluster-category/hooks/useClusters.js"))
            return "export default function Clusters() { return {clusters:[]}; }";
          if (path.endsWith("/cluster-category/hooks/useCategories.js"))
            return "export default function Categories() { return {categories:[]}; }";
          if (path.endsWith("/specialty-tags/hooks/useSpecialtyTags.js"))
            return "export default function Tags() { return {specialtyTags:[]}; }";
        },
      },
    ],
  });
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/DiscoveryScoresPage.jsx",
  ));
  ({ useDiscoveryScoreAnalytics: useHealth } = await server.ssrLoadModule(
    "/src/features/admin-panel/analytics/hooks/useAnalyticsReports.js",
  ));
  ({ analyticsQueryKeys: keys } = await server.ssrLoadModule(
    "/src/features/admin-panel/analytics/queries/analyticsQueryKeys.js",
  ));
});

beforeEach(async () => {
  gets = [];
  posts = [];
  errors = [];
  invalidations = [];
  version = 0;
  fail = false;
  completionStatus = "COMPLETED";
  successes = [];
  failDiagnostic = false;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const invalidate = client.invalidateQueries.bind(client);
  client.invalidateQueries = (options) => {
    invalidations.push(options);
    return invalidate(options);
  };
  globalThis.__recomputeGet = async (url, options) => {
    gets.push({ url, ...options });
    const row = {
      business: { id: 42, business_name: "Cafe", category_name: "Coffee", cluster_name: "Food", specialty_tags: [{ id: 1, name: "Local Coffee", tag_score: "0.12345", color: "blue" }] },
      specialty_score: "0.72000", visibility_gap: "0.61000", discovery_score: "0.69800",
      refresh_status: "FAILED", computed_at: "2026-11-03T18:38:00Z",
    };
    if (url.endsWith("/visibility-diagnostics/")) {
      if (failDiagnostic) throw { response: { data: { message: "Tracking unavailable" } } };
      return { data: { data: {
        business_id: 42, impression_count: 10, profile_visit_count: 4, unique_saver_count: 2,
        signal_weights: {}, visibility_gap: "0.63500", coverage_verified: false,
      } } };
    }
    if (url.endsWith("/42/")) return { data: { data: row } };
    return {
      data: { data: {
        items: [row], pagination: { total_items: 35, total_pages: Math.ceil(35 / (options.params?.page_size ?? 10)) },
        coverage: { fresh: version, active_businesses: 2, computed: 1, failed: 1,
          telemetry_coverage: { value: null, reason: "coverage_unverified" } },
      } },
    };
  };
  globalThis.__recomputePost = async (url) => {
    posts.push(url);
    if (fail) throw new Error("Recomputation unavailable");
    version = 1;
    return { data: { data: { status: completionStatus, updated: 2, failed: completionStatus === "COMPLETED_WITH_FAILURES" ? 1 : 0 } } };
  };
  toast.success = (message) => successes.push(message);
  toast.error = (error) => errors.push(error);
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

after(async () => {
  toast.success = originalSuccess;
  toast.error = originalError;
  await server?.close();
  dom.window.close();
  for (const [key, value] of previousGlobals) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
});

/** Observe the actual shared query independently, as Dashboard and Analytics health views do. */
function HealthProbe({ label }) {
  const query = useHealth({ page_size: 1 });
  return React.createElement(
    "output",
    { "aria-label": label },
    String(query.data?.coverage?.fresh ?? "loading"),
  );
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Recomputation did not reach the expected state.");
}

async function openPage() {
  await act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(Page),
          React.createElement(HealthProbe, { label: "Dashboard health" }),
          React.createElement(HealthProbe, { label: "Analytics health" }),
        ),
      ),
    ),
  );
  await until(() =>
    [...container.querySelectorAll("output")].every(
      (node) => node.textContent === "0",
    ),
  );
}

async function confirmRecompute() {
  const button = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === "Recompute Discovery Scores",
  );
  await act(async () => button.click());
  assert.equal(posts.length, 0);
  const confirm = [
    ...container.querySelectorAll('[role="dialog"] button'),
  ].find((node) => node.textContent === "Recompute");
  await act(async () => confirm.click());
}

test("successful synchronous recomputation refreshes rows and shared health without unrelated invalidation", async () => {
  const unrelated = ["admin", "analytics", "platformGrowth", {}];
  client.setQueryData(unrelated, { unchanged: true });
  await openPage();
  assert.equal(gets.length, 2);
  await confirmRecompute();
  await until(() =>
    [...container.querySelectorAll("output")].every(
      (node) => node.textContent === "1",
    ),
  );
  assert.deepEqual(posts, ["/admin/analytics/discovery-scores/recompute/"]);
  assert.deepEqual(invalidations, [
    { queryKey: keys.discoveryScores({}).slice(0, 3) },
    { queryKey: ["admin", "discovery-score-detail"] },
    { queryKey: ["admin", "visibility-diagnostics"] },
  ]);
  assert.equal(gets.length, 4);
  assert.ok(
    gets.every(
      (request) => request.url === "/admin/analytics/discovery-scores/",
    ),
  );
  assert.equal(client.getQueryState(unrelated).isInvalidated, false);
  assert.equal(successes.length, 1);
});

test("failed recomputation exposes its error without invalidating queries as a success", async () => {
  await openPage();
  fail = true;
  await confirmRecompute();
  await until(() => errors.length === 1);
  assert.equal(invalidations.length, 0);
  assert.equal(gets.length, 2);
  assert.ok(
    [...container.querySelectorAll("output")].every(
      (node) => node.textContent === "0",
    ),
  );
});

test("partial completion reports failures and still refreshes the score caches", async () => {
  completionStatus = "COMPLETED_WITH_FAILURES";
  await openPage();
  await confirmRecompute();
  await until(() => errors.length === 1);
  assert.equal(successes.length, 0);
  assert.match(errors[0], /completed with refresh failures.*1 failed/);
  assert.equal(invalidations.length, 3);
});

test("View Details targets the selected business and retries only failed diagnostics", async () => {
  failDiagnostic = true;
  await openPage();
  const table = container.querySelector('table[aria-label="Business Discovery Scores"]');
  assert.ok(table);
  assert.doesNotMatch(table.textContent, /Local Coffee/);
  assert.match(table.textContent, /0\.720.*0\.610.*0\.698/);
  const details = container.querySelector('button[aria-label="View Details for Cafe"]');
  await act(async () => details.click());
  await until(() => container.textContent.includes("Tracking unavailable"));
  assert.match(container.textContent, /Score Breakdown/);
  assert.match(container.textContent, /Local Coffee/);
  assert.ok(gets.some((request) => request.url.endsWith("/42/")));
  assert.equal(gets.filter((request) => request.url.endsWith("/visibility-diagnostics/")).length, 1);
  const detailReads = gets.filter((request) => request.url.endsWith("/42/")).length;
  failDiagnostic = false;
  const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry visibility diagnostics");
  await act(async () => retry.click());
  await until(() => container.textContent.includes("Recorded activity and normalization"));
  assert.equal(gets.filter((request) => request.url.endsWith("/42/")).length, detailReads);
  assert.equal(gets.filter((request) => request.url.endsWith("/visibility-diagnostics/")).length, 2);
});

test("recompute disables duplicate submissions until synchronous completion", async () => {
  await openPage();
  let release;
  let attempts = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  globalThis.__recomputePost = async () => {
    attempts += 1;
    await gate;
    version = 1;
    return { data: { data: { status: "COMPLETED", updated: 1, failed: 0 } } };
  };
  await confirmRecompute();
  const confirm = [...container.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent === "Recompute");
  await until(() => confirm.disabled);
  assert.equal(confirm.disabled, true);
  assert.equal(successes.length, 0);
  await act(async () => { confirm.click(); confirm.click(); });
  assert.equal(attempts, 1);
  await act(async () => release());
  await until(() => successes.length === 1);
});

test("management controls send supported server search filtering sorting and pagination", async () => {
  await openPage();
  async function click(label) {
    await until(() => [...container.querySelectorAll("button")].some((element) => (element.getAttribute("aria-label") || element.textContent) === label));
    const button = [...container.querySelectorAll("button")].find((element) => (element.getAttribute("aria-label") || element.textContent) === label);
    assert.ok(button, label);
    await act(async () => button.click());
  }
  await click("Sort items: Default order");
  assert.doesNotMatch(container.querySelector('[role="menu"]').textContent, /Refresh Status/);
  await click("Discovery Score: descending");
  await until(() => gets.some((request) => request.params?.ordering === "-discovery_score"));
  await click("Rows per page: Rows: 10");
  await click("25");
  await until(() => gets.some((request) => request.params?.page_size === 25));
  await click("Next page");
  await until(() => gets.some((request) => request.params?.page === 2 && request.params?.page_size === 25));
  await until(() => container.querySelector("tbody tr td")?.textContent === "26");
  assert.equal(container.querySelector("tbody tr td").textContent, "26");
  await click("Filter");
  await click("Choose Status filter");
  await click("Active");
  await until(() => gets.some((request) => request.params?.status === "active" && request.params?.page === 1));
  const input = container.querySelector('input[placeholder="Search businesses..."]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "Cafe");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await until(() => gets.some((request) => request.params?.search === "Cafe"));
  const latest = gets.at(-1).params;
  assert.equal(latest.ordering, "-discovery_score");
  assert.equal(latest.status, "active");
  assert.equal(latest.page_size, 25);
  assert.equal(latest.page, 1);
  await until(() => container.querySelector("tbody tr td")?.textContent === "1");
  assert.equal(container.querySelector("tbody tr td").textContent, "1");
});
