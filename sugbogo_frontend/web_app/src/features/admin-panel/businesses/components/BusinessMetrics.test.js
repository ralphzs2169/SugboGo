import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Metrics;
let useOverview;
let useTableState;
let queryKey;
let queryOptions;
let reads;
let posts;
let transport;
let query;
let mutation;
let mutations;
let notifications;
const originalToastError = toast.error;
const originalToastDismiss = toast.dismiss;

const fixture = () => ({
  as_of: "2026-11-06T12:00:00Z",
  business_status: { total: 12, active: 9, suspended: 2, unknown_status: 1 },
  new_businesses: { count: 5, previous_count: 2, difference: 3, comparison_available: true },
  change_requests: { pending_total: 7 },
});

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
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
    plugins: [{
      name: "business-overview-transport",
      enforce: "pre",
      resolveId(source) {
        if (source === "recharts") return "\0overview-charts";
      },
      load(id) {
        if (id === "\0overview-charts") {
          return `export const Pie = () => { throw new Error('Unexpected donut'); };
            export const AreaChart = () => { throw new Error('Unexpected sparkline'); };
            export const Area = () => null;
            export const PieChart = () => null;
            export const ResponsiveContainer = () => null;
            export const Cell = () => null;
            export const XAxis = () => null;
            export const Tooltip = () => null;`;
        }
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__overviewGet(...args),
            post: (...args) => globalThis.__overviewPost(...args),
          };`;
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Metrics } = await server.ssrLoadModule(`${base}businesses/components/BusinessMetrics.jsx`));
  ({ default: useOverview } = await server.ssrLoadModule(`${base}businesses/hooks/useBusinessOverview.js`));
  ({ default: useTableState } = await server.ssrLoadModule(`${base}businesses/hooks/useBusinessTableState.js`));
  ({ businessOverviewQueryKey: queryKey, businessOverviewQueryOptions: queryOptions } = await server.ssrLoadModule(
    `${base}businesses/queries/businessOverviewQuery.js`,
  ));
  mutations = {};
  for (const [name, path] of Object.entries({
    name: "business-update-requests/hooks/useBusinessUpdateRequestDecisions.js",
    classification: "business-update-requests/hooks/useClassificationUpdateRequestDecisions.js",
    location: "business-update-requests/hooks/useLocationUpdateRequestDecisions.js",
    application: "business-applications/hooks/useApproveBusinessApplication.js",
  })) {
    ({ default: mutations[name] } = await server.ssrLoadModule(base + path));
  }
});

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  reads = [];
  posts = [];
  notifications = [];
  transport = async () => ({ data: { data: fixture() } });
  globalThis.__overviewGet = (url, options) => {
    reads.push({ url, ...options });
    return transport(url, options);
  };
  globalThis.__overviewPost = async (...args) => {
    posts.push(args);
    return { data: { data: { id: 1 } } };
  };
  toast.error = (...args) => notifications.push(args);
  toast.dismiss = () => {};
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
  toast.error = originalToastError;
  toast.dismiss = originalToastDismiss;
  await server.close();
  dom.window.close();
  for (const name of ["window", "document", "HTMLElement", "Element", "Node", "IS_REACT_ACT_ENVIRONMENT", "__overviewGet", "__overviewPost"]) {
    delete globalThis[name];
  }
});

function Probe() {
  const result = useOverview();
  React.useEffect(() => {
    query = result;
  }, [result]);
  return null;
}

function TableProbe() {
  const table = useTableState();
  const location = useLocation();
  return React.createElement("output", {
    "data-page": table.pagination.pageIndex,
    "data-category": table.categoryFilter,
  }, `${table.statusFilter}|${location.pathname}${location.search}`);
}

function MutationProbe({ name }) {
  const useDecision = mutations[name];
  const result = useDecision();
  React.useEffect(() => {
    mutation = result;
  }, [result]);
  return null;
}

async function render(children, route = "/admin-panel/businesses") {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [route] }, children)),
  ));
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Business overview did not reach the expected state");
}

function card(title) {
  return [...container.querySelectorAll("h3")].find((heading) => heading.textContent === title)?.parentElement.parentElement.parentElement;
}

test("initial skeletons resolve to real counts with no charts and deduplicated requests", async () => {
  let finish;
  transport = () => new Promise((done) => { finish = done; });
  await render(React.createElement(React.Fragment, null, React.createElement(Metrics), React.createElement(Probe)));
  assert.equal(container.querySelectorAll('[role="status"]').length, 4);
  assert.match(container.innerHTML, /sm:grid-cols-2 xl:grid-cols-4/);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].url, "/admin/businesses/overview/");
  assert.ok(reads[0].signal instanceof AbortSignal);
  await act(async () => finish({ data: { data: fixture() } }));
  await until(() => container.textContent.includes("9 active businesses"));
  assert.match(card("Total Businesses").textContent, /12.*9 active businesses/);
  assert.match(card("Suspended Businesses").textContent, /2Currently suspended/);
  assert.match(card("New Businesses").textContent, /5Added this month3 morePrev. equivalent period: 2/);
  assert.match(card("Pending Business Updates").textContent, /7Awaiting review/);
  assert.equal(container.querySelectorAll("h3").length, 4);
  assert.doesNotMatch(container.textContent, /248|241|Sugbo Bistro|7\.8%|97\.2%/);
  assert.equal(queryOptions().staleTime, 30_000);
  assert.equal(queryOptions().refetchOnWindowFocus, true);
});

test("zero counts remain zero and comparison is omitted when unavailable", async () => {
  const payload = fixture();
  payload.business_status = { total: 0, active: 0, suspended: 0 };
  payload.new_businesses = { count: 0, previous_count: null, difference: null, comparison_available: false };
  payload.change_requests.pending_total = 0;
  transport = async () => ({ data: { data: payload } });
  await render(React.createElement(Metrics));
  await until(() => Boolean(card("Total Businesses")));
  for (const title of ["Total Businesses", "Suspended Businesses", "New Businesses", "Pending Business Updates"]) {
    assert.equal(card(title).querySelector(".tabular-nums").textContent, "0");
  }
  assert.doesNotMatch(container.textContent, /Prev\.|more|fewer|No change|Unavailable/);
});

test("failure shows persistent Retry and toast, never zero, then recovers without reload", async () => {
  transport = async () => { throw new Error("Offline"); };
  await render(React.createElement(Metrics));
  await until(() => container.textContent.includes("Unable to load business overview"));
  assert.equal(container.querySelectorAll(".tabular-nums").length, 0);
  assert.equal(notifications.length, 1);
  transport = async () => ({ data: { data: fixture() } });
  const retry = [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry");
  await act(async () => retry.click());
  await until(() => Boolean(card("Total Businesses")));
  assert.equal(reads.length, 2);
});

test("cached values remain visible through background failure and Retry", async () => {
  client.setQueryData(queryKey, fixture());
  await render(React.createElement(React.Fragment, null, React.createElement(Metrics), React.createElement(Probe)));
  assert.equal(reads.length, 0);
  transport = async () => { throw new Error("Refresh unavailable"); };
  await act(async () => query.refetch());
  await until(() => container.textContent.includes("Showing previously loaded data"));
  assert.match(card("Total Businesses").textContent, /12/);
  assert.equal(container.querySelectorAll("h3").length, 4);
  transport = async () => ({ data: { data: { ...fixture(), business_status: { total: 13, active: 10, suspended: 3 } } } });
  await act(async () => container.querySelector("button").click());
  await until(() => container.textContent.includes("10 active businesses"));
  assert.doesNotMatch(container.textContent, /Refresh failed/);
});

test("additions comparisons handle zero baseline, fewer, unchanged, and invalid differences neutrally", async () => {
  for (const [current, previous, difference, label] of [[3, 0, 3, "3 more"], [1, 3, -2, "2 fewer"], [0, 0, 0, "No change"], [2, 1, 99, null]]) {
    await act(async () => client.setQueryData(queryKey, {
      ...fixture(), new_businesses: { count: current, previous_count: previous, difference, comparison_available: true },
    }));
    await render(React.createElement(Metrics));
    if (label) assert.match(card("New Businesses").textContent, new RegExp(label));
    else assert.doesNotMatch(card("New Businesses").textContent, /Prev\.|more|fewer/);
    assert.equal(card("New Businesses").querySelectorAll(".text-danger, .text-success").length, 0);
  }
});

test("suspended link updates the existing table filter on the same page", async () => {
  client.setQueryData(queryKey, fixture());
  await render(React.createElement(React.Fragment, null, React.createElement(Metrics), React.createElement(TableProbe)));
  const link = container.querySelector('a[href="/admin-panel/businesses?status=suspended"]');
  assert.match(link.className, /cursor-pointer.*focus-visible/);
  await act(async () => link.click());
  assert.equal(container.querySelector("output").textContent, "suspended|/admin-panel/businesses?status=suspended");
});

test("pending link navigates to the existing combined pending update queue", async () => {
  client.setQueryData(queryKey, fixture());
  await render(React.createElement(React.Fragment, null, React.createElement(Metrics), React.createElement(TableProbe)));
  await act(async () => container.querySelector('a[href*="update-requests"]').click());
  assert.match(container.querySelector("output").textContent, /\/businesses\/update-requests\?type=all&status=pending/);
});

test("suspended navigation retains existing classification filters and resets pagination", async () => {
  client.setQueryData(queryKey, fixture());
  await render(
    React.createElement(React.Fragment, null, React.createElement(Metrics), React.createElement(TableProbe)),
    "/admin-panel/businesses?category=4&page=3&tab=map",
  );
  assert.equal(container.querySelector("output").dataset.page, "2");
  await act(async () => container.querySelector('a[href*="status=suspended"]').click());
  const output = container.querySelector("output");
  assert.equal(output.dataset.page, "0");
  assert.equal(output.dataset.category, "4");
  assert.equal(output.textContent, "suspended|/admin-panel/businesses?category=4&status=suspended");
});

test("missing metric fields remain unavailable without fabricated zeroes", async () => {
  client.setQueryData(queryKey, { as_of: fixture().as_of });
  await render(React.createElement(Metrics));
  assert.deepEqual(
    [...container.querySelectorAll(".tabular-nums")].map((value) => value.textContent),
    ["Unavailable", "Unavailable", "Unavailable", "Unavailable"],
  );
  assert.doesNotMatch(container.textContent, /Prev\.|more|fewer/);
});

test("application approval and every update approval/rejection invalidate the overview cache", async () => {
  for (const name of ["name", "classification", "location", "application"]) {
    await render(React.createElement(MutationProbe, { key: name, name }));
    for (const action of name === "application" ? ["approveApplication"] : ["approve", "reject"]) {
      client.setQueryData(queryKey, fixture());
      assert.equal(client.getQueryState(queryKey).isInvalidated, false);
      await act(async () => {
        if (action === "reject") await mutation.reject({ requestId: 1, rejectionReason: "Needs correction" });
        else await mutation[action](1, 2);
      });
      assert.equal(client.getQueryState(queryKey).isInvalidated, true, `${name} ${action}`);
    }
  }
  assert.equal(posts.length, 7);
});
