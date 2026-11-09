import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createServer } from "vite";

import { getNotificationDestination } from "../utils/notificationDestination.js";
import { formatNotificationTime } from "../utils/notificationPresentation.js";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const events = [
  ["admin_merchant_application_submitted", "admin_merchant_application", "clipboard-list"],
  ["admin_review_moderation_required", "admin_review_moderation", "shield-alert"],
  ["admin_review_report_received", "admin_reported_review", "flag"],
  ["admin_review_dispute_filed", "admin_review_dispute", "message-square-warning"],
];
let dom;
let server;
let Header;
let Page;
let auth;
let options;
let client;
let root;
let container;
let records;
let reads;
let posts;
let failures;
let getTransport;

function fixtures() {
  return Array.from({ length: 23 }, (_, index) => ({
    id: 23 - index,
    type: events[index % events.length][0],
    target_type: events[index % events.length][1],
    target_id: 200 + index,
    title: `Notice ${23 - index}`,
    body: `Actionable event ${23 - index}`,
    is_read: index >= 12,
    read_at: index >= 12 ? new Date().toISOString() : null,
    created_at: new Date(Date.now() - index * 60_000).toISOString(),
  }));
}

function listData(params) {
  const items = params.is_read === false ? records.filter((item) => !item.is_read) : records;
  const start = (params.page - 1) * params.page_size;
  return {
    items: items.slice(start, start + params.page_size),
    pagination: {
      page: params.page,
      page_size: params.page_size,
      total_items: items.length,
      total_pages: Math.ceil(items.length / params.page_size),
      has_next: start + params.page_size < items.length,
      has_previous: params.page > 1,
    },
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
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "notification-test-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__notificationGet(...args), post: (...args) => globalThis.__notificationPost(...args) };";
        }
      },
    }],
  });
  ({ default: Header } = await server.ssrLoadModule(
    "/src/features/admin-panel/components/NavigationHeader.jsx",
  ));
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/NotificationsPage.jsx",
  ));
  ({ useAuthStore: auth } = await server.ssrLoadModule(
    "/src/features/auth/storage/auth.store.js",
  ));
  options = await server.ssrLoadModule(
    "/src/features/admin-panel/notifications/queries/notificationQueries.js",
  );
});

beforeEach(async () => {
  reads = [];
  posts = [];
  records = fixtures();
  failures = {};
  getTransport = async (url, { params } = {}) => {
    if (url === "/notifications/unread-count/") {
      if (failures.count) throw new Error("Count unavailable");
      return { unread_count: records.filter((item) => !item.is_read).length };
    }
    if (failures.list) throw new Error("List unavailable");
    return listData(params);
  };
  globalThis.__notificationGet = async (url, request) => {
    reads.push({ url, ...request });
    return { data: { success: true, data: await getTransport(url, request) } };
  };
  globalThis.__notificationPost = async (url) => {
    posts.push(url);
    if (failures.read) throw new Error("Read unavailable");
    const id = Number(url.split("/")[2]);
    const affected = url === "/notifications/read-all/"
      ? records.filter((item) => !item.is_read)
      : records.filter((item) => item.id === id);
    affected.forEach((item) => {
      item.is_read = true;
      item.read_at = new Date().toISOString();
    });
    return {
      data: {
        success: true,
        data: url === "/notifications/read-all/" ? { updated_count: affected.length } : affected[0],
      },
    };
  };
  auth.setState({
    user: { id: 7, role: "admin" },
    isAuthenticated: true,
    isLoading: false,
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
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
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "localStorage", "HTMLElement", "Element", "Node",
    "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT",
    "__notificationGet", "__notificationPost",
  ]) {
    delete globalThis[key];
  }
});

function RouterProbe() {
  const location = useLocation();
  return React.createElement("output", { "data-location": true }, location.pathname + location.search);
}

async function render(path = "/admin-panel/dashboard") {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [path] },
        React.createElement(Header),
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/admin-panel/notifications", element: React.createElement(Page) }),
          React.createElement(Route, { path: "*", element: React.createElement("p", null, "Workflow") }),
        ),
        React.createElement("button", { "data-outside": true }, "Outside"),
        React.createElement(RouterProbe),
      ),
    ),
  ));
}

const bell = () => container.querySelector('[aria-label="Notifications"][aria-expanded]');
const panel = () => container.querySelector('[role="dialog"]');
const list = () => container.querySelector('ul[aria-label="Notifications"]');
const rows = () => [...(list()?.querySelectorAll("li > button") ?? [])];
const location = () => container.querySelector("[data-location]").textContent;
const button = (text) => [...container.querySelectorAll("button")].find((item) => item.textContent.trim() === text);
const listReads = () => reads.filter((item) => item.url === "/notifications/");

async function pause() {
  await act(async () => new Promise((done) => setTimeout(done, 20)));
}

async function until(predicate) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await pause();
  }
  assert.fail("Notifications did not reach the expected state");
}

async function click(element) {
  assert.ok(element, "Expected a clickable element");
  await act(async () => {
    element.focus();
    element.click();
  });
}

async function press(element, key) {
  await act(async () => element.dispatchEvent(new dom.window.KeyboardEvent(
    "keydown", { key, bubbles: true, cancelable: true },
  )));
}

test("count polling is lightweight, account scoped, focus-aware, and visibility-bound", () => {
  const count = options.notificationCountOptions(7, { poll: true });
  assert.equal(count.refetchInterval, 60_000);
  assert.equal(count.refetchIntervalInBackground, false);
  assert.equal(count.refetchOnWindowFocus, "always");
  assert.equal(count.refetchOnReconnect, "always");
  assert.equal(options.notificationCountOptions(7).refetchInterval, false);
  assert.equal(options.notificationListOptions(7, { page: 1 }).refetchInterval, undefined);
  assert.notDeepEqual(options.notificationKeys.account(7), options.notificationKeys.account(8));
});

test("destinations allow only the four Task 1 record types and relative time is readable", () => {
  const expected = [
    "/admin-panel/business/application/42",
    "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42",
    "/admin-panel/moderation-integrity?tab=reported&reported_id=42",
    "/admin-panel/moderation-integrity?tab=disputes&dispute_id=42&status=all",
  ];
  events.forEach((event, index) => {
    assert.equal(getNotificationDestination({ target_type: event[1], target_id: 42 }), expected[index]);
  });
  for (const id of [0, -1, null, "42", 1.5, "https://example.com"]) {
    assert.equal(getNotificationDestination({ target_type: events[0][1], target_id: id }), null);
  }
  for (const type of ["https://example.com", "review_dispute", "constructor", "toString", ""]) {
    assert.equal(getNotificationDestination({ target_type: type, target_id: 42 }), null);
  }
  const now = Date.parse("2026-11-09T01:00:00Z");
  assert.equal(formatNotificationTime("2026-11-09T00:58:00Z", now), "2 minutes ago");
  assert.equal(formatNotificationTime(null, now), "Time unavailable");
});

test("bell shows 9+, loads ten recent items on opening, and supports disclosure dismissal", async () => {
  await render();
  await until(() => bell()?.textContent.includes("9+"));
  assert.equal(listReads().length, 0);
  await click(bell());
  await until(() => rows().length === 10);
  assert.match(rows()[0].textContent, /Notice 23/);
  assert.match(rows()[0].textContent, /Just now/);
  assert.equal(posts.length, 0);
  assert.deepEqual(listReads()[0].params, { page: 1, page_size: 10 });
  assert.ok(listReads()[0].signal instanceof AbortSignal);
  for (const event of events) assert.ok(panel().querySelector(`.lucide-${event[2]}`));
  assert.ok(rows()[0].classList.contains("bg-primary/5"));
  await press(rows()[0], "Escape");
  assert.equal(panel(), null);
  assert.ok(document.activeElement === bell());
  await press(bell(), "ArrowDown");
  assert.ok(panel());
  assert.ok(panel().contains(document.activeElement));
  await act(async () => document.body.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true })));
  assert.equal(panel(), null);
  await click(bell());
  await click(container.querySelector('a[href="/admin-panel/notifications"]'));
  assert.equal(location(), "/admin-panel/notifications");
  assert.equal(panel(), null);
  await click(bell());
  await act(async () => container.querySelector("[data-outside]").focus());
  assert.equal(panel(), null);
});

test("history paginates and All/Unread changes reset the requested page", async () => {
  await render("/admin-panel/notifications");
  await until(() => rows().length === 10);
  assert.equal(document.title, "Notifications | SugboGo Admin");
  assert.match(container.querySelector("h1").textContent, /Notifications/);
  await click(container.querySelector('[aria-label="Next page"]'));
  await until(() => rows()[0]?.textContent.includes("Notice 13"));
  assert.equal(listReads().at(-1).params.page, 2);
  await click(container.querySelector('[role="tab"]#notification-filters-unread'));
  await until(() => rows()[0]?.textContent.includes("Notice 23"));
  assert.deepEqual(listReads().at(-1).params, { page: 1, page_size: 10, is_read: false });
  await click(container.querySelector('[aria-label="Next page"]'));
  await until(() => rows().length === 2);
  await click(container.querySelector('[role="tab"]#notification-filters-all'));
  await until(() => rows().length === 10);
  assert.equal(container.querySelector('[aria-current="page"]').textContent, "1");
});

test("selection reads once and navigates every supported target through the allowlist", async () => {
  await render();
  for (const [index, event] of events.entries()) {
    records = [{ ...fixtures()[0], id: 40 + index, type: event[0], target_type: event[1] }];
    await click(bell());
    await until(() => rows().length === 1 && rows()[0].querySelector(`.lucide-${event[2]}`));
    const expected = getNotificationDestination(records[0]);
    await click(rows()[0]);
    await until(() => location() === expected);
    assert.equal(posts.at(-1), `/notifications/${40 + index}/read/`);
    assert.equal(records[0].is_read, true);
    assert.equal(panel(), null);
  }
});

test("unsupported targets safely return to history and reading removes an Unread item", async () => {
  records = [{ ...fixtures()[0], target_type: "https://untrusted.example" }];
  await render("/admin-panel/notifications");
  await until(() => rows().length === 1);
  await click(container.querySelector("#notification-filters-unread"));
  await until(() => listReads().at(-1).params.is_read === false);
  await until(() => rows().length === 1);
  await click(rows()[0]);
  await until(() => container.textContent.includes("No unread notifications"));
  assert.equal(location(), "/admin-panel/notifications");
  assert.equal(posts.length, 1);
  assert.equal(bell().querySelector('[aria-hidden="true"].absolute'), null);
});

test("bulk read reconciles count and rows without navigating or resolving a case", async () => {
  await render();
  await click(bell());
  await until(() => rows().length === 10);
  await click(button("Mark all as read"));
  await until(() => button("Mark all as read").disabled && bell().textContent.includes("0 unread"));
  assert.deepEqual(posts, ["/notifications/read-all/"]);
  assert.equal(location(), "/admin-panel/dashboard");
  assert.ok(panel());
  assert.equal(rows().length, 10);
  assert.ok(rows().every((row) => row.classList.contains("bg-background")));
  assert.equal(bell().querySelector('[aria-hidden="true"].absolute'), null);
});

test("dropdown bulk read recovers an exhausted Unread history page", async () => {
  const original = getTransport;
  getTransport = async (url, request) => {
    const data = await original(url, request);
    if (
      url === "/notifications/" &&
      request.params.page > Math.max(1, data.pagination.total_pages)
    ) {
      throw Object.assign(new Error("Invalid page."), { response: { status: 404 } });
    }
    return data;
  };
  await render("/admin-panel/notifications");
  await until(() => rows().length === 10);
  await click(container.querySelector("#notification-filters-unread"));
  await until(() => listReads().at(-1).params.is_read === false);
  await until(() => rows().length === 10);
  await click(container.querySelector('[aria-label="Next page"]'));
  await until(() => rows().length === 2);
  await click(bell());
  await until(() => panel()?.querySelectorAll("li > button").length === 10);
  await click([...panel().querySelectorAll("button")].find(
    (item) => item.textContent.trim() === "Mark all as read",
  ));
  const history = container.querySelector('[aria-label="Notification history"]');
  await until(() => history.textContent.includes("No unread notifications"));
  const unreadHistory = client.getQueryData(options.notificationKeys.list(7, {
    page: 1,
    page_size: 10,
    is_read: false,
  }));
  assert.equal(unreadHistory.pagination.page, 1);
  assert.equal(unreadHistory.pagination.total_items, 0);
  assert.match(history.textContent, /No unread notifications/);
  assert.doesNotMatch(history.textContent, /Unable to load notifications/);
  assert.ok(bell().textContent.includes("0 unread"));
  assert.deepEqual(posts, ["/notifications/read-all/"]);
  assert.equal(location(), "/admin-panel/notifications");
});

test("loading, empty history, and query errors remain visible and retry only the failed section", async () => {
  failures.count = true;
  failures.list = true;
  await render("/admin-panel/notifications");
  await until(() => container.textContent.includes("Unable to load notifications"));
  assert.match(container.textContent, /Unread count unavailable/);
  const countReads = reads.filter((item) => item.url.endsWith("unread-count/")).length;
  records = [];
  failures.list = false;
  const listError = [...container.querySelectorAll('[role="alert"]')].find((item) => item.textContent.includes("Unable to load notifications"));
  await click(listError.querySelector("button"));
  await until(() => container.textContent.includes("No notifications yet"));
  assert.equal(reads.filter((item) => item.url.endsWith("unread-count/")).length, countReads);
  failures.count = false;
  await click(container.querySelector('[role="alert"] button'));
  await until(() => container.textContent.includes("0 unread"));
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test("list loading is explicit and an open dropdown refreshes when count changes", async () => {
  let finish;
  const original = getTransport;
  getTransport = (url, request) => url === "/notifications/"
    ? new Promise((done) => { finish = () => done(listData(request.params)); })
    : original(url, request);
  await render();
  await click(bell());
  await until(() => panel()?.querySelector('[aria-label="Loading notifications"]'));
  await act(async () => finish());
  await until(() => rows().length === 10);
  getTransport = original;
  records.unshift({ ...fixtures()[0], id: 99, title: "Newest notice" });
  await act(async () => client.invalidateQueries({ queryKey: options.notificationKeys.unreadCount(7) }));
  await until(() => rows()[0]?.textContent.includes("Newest notice"));
});

test("read failures retain the dropdown and retry the intended mutation", async () => {
  failures.read = true;
  await render();
  await click(bell());
  await until(() => rows().length === 10);
  await click(rows()[0]);
  await until(() => panel()?.textContent.includes("Unable to mark notifications as read"));
  assert.equal(location(), "/admin-panel/dashboard");
  assert.equal(records[0].is_read, false);
  failures.read = false;
  await click(panel().querySelector('[role="alert"] button'));
  await until(() => location() === "/admin-panel/business/application/200");
  assert.deepEqual(posts, ["/notifications/23/read/", "/notifications/23/read/"]);
});

test("only restored admin sessions fetch, and account loss cancels pending list reads", async () => {
  auth.setState({ isLoading: true });
  await render();
  assert.equal(bell(), null);
  assert.equal(reads.length, 0);
  await act(async () => auth.setState({ isLoading: false, user: { id: 7, role: "merchant" } }));
  assert.equal(bell(), null);
  assert.equal(reads.length, 0);
  await act(async () => auth.setState({ user: { id: 7, role: "super_admin" } }));
  await until(() => bell()?.textContent.includes("9+"));
  let finish;
  const original = getTransport;
  getTransport = (url, request) => url === "/notifications/"
    ? new Promise((done) => { finish = () => done(listData(request.params)); })
    : original(url, request);
  await click(bell());
  await until(() => listReads().length === 1);
  const signal = listReads()[0].signal;
  await act(async () => auth.getState().clearUser());
  assert.equal(bell(), null);
  assert.equal(signal.aborted, true);
  await act(async () => finish());
  records = [];
  getTransport = original;
  await act(async () => auth.setState({ user: { id: 8, role: "admin" }, isAuthenticated: true }));
  await until(() => bell()?.textContent.includes("0 unread"));
  assert.ok(client.getQueryData(options.notificationKeys.unreadCount(8)));
  assert.equal(panel(), null);
});
