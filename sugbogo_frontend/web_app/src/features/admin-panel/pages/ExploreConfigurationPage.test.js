import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import toast from "react-hot-toast";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const ENDPOINT = "/admin/taxonomy/discovery-shortcuts/";
let server;
let dom;
let root;
let container;
let client;
let Page;
let LegacyPage;
let LegacyTagsPage;
let navigation;
let metadata;
let queryKey;
let shortcuts;
let reads;
let writes;
let failure;
let mutationFailure;
let totalItems;

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
      name: "explore-configuration-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__exploreConfigurationTransport("get", ...args),
            post: (...args) => globalThis.__exploreConfigurationTransport("post", ...args),
            patch: (...args) => globalThis.__exploreConfigurationTransport("patch", ...args),
            delete: (...args) => globalThis.__exploreConfigurationTransport("delete", ...args),
          };`;
        }
      },
    }],
  });
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/ExploreConfigurationPage.jsx",
  ));
  ({ default: LegacyPage } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/ClusterCategoryPage.jsx",
  ));
  ({ default: LegacyTagsPage } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/SpecialtyTagsPage.jsx",
  ));
  ({ default: navigation } = await server.ssrLoadModule(
    "/src/features/admin-panel/config/sidebarNavigation.js",
  ));
  ({ PAGE_METADATA: metadata } = await server.ssrLoadModule(
    "/src/features/admin-panel/constants/pageMetaData.js",
  ));
  ({ discoveryShortcutQueryKey: queryKey } = await server.ssrLoadModule(
    "/src/features/admin-panel/explore-configuration/queries/discoveryShortcutQueries.js",
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
  shortcuts = [{
    id: 1,
    cluster: { id: 1, name: "Food", icon: "utensils" },
    title: "Find a meal",
    subtitle: "Places to eat",
    business_count: 3,
    is_active: true,
  }];
  reads = [];
  writes = [];
  failure = false;
  mutationFailure = null;
  totalItems = null;
  const clusters = [
    { id: 1, name: "Food", icon: "utensils", business_count: 99 },
    { id: 2, name: "Tourism", icon: "landmark", business_count: 50 },
  ];
  globalThis.__exploreConfigurationTransport = async (method, url, payload = {}) => {
    if (method === "get") {
      reads.push({ url, params: payload.params });
      if (url === ENDPOINT && failure) {
        throw new Error("Shortcuts unavailable");
      }
      let items;
      if (url === ENDPOINT) {
        const search = payload.params?.search?.toLowerCase();
        items = shortcuts.filter((item) => (
          !search || `${item.title} ${item.subtitle} ${item.cluster.name}`.toLowerCase().includes(search)
        ));
      } else {
        assert.equal(url, "/admin/taxonomy/clusters/");
        items = clusters;
      }
      const count = totalItems ?? items.length;
      return { data: { data: {
        items: structuredClone(items),
        pagination: {
          total_items: count,
          total_pages: Math.ceil(count / (payload.params?.page_size ?? 10)),
        },
      } } };
    }
    writes.push({ method, url, payload });
    if (mutationFailure) {
      throw mutationFailure;
    }
    if (method === "post") {
      assert.equal(url, ENDPOINT);
      shortcuts.push({
        id: 2,
        ...payload,
        cluster: clusters.find((item) => item.id === Number(payload.cluster_id)),
        business_count: 2,
      });
    } else if (method === "patch") {
      const id = Number(url.split("/").at(-2));
      Object.assign(shortcuts.find((item) => item.id === id), payload);
    } else if (method === "delete") {
      const id = Number(url.split("/").at(-2));
      shortcuts = shortcuts.filter((item) => item.id !== id);
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
  delete globalThis.__exploreConfigurationTransport;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function settle() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    if (client.isFetching() === 0) {
      return;
    }
  }
  assert.fail("Shortcut request did not settle");
}

async function render(element = React.createElement(Page), entry = "/admin-panel/explore-configuration") {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [entry], key: entry }, element)),
  ));
  await settle();
}

function button(label, scope = container) {
  return [...scope.querySelectorAll("button")].find((item) => (
    item.textContent.trim() === label || item.getAttribute("aria-label") === label
  ));
}

async function click(element) {
  assert.ok(element, "Expected an available control");
  await act(async () => element.click());
  await settle();
}

async function input(element, value) {
  const prototype = element.tagName === "TEXTAREA"
    ? dom.window.HTMLTextAreaElement.prototype
    : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await settle();
}

async function submit() {
  await act(async () => container.querySelector('[role="dialog"] form').dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  await settle();
}

test("the dedicated page uses one shortcut request, existing active counts, and supported controls", async () => {
  totalItems = 50;
  await render();
  assert.equal(document.title, "Explore Configuration | SugboGo Admin");
  assert.equal(container.querySelector("h1").textContent, "Explore Configuration");
  assert.match(container.textContent, /Manage discovery shortcuts and navigation entry points shown to explorers\./);
  assert.deepEqual([...container.querySelectorAll("th")].map((item) => item.textContent.trim()), [
    "No.", "Cluster", "Title / Subtitle", "Active Businesses", "Status", "Actions",
  ]);
  assert.equal(reads.length, 1);
  const cells = container.querySelectorAll("tbody tr:first-child td");
  assert.equal(cells[0].textContent.trim(), "1");
  assert.match(cells[2].textContent, /Find a mealPlaces to eat/);
  assert.equal(cells[3].textContent.trim(), "3");
  assert.equal(cells[3].classList.contains("text-center"), true);
  assert.equal(container.querySelector("colgroup col").style.width, "56px");
  assert.equal(cells[4].textContent.trim(), "Enabled");
  assert.equal(container.querySelector("table").parentElement.classList.contains("min-h-[520px]"), false);
  assert.equal(container.querySelector('[role="tablist"]'), null);
  await click(container.querySelector('[aria-label^="Sort items:"]'));
  assert.ok(button("Title / Subtitle: ascending"));
  assert.equal(button("Cluster: ascending"), undefined);
  assert.equal(button("Status: ascending"), undefined);
  assert.equal(button("No.: ascending"), undefined);
  await click(button("Active Businesses: descending"));
  assert.equal(reads.at(-1).params.ordering, "-business_count");
  await input(container.querySelector('input[placeholder="Search Discovery shortcuts..."]'), "Food");
  await click(container.querySelector('[aria-label^="Rows per page:"]'));
  await click(button("25"));
  await click(container.querySelector('[aria-label="Next page"]'));
  assert.deepEqual(reads.at(-1).params, {
    search: "Food", ordering: "-business_count", page: 2, page_size: 25,
  });
  assert.equal(container.querySelector("tbody tr:first-child td").textContent.trim(), "26");
  assert.match(container.querySelector('[aria-label="Table pagination"]').parentElement.textContent, /Showing 26–50 of 50 results/);
});

test("creation, text editing, activation, and deletion reuse the existing contract and dialogs", async () => {
  await render();
  await click(button("Add Discovery Shortcut"));
  let dialog = container.querySelector('[role="dialog"]');
  await click(button("Select a cluster", dialog));
  const options = document.body.querySelector('[role="listbox"]');
  assert.equal(button("Food", options), undefined);
  await click(button("Tourism", options));
  await input(dialog.querySelector('input[name="title"]'), "Find an adventure");
  await input(dialog.querySelector('textarea[name="subtitle"]'), "Places to explore");
  await submit();
  assert.equal(writes.at(-1).url, ENDPOINT);
  assert.equal(Number(writes.at(-1).payload.cluster_id), 2);
  assert.equal(reads.filter((item) => item.url === ENDPOINT).length, 2);
  assert.match(container.querySelector("tbody").textContent, /Find an adventure/);
  await click(button("Edit Find an adventure"));
  dialog = container.querySelector('[role="dialog"]');
  await input(dialog.querySelector('input[name="title"]'), "Take a break");
  await input(dialog.querySelector('textarea[name="subtitle"]'), "Discover somewhere new");
  await click(dialog.querySelector('input[name="is_active"]'));
  await submit();
  assert.equal(writes.at(-1).method, "patch");
  assert.equal(writes.at(-1).url, `${ENDPOINT}2/`);
  assert.equal(writes.at(-1).payload.is_active, false);
  assert.match(container.querySelector("tbody").textContent, /Take a breakDiscover somewhere new2Disabled/);
  assert.equal(reads.filter((item) => item.url === ENDPOINT).length, 3);
  await click(button("Delete Take a break"));
  await click(button("Delete", container.querySelector('[role="dialog"]')));
  assert.equal(writes.at(-1).method, "delete");
  assert.equal(writes.at(-1).url, `${ENDPOINT}2/`);
  assert.equal(reads.filter((item) => item.url === ENDPOINT).length, 4);
  assert.equal(reads.filter((item) => item.url === "/admin/taxonomy/clusters/").length, 1);
  assert.doesNotMatch(container.querySelector("tbody").textContent, /Take a break/);
});

test("validation and backend uniqueness errors retain the existing form and error message", async () => {
  await render();
  await click(button("Add Discovery Shortcut"));
  await submit();
  assert.equal(writes.length, 0);
  assert.match(container.textContent, /Title is required/);
  const dialog = container.querySelector('[role="dialog"]');
  await click(button("Select a cluster", dialog));
  await click(button("Tourism", document.body.querySelector('[role="listbox"]')));
  await input(dialog.querySelector('input[name="title"]'), "Discover tourism");
  await input(dialog.querySelector('textarea[name="subtitle"]'), "Find local experiences");
  mutationFailure = { response: { data: {
    message: "This cluster already has a Discovery Shortcut.",
    errors: { cluster_id: ["This cluster already has a Discovery Shortcut."] },
  } } };
  await submit();
  assert.match(container.textContent, /This cluster already has a Discovery Shortcut\./);
  assert.equal(dialog.querySelector('input[name="title"]').value, "Discover tourism");
  assert.equal(reads.filter((item) => item.url === ENDPOINT).length, 1);
  assert.equal(toast.error.mock.calls.at(-1).arguments[0], mutationFailure.response.data.message);
});

test("initial and refresh failures expose persistent Retry without discarding successful rows", async () => {
  failure = true;
  await render();
  assert.match(container.textContent, /Unable to load Discovery shortcuts/);
  failure = false;
  await click(button("Try Again"));
  assert.match(container.querySelector("tbody").textContent, /Find a meal/);
  failure = true;
  await act(async () => client.invalidateQueries({ queryKey }));
  await settle();
  assert.match(container.textContent, /Showing previously loaded data/);
  assert.match(container.querySelector("tbody").textContent, /Find a meal/);
  failure = false;
  await click(button("Retry"));
  assert.doesNotMatch(container.textContent, /Showing previously loaded data/);
  assert.equal(reads.length, 4);
});

function Destination() {
  const location = useLocation();
  return React.createElement("output", null, `${location.pathname}${location.search}${location.hash}`);
}

test("actual legacy routes resolve to the correct destination and tab without loops", async () => {
  const routes = React.createElement(Routes, null,
    React.createElement(Route, { path: "/admin-panel/cluster-category", element: React.createElement(LegacyPage) }),
    React.createElement(Route, { path: "/admin-panel/specialty-tags", element: React.createElement(LegacyTagsPage) }),
    React.createElement(Route, { path: "/admin-panel/business-taxonomy", element: React.createElement(Destination) }),
    React.createElement(Route, { path: "/admin-panel/explore-configuration", element: React.createElement(Page) }),
  );
  for (const [entry, expected] of [
    ["/admin-panel/cluster-category", "/admin-panel/business-taxonomy?tab=clusters"],
    ["/admin-panel/cluster-category?tab=categories", "/admin-panel/business-taxonomy?tab=categories"],
    ["/admin-panel/specialty-tags", "/admin-panel/business-taxonomy?tab=specialty-tags"],
    ["/admin-panel/cluster-category?tab=clusters&search=food#management", "/admin-panel/business-taxonomy?tab=clusters&search=food#management"],
  ]) {
    await render(routes, entry);
    assert.equal(container.querySelector("output").textContent, expected);
  }
  await render(routes, "/admin-panel/cluster-category?tab=discovery-shortcuts");
  assert.equal(container.querySelector("h1").textContent, "Explore Configuration");
  assert.match(container.querySelector("tbody").textContent, /Find a meal/);
  const app = readFileSync("src/App.jsx", "utf8");
  assert.match(app, /path="explore-configuration" element={<ExploreConfigurationPage/);
  assert.match(app, /path="business-taxonomy" element={<BusinessTaxonomyPage/);
});

test("the Management and Discovery sidebar sections and metadata expose their intended destinations", async () => {
  const management = navigation.find((section) => section.section === "Management").items;
  for (const [label, to] of [
    ["Business Management", "/admin-panel/businesses"],
    ["Merchant Applications", "/admin-panel/businesses/applications"],
    ["Business Taxonomy", "/admin-panel/business-taxonomy"],
  ]) {
    assert.equal(management.filter((item) => item.to === to && item.label === label).length, 1);
  }
  const discovery = navigation.find((section) => section.section === "Discovery").items;
  assert.equal(discovery.filter((item) => (
    item.to === "/admin-panel/explore-configuration" && item.label === "Explore Configuration"
  )).length, 1);
  assert.equal(management.some((item) => item.to === "/admin-panel/explore-configuration"), false);
  for (const path of ["cluster-category", "specialty-tags", "discovery-shortcuts"]) {
    assert.equal(management.some((item) => item.to === `/admin-panel/${path}`), false);
  }
  assert.equal(metadata["/admin-panel/explore-configuration"].title, "Explore Configuration");
  assert.equal(metadata["/admin-panel/business-taxonomy"].title, "Business Taxonomy Management");
  await render();
  assert.match(container.textContent, /SugboGo AdminDiscoveryExplore Configuration/);
});
