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
let deletes;
let deleteOperation;
let successes;
let reads;
let pointListing;
const unusedDeletion = () => ({
  can_delete: true,
  counts: {
    directions: 0, routes: 0, origin_directions: 0, destination_directions: 0,
    ordered_stops: 0, transfers: 0, alighting_transfers: 0, boarding_transfers: 0,
  },
  example_limit: 5,
  examples: { routes: [], directions: [], transfers: [] },
});
const referencedDeletion = () => ({
  can_delete: false,
  counts: {
    directions: 2, routes: 1, origin_directions: 1, destination_directions: 1,
    ordered_stops: 2, transfers: 1, alighting_transfers: 1, boarding_transfers: 1,
  },
  example_limit: 5,
  examples: {
    routes: [{ id: 1, code: "14D" }],
    directions: [{ id: 10, route_id: 1, route_code: "14D", origin: "Colon", destination: "Capitol" }],
    transfers: [{
      id: 20, status: "ignored", source_variant_id: 10, source_route_code: "14D",
      destination_variant_id: 11, destination_route_code: "08G",
    }],
  },
});
const base = "/src/features/admin-panel/";
const response = (data) => ({ data: { data } });
const page = (items) => ({ items, pagination: {
  page: 1, page_size: 10, total_items: items.length,
  total_pages: Math.ceil(items.length / 10), has_next: false, has_previous: false,
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
          return "export default { get: (...args) => globalThis.__selectionGet(...args), patch: (...args) => globalThis.__selectionPatch(...args), delete: (...args) => globalThis.__selectionDelete(...args), post: (...args) => globalThis.__selectionPost(...args) };";
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
  point = { id: 1, name: "Original stop", latitude: 10.3, longitude: 123.9, deletion: unusedDeletion() };
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
  deletes = [];
  reads = [];
  successes = [];
  pointListing = null;
  deleteOperation = async () => {};
  globalThis.__selectionGet = async (url, options = {}) => {
    reads.push({ url, options });
    if (gates[url]) return gates[url];
    if (/\/(transit-points|transfers)\/\d+\/$/.test(url) && detailFailure) throw detailFailure;
    if (url.endsWith(`transit-points/${point.id}/`)) return response(structuredClone(point));
    if (url.endsWith("transit-points/1/")) return response(structuredClone(point));
    if (url.endsWith("transit-points/2/")) return response({ ...point, id: 2, name: "Second stop" });
    if (url.endsWith("transit-points/")) {
      if (pointListing) return response(pointListing(options.params));
      const listedPoint = structuredClone(point);
      delete listedPoint.deletion;
      return response(page(excluded ? [] : [listedPoint]));
    }
    if (url.endsWith("transfers/3/")) return response(structuredClone(transfer));
    if (url.endsWith("transfers/")) return response(page(excluded ? [] : [structuredClone(transfer)]));
    if (url.endsWith("route-variants/")) return response(page(variants));
    const route = { id: 1, code: "R1", variants: [variants[0]], variant_count: 1 };
    if (url.endsWith("routes/")) return response(page([route]));
    if (url.endsWith("routes/1/")) return response(route);
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
  globalThis.__selectionDelete = async (url) => {
    deletes.push(url);
    await deleteOperation();
    excluded = true;
    return response(null);
  };
  globalThis.__selectionPost = async (url, data) => {
    assert.equal(url, "/admin/transit/transit-points/");
    point = { id: 4, ...data, deletion: unusedDeletion() };
    return response(point);
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container, { onCaughtError() {} });
  toast.error = () => {};
  toast.success = (message) => successes.push(message);
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
  for (const key of ["window", "document", "HTMLElement", "Element", "localStorage", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT", "__selectionGet", "__selectionPatch", "__selectionDelete", "__selectionPost", "__selectionMap"]) delete globalThis[key];
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
async function open(context = "transit-points", query = "") {
  await act(async () => root.render(React.createElement(QueryClientProvider, { client },
    React.createElement(MemoryRouter, { initialEntries: [`/admin-panel/transit-network?tab=${context}${query}`] }, React.createElement(Workspace)))));
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
  assert.equal(button("Delete Point"), undefined);
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
  assert.equal(button("Delete Point"), undefined);
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

const dialog = () => container.querySelector('[role="dialog"]');
const dialogButton = (label) => [...dialog().querySelectorAll("button")].find(
  (node) => node.textContent.trim() === label || node.getAttribute("aria-label") === label,
);
async function openDelete() {
  await click(button("Delete Point"));
  await until(() => dialog() && !dialog().textContent.includes("Checking current"));
}

test("unused point deletion cancels safely and fetches fresh persisted eligibility on every open", async () => {
  await open();
  assert.equal(button("Delete Point").disabled, false);
  const before = reads.filter((read) => read.url.endsWith("transit-points/1/")).length;
  await openDelete();
  assert.match(dialog().textContent, /Original stop/);
  assert.match(dialog().textContent, /permanent and cannot be undone/);
  assert.equal(dialogButton("Delete Point").disabled, false);
  await click(dialogButton("Cancel"));
  assert.equal(dialog(), null);
  assert.deepEqual(deletes, []);
  assert.equal(globalThis.__selectionMap.selectedPoint.id, 1);
  point = { ...point, name: "Persisted stop", deletion: referencedDeletion() };
  await openDelete();
  assert.match(dialog().textContent, /Persisted stop/);
  assert.equal(dialogButton("Delete Point").disabled, true);
  assert.ok(reads.filter((read) => read.url.endsWith("transit-points/1/")).length >= before + 2);
});

test("referenced point shows backend counts and examples and cannot submit deletion", async () => {
  point.deletion = referencedDeletion();
  await open();
  await openDelete();
  assert.match(dialog().textContent, /2 directions across 1 routes/);
  assert.match(dialog().textContent, /1 origins, 1 destinations, 2 ordered stops/);
  assert.match(dialog().textContent, /1 transfers \(1 alighting, 1 boarding\)/);
  assert.match(dialog().textContent, /14D · Direction #10: Colon → Capitol/);
  assert.match(dialog().textContent, /Transfer #20 \(ignored\)/);
  assert.match(dialog().textContent, /Reassign transfer connections first/);
  assert.equal(dialogButton("Delete Point").disabled, true);
  await click(dialogButton("Delete Point"));
  assert.deepEqual(deletes, []);
});

test("eligibility loading and request failure fail closed and Retry fetches current details", async () => {
  await open();
  let reject;
  const url = "/admin/transit/transit-points/1/";
  gates[url] = new Promise((_, fail) => { reject = fail; });
  await click(button("Delete Point"));
  assert.match(dialog().textContent, /Checking current deletion eligibility/);
  assert.equal(dialogButton("Delete Point").disabled, true);
  await act(async () => reject({ response: { status: 503, data: { message: "Temporarily unavailable" } } }));
  await until(() => dialog().textContent.includes("Unable to verify"));
  assert.match(dialog().textContent, /Temporarily unavailable/);
  assert.equal(dialogButton("Delete Point").disabled, true);
  delete gates[url];
  await click(dialogButton("Retry"));
  await until(() => !dialogButton("Delete Point").disabled);
  assert.deepEqual(deletes, []);
});

test("pending deletion prevents duplicate writes and every dismissal path until API success", async () => {
  await open();
  await openDelete();
  let release;
  deleteOperation = () => new Promise((done) => { release = done; });
  const confirm = dialogButton("Delete Point");
  await act(async () => { confirm.click(); confirm.click(); confirm.click(); });
  assert.deepEqual(deletes, ["/admin/transit/transit-points/1/"]);
  assert.deepEqual(successes, []);
  assert.equal(dialogButton("Cancel").disabled, true);
  assert.equal(dialogButton("Close modal").disabled, true);
  await act(async () => {
    dialog().dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    dialog().parentElement.click();
    dialogButton("Close modal").click();
    dialogButton("Cancel").click();
  });
  assert.ok(dialog());
  assert.equal(globalThis.__selectionMap.selectedPoint.id, 1);
  await act(async () => release());
  await until(() => !dialog());
  assert.deepEqual(successes, ["Transit Point deleted successfully."]);
  assert.match(inspector().textContent, /Select a Transit Point/);
});

test("failed deletion retains selection and server dependency rejection overrides earlier eligibility", async () => {
  await open();
  await openDelete();
  deleteOperation = async () => { throw { response: { status: 503, data: { message: "Delete unavailable" } } }; };
  await click(dialogButton("Delete Point"));
  await until(() => dialog().textContent.includes("Delete unavailable"));
  assert.equal(globalThis.__selectionMap.selectedPoint.id, 1);
  assert.match(inspector().textContent, /Original stop/);
  assert.equal(dialogButton("Cancel").disabled, false);
  deleteOperation = async () => { throw { response: { status: 400, data: {
    message: "References were added. Reassign them before deleting.",
    code: "VALIDATION_ERROR", errors: { deletion: referencedDeletion() },
  } } }; };
  await click(dialogButton("Delete Point"));
  await until(() => dialog().textContent.includes("References were added"));
  assert.equal(dialogButton("Delete Point").disabled, true);
  assert.match(dialog().textContent, /Transfer #20/);
  assert.equal(globalThis.__selectionMap.selectedPoint.id, 1);
  assert.ok(client.getQueryData(keys.transitPointDetail(1)));
  assert.deepEqual(successes, []);
  await click(dialogButton("Cancel"));
  assert.equal(globalThis.__selectionMap.selectedPoint.id, 1);
});

test("successful deletion prunes point caches and markers without restoring late list responses", async () => {
  await open();
  await openDelete();
  const other = { ...point, id: 2, name: "Another stop" };
  client.setQueryData(keys.transitPointReferences(), [point, other]);
  const otherList = keys.transitPointList({ page: 1, page_size: 10, search: "stop" });
  client.setQueryData(otherList, page([point, other]));
  client.setQueryData(keys.routeList({}), page([]));
  client.setQueryData(keys.transferList({}), page([]));
  let release;
  gates["/admin/transit/transit-points/"] = new Promise((done) => { release = done; });
  await act(async () => { void client.invalidateQueries({ queryKey: keys.transitPointList({ page: 1, page_size: 10 }) }); });
  await click(dialogButton("Delete Point"));
  await until(() => !dialog());
  delete gates["/admin/transit/transit-points/"];
  await act(async () => release(response(page([point]))));
  assert.equal(globalThis.__selectionMap.selectedPoint, null);
  assert.equal(globalThis.__selectionMap.focusRequest, null);
  assert.deepEqual(globalThis.__selectionMap.transitPoints, []);
  assert.equal(client.getQueryData(keys.transitPointDetail(1)), undefined);
  assert.deepEqual(client.getQueryData(keys.transitPointReferences()).map((item) => item.id), [2]);
  assert.deepEqual(client.getQueryData(otherList).items.map((item) => item.id), [2]);
  assert.equal(client.getQueryState(keys.routeList({})).isInvalidated, true);
  assert.equal(client.getQueryState(keys.transferList({})).isInvalidated, true);
});

test("deleting the final record on a later page moves to the remaining valid page", async () => {
  pointListing = (params) => ({
    items: params.page === 2 ? (excluded ? [] : [point]) : Array.from(
      { length: 10 },
      (_, index) => ({ ...point, id: index + 2, name: `Remaining ${index}` }),
    ),
    pagination: {
      page: params.page, page_size: 10, total_items: excluded ? 10 : 11,
      total_pages: excluded ? 1 : 2, has_next: params.page === 1 && !excluded,
    },
  });
  await open("transit-points", "&page=2");
  await openDelete();
  await click(dialogButton("Delete Point"));
  await until(() => !dialog() && container.textContent.includes("Remaining 0"));
  assert.equal(globalThis.__selectionMap.selectedPoint, null);
  assert.equal(globalThis.__selectionMap.transitPoints.length, 10);
  assert.equal(reads.filter((read) => read.url.endsWith("transit-points/")).at(-1).options.params.page, 1);
});

test("deletion removes a recently created route point from fallback markers and selectors", async () => {
  await open("routes");
  await click(button("Add Direction"));
  assert.equal(button("Delete Point"), undefined);
  const origin = inspector().querySelector('[role="combobox"]');
  await act(async () => origin.focus());
  await click(button("Create new stop"));
  assert.equal(button("Delete Point"), undefined);
  await input(inspector().querySelector('input[name="name"]'), "Created in a direction");
  await act(async () => globalThis.__selectionMap.onPointPositionChange({ lat: 10.3, lng: 123.9 }));
  await act(async () => inspector().querySelector("form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  await until(() => button("Save Direction"));
  assert.ok(globalThis.__selectionMap.transitPoints.some((item) => item.id === 4));
  await click(button("Cancel"));
  await click(button("Transit Points"));
  await until(() => globalThis.__selectionMap.context === "transit-points");
  await act(async () => globalThis.__selectionMap.onTransitPointSelect(point));
  await until(() => button("Delete Point") && !button("Delete Point").disabled);
  await openDelete();
  await click(dialogButton("Delete Point"));
  await until(() => !dialog());
  await click(button("Routes"));
  await until(() => globalThis.__selectionMap.context === "routes");
  assert.equal(globalThis.__selectionMap.transitPoints.some((item) => item.id === 4), false);
  await click([...container.querySelectorAll("button")].find((node) => node.textContent.includes("R1")));
  await click(button("Add Direction"));
  await until(() => inspector().querySelector('[role="combobox"]'));
  await act(async () => inspector().querySelector('[role="combobox"]').focus());
  assert.doesNotMatch(inspector().textContent, /Created in a direction/);
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
