import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let dom;
let server;
let root;
let container;
let DataTable;
let props;
let calls;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
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
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  ({ default: DataTable } = await server.ssrLoadModule(
    "/src/features/admin-panel/components/data-table/DataTable.jsx",
  ));
});

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
  calls = [];
  props = {
    data: [{ name: "Cebu business" }],
    columns: [
      { accessorKey: "name", header: "Name" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => React.createElement("button", {
          "aria-label": "View business",
          onClick: () => calls.push(row.original),
        }, "View"),
      },
    ],
    state: { globalFilter: "", sorting: [] },
    pagination: { pageIndex: 1, pageSize: 10 },
    pageCount: 4,
    totalItems: 40,
    onPaginationChange: (next) => calls.push(next),
    onSortingChange: (updater) => calls.push(
      typeof updater === "function" ? updater(props.state.sorting) : updater,
    ),
    onGlobalFilterChange: (value) => calls.push(value),
    config: {
      managementControls: true,
      tableLabel: "Businesses",
      emptyState: { title: "No businesses yet" },
    },
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

after(async () => {
  await server?.close();
  dom?.window.close();
});

async function render(overrides = {}) {
  props = { ...props, ...overrides };
  await act(async () => root.render(React.createElement(DataTable, props)));
}

function button(label) {
  const found = [...container.querySelectorAll("button")].find(
    (element) => (element.getAttribute("aria-label") || element.textContent) === label,
  );
  assert.ok(found, `Missing button: ${label}`);
  return found;
}

async function click(label) {
  await act(async () => button(label).click());
}

test("controlled search, filter, pagination and row action keep their callbacks", async () => {
  await render({
    slots: {
      renderFilters: () => React.createElement("button", {
        onClick: () => calls.push("filter"),
      }, "Filter"),
    },
  });
  const input = container.querySelector("input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
      .set.call(input, "coffee");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click("Filter");
  await click("Next page");
  await click("View business");
  assert.deepEqual(calls, [
    "coffee", "filter", { pageIndex: 2, pageSize: 10 }, props.data[0],
  ]);
  assert.equal(container.querySelector("table").getAttribute("aria-label"), "Businesses");
});

test("embedded content fits its rows and aligns numeric columns without changing defaults", async () => {
  await render();
  assert.equal(container.querySelector("table").parentElement.classList.contains("min-h-[520px]"), true);
  await render({
    config: { managementControls: true, embedded: true, fitContent: true },
    columns: [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "count", header: "Count", meta: { align: "right" } },
    ],
    data: [{ name: "Cebu business", count: 7 }],
  });
  assert.equal(container.firstElementChild.classList.contains("rounded-2xl"), false);
  assert.equal(container.querySelector("table").parentElement.classList.contains("min-h-[520px]"), false);
  assert.equal(container.querySelectorAll("th")[1].classList.contains("text-right"), true);
  assert.equal(container.querySelectorAll("th")[1].firstElementChild.classList.contains("justify-end"), true);
  assert.equal(container.querySelectorAll("td")[1].classList.contains("text-right"), true);
  assert.ok(container.querySelector('[aria-label="Table pagination"]'));
});

test("utility columns keep their pixel widths while content columns share the remaining space", async () => {
  await render({
    config: {
      managementControls: true,
      fixedUtilityColumns: true,
      fitContent: true,
    },
    columns: [
      { id: "rowNumber", header: "No.", size: 56, cell: () => 1 },
      { accessorKey: "name", header: "Name", size: 260 },
      { accessorKey: "count", header: "Businesses", size: 136, meta: { align: "center" } },
      { accessorKey: "created_at", header: "Date Added", size: 148 },
      { id: "actions", header: "Actions", size: 112, cell: () => null },
    ],
    data: [{ name: "Cebu business", count: 7 }],
  });
  const columns = container.querySelectorAll("colgroup col");
  assert.equal(columns[0].style.width, "56px");
  assert.equal(columns[3].style.width, "148px");
  assert.equal(columns[4].style.width, "112px");
  assert.match(columns[1].style.width, /calc\(/);
  assert.match(columns[2].style.width, /calc\(/);
  assert.equal(container.querySelectorAll("th")[2].classList.contains("text-center"), true);
  assert.equal(container.querySelectorAll("td")[2].classList.contains("text-center"), true);
  assert.equal(container.querySelector("th").style.width, "");
  const footer = container.querySelector('[aria-label="Table pagination"]').parentElement;
  assert.ok(footer.classList.contains("mt-3"));
  assert.equal(footer.classList.contains("border-t"), false);
});

test("rows flyout changes page size, resets to page one and restores focus", async () => {
  await render();
  const trigger = button("Rows per page: Rows: 10");
  await click("Rows per page: Rows: 10");
  assert.equal(document.activeElement.textContent, "10");
  await act(async () => document.activeElement.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  ));
  assert.equal(document.activeElement.textContent, "25");
  await click("25");
  assert.deepEqual(calls, [{ pageIndex: 0, pageSize: 25 }]);
  assert.equal(document.activeElement, trigger);
  assert.equal(container.querySelector('[role="menu"]'), null);
  await click("Rows per page: Rows: 10");
  await act(async () => document.activeElement.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  ));
  assert.equal(document.activeElement, trigger);
  assert.equal(container.querySelector('[role="menu"]'), null);
});

test("sort menu exposes only existing sortable columns and keeps sort identifiers", async () => {
  await render();
  await click("Sort items: Default order");
  assert.equal(container.querySelectorAll('[role="menuitemradio"]').length, 3);
  await click("Name: descending");
  assert.deepEqual(calls, [[{ id: "name", desc: true }]]);
  await render({ state: { globalFilter: "", sorting: [{ id: "name", desc: true }] } });
  assert.equal(container.querySelector("th").getAttribute("aria-sort"), "descending");
  assert.equal(container.querySelector("th button").type, "button");
  await click("Sort items: Name: descending");
  await click("Default order");
  assert.deepEqual(calls.at(-1), []);
});

test("shared states retain table headers and recovery actions", async () => {
  await render({ data: [], isLoading: true });
  assert.equal(container.querySelectorAll("thead th").length, 2);
  assert.equal(container.querySelectorAll("tbody tr").length, 10);
  await render({ isLoading: false });
  assert.match(container.textContent, /No businesses yet/);
  await render({ hasActiveFilters: true });
  assert.match(container.textContent, /No results found/);
  await render({ error: new Error("offline"), onRetry: () => calls.push("retry") });
  assert.match(container.textContent, /Unable to load data/);
  await click("Try Again");
  assert.deepEqual(calls, ["retry"]);
});

test("controls are opt-in and stay absent for unrelated consumers and map content", async () => {
  await render({ config: { compact: true, showSearch: false } });
  assert.equal(container.querySelector('[aria-label^="Rows per page"]'), null);
  await render({
    config: { managementControls: true },
    slots: { renderContent: () => React.createElement("div", null, "Business map") },
  });
  assert.equal(container.querySelector('[aria-label^="Rows per page"]'), null);
});

test("management pages opt in, remove Export and leave analytics exports available", () => {
  const base = "src/features/admin-panel/";
  const managementTables = [
    "businesses/components/BusinessManagementTable.jsx",
    "business-applications/components/BusinessApplicationManagementTable.jsx",
    "users/components/UserManagementTable.jsx",
    "cluster-category/components/ClusterCategoryManagementTable.jsx",
    "specialty-tags/components/SpecialtyTagManagementPanel.jsx",
  ];
  for (const path of managementTables) {
    const source = readFileSync(base + path, "utf8");
    assert.match(source, /managementControls: true/);
    assert.doesNotMatch(source, /\bExport\b|\bDownload\b/);
  }
  assert.match(
    readFileSync(base + "analytics/components/AnalyticsPdfExport.jsx", "utf8"),
    /Export current tab as PDF/,
  );
});
