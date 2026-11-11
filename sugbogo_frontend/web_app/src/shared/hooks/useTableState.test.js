import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let navigate;
let table;
let location;
let UpdateRequests;
const hooks = {};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: "table-state-probes",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/data-table/DataTable.jsx")) {
          return "export default function Table(props) { globalThis.__urlTable = props; return null; }";
        }
        if (/\/hooks\/use(BusinessUpdateRequests|CombinedUpdateRequests|ClassificationUpdateRequests|LocationUpdateRequests)\.js$/.test(path)) {
          return `export default function useQueue(params, options) {
            if (options.enabled) globalThis.__urlRequest = params;
            return { requests: [], hasData: true, pageCount: 4, totalItems: 40 };
          }`;
        }
        if (path.endsWith("/components/UpdateRequestMetrics.jsx")) {
          return "export default function Metrics() { return null; }";
        }
      },
    }],
  });
  for (const [name, path] of Object.entries({
    business: "features/admin-panel/businesses/hooks/useBusinessTableState.js",
    users: "features/admin-panel/users/hooks/useUserTableState.js",
    applications: "features/admin-panel/business-applications/hooks/useBusinessApplicationTableState.js",
  })) {
    ({ default: hooks[name] } = await server.ssrLoadModule(`/src/${path}`));
  }
  ({ default: UpdateRequests } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/UpdateRequestsPage.jsx",
  ));
});
beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(async () => {
  await server.close();
  dom.window.close();
  for (const key of ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT", "__urlTable", "__urlRequest"]) {
    delete globalThis[key];
  }
});
function Probe({ kind }) {
  navigate = useNavigate();
  location = useLocation();
  if (kind !== "updates") table = hooks[kind]();
  return kind === "updates" ? React.createElement(UpdateRequests) : null;
}
async function render(kind, entries, initialIndex = 0) {
  await act(async () => root.render(React.createElement(
    MemoryRouter,
    { initialEntries: entries, initialIndex },
    React.createElement(Probe, { kind }),
  )));
}
async function go(to) {
  await act(async () => navigate(to));
}

for (const kind of ["business", "users", "applications"]) {
  test(`${kind}: history and same-page navigation restore controls and query criteria`, async () => {
    const first = "/?search=first&page=2&sort=-name&status=active&role=admin&cluster=11&category=12&specialty_tag=13&queue_status=unassigned&keep=yes";
    const second = "/?search=second&page=4&sort=name&status=suspended&role=merchant&cluster=21&category=22&specialty_tag=23&queue_status=assigned&keep=yes";
    await render(kind, [first]);
    assert.equal(table.params.search, "first");
    await go(second);
    assert.equal(table.globalFilter, "second");
    assert.equal(table.params.search, "second");
    assert.equal(table.params.page, 4);
    assert.equal(table.sorting[0].desc, false);
    assert.equal(table.params.status, "suspended");
    if (kind === "users") assert.equal(table.params.role, "merchant");
    else {
      assert.equal(table.params.cluster, "21");
      assert.equal(table.params.category, "22");
      if (kind === "business") assert.equal(table.params.specialty_tag, "23");
      else assert.equal(table.params.queue_status, "assigned");
    }
    await act(async () => table.setGlobalFilter("unfinished"));
    await go(-1);
    assert.equal(table.globalFilter, "first");
    assert.equal(table.params.search, "first");
    assert.equal(table.params.page, 2);
    assert.equal(table.sorting[0].desc, true);
    await act(async () => pause(450));
    assert.equal(location.search, first.slice(1));
    await go(1);
    assert.equal(table.globalFilter, "second");
    assert.equal(table.params.page, 4);
    await go(-1);
    await act(async () => pause(450));
    assert.equal(table.globalFilter, "first");
    assert.equal(location.search, first.slice(1));
  });
}

test("search stays debounced, replaces history, preserves unrelated keys and resets page", async () => {
  await render("business", ["/?search=older", "/?search=current&page=3&keep=yes"], 1);
  await act(async () => table.setGlobalFilter("new"));
  assert.equal(table.params.search, "current");
  assert.equal(table.isSearching, true);
  await act(async () => pause(450));
  assert.equal(table.params.search, "new");
  assert.equal(table.params.page, 1);
  assert.equal(new URLSearchParams(location.search).get("keep"), "yes");
  const key = location.key;
  await act(async () => table.setSorting([]));
  assert.equal(location.key, key);
  await go(-1);
  assert.equal(table.globalFilter, "older");
});

test("controls, reset and invalid page defaults remain functional", async () => {
  await render("users", ["/?page=invalid&keep=yes"]);
  assert.equal(table.pagination.pageIndex, 0);
  assert.equal(table.pagination.pageSize, 10);
  assert.equal(table.globalFilter, "");
  assert.deepEqual(table.sorting, []);
  await act(async () => table.setRoleFilter("merchant"));
  assert.equal(table.params.role, "merchant");
  await act(async () => table.setPagination((old) => ({ ...old, pageIndex: 2 })));
  assert.equal(table.params.page, 3);
  await act(async () => table.setSorting([{ id: "name", desc: true }]));
  assert.equal(table.params.ordering, "-name");
  await act(async () => table.handleResetFilters());
  assert.equal(location.search, "?keep=yes");
  assert.equal(table.hasActiveFilters, false);
  for (const page of ["-2", "0", "2.5", "Infinity"]) {
    await go(`/?page=${page}`);
    assert.equal(table.params.page, 1);
  }
});

test("Update Requests restores URL search, scope and page without stale debounce writes", async () => {
  await render("updates", ["/?search=first&type=all&status=pending&page=2&keep=yes"]);
  assert.equal(globalThis.__urlTable.state.globalFilter, "first");
  await go("/?search=second&type=all&status=all&page=3&keep=yes");
  assert.equal(globalThis.__urlTable.state.globalFilter, "second");
  assert.equal(globalThis.__urlRequest.search, "second");
  assert.equal(globalThis.__urlRequest.page, 3);
  await act(async () => globalThis.__urlTable.onGlobalFilterChange("unfinished"));
  await go(-1);
  await act(async () => pause(450));
  assert.equal(globalThis.__urlTable.state.globalFilter, "first");
  assert.equal(globalThis.__urlRequest.search, "first");
  assert.equal(globalThis.__urlRequest.page, 2);
  await go(1);
  assert.equal(globalThis.__urlRequest.search, "second");
  await act(async () => globalThis.__urlTable.onResetFilters());
  assert.equal(new URLSearchParams(location.search).get("keep"), "yes");
  assert.equal(globalThis.__urlTable.state.globalFilter, "");
});
