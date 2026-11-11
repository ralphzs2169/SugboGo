import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createServer } from "vite";
import toast from "react-hot-toast";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Workspace;
let Layout;
let DataErrorState;
let keys;
let point;
let transfer;
let variants;
let excluded;
let detailFailure;
let patches;
let gates;
const base = "/src/features/admin-panel/";
const response = (data) => ({ data: { data } });
const page = (items) => ({ items, pagination: {
  page: 1, page_size: 10, total_items: items.length,
  total_pages: 1, has_next: false, has_previous: false,
} });
before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
    localStorage: dom.window.localStorage,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  window.scrollTo = () => {};
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: "focused-transit-and-boundary-fixtures", enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__selectionGet(...args), patch: (...args) => globalThis.__selectionPatch(...args) };";
        }
        if (path.endsWith("/TransitNetworkMapCanvas.jsx")) {
          return "export default function Map(props) { globalThis.__selectionMap = props; return null; }";
        }
        if (path.endsWith("/Tooltip.jsx") || path.endsWith("/GoogleMapsProvider.jsx")) return "export default ({children}) => children";
        if (path.endsWith("/sidebar/Sidebar.jsx")) return 'import React from "react"; import {Link} from "react-router-dom"; export default () => React.createElement(Link, {to:"/admin-panel/dashboard"}, "Sidebar dashboard");';
        if (path.endsWith("/NavigationHeader.jsx")) return 'import React from "react"; export default () => React.createElement("header", null, "Admin header");';
      },
    }],
  });
  ({ default: Workspace } = await server.ssrLoadModule(base + "transit-network/components/workspace/TransitNetworkWorkspace.jsx"));
  ({ transitQueryKeys: keys } = await server.ssrLoadModule(base + "transit-network/hooks/transitQueryKeys.js"));
  ({ default: Layout } = await server.ssrLoadModule(base + "pages/AdminPanelLayout.jsx"));
  ({ default: DataErrorState } = await server.ssrLoadModule("/src/shared/components/errors/DataErrorState.jsx"));
});
beforeEach(async () => {
  point = { id: 1, name: "Original stop", latitude: 10.3, longitude: 123.9 };
  variants = [1, 2].map((id) => ({
    id, route_code: `R${id}`, route_id: id,
    origin: point, destination: { ...point, id: 2 },
    transit_points: [{ transit_point: point }, { transit_point: { ...point, id: 2 } }],
    geometry: [],
  }));
  transfer = { id: 3, status: "pending", source_variant: variants[0], destination_variant: variants[1],
    alighting_transit_point: point, boarding_transit_point: { ...point, id: 2 },
    connection_distance_meters: 25, route_separation_meters: 40 };
  excluded = false;
  detailFailure = null;
  patches = [];
  gates = {};
  globalThis.__selectionGet = async (url) => {
    if (gates[url]) return gates[url];
    if (/\/(transit-points|transfers)\/\d+\/$/.test(url) && detailFailure) throw detailFailure;
    if (url.endsWith("transit-points/1/")) return response(structuredClone(point));
    if (url.endsWith("transit-points/2/")) return response({ ...point, id: 2, name: "Second stop" });
    if (url.endsWith("transit-points/")) return response(page(excluded ? [] : [structuredClone(point)]));
    if (url.endsWith("transfers/3/")) return response(structuredClone(transfer));
    if (url.endsWith("transfers/")) return response(page(excluded ? [] : [structuredClone(transfer)]));
    if (url.endsWith("route-variants/")) return response(page(variants));
    const variant = variants.find((item) => url.endsWith(`route-variants/${item.id}/`));
    if (variant) return response(variant);
    throw new Error("Unexpected request: " + url);
  };
  globalThis.__selectionPatch = async (url, data) => {
    patches.push({ url, data });
    if (url.includes("transit-points")) point = { ...point, ...data };
    else transfer = { ...transfer, ...data };
    return response(url.includes("transit-points") ? point : transfer);
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container, { onCaughtError() {} });
  toast.error = () => {};
  toast.success = () => {};
});
const originalError = toast.error;
const originalSuccess = toast.success;
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  toast.error = originalError;
  toast.success = originalSuccess;
});
after(async () => {
  await server.close();
  dom.window.close();
  for (const key of ["window", "document", "HTMLElement", "Element", "localStorage", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT", "__selectionGet", "__selectionPatch", "__selectionMap"]) delete globalThis[key];
});
async function until(check) {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await act(async () => new Promise((done) => setTimeout(done, 15)));
  }
  assert.fail("Expected UI state was not reached");
}
const button = (text) => [...container.querySelectorAll("button")].find((node) => node.textContent.trim() === text);
const inspector = () => container.querySelector("#transit-network-inspector");
async function click(node) { await act(async () => node.click()); }
async function input(node, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(node, value);
    node.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function open(context = "transit-points") {
  await act(async () => root.render(React.createElement(QueryClientProvider, { client },
    React.createElement(MemoryRouter, { initialEntries: [`/admin-panel/transit-network?tab=${context}`] }, React.createElement(Workspace)))));
  await until(() => context === "transit-points" ? container.textContent.includes("Original stop") : container.textContent.includes("R1"));
  if (context === "transit-points") {
    await act(async () => globalThis.__selectionMap.onTransitPointSelect(point));
  } else {
    await click([...container.querySelectorAll("button")].find((node) => node.textContent.includes("R1")));
  }
  await until(() => button("Edit") && !button("Edit").disabled);
}
async function refresh(key) {
  await act(async () => client.invalidateQueries({ queryKey: key }));
  await act(async () => new Promise((done) => setTimeout(done, 25)));
}

test("point list refetch reconciles the inspector, map and off-page selection", async () => {
  await open();
  point = { ...point, name: "Refreshed stop", latitude: 10.4 };
  await refresh(keys.transitPoints());
  assert.match(inspector().textContent, /Refreshed stop/);
  assert.match(inspector().textContent, /10\.400000/);
  assert.equal(globalThis.__selectionMap.selectedPoint.name, "Refreshed stop");
  assert.equal(globalThis.__selectionMap.transitPoints[0].name, "Refreshed stop");
  excluded = true;
  await refresh(keys.transitPointList({ page: 1, page_size: 10 }));
  await refresh(keys.transitPoints());
  assert.match(inspector().textContent, /Refreshed stop/);
  assert.equal(button("Edit").disabled, false);
});

test("transfer refetch changes status and removes obsolete decision actions", async () => {
  await open("transfers");
  assert.ok(button("Confirm"));
  transfer = { ...transfer, status: "confirmed" };
  await refresh(keys.transfers());
  assert.match(inspector().textContent, /confirmed/);
  assert.equal(button("Confirm"), undefined);
  assert.equal(globalThis.__selectionMap.transfer.status, "confirmed");
});

test("temporary errors retain selections while a detail 404 removes actionable records", async () => {
  await open();
  detailFailure = { response: { status: 503 } };
  await refresh(keys.transitPointDetail(1));
  assert.match(inspector().textContent, /Original stop/);
  assert.equal(button("Edit").disabled, true);
  detailFailure = { response: { status: 404 } };
  await refresh(keys.transitPointDetail(1));
  assert.equal(button("Edit"), undefined);
  assert.equal(globalThis.__selectionMap.selectedPoint, null);
  assert.deepEqual(globalThis.__selectionMap.transitPoints, []);
  detailFailure = null;
  await click(button("Try Again"));
  await until(() => button("Edit") && !button("Edit").disabled);
});

test("dirty point values survive refresh and removal, preserve guard, and cancel to current data", async () => {
  await open();
  await click(button("Edit"));
  const field = container.querySelector('input[name="name"]');
  await input(field, "My draft");
  point = { ...point, name: "Other administrator", latitude: 10.5 };
  await refresh(keys.transitPoints());
  assert.equal(field.value, "My draft");
  assert.equal(container.querySelector('input[name="latitude"]').value, "10.300000");
  assert.match(container.textContent, /Server data changed/);
  // The original baseline still considers this an unsaved draft.
  const navigation = new window.CustomEvent("admin-navigation-request", { cancelable: true, detail: { destination: "/admin-panel/dashboard" } });
  await act(async () => window.dispatchEvent(navigation));
  assert.equal(navigation.defaultPrevented, true);
  await click([...document.querySelectorAll("button")].find((node) => node.textContent.includes("Keep Editing")));
  detailFailure = { response: { status: 404 } };
  await refresh(keys.transitPointDetail(1));
  assert.equal(field.value, "My draft");
  assert.equal(button("Save Changes").disabled, true);
  detailFailure = null;
  await click(button("Try Again"));
  await until(() => !button("Save Changes").disabled);
  await click(button("Cancel"));
  assert.match(inspector().textContent, /Other administrator/);
});

test("local point save updates browsing selection and map", async () => {
  await open();
  await click(button("Edit"));
  await input(container.querySelector('input[name="name"]'), "Saved stop");
  await act(async () => container.querySelector("#transit-network-inspector form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
  await until(() => button("Edit"));
  assert.match(inspector().textContent, /Saved stop/);
  assert.equal(globalThis.__selectionMap.selectedPoint.name, "Saved stop");
  assert.equal(patches.length, 1);
});

test("transfer draft and dirty baseline survive refreshed props and unavailability", async () => {
  await open("transfers");
  await click(button("Edit"));
  const select = inspector().querySelector('select[name="boarding_transit_point_id"]');
  await act(async () => {
    select.value = "1";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await until(() => !button("Save Connection").disabled);
  transfer = { ...transfer, boarding_transit_point: point, status: "confirmed" };
  await refresh(keys.transfers());
  assert.equal(select.value, "1");
  assert.equal(button("Save Connection").disabled, false);
  detailFailure = { response: { status: 404 } };
  await refresh(keys.transferDetail(3));
  assert.equal(select.value, "1");
  assert.equal(button("Save Connection").disabled, true);
});

test("late detail response cannot restore a previous point selection", async () => {
  await open();
  let release;
  gates['/admin/transit/transit-points/1/'] = new Promise((done) => { release = done; });
  await act(async () => { void client.invalidateQueries({ queryKey: keys.transitPointDetail(1) }); });
  await act(async () => globalThis.__selectionMap.onTransitPointSelect({ ...point, id: 2, name: "Second stop" }));
  await until(() => inspector().textContent.includes("Second stop"));
  await act(async () => release(response({ ...point, name: "Late obsolete stop" })));
  assert.match(inspector().textContent, /Second stop/);
  assert.doesNotMatch(inspector().textContent, /Late obsolete/);
});

test("route render failure preserves shell navigation, retries locally and resets on pathname change", async () => {
  let shouldThrow = true;
  function BrokenPage() { if (shouldThrow) throw new Error("Render failure"); return React.createElement("p", null, "Recovered page"); }
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ["/admin-panel/broken"] },
    React.createElement(Routes, null,
      React.createElement(Route, { path: "/admin-panel", element: React.createElement(Layout) },
        React.createElement(Route, { path: "broken", element: React.createElement(BrokenPage) }),
        React.createElement(Route, { path: "dashboard", element: React.createElement("p", null, "Working dashboard") }),
      ),
    ),
  )));
  assert.match(container.textContent, /This page could not be displayed/);
  assert.match(container.textContent, /Admin header/);
  assert.ok([...container.querySelectorAll("a")].find((node) => node.textContent === "Sidebar dashboard"));
  await click(button("Retry page"));
  assert.match(container.textContent, /This page could not be displayed/);
  shouldThrow = false;
  await click(button("Retry page"));
  assert.match(container.textContent, /Recovered page/);
  shouldThrow = true;
  // Re-enter a failed state then use the boundary's own Dashboard recovery link.
  await act(async () => root.render(null));
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: ["/admin-panel/broken"] },
    React.createElement(Routes, null, React.createElement(Route, { path: "/admin-panel", element: React.createElement(Layout) },
      React.createElement(Route, { path: "broken", element: React.createElement(BrokenPage) }),
      React.createElement(Route, { path: "dashboard", element: React.createElement("p", null, "Working dashboard") }),
    )),
  )));
  await click([...container.querySelectorAll("a")].find((node) => node.textContent === "Back to Admin Dashboard"));
  assert.match(container.textContent, /Working dashboard/);
  assert.doesNotMatch(container.textContent, /This page could not be displayed/);
});


test("ordinary query failures retain section Retry inside the route boundary", async () => {
  let fail = true;
  let reads = 0;
  function ApiPage() {
    const query = useQuery({
      queryKey: ["focused-section"],
      queryFn: async () => {
        reads += 1;
        if (fail) throw new Error("API unavailable");
        return "Section recovered";
      },
    });
    if (query.error) return React.createElement(DataErrorState, {
      title: "Section unavailable", onRetry: query.refetch,
    });
    return React.createElement("p", null, query.data ?? "Loading section");
  }
  await act(async () => root.render(React.createElement(QueryClientProvider, { client },
    React.createElement(MemoryRouter, { initialEntries: ["/admin-panel/section"] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/admin-panel", element: React.createElement(Layout) },
          React.createElement(Route, { path: "section", element: React.createElement(ApiPage) }),
        ),
      ),
    ),
  )));
  await until(() => container.textContent.includes("Section unavailable"));
  assert.match(container.textContent, /Admin header/);
  assert.doesNotMatch(container.textContent, /This page could not be displayed/);
  fail = false;
  await click(button("Try Again"));
  await until(() => container.textContent.includes("Section recovered"));
  assert.equal(reads, 2);
});
