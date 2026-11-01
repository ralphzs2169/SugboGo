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
let legacyRefreshes;
let invalidations;
let errors;
let fail;
let version;
const globals = [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "IS_REACT_ACT_ENVIRONMENT",
  "__recomputeGet",
  "__recomputePost",
  "__legacyScoreRefresh",
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
          if (path.endsWith("/components/data-table/DataTable.jsx"))
            return "export default function Table({slots}) { return slots.renderHeaderActions(); }";
          if (path.endsWith("/shared/components/modals/Modal.jsx"))
            return "import React from 'react'; export default function Modal({isOpen,children}) { return isOpen ? React.createElement('div', {role:'dialog'}, children) : null; }";
          if (path.endsWith("/businesses/hooks/useBusinessTableState.js"))
            return "export default function State() { return {params:{},pagination:{pageIndex:0,pageSize:10},sorting:[]}; }";
          if (path.endsWith("/discovery-scores/hooks/useDiscoveryScores.js"))
            return "export default function Scores() { return {scores:[], totalItems:0, pageCount:0, isLoading:false, isFetching:false, error:null, refetch:globalThis.__legacyScoreRefresh}; }";
          if (path.endsWith("/cluster-category/hooks/useClusters.js"))
            return "export default function Clusters() { return {clusters:[]}; }";
          if (path.endsWith("/cluster-category/hooks/useCategories.js"))
            return "export default function Categories() { return {categories:[]}; }";
          if (path.endsWith("/specialty-tags/hooks/useSpecialtyTags.js"))
            return "export default function Tags() { return {specialtyTags:[]}; }";
          if (
            path.endsWith("/discovery-scores/columns/discoveryScoreColumns.jsx")
          )
            return "export default function Columns() { return []; }";
          if (
            path.endsWith(
              "/discovery-scores/components/VisibilityDiagnosticsModal.jsx",
            )
          )
            return "export default function Diagnostics() { return null; }";
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
  legacyRefreshes = 0;
  version = 0;
  fail = false;
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
    return {
      data: { data: { coverage: { fresh: version, active_businesses: 2 } } },
    };
  };
  globalThis.__recomputePost = async (url) => {
    posts.push(url);
    if (fail) throw new Error("Recomputation unavailable");
    version = 1;
    return { data: { data: { updated: 2, failed: 0 } } };
  };
  globalThis.__legacyScoreRefresh = async () => {
    legacyRefreshes += 1;
  };
  toast.success = () => {};
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

test("successful confirmed recomputation refreshes legacy rows and deduplicates shared health invalidation", async () => {
  const unrelated = ["admin", "analytics", "platformGrowth", {}];
  client.setQueryData(unrelated, { unchanged: true });
  await openPage();
  assert.equal(gets.length, 1);
  await confirmRecompute();
  await until(() =>
    [...container.querySelectorAll("output")].every(
      (node) => node.textContent === "1",
    ),
  );
  assert.deepEqual(posts, ["/admin/analytics/discovery-scores/recompute/"]);
  assert.equal(legacyRefreshes, 1);
  assert.deepEqual(invalidations, [
    { queryKey: keys.discoveryScores({ page_size: 1 }), exact: true },
  ]);
  assert.equal(gets.length, 2);
  assert.ok(
    gets.every(
      (request) => request.url === "/admin/analytics/discovery-scores/",
    ),
  );
  assert.equal(client.getQueryState(unrelated).isInvalidated, false);
});

test("failed recomputation does not invalidate health or refresh legacy rows as a success", async () => {
  await openPage();
  fail = true;
  await confirmRecompute();
  await until(() => errors.length === 1);
  assert.equal(legacyRefreshes, 0);
  assert.equal(invalidations.length, 0);
  assert.equal(gets.length, 1);
  assert.ok(
    [...container.querySelectorAll("output")].every(
      (node) => node.textContent === "0",
    ),
  );
});
