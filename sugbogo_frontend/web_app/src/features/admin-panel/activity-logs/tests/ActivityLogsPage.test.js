import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Page;
let ProtectedRoute;
let authStore;
let reads;
let transport;
let queries;
let stateUtils;
let presentation;
let navigation;
let notifications;
const originalToastError = toast.error;
const originalToastDismiss = toast.dismiss;
const originalFormData = globalThis.FormData;

const activity = {
  id: "admin_activity:42:user_suspended",
  category: "administrative",
  source_type: "admin_activity",
  source_id: "42",
  occurrence: "user_suspended",
  module: "user",
  occurred_at: "2026-11-06T16:05:06Z",
  actor_id: 7,
  actor_display_snapshot: "Recorded Administrator",
  actor_role_snapshot: "super_admin",
  target_type: "user",
  target_id: "73",
  target_label: "Recorded Target",
  outcome: "succeeded",
  new_state: { status: "suspended" },
  is_administrative: true,
  provenance: { model: "activity_management.adminactivity" },
};

function pageData(params, items = [activity]) {
  const page = params.page ?? 1;
  const pageSize = params.page_size ?? 10;
  return {
    items,
    pagination: {
      page,
      page_size: pageSize,
      total_items: 21,
      total_pages: Math.ceil(21 / pageSize),
      has_next: page * pageSize < 21,
      has_previous: page > 1,
    },
  };
}

function detailData() {
  return {
    ...activity,
    previous_state: { status: "active", password: "private-password" },
    new_state: { status: "suspended", token: "private-token" },
    reason: "Recorded administrative reason.",
    context: { business_id: 73, device_id: "private-device", admin_notes: "private-evidence" },
    provenance: { ...activity.provenance, raw_provider_payload: "private-provider" },
  };
}

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
    FormData: dom.window.FormData,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "activity-log-test-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__activityGet(...args) };";
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Page } = await server.ssrLoadModule(`${base}pages/ActivityLogsPage.jsx`));
  queries = await server.ssrLoadModule(`${base}activity-logs/queries/activityLogQueries.js`);
  stateUtils = await server.ssrLoadModule(`${base}activity-logs/utils/activityLogTableState.js`);
  presentation = await server.ssrLoadModule(`${base}activity-logs/utils/activityLogPresentation.js`);
  ({ default: navigation } = await server.ssrLoadModule(`${base}config/sidebarNavigation.js`));
  ({ default: ProtectedRoute } = await server.ssrLoadModule("/src/features/auth/routes/ProtectedRoute.jsx"));
  ({ useAuthStore: authStore } = await server.ssrLoadModule("/src/features/auth/storage/auth.store.js"));
});

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  reads = [];
  notifications = [];
  toast.error = (message, options) => notifications.push({ message, ...options });
  toast.dismiss = () => {};
  transport = async (url, options) => url === "/admin/activity-logs/"
    ? pageData(options.params)
    : detailData();
  globalThis.__activityGet = async (url, options) => {
    reads.push({ url, ...options });
    return { data: { success: true, message: "Success.", data: await transport(url, options) } };
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
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.body.style.overflow, "");
});

after(async () => {
  toast.error = originalToastError;
  toast.dismiss = originalToastDismiss;
  globalThis.FormData = originalFormData;
  await server.close();
  dom.window.close();
  for (const key of [
    "window", "document", "HTMLElement", "Element", "Node",
    "requestAnimationFrame", "cancelAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT", "__activityGet",
  ]) delete globalThis[key];
});

function RouterProbe() {
  const location = useLocation();
  return React.createElement("output", { "data-location": true }, location.pathname + location.search);
}

async function render(
  route = "/admin-panel/activity-logs",
  protectedPage = false,
) {
  const content = protectedPage
    ? React.createElement(Routes, null,
      React.createElement(Route, { path: "/login", element: React.createElement("p", null, "Login destination") }),
      React.createElement(Route, { element: React.createElement(ProtectedRoute) },
        React.createElement(Route, { path: "/admin-panel/activity-logs", element: React.createElement(Page) }),
      ),
    )
    : React.createElement(Page);
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [route] },
        content,
        React.createElement(RouterProbe),
      ),
    ),
  ));
}

async function until(predicate) {
  for (let index = 0; index < 150; index += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Activity Logs did not reach the expected state");
}

function button(
  label,
  scope = document,
) {
  return [...scope.querySelectorAll("button")].find((item) => (
    item.getAttribute("aria-label") === label ||
    item.getAttribute("aria-label")?.startsWith(`${label}: `) ||
    item.textContent.trim() === label
  ));
}

async function click(
  label,
  scope,
) {
  const target = button(label, scope);
  assert.ok(target, `Missing button: ${label}`);
  await act(async () => {
    target.focus();
    target.click();
  });
}

async function input(
  element,
  value,
) {
  assert.ok(element, "Missing input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(element, value);
    element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

const listReads = () => reads.filter((read) => read.url === "/admin/activity-logs/");
const detailReads = () => reads.filter((read) => read.url !== "/admin/activity-logs/");
const dialog = () => document.querySelector('[role="dialog"][aria-describedby]');
const locationParams = () => new URLSearchParams(container.querySelector("output").textContent.split("?")[1]);

test("page consumes the normalized list and existing table/pagination components", async () => {
  await render();
  await until(() => container.textContent.includes("Recorded Administrator"));
  assert.equal(document.title, "Activity Logs | SugboGo Admin");
  assert.match(container.textContent, /View and track significant actions across SugboGo\./);
  assert.deepEqual(
    [...container.querySelectorAll("th")].map((cell) => cell.textContent),
    ["Date & Time", "Actor", "Role", "Module", "Action", "Target", "Outcome", "Actions"],
  );
  assert.equal(container.querySelector("time").dateTime, activity.occurred_at);
  assert.match(container.querySelector("time").textContent, /Nov 7, 2026/);
  assert.match(container.querySelector("time").textContent, /12:05:06 AM PHT/);
  assert.match(container.textContent, /of\s*21\s*results/);
  assert.equal(container.querySelector("table").getAttribute("aria-label"), "Activity logs");
  assert.equal(container.querySelector("input"), null);
  assert.equal(button("Export"), undefined);
  assert.equal(listReads()[0].params.category, "all");
  assert.equal(listReads()[0].params.page_size, 10);
  assert.ok(listReads()[0].signal instanceof AbortSignal);
});

test("all categories and combined URL filters reach the API and reset page on changes", async () => {
  await render("/admin-panel/activity-logs?page=3&page_size=25&module=business&action=business_name_change_approved&actor_id=9223372036854775807&start_date=2026-11-01&end_date=2026-11-06");
  await until(() => listReads().length === 1);
  assert.deepEqual(listReads()[0].params, {
    category: "all",
    module: "business",
    action: "business_name_change_approved",
    actor_id: "9223372036854775807",
    start_date: "2026-11-01",
    end_date: "2026-11-06",
    page: 3,
    page_size: 25,
  });
  for (const category of ["Administrative", "Merchant", "Explorer", "Authentication", "All Activity"]) {
    await click(category);
    const value = category === "All Activity" ? "all" : category.toLowerCase();
    await until(() => listReads().at(-1).params.category === value);
    assert.equal(listReads().at(-1).params.page, 1);
    assert.equal(listReads().at(-1).params.module, "business");
    assert.equal(listReads().at(-1).params.page_size, 25);
  }
});

test("shared menus apply verified module/action values and validate actor IDs and date ranges", async () => {
  await render("/admin-panel/activity-logs?page=2");
  await until(() => container.textContent.includes("Recorded Administrator"));
  await click("Filter activities");
  await click("Choose Module filter");
  await click("Business management");
  await until(() => listReads().at(-1).params.module === "business");
  assert.equal(listReads().at(-1).params.page, 1);
  await click("Filter activities");
  await click("Choose Action type filter");
  await click("Business suspended");
  await until(() => listReads().at(-1).params.action === "business_suspended");
  await click("Filter by administrator or user");
  await click("Specific user ID");
  await input(container.querySelector('input[inputmode="numeric"]'), "not-an-id");
  await click("Apply user");
  assert.match(container.textContent, /Enter a valid positive user identifier/);
  await input(container.querySelector('input[inputmode="numeric"]'), "73");
  await click("Apply user");
  await until(() => listReads().at(-1).params.actor_id === "73");
  await click("Filter activity dates");
  await click("Custom date range");
  const dates = container.querySelectorAll('input[type="date"]');
  await input(dates[0], "2026-11-07");
  await input(dates[1], "2026-11-06");
  await click("Apply dates");
  assert.match(container.textContent, /End date must be on or after start date/);
  await input(dates[0], "2026-11-01");
  await click("Apply dates");
  await until(() => listReads().at(-1).params.start_date === "2026-11-01");
  assert.equal(listReads().at(-1).params.end_date, "2026-11-06");
  assert.equal(locationParams().get("actor_id"), "73");
});

test("pagination uses backend totals and sends page changes without client slicing", async () => {
  await render();
  await until(() => container.textContent.includes("Recorded Administrator"));
  await click("Next page");
  await until(() => listReads().at(-1).params.page === 2);
  await until(() => container.textContent.includes("Recorded Administrator"));
  assert.equal(locationParams().get("page"), "2");
  assert.equal(container.querySelectorAll("tbody tr").length, 1);
  assert.match(container.textContent, /11–20\s*of\s*21\s*results/);
  await click("Activities per page");
  await click("100");
  await until(() => listReads().at(-1).params.page_size === 100);
  assert.equal(listReads().at(-1).params.page, 1);
  assert.equal(locationParams().get("page_size"), "100");
});

test("detail uses encoded stable identity and displays only supported labeled information", async () => {
  await render("/admin-panel/activity-logs?page=2&category=administrative");
  await until(() => button(`View details for ${activity.id}`));
  const trigger = button(`View details for ${activity.id}`);
  await click(`View details for ${activity.id}`);
  await until(() => dialog()?.textContent.includes("Recorded administrative reason."));
  assert.equal(detailReads()[0].url, `/admin/activity-logs/${encodeURIComponent(activity.id)}/`);
  assert.ok(detailReads()[0].signal instanceof AbortSignal);
  assert.equal(locationParams().get("event_id"), activity.id);
  assert.equal(locationParams().get("page"), "2");
  assert.match(dialog().textContent, /Previous state/);
  assert.match(dialog().textContent, /Resulting state/);
  assert.match(dialog().textContent, /Historical roleSuper admin/);
  assert.match(dialog().textContent, /Business ID73/);
  assert.doesNotMatch(dialog().textContent, /private-|raw_provider_payload|device_id|password/);
  await click("Close modal", dialog());
  await until(() => !dialog());
  assert.equal(locationParams().get("page"), "2");
  assert.equal(locationParams().get("category"), "administrative");
  assert.equal(locationParams().get("event_id"), null);
  assert.equal(listReads().length, 1);
  assert.equal(document.activeElement, trigger);
});

test("missing historical fields stay unavailable without invented outcomes or state transitions", async () => {
  const login = {
    ...activity,
    id: "login_event:42:login_succeeded",
    category: "authentication",
    source_type: "login_event",
    occurrence: "login_succeeded",
    module: "authentication",
    actor_display_snapshot: null,
    actor_role_snapshot: null,
    target_label: null,
    outcome: null,
    new_state: null,
    is_administrative: false,
    provenance: { model: "authentication.loginevent", method: "admin" },
  };
  transport = async (url, options) => url === "/admin/activity-logs/"
    ? pageData(options.params, [login])
    : { ...login, previous_state: null, reason: null, context: null };
  await render();
  await until(() => container.textContent.includes("User #7"));
  assert.doesNotMatch(container.querySelector("tbody").textContent, /Super admin|Completed|Success/);
  await click(`View details for ${login.id}`);
  await until(() => dialog()?.textContent.includes("No change details"));
  assert.match(dialog().textContent, /Historical roleNot recorded/);
  assert.match(dialog().textContent, /Recorded outcomeNot recorded/);
  assert.doesNotMatch(dialog().textContent, /Previous state|Resulting state/);
});

test("list loading, persistent failure, notification, and Retry are scoped to the query", async () => {
  let fail;
  transport = () => new Promise((resolve, reject) => { fail = reject; });
  await render("/admin-panel/activity-logs?module=user&page=2");
  await until(() => fail);
  assert.ok(container.querySelector(".animate-pulse"));
  assert.equal(container.querySelector('[aria-busy="true"]') != null, true);
  await act(async () => fail({ response: { status: 503, data: { message: "Activity service unavailable." } } }));
  await until(() => container.textContent.includes("Unable to load activity logs"));
  assert.ok(button("Try Again"));
  assert.equal(notifications.at(-1).message, "Activity service unavailable.");
  transport = async (url, options) => pageData(options.params);
  await click("Try Again");
  await until(() => container.textContent.includes("Recorded Administrator"));
  assert.equal(listReads().length, 2);
  assert.equal(listReads().at(-1).params.page, 2);
  assert.equal(listReads().at(-1).params.module, "user");
});

test("detail loading and expired-source errors leave the table usable and retry only details", async () => {
  let fail;
  transport = async (url, options) => url === "/admin/activity-logs/"
    ? pageData(options.params)
    : new Promise((resolve, reject) => { fail = reject; });
  await render();
  await until(() => button(`View details for ${activity.id}`));
  await click(`View details for ${activity.id}`);
  await until(() => dialog()?.querySelector('[aria-label="Loading activity details"]'));
  await act(async () => fail({ response: { status: 404, data: { message: "Activity not found." } } }));
  await until(() => dialog()?.textContent.includes("Activity no longer available"));
  assert.match(container.querySelector("tbody").textContent, /Recorded Administrator/);
  assert.equal(notifications.at(-1).message, "Activity not found.");
  transport = async () => detailData();
  await click("Try Again", dialog());
  await until(() => dialog()?.textContent.includes("Recorded administrative reason."));
  assert.equal(detailReads().length, 2);
  assert.equal(listReads().length, 1);
});

test("empty states distinguish absent data from filtered results and clear filters", async () => {
  transport = async (url, options) => ({
    ...pageData(options.params, []),
    pagination: { ...pageData(options.params).pagination, total_items: 0, total_pages: 0 },
  });
  await render();
  await until(() => container.textContent.includes("No activity records available"));
  await click("Merchant");
  await until(() => container.textContent.includes("No activities match your filters"));
  await click("Clear activity filters");
  await until(() => container.textContent.includes("No activity records available"));
  assert.equal(listReads().at(-1).params.category, "all");
  assert.equal(locationParams().has("category"), false);
});

test("query keys isolate pages and separate genuine occurrences while forwarding cancellation", async () => {
  assert.notDeepEqual(
    queries.activityLogKeys.list({ page: 1 }),
    queries.activityLogKeys.list({ page: 2 }),
  );
  assert.notDeepEqual(
    queries.activityLogKeys.detail("business_vouch:42:business_vouch_submitted"),
    queries.activityLogKeys.detail("business_vouch:42:business_vouch_withdrawn"),
  );
  const controller = new AbortController();
  await queries.activityLogDetailOptions(activity.id).queryFn({ signal: controller.signal });
  assert.equal(reads.at(-1).signal, controller.signal);
  const state = stateUtils.readActivityLogState(new URLSearchParams("page=-1&page_size=101"));
  assert.equal(state.page, 1);
  assert.equal(state.page_size, 10);
  assert.deepEqual(presentation.activityDetailEntries(
    { status: { token: "private" }, token: "private" },
    { status: "Status" },
  ), []);
});

test("navigation and the existing role guard restrict the page to Admin and Super Admin", async () => {
  const system = navigation.find((section) => section.section === "System");
  const entry = system.items.find((item) => item.label === "Activity Logs");
  assert.equal(entry.to, "/admin-panel/activity-logs");
  assert.deepEqual(entry.roles, ["admin", "super_admin"]);
  const app = readFileSync("src/App.jsx", "utf8");
  assert.match(app, /path="activity-logs" element={<ActivityLogsPage \/>}/);
  assert.ok(app.indexOf('path="activity-logs"') > app.indexOf("<ProtectedRoute"));
  authStore.setState({ isLoading: false, isAuthenticated: true, user: { role: "explorer" } });
  await render("/admin-panel/activity-logs", true);
  await until(() => container.textContent.includes("Login destination"));
  assert.equal(listReads().length, 0);
});
