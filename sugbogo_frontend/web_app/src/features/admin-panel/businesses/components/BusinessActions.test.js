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
let dom;
let server;
let root;
let container;
let client;
let Dialog;
let Actions;
let useBusinesses;
let useBusinessMap;
let useBusinessDetail;
let useCombined;
let businessStatusKeys;
let refreshResources;
let reads;
let posts;
let status;
let get;
let post;
let closed;
let success;
const originalToast = { error: toast.error, success: toast.success, dismiss: toast.dismiss };
const business = { id: 41, name: "Test Bistro", status: "active", application_id: 88 };
const respond = (data) => ({ data: { data } });
const fail = (code, message = "Request failed", statusCode = 500) => Object.assign(new Error(message), {
  response: { status: statusCode, data: { code, message } },
});

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom", optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "business-actions-transport", enforce: "pre",
      resolveId(source) {
        if (source === "react-tooltip") return "\0actions-tooltip";
      },
      load(id) {
        if (id === "\0actions-tooltip") return "export const Tooltip = () => null;";
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__actionsGet(...args),
            post: (...args) => globalThis.__actionsPost(...args),
          };`;
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Dialog } = await server.ssrLoadModule(`${base}businesses/components/BusinessStatusDialog.jsx`));
  ({ default: Actions } = await server.ssrLoadModule(`${base}businesses/components/BusinessRowActions.jsx`));
  ({ default: useBusinesses } = await server.ssrLoadModule(`${base}businesses/hooks/useBusinesses.js`));
  ({ default: useBusinessMap } = await server.ssrLoadModule(`${base}businesses/hooks/useBusinessMap.js`));
  ({ default: useBusinessDetail } = await server.ssrLoadModule(`${base}businesses/hooks/useBusinessDetail.js`));
  ({ default: useCombined } = await server.ssrLoadModule(`${base}business-update-requests/hooks/useCombinedUpdateRequests.js`));
  ({ businessStatusKeys } = await server.ssrLoadModule(`${base}businesses/queries/businessStatusQuery.js`));
  ({ refreshBusinessStatusResources: refreshResources } = await server.ssrLoadModule(`${base}businesses/queries/businessStatusQueryEffects.js`));
});

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  reads = [];
  posts = [];
  closed = 0;
  success = [];
  status = { business_id: 41, status: "active", transition_id: 0, owner_account_status: "active", suspension_reason: null };
  get = async () => respond(status);
  post = async () => respond({ ...status, status: "suspended", transition_id: 10 });
  globalThis.__actionsGet = (url, options) => { reads.push({ url, ...options }); return get(url, options); };
  globalThis.__actionsPost = (url, payload) => { posts.push({ url, payload }); return post(url, payload); };
  toast.error = () => {};
  toast.dismiss = () => {};
  toast.success = (message) => success.push(message);
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
  Object.assign(toast, originalToast);
  await server.close();
  dom.window.close();
  for (const key of ["window", "document", "HTMLElement", "Element", "Node", "CustomEvent", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT", "__actionsGet", "__actionsPost"]) delete globalThis[key];
});

function Location() {
  const location = useLocation();
  return React.createElement("output", null, location.pathname + location.search);
}

async function render(children) {
  await act(async () => root.render(React.createElement(QueryClientProvider, { client },
    React.createElement(MemoryRouter, null, children))));
}

async function until(predicate) {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Business actions did not reach the expected state");
}

const buttons = () => [...document.querySelectorAll("button")];
const button = (label) => buttons().find((item) => item.textContent === label);
const click = async (element) => act(async () => element.click());
async function key(element, name, options = {}) {
  await act(async () => element.dispatchEvent(new window.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...options })));
}
async function reason(value) {
  const input = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => container.querySelector("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
}
async function showDialog(operation = "suspend") {
  await render(React.createElement(Dialog, { business, operation, onClose: () => { closed += 1; } }));
  await until(() => container.textContent.includes("Current business status:"));
}

test("menus retain the eye action, omit only unlinked applications, and navigate exact destinations", async () => {
  let viewed;
  let managed;
  await render(React.createElement(React.Fragment, null,
    React.createElement(Actions, { business, onViewBusiness: (value) => { viewed = value; }, onManageStatus: (...value) => { managed = value; } }),
    React.createElement(Location)));
  await click(document.querySelector('[aria-label="View business"]'));
  assert.equal(viewed, business);
  const trigger = document.querySelector('[aria-label="More actions"]');
  await click(trigger);
  assert.equal(document.querySelectorAll('[role="menu"]').length, 1);
  assert.ok(!container.contains(document.querySelector('[role="menu"]')), "overlay is portalled outside table");
  assert.deepEqual([...document.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent), ["View Application", "View Update Requests", "Suspend Business"]);
  await click(button("View Application"));
  assert.match(container.querySelector("output").textContent, /business\/application\/88$/);
  await click(trigger);
  await click(button("View Update Requests"));
  assert.equal(container.querySelector("output").textContent, "/admin-panel/businesses/update-requests?business_id=41&type=all&status=all");
  await click(trigger);
  await click(button("Suspend Business"));
  assert.deepEqual(managed, [business, "suspend"]);
  assert.equal(document.querySelector('[role="menu"]'), null);
  await render(React.createElement(Actions, { business: { ...business, status: "suspended", application_id: null }, onManageStatus: (...value) => { managed = value; } }));
  await click(document.querySelector('[aria-label="More actions"]'));
  assert.equal(button("View Application"), undefined);
  assert.equal(button("Suspend Business"), undefined);
  assert.ok(button("View Update Requests"));
  await click(button("Reactivate Business"));
  assert.equal(managed[1], "reactivate");
  assert.equal(reads.length, 0, "rows do not fetch authoritative status preemptively");
});

test("one menu opens at a time with arrow, Home, End, Escape and outside dismissal", async () => {
  let rowClicks = 0;
  await render(React.createElement("div", { onClick: () => { rowClicks += 1; } },
    [business, { ...business, id: 42 }, { ...business, id: 43 }].map((item) => React.createElement(Actions, { key: item.id, business: item }))));
  const triggers = [...document.querySelectorAll('[aria-label="More actions"]')];
  for (const trigger of triggers) {
    await click(trigger);
    assert.equal(document.querySelectorAll('[role="menu"]').length, 1);
    assert.equal(document.activeElement.textContent, "View Application");
  }
  await key(document.activeElement, "ArrowDown");
  assert.equal(document.activeElement.textContent, "View Update Requests");
  await key(document.activeElement, "End");
  assert.equal(document.activeElement.textContent, "Suspend Business");
  await key(document.activeElement, "ArrowDown");
  assert.equal(document.activeElement.textContent, "View Application");
  await key(document.activeElement, "Escape");
  assert.equal(document.activeElement, triggers[2]);
  assert.equal(document.querySelector('[role="menu"]'), null);
  await key(triggers[0], "ArrowUp");
  assert.equal(document.activeElement.textContent, "Suspend Business");
  await act(async () => document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true })));
  assert.equal(document.querySelector('[role="menu"]'), null);
  assert.equal(rowClicks, 0);
});

test("portal menu flips above the last row and clamps to viewport edges during scrolling", async () => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 224 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 142 });
  try {
    await render(React.createElement(Actions, { business }));
    const trigger = document.querySelector('[aria-label="More actions"]');
    trigger.getBoundingClientRect = () => ({ top: 740, bottom: 776, right: 1040 });
    await click(trigger);
    const overlay = document.querySelector('[role="menu"]').parentElement;
    assert.equal(overlay.style.top, "590px");
    assert.equal(overlay.style.left, "792px");
    assert.equal(overlay.parentElement, document.body);
    assert.ok(overlay.classList.contains("fixed"));
    trigger.getBoundingClientRect = () => ({ top: 20, bottom: 56, right: 100 });
    await act(async () => window.dispatchEvent(new window.Event("scroll")));
    assert.equal(overlay.style.top, "64px");
    assert.equal(overlay.style.left, "8px");
  } finally {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", width);
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", height);
  }
});

test("suspension requires a trimmed bounded explanation, sends zero unchanged and prevents duplicates", async () => {
  await showDialog();
  assert.match(container.textContent, /Test Bistro/);
  await reason("   ");
  await submit();
  assert.equal(posts.length, 0);
  assert.match(container.textContent, /Provide a reason/);
  await reason("x".repeat(1001));
  await submit();
  assert.equal(posts.length, 0);
  assert.match(container.textContent, /1,000 characters/);
  await reason("  Required listing correction.  ");
  let finish;
  post = () => new Promise((done) => { finish = done; });
  await submit();
  await submit();
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], { url: "/admin/businesses/41/suspend/", payload: { reason: "Required listing correction.", expected_transition_id: 0 } });
  await until(() => button("Cancel").disabled);
  await act(async () => finish(respond({ ...status, status: "suspended", transition_id: 10 })));
  await until(() => closed === 1);
  assert.deepEqual(success, ["Business suspended."]);
});

test("reactivation uses authoritative token and warns about suspended owner without blocking", async () => {
  status = { ...status, status: "suspended", transition_id: 27, owner_account_status: "suspended" };
  await showDialog("reactivate");
  assert.match(container.textContent, /will not restore their account access/);
  assert.equal(container.querySelector("textarea"), null);
  await submit();
  await until(() => closed === 1);
  assert.deepEqual(posts[0], { url: "/admin/businesses/41/reactivate/", payload: { expected_transition_id: 27 } });
  assert.deepEqual(success, ["Business reactivated."]);
  assert.equal(status.owner_account_status, "suspended");
});

test("required status failures preserve the dialog, disable confirmation and expose Retry", async () => {
  get = async () => { throw fail("UNAVAILABLE"); };
  await render(React.createElement(Dialog, { business, operation: "suspend", onClose: () => { closed += 1; } }));
  await until(() => button("Retry"));
  assert.equal(button("Suspend Business").disabled, true);
  assert.equal(posts.length, 0);
  get = async () => respond(status);
  await click(button("Retry"));
  await until(() => !button("Suspend Business").disabled);
  assert.equal(closed, 0);
});

test("cached status cannot authorize before a fresh status request and incompatible state blocks action", async () => {
  client.setQueryData(businessStatusKeys.status(41), status);
  let finish;
  get = () => new Promise((done) => { finish = done; });
  await render(React.createElement(Dialog, { business, operation: "suspend", onClose: () => {} }));
  assert.equal(button("Suspend Business").disabled, true);
  await act(async () => finish(respond({ ...status, status: "suspended", transition_id: 2 })));
  await until(() => container.textContent.includes("no longer eligible"));
  assert.equal(button("Suspend Business").disabled, true);
  assert.equal(posts.length, 0);
});

test("failed mutations stay open without success, and conflict after a full cycle needs explicit reconfirmation", async () => {
  await showDialog();
  await reason("Listing review");
  post = async () => { throw fail("ERROR", "Please try later."); };
  await submit();
  await until(() => container.textContent.includes("Please try later."));
  assert.equal(closed, 0);
  assert.deepEqual(success, []);
  status = { ...status, transition_id: 72 };
  post = async () => { throw fail("BUSINESS_STATUS_CONFLICT", "Status changed.", 409); };
  await submit();
  await until(() => button("I have reviewed the updated status"));
  assert.match(container.textContent, /previous request was not applied/);
  assert.equal(button("Suspend Business").disabled, true);
  assert.equal(posts.length, 2, "no automatic mutation retry");
  await submit();
  assert.equal(posts.length, 2);
  assert.equal(reads.length, 2, "one initial status read and one conflict refresh");
  await click(button("I have reviewed the updated status"));
  post = async () => respond({ ...status, status: "suspended", transition_id: 73 });
  await submit();
  await until(() => closed === 1);
  assert.equal(posts[2].payload.expected_transition_id, 72);
});

test("conflict refresh failure blocks reconfirmation until Retry loads an eligible status", async () => {
  await showDialog();
  await reason("Listing review");
  post = async () => { throw fail("BUSINESS_STATUS_CONFLICT", "Status changed.", 409); };
  get = async () => { throw fail("OFFLINE"); };
  await submit();
  await until(() => button("Retry"));
  assert.equal(button("Suspend Business").disabled, true);
  assert.equal(button("I have reviewed the updated status"), undefined);
  assert.equal(closed, 0);
  status = { ...status, status: "suspended", transition_id: 9 };
  get = async () => respond(status);
  await click(button("Retry"));
  await until(() => container.textContent.includes("no longer eligible"));
  assert.equal(button("Suspend Business").disabled, true);
  assert.equal(posts.length, 1);
});

function FocusDialog() {
  const [open, setOpen] = React.useState(false);
  return React.createElement(React.Fragment, null,
    React.createElement("button", { onClick: () => setOpen(true) }, "Open confirmation"),
    open && React.createElement(Dialog, { business, operation: "suspend", onClose: () => setOpen(false) }));
}

test("dialog traps keyboard focus and restores the trigger after Escape", async () => {
  await render(React.createElement(FocusDialog));
  const trigger = button("Open confirmation");
  await act(async () => trigger.focus());
  await click(trigger);
  await until(() => !button("Suspend Business").disabled);
  await until(() => document.activeElement?.getAttribute("role") === "dialog");
  await key(document.activeElement, "Tab", { shiftKey: true });
  assert.equal(document.activeElement, button("Suspend Business"));
  await key(document.activeElement, "Tab");
  assert.equal(document.activeElement.getAttribute("aria-label"), "Close modal");
  await key(document.activeElement, "Escape");
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, trigger);
});

function LegacyConsumers() {
  const list = useBusinesses({ status: "active", page: 2 });
  const map = useBusinessMap({ enabled: true, status: "active" });
  const detail = useBusinessDetail(41);
  return React.createElement("output", null, `${list.businesses[0]?.status}|${map.businesses[0]?.status}|${detail.business?.status}`);
}

test("lifecycle refresh reaches mounted manual table, detail, map and cached overview/history/dashboard", async () => {
  get = async (url) => {
    if (url.includes("map/")) return respond([status]);
    if (url.endsWith("41/")) return respond(status);
    return respond({ items: [status], pagination: { total_items: 1, total_pages: 1 } });
  };
  const keys = [
    ["admin", "businesses", "overview"], businessStatusKeys.history(41),
    ["admin", "analytics", "platformOverview"],
  ];
  keys.forEach((queryKey) => client.setQueryData(queryKey, {}));
  await render(React.createElement(LegacyConsumers));
  await until(() => container.textContent === "active|active|active");
  status = { ...status, status: "suspended" };
  await act(async () => refreshResources(client, 41));
  await until(() => container.textContent === "suspended|suspended|suspended");
  assert.equal(reads.length, 6);
  assert.equal(reads.filter((item) => item.params?.status === "active").length, 4);
  keys.forEach((queryKey) => assert.equal(client.getQueryState(queryKey).isInvalidated, true));
});

test("older in-flight list, map and detail responses cannot overwrite a lifecycle refresh", async () => {
  const pending = [];
  get = (url) => new Promise((finish) => pending.push({ url, finish }));
  await render(React.createElement(LegacyConsumers));
  assert.equal(pending.length, 3);
  const payload = (url, value) => url.includes("map/")
    ? [value]
    : url.endsWith("41/")
      ? value
      : { items: [value], pagination: { total_items: 1, total_pages: 1 } };
  const old = { ...status };
  status = { ...status, status: "suspended" };
  get = async (url) => respond(payload(url, status));
  await act(async () => refreshResources(client, 41));
  await until(() => container.textContent === "suspended|suspended|suspended");
  await act(async () => pending.forEach(({ url, finish }) => finish(respond(payload(url, old)))));
  assert.equal(container.textContent, "suspended|suspended|suspended");
});

function CombinedProbe() {
  const result = useCombined({ status: "all", requestType: "all", page: 1, pageSize: 10, search: "", businessId: 41 });
  return React.createElement("output", null, result.hasData ? String(result.totalItems) : "Loading");
}

test("combined update requests passes business scope to each existing queue before pagination", async () => {
  get = async () => respond({ items: [], pagination: { total_items: 0, total_pages: 0 } });
  await render(React.createElement(CombinedProbe));
  await until(() => container.textContent === "0");
  assert.equal(reads.length, 3);
  reads.forEach((read) => assert.equal(read.params.business_id, 41));
});
