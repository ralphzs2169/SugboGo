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
let LegacyPage;
let LegacyTagsPage;
let records;
let reads;
let writes;
let failures;
let mutationError;
let totalItems;
let keys;

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
  ({ default: LegacyPage } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/ClusterCategoryPage.jsx",
  ));
  ({ default: LegacyTagsPage } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/SpecialtyTagsPage.jsx",
  ));
  ({ taxonomyQueryKeys: keys } = await server.ssrLoadModule(
    "/src/features/admin-panel/taxonomy/queries/taxonomyQueries.js",
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
  reads = [];
  writes = [];
  failures = new Set();
  mutationError = null;
  totalItems = null;
  globalThis.__taxonomyTransport = async (method, url, payload = {}) => {
    if (method === "get") {
      reads.push({ url, params: payload.params });
      if (failures.has(url)) {
        throw new Error("Inventory temporarily unavailable");
      }
      if (url === "/admin/businesses/overview/") {
        return { data: { data: { business_status: { total: 12 } } } };
      }
      const resource = url.slice(API.length).split("/")[0];
      assert.ok(records[resource], `Unexpected endpoint: ${url}`);
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
      return { data: { data: {
        items,
        pagination: {
          total_items: count,
          total_pages: Math.ceil(count / (params.page_size ?? 10)),
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

async function render(Component = Page) {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, null, React.createElement(Component))),
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
  assert.deepEqual(headers(), ["Cluster", "Categories", "Businesses", "Actions"]);
  assert.doesNotMatch(panel().textContent, /999|Created|Last Updated/);
  assert.match(panel().querySelector("tbody").textContent, /7/);
  assert.equal(reads.filter((item) => item.url === `${API}categories/`).length, 0);
  assert.equal(reads.filter((item) => item.url === `${API}specialty-tags/`).length, 0);

  await tab("categories");
  assert.deepEqual(headers(), ["Category", "Cluster", "Businesses", "Application References", "Actions"]);
  assert.doesNotMatch(panel().textContent, /999/);
  assert.equal(button("Delete Restaurants").disabled, true);
  await tab("specialty-tags");
  assert.deepEqual(headers(), ["Specialty Tag", "Businesses", "Application References", "Actions"]);
  assert.match(panel().querySelector("tbody").textContent, /HeritageUnavailable/);
  assert.equal(button("Delete Eco Friendly").disabled, true);
  assert.match(card("Classified Businesses").textContent, /12/);
  assert.equal(reads.filter((item) => item.url.endsWith("statistics/")).length, 3);
  assert.equal(reads.filter((item) => item.url === "/admin/businesses/overview/").length, 1);
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

test("legacy taxonomy pages, routes, navigation, and Discovery Shortcuts remain available", async () => {
  await render(LegacyPage);
  await click(button("Discovery Shortcuts"));
  assert.match(container.textContent, /Find a meal/);
  assert.ok(button("Add Discovery Shortcut"));
  await render(LegacyTagsPage);
  assert.match(container.textContent, /Specialty Tag Management/);
  assert.ok(button("Add Specialty Tag"));
  const routes = readFileSync("src/App.jsx", "utf8");
  for (const path of ["business-taxonomy", "cluster-category", "specialty-tags"]) {
    assert.match(routes, new RegExp(`path="${path}"`));
  }
  const navigation = readFileSync("src/features/admin-panel/config/sidebarNavigation.js", "utf8");
  for (const path of ["business-taxonomy", "cluster-category", "specialty-tags"]) {
    assert.match(navigation, new RegExp(`to: "/admin-panel/${path}"`));
  }
});
