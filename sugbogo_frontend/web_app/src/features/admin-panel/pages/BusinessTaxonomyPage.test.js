import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import toast from "react-hot-toast";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const API = "/admin/taxonomy/";
let server;
let dom;
let root;
let container;
let client;
let Page;
let records;
let reads;
let writes;
let failures;
let mutationError;
let totalItems;
let keys;
let optionPageSize;
let optionFailures;
let optionGates;
let BusinessTable;
let DiscoveryScores;
const optionForms = [
  { file: "CreateCategoryModal", field: "name" },
  { file: "EditCategoryModal", field: "name", editing: true },
  { file: "CreateDiscoveryShortcutModal", field: "title" },
  { file: "EditDiscoveryShortcutModal", field: "title", editing: true },
];

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
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    ssr: {
      noExternal: ["@googlemaps/markerclusterer", "@vis.gl/react-google-maps"],
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: "taxonomy-contract-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__taxonomyTransport("get", ...args),
            post: (...args) => globalThis.__taxonomyTransport("post", ...args),
            patch: (...args) => globalThis.__taxonomyTransport("patch", ...args),
            delete: (...args) => globalThis.__taxonomyTransport("delete", ...args),
          };`;
        }
      },
    }],
  });
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/BusinessTaxonomyPage.jsx",
  ));
  ({ taxonomyQueryKeys: keys } = await server.ssrLoadModule(
    "/src/features/admin-panel/taxonomy/queries/taxonomyQueries.js",
  ));
  for (const form of optionForms) {
    ({ default: form.Component } = await server.ssrLoadModule(
      `/src/features/admin-panel/cluster-category/components/${form.file}.jsx`,
    ));
  }
  ({ default: BusinessTable } = await server.ssrLoadModule(
    "/src/features/admin-panel/businesses/components/BusinessManagementTable.jsx",
  ));
  ({ default: DiscoveryScores } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/DiscoveryScoresPage.jsx",
  ));
});

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  mock.method(toast, "error", () => {});
  mock.method(toast, "success", () => {});
  mock.method(toast, "dismiss", () => {});
  mock.method(console, "error", () => {});
  records = {
    clusters: [
      { id: 1, name: "Food", description: "Food businesses", icon: "utensils", category_count: 1, business_count: 7, msme_count: 999 },
      { id: 2, name: "Tourism", description: "Tourism businesses", icon: "landmark", category_count: 0, business_count: 0 },
    ],
    categories: [
      { id: 1, name: "Restaurants", description: "Dining places", cluster_id: 1, cluster_name: "Food", cluster_icon: "utensils", business_count: 7, msme_count: 999, application_count: 4 },
      { id: 2, name: "Hotels", description: "Places to stay", cluster_id: 2, cluster_name: "Tourism", cluster_icon: "landmark", business_count: 0, application_count: 0 },
    ],
    "specialty-tags": [
      { id: 1, name: "Eco Friendly", color: "green", icon: "leaf", business_count: 2, application_count: 4 },
      { id: 2, name: "Heritage", color: "blue", icon: "tag", application_count: 0 },
    ],
    "discovery-shortcuts": [
      { id: 1, title: "Find a meal", subtitle: "Places to eat", cluster: { id: 1, name: "Food", icon: "utensils" }, business_count: 5, is_active: true },
    ],
  };
  for (const resource of ["clusters", "categories", "specialty-tags"]) {
    for (const record of records[resource]) {
      record.created_at = "2026-11-05T04:30:00Z";
    }
  }
  reads = [];
  writes = [];
  failures = new Set();
  mutationError = null;
  totalItems = null;
  optionPageSize = null;
  optionFailures = new Set();
  optionGates = new Map();
  globalThis.__taxonomyTransport = async (method, url, payload = {}) => {
    if (method === "get") {
      reads.push({ url, params: payload.params, signal: payload.signal });
      if (failures.has(url)) {
        throw new Error("Inventory temporarily unavailable");
      }
      if (url === "/admin/businesses/overview/") {
        return { data: { data: { business_status: { total: 12 } } } };
      }
      if (url === "/admin/businesses/" || url === "/admin/analytics/discovery-scores/") {
        const business = { id: 7, business_name: "Healthy business", status: "active", created_at: "2026-11-05T04:30:00Z" };
        return { data: { data: {
          items: url.includes("analytics") ? [{ business, refresh_status: "SUCCESS" }] : [business],
          pagination: { total_items: 1, total_pages: 1 },
          coverage: { computed: 1, fresh: 1, failed: 0, needs_attention: 0 },
        } } };
      }
      const resource = url.slice(API.length).split("/")[0];
      assert.ok(records[resource], `Unexpected endpoint: ${url}`);
      const referenceKey = `${resource}:${payload.params?.page}`;
      if (optionGates.has(referenceKey)) {
        await optionGates.get(referenceKey).promise;
      }
      if (optionFailures.has(referenceKey)) {
        throw { response: { data: { message: `${resource} options unavailable.` } } };
      }
      if (url.endsWith("statistics/")) {
        const field = {
          clusters: "total_clusters",
          categories: "total_categories",
          "specialty-tags": "total_tags",
        }[resource];
        return { data: { data: { [field]: records[resource].length } } };
      }
      const params = payload.params ?? {};
      let items = records[resource].filter((item) => (
        !params.search || (item.name ?? item.title).toLowerCase().includes(params.search.toLowerCase())
      ));
      if (params.cluster_id) {
        items = items.filter((item) => item.cluster_id === Number(params.cluster_id));
      }
      const count = totalItems ?? items.length;
      const completeReference = optionPageSize && payload.params?.page_size === 100;
      const size = completeReference ? optionPageSize : params.page_size ?? 10;
      const page = params.page ?? 1;
      if (completeReference) {
        items = items.slice((page - 1) * size, page * size);
      }
      return { data: { data: {
        items,
        pagination: {
          total_items: count,
          total_pages: Math.ceil(count / size),
          page,
          page_size: size,
          has_next: page * size < count,
        },
      } } };
    }
    writes.push({ method, url, payload });
    if (mutationError) {
      throw mutationError;
    }
    const resource = url.slice(API.length).split("/")[0];
    if (method === "post") {
      records[resource].push({ id: 3, ...payload, category_count: 0, business_count: 0, application_count: 0 });
    } else if (method === "patch") {
      const id = Number(url.split("/").at(-2));
      Object.assign(records[resource].find((item) => item.id === id), payload);
    } else if (method === "delete") {
      const id = Number(url.split("/").at(-2));
      records[resource] = records[resource].filter((item) => item.id !== id);
    }
    return { data: { data: payload } };
  };
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
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
  delete globalThis.__taxonomyTransport;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function settleQueries() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    if (client.isFetching() === 0) {
      return;
    }
  }
  assert.fail("Taxonomy queries did not settle");
}

async function render(Component = Page, entry = "/admin-panel/business-taxonomy") {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [entry], key: entry }, React.createElement(Component))),
  ));
  await settleQueries();
}

function panel() {
  return container.querySelector('[role="tabpanel"]:not([hidden])') ?? container;
}

function button(text, scope = panel()) {
  return [...scope.querySelectorAll("button")].find((item) => (
    item.textContent.trim() === text || item.getAttribute("aria-label") === text
  ));
}

async function click(element) {
  assert.ok(element, "Expected an available control");
  await act(async () => element.click());
  await settleQueries();
}

async function tab(id) {
  await click(container.querySelector(`#business-taxonomy-${id}`));
}

async function input(element, value) {
  assert.ok(element);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(element, value);
    element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await settleQueries();
}

function headers() {
  return [...panel().querySelectorAll("th")].map((item) => item.textContent.trim());
}

function card(title) {
  return [...container.querySelectorAll("h3")].find(
    (item) => item.textContent === title,
  )?.closest(".relative.flex");
}

test("four fixed inventories, final columns, and canonical counts survive tab changes", async () => {
  await render();
  assert.equal(container.querySelector("h1").textContent, "Business Taxonomy Management");
  assert.match(container.textContent, /Manage business clusters, categories, and specialty tags used throughout SugboGo\./);
  assert.match(card("Total Clusters").textContent, /Total Clusters2Business groupings/);
  assert.match(card("Total Categories").textContent, /Total Categories2Business classifications/);
  assert.match(card("Specialty Tags").textContent, /Specialty Tags2Available specialty labels/);
  assert.match(card("Classified Businesses").textContent, /Classified Businesses12Total retained businesses/);
  assert.deepEqual(headers(), ["No.", "Cluster", "Categories", "Businesses", "Date Added", "Actions"]);
  const tabs = container.querySelector('[role="tablist"]');
  const managementContainer = tabs.closest(".rounded-2xl");
  assert.equal(panel().querySelector("table").closest(".rounded-2xl"), managementContainer);
  assert.equal(managementContainer.querySelectorAll(".rounded-2xl").length, 0);
  assert.ok(tabs.compareDocumentPosition(panel().querySelector("input")) & Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(panel().querySelector("table").parentElement.classList.contains("min-h-[520px]"), false);
  assert.equal(panel().querySelector("colgroup col").style.width, "56px");
  assert.equal(panel().querySelectorAll("th")[2].classList.contains("text-center"), true);
  assert.equal(panel().querySelectorAll("tbody tr:first-child td")[2].classList.contains("text-center"), true);
  assert.doesNotMatch(panel().textContent, /999|Created|Last Updated/);
  assert.match(panel().querySelector("tbody").textContent, /7/);
  assert.equal(reads.filter((item) => item.url === `${API}categories/`).length, 0);
  assert.equal(reads.filter((item) => item.url === `${API}specialty-tags/`).length, 0);

  await tab("categories");
  assert.deepEqual(headers(), ["No.", "Category", "Cluster", "Businesses", "Application References", "Date Added", "Actions"]);
  assert.doesNotMatch(panel().textContent, /999/);
  assert.equal(button("Delete Restaurants").disabled, true);
  await tab("specialty-tags");
  assert.deepEqual(headers(), ["No.", "Specialty Tag", "Businesses", "Application References", "Date Added", "Actions"]);
  assert.match(panel().querySelector("tbody").textContent, /HeritageUnavailable/);
  assert.equal(button("Delete Eco Friendly").disabled, true);
  assert.match(card("Classified Businesses").textContent, /12/);
  assert.equal(reads.filter((item) => item.url.endsWith("statistics/")).length, 3);
  assert.equal(reads.filter((item) => item.url === "/admin/businesses/overview/").length, 1);
});

test("all taxonomy tables number server pages and expose the existing creation date ordering", async () => {
  totalItems = 80;
  await render();
  for (const resource of ["clusters", "categories", "specialty-tags"]) {
    await tab(resource);
    const firstNumber = () => panel().querySelector("tbody tr:first-child td").textContent.trim();
    assert.equal(firstNumber(), "1");
    const date = panel().querySelector("tbody time");
    assert.equal(date.getAttribute("datetime"), "2026-11-05T04:30:00.000Z");
    assert.match(date.firstElementChild.textContent, /Nov.*2026/);
    assert.match(date.lastElementChild.textContent, /\d+:\d+/);
    assert.equal(panel().querySelector("table").parentElement.classList.contains("min-h-[520px]"), false);
    await click(panel().querySelector('[aria-label="Next page"]'));
    assert.equal(firstNumber(), "11");
    await click(panel().querySelector('[aria-label^="Rows per page:"]'));
    await click(button("25"));
    assert.equal(firstNumber(), "1");
    await click(panel().querySelector('[aria-label="Next page"]'));
    assert.equal(firstNumber(), "26");
    assert.match(panel().querySelector('[aria-label="Table pagination"]').parentElement.textContent, /Showing 26–50 of 80 results/);
    await click(panel().querySelector('[aria-label^="Sort items:"]'));
    assert.equal(button("No.: ascending"), undefined);
    await click(button("Date Added: ascending"));
    const params = reads.filter((item) => item.url === `${API}${resource}/`).at(-1).params;
    assert.equal(params.ordering, "created_at");
    assert.equal(params.page, 1);
  }
});

test("each tab retains independent server-side search, sorting, page size, page, and category filter", async () => {
  totalItems = 80;
  await render();
  await input(panel().querySelector("input"), "Food");
  await click(panel().querySelector('[aria-label^="Sort items:"]'));
  await click(button("Businesses: descending"));
  await click(panel().querySelector('[aria-label^="Rows per page:"]'));
  await click(button("25"));
  await click(panel().querySelector('[aria-label="Next page"]'));
  const clusterParams = reads.filter((item) => item.url === `${API}clusters/`).at(-1).params;
  assert.deepEqual(clusterParams, { search: "Food", ordering: "-business_count", page: 2, page_size: 25 });

  await tab("categories");
  await click(button("Filter"));
  await click(button("Choose Cluster filter"));
  await click(button("Food"));
  await input(panel().querySelector('input[placeholder="Search categories..."]'), "Restaurants");
  await click(panel().querySelector('[aria-label^="Sort items:"]'));
  await click(button("Cluster: ascending"));
  const categoryParams = reads.filter((item) => item.url === `${API}categories/`).at(-1).params;
  assert.equal(categoryParams.cluster_id, 1);
  assert.equal(categoryParams.ordering, "cluster_name");
  assert.equal(categoryParams.search, "Restaurants");
  assert.equal(categoryParams.page_size, 10);
  await tab("specialty-tags");
  await input(panel().querySelector("input"), "Heritage");
  await click(panel().querySelector('[aria-label^="Sort items:"]'));
  await click(button("Application References: descending"));
  assert.equal(reads.filter((item) => item.url === `${API}specialty-tags/`).at(-1).params.ordering, "-application_count");

  await tab("clusters");
  assert.equal(panel().querySelector("input").value, "Food");
  assert.match(panel().textContent, /Rows: 25/);
  assert.match(panel().textContent, /Businesses: descending/);
  assert.equal(panel().querySelector('[aria-current="page"]').textContent, "2");
  await tab("categories");
  assert.equal(panel().querySelector("input").value, "Restaurants");
  assert.match(panel().textContent, /Cluster: Food/);
  await tab("specialty-tags");
  assert.equal(panel().querySelector("input").value, "Heritage");
});

test("an inventory failure preserves other cards and retries only its request", async () => {
  const endpoint = `${API}categories/statistics/`;
  failures.add(endpoint);
  await render();
  assert.match(card("Total Categories").textContent, /Unavailable/);
  assert.match(card("Total Clusters").textContent, /2/);
  assert.match(panel().textContent, /Food/);
  const before = reads.length;
  failures.delete(endpoint);
  await click(button("Retry total categories", container));
  assert.equal(reads.length, before + 1);
  assert.equal(reads.at(-1).url, endpoint);
  assert.match(card("Total Categories").textContent, /Total Categories2/);
});

test("list and filter errors recover independently without disturbing the overview", async () => {
  failures.add(`${API}categories/`);
  await render();
  await tab("categories");
  assert.match(panel().textContent, /Unable to load categories/);
  assert.match(card("Total Clusters").textContent, /2/);
  failures.delete(`${API}categories/`);
  await click(button("Try Again"));
  assert.match(panel().textContent, /Restaurants/);
  failures.add(`${API}clusters/`);
  await act(async () => client.invalidateQueries({
    queryKey: keys.list("clusters", { page_size: 100 }),
  }));
  await settleQueries();
  assert.match(panel().textContent, /Showing previously loaded data/);
  assert.match(panel().textContent, /Restaurants/);
  failures.delete(`${API}clusters/`);
  await click(button("Retry cluster filter"));
  assert.doesNotMatch(panel().textContent, /Showing previously loaded data/);
});

test("existing create dialogs refresh the affected overview and list", async () => {
  await render();
  for (const [resource, addLabel, name, expectedTotal] of [
    ["clusters", "Cluster", "Creative", 3],
    ["categories", "Category", "Workshops", 3],
    ["specialty-tags", "Specialty Tag", "Handmade", 3],
  ]) {
    await tab(resource);
    await click(button(`Add ${addLabel}`));
    const dialog = container.querySelector('[role="dialog"]');
    await input(dialog.querySelector('input[name="name"]'), name);
    if (resource === "categories") {
      await click(button("Select a cluster", dialog));
      await click(button("Food", document.body));
    }
    await act(async () => dialog.querySelector("form").dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    ));
    await settleQueries();
    assert.equal(writes.at(-1).method, "post");
    assert.equal(writes.at(-1).url, `${API}${resource}/`);
    assert.equal(writes.at(-1).payload.name, name);
    const title = { clusters: "Total Clusters", categories: "Total Categories", "specialty-tags": "Specialty Tags" }[resource];
    assert.match(card(title).textContent, new RegExp(`${title}${expectedTotal}`));
    assert.match(panel().textContent, new RegExp(name));
  }
});

test("edit and protected delete preserve backend messages and refresh successful changes", async () => {
  await render();
  await click(button("Edit Tourism"));
  let dialog = container.querySelector('[role="dialog"]');
  await input(dialog.querySelector('input[name="name"]'), "Travel");
  await act(async () => dialog.querySelector("form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  await settleQueries();
  assert.equal(writes.at(-1).method, "patch");
  assert.match(panel().textContent, /Travel/);
  await tab("specialty-tags");
  await click(button("Delete Heritage"));
  mutationError = { response: { data: { message: "Retained specialty assignments prevent deletion." } } };
  dialog = container.querySelector('[role="dialog"]');
  await click(button("Delete", dialog));
  assert.equal(writes.at(-1).method, "delete");
  assert.ok(container.querySelector('[role="dialog"]'));
  assert.equal(toast.error.mock.calls.at(-1).arguments[0], "Retained specialty assignments prevent deletion.");
  mutationError = null;
  await click(button("Delete", dialog));
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.doesNotMatch(panel().querySelector("tbody").textContent, /Heritage/);
  assert.match(card("Specialty Tags").textContent, /Specialty Tags1/);
});

test("existing routes remain registered and navigation exposes only the new destinations", () => {
  const routes = readFileSync("src/App.jsx", "utf8");
  for (const path of ["business-taxonomy", "cluster-category", "specialty-tags"]) {
    assert.match(routes, new RegExp(`path="${path}"`));
  }
  const navigation = readFileSync("src/features/admin-panel/config/sidebarNavigation.js", "utf8");
  const activeNavigation = navigation.split("\n").filter(
    (line) => !line.trim().startsWith("//"),
  ).join("\n");
  for (const path of ["business-taxonomy", "explore-configuration"]) {
    assert.match(activeNavigation, new RegExp(`to: "/admin-panel/${path}"`));
  }
  for (const path of ["cluster-category", "specialty-tags"]) {
    assert.doesNotMatch(activeNavigation, new RegExp(`to: "/admin-panel/${path}"`));
  }
});

test("taxonomy direct links select the matching tab without duplicating the workspace", async () => {
  for (const [selected, table] of [
    ["categories", "Categories"],
    ["specialty-tags", "Specialty Tags"],
    ["clusters", "Clusters"],
  ]) {
    await render(Page, `/admin-panel/business-taxonomy?tab=${selected}`);
    assert.equal(container.querySelector('[role="tab"][aria-selected="true"]').id, `business-taxonomy-${selected}`);
    assert.equal(panel().querySelector("table").getAttribute("aria-label"), table);
    assert.equal(container.querySelectorAll('[role="tabpanel"]:not([hidden])').length, 1);
  }
});

function optionDeferred() {
  let finish;
  const promise = new Promise((done) => { finish = done; });
  return { promise, resolve: finish };
}

async function waitForOptions(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Taxonomy options did not reach the expected state");
}

function completeInventories(count = 251) {
  optionPageSize = 100;
  for (const [resource, prefix] of [
    ["clusters", "Cluster"],
    ["categories", "Category"],
    ["specialty-tags", "Specialty"],
  ]) {
    records[resource] = Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name: `${prefix} ${index + 1}`,
      icon: "tag",
      cluster_id: 1,
      color: "blue",
    }));
  }
}

async function mountOptionForm(form) {
  const category = { id: 9, name: "Existing category", cluster_id: 251 };
  const shortcut = {
    id: 9, cluster: { id: 251 }, title: "Existing shortcut",
    subtitle: "Existing subtitle", is_active: true,
  };
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(form.Component, {
        isOpen: true, category, shortcut, shortcuts: [], onClose: () => {},
      }),
    ),
  ));
}

async function changeOptionField(field, value) {
  const element = container.querySelector(`[name="${field}"]`);
  const prototype = element.tagName === "TEXTAREA"
    ? dom.window.HTMLTextAreaElement.prototype
    : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

for (const form of optionForms) {
  test(`${form.file}: complete cluster selector recovers a failed later page without losing the draft`, async () => {
    completeInventories();
    const pending = optionDeferred();
    optionGates.set("clusters:2", pending);
    optionFailures.add("clusters:2");
    await mountOptionForm(form);
    await waitForOptions(() => reads.some((read) => read.url === `${API}clusters/` && read.params.page === 2));
    await changeOptionField(form.field, "Preserved draft");
    assert.match(container.textContent, /Loading cluster options/);
    assert.doesNotMatch(container.textContent, /No clusters available/);
    assert.equal(container.querySelector('[aria-haspopup="listbox"]').disabled, true);
    assert.equal(container.querySelector('button[type="submit"]').disabled, true);
    await act(async () => container.querySelector("form").dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    ));
    assert.equal(writes.length, 0);
    optionGates.delete("clusters:2");
    await act(async () => pending.resolve());
    await waitForOptions(() => button("Retry cluster options", container));
    assert.match(container.textContent, /Unable to load cluster options/);
    assert.doesNotMatch(container.textContent, /No clusters available/);
    assert.equal(container.querySelector(`[name="${form.field}"]`).value, "Preserved draft");
    assert.equal(container.querySelector('button[type="submit"]').disabled, true);
    assert.equal(toast.error.mock.calls.at(-1).arguments[0], "clusters options unavailable.");
    optionFailures.clear();
    const previousReads = reads.length;
    await click(button("Retry cluster options", container));
    assert.deepEqual(reads.slice(previousReads).map((read) => [read.url, read.params.page]), [
      [`${API}clusters/`, 1], [`${API}clusters/`, 2], [`${API}clusters/`, 3],
    ]);
    assert.ok(reads.slice(previousReads).every((read) => read.signal instanceof AbortSignal));
    assert.equal(container.querySelector(`[name="${form.field}"]`).value, "Preserved draft");
    const trigger = container.querySelector('[aria-haspopup="listbox"]');
    assert.equal(trigger.disabled, false);
    if (form.editing) assert.match(trigger.textContent, /Cluster 251/);
    await click(trigger);
    assert.equal(document.querySelectorAll('[role="option"]').length, 251);
    await click(button("Cluster 251", document.body));
    if (form.field === "title") await changeOptionField("subtitle", "Useful subtitle");
    await act(async () => container.querySelector("form").dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    ));
    await waitForOptions(() => writes.length === 1);
    assert.equal(String(writes[0].payload.cluster_id), "251");
  });

  test(`${form.file}: genuinely empty cluster options retain their empty state`, async () => {
    optionPageSize = 100;
    records.clusters = [];
    await mountOptionForm(form);
    await waitForOptions(() => !container.querySelector('[aria-haspopup="listbox"]').disabled);
    await click(container.querySelector('[aria-haspopup="listbox"]'));
    assert.match(document.body.textContent, /No clusters available/);
    assert.equal(button("Retry cluster options", container), undefined);
  });
}

for (const [name, getComponent, entry] of [
  ["Business Management", () => BusinessTable, "/admin-panel/businesses"],
  ["Discovery Scores", () => DiscoveryScores, "/admin-panel/analytics/discovery-scores"],
]) {
  test(`${name}: filter sources load every page and preserve selected filters across refresh failures`, async () => {
    completeInventories();
    await render(getComponent(), entry);
    assert.match(container.querySelector("tbody").textContent, /Healthy business/);
    for (const [resource, label, option] of [
      ["clusters", "Cluster", "Cluster 251"],
      ["categories", "Category", "Category 251"],
      ["specialty-tags", "Specialty Tag", "Specialty 251"],
    ]) {
      assert.deepEqual(reads.filter((read) => read.url === `${API}${resource}/`).map((read) => read.params.page), [1, 2, 3]);
      await click(button("Filter", container));
      await click(button(`Choose ${label} filter`, container));
      await click(button(option, container));
      assert.ok(container.querySelector(`[aria-label="Remove ${label} filter"]`));
    }
    optionFailures.add("clusters:2");
    await act(async () => client.invalidateQueries({ queryKey: keys.references("clusters"), exact: true }));
    await waitForOptions(() => button("Retry cluster options", container));
    assert.match(container.textContent, /Cluster: Cluster 251/);
    assert.match(container.querySelector("tbody").textContent, /Healthy business/);
    await click(button("Filter", container));
    assert.equal(button("Choose Cluster filter", container).disabled, true);
    assert.equal(button("Choose Category filter", container).disabled, false);
    optionFailures.clear();
    const previousReads = reads.length;
    await click(button("Retry cluster options", container));
    assert.deepEqual(reads.slice(previousReads).map((read) => [read.url, read.params.page]), [
      [`${API}clusters/`, 1], [`${API}clusters/`, 2], [`${API}clusters/`, 3],
    ]);
    assert.equal(button("Choose Cluster filter", container).disabled, false);
    assert.match(container.textContent, /Cluster: Cluster 251/);
    assert.match(container.textContent, /Category: Category 251/);
    assert.match(container.textContent, /Specialty Tag: Specialty 251/);
  });

  for (const [resource, label] of [
    ["clusters", "Cluster"], ["categories", "Category"], ["specialty-tags", "Specialty Tag"],
  ]) {
    test(`${name}: initial ${resource} failure retries only that filter source`, async () => {
      completeInventories(101);
      optionFailures.add(`${resource}:2`);
      await render(getComponent(), entry);
      const retryLabel = `Retry ${label.toLowerCase()} options`;
      assert.ok(button(retryLabel, container));
      assert.match(container.querySelector("tbody").textContent, /Healthy business/);
      await click(button("Filter", container));
      assert.equal(button(`Choose ${label} filter`, container).disabled, true);
      optionFailures.clear();
      const previousReads = reads.length;
      await click(button(retryLabel, container));
      assert.deepEqual(reads.slice(previousReads).map((read) => read.url), [
        `${API}${resource}/`, `${API}${resource}/`,
      ]);
      assert.equal(button(`Choose ${label} filter`, container).disabled, false);
    });
  }

  test(`${name}: pending and empty filter sources are distinct`, async () => {
    completeInventories(0);
    const pending = optionDeferred();
    optionGates.set("clusters:1", pending);
    const Component = getComponent();
    await act(async () => root.render(
      React.createElement(QueryClientProvider, { client },
        React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(Component)),
      ),
    ));
    await waitForOptions(() => container.textContent.includes("Loading cluster options"));
    await act(async () => button("Filter", container).click());
    assert.equal(button("Choose Cluster filter", container).disabled, true);
    optionGates.delete("clusters:1");
    await act(async () => pending.resolve());
    await settleQueries();
    assert.equal(button("Choose Cluster filter", container).disabled, false);
    await click(button("Choose Cluster filter", container));
    assert.match(container.textContent, /No cluster options available/);
    assert.equal(button("Retry cluster options", container), undefined);
  });
}
