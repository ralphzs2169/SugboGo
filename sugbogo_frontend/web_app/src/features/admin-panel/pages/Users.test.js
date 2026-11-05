import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import toast from "react-hot-toast";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const originalToastError = toast.error;
const originalToastDismiss = toast.dismiss;
const originalTimezone = process.env.TZ;
let server;
let dom;
let root;
let container;
let client;
let Page;
let useCreateAdmin;
let useUserStatusMutations;
let mutations;
let authStore;
let userQueryKeys;
let reads;
let posts;
let notifications;
let failedCounts;
let tableFailure;
let postFailure;
let counts;
let pendingReads;
let targetStatus;

before(async () => {
  process.env.TZ = "UTC";
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/admin-panel/users/all",
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
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
      name: "user-management-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__usersGet(...args),
            post: (...args) => globalThis.__usersPost(...args),
          };`;
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Page } = await server.ssrLoadModule(`${base}pages/Users.jsx`));
  ({ default: useCreateAdmin } = await server.ssrLoadModule(`${base}users/hooks/useCreateAdmin.js`));
  ({ default: useUserStatusMutations } = await server.ssrLoadModule(`${base}users/hooks/useUserStatusMutations.js`));
  ({ userQueryKeys } = await server.ssrLoadModule(`${base}users/hooks/userQueryKeys.js`));
  ({ useAuthStore: authStore } = await server.ssrLoadModule("/src/features/auth/storage/auth.store.js"));
});

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  reads = [];
  posts = [];
  notifications = [];
  failedCounts = new Set();
  tableFailure = false;
  postFailure = false;
  pendingReads = null;
  targetStatus = "disabled";
  counts = { total: 30, active: 20, merchants: 7, suspended: 0 };
  authStore.setState({ user: { id: 1, role: "super_admin" } });
  toast.error = (...args) => notifications.push(args);
  toast.dismiss = () => {};
  globalThis.__usersGet = async (url, { params }) => {
    assert.equal(url, "/admin/users/");
    reads.push({ ...params });

    if (pendingReads) {
      await new Promise((done) => pendingReads.push(done));
    }

    if (params.page_size === 1) {
      let key = "total";
      if (params.role === "merchant") key = "merchants";
      if (params.status === "active") key = "active";
      if (params.status === "suspended") key = "suspended";
      if (failedCounts.has(key)) throw new Error(`${key} count unavailable`);
      return { data: { data: { items: [], pagination: { total_items: counts[key] } } } };
    }

    if (tableFailure) throw new Error("Directory unavailable");
    return { data: { data: {
      items: [{
        id: 2,
        name: "Mara Merchant",
        email: "mara@example.com",
        role: "merchant",
        status: targetStatus,
        joined_at: "2026-11-04T16:30:00Z",
        invitation_resend_eligible: false,
      }],
      pagination: { total_items: 30, total_pages: 3 },
    } } };
  };
  globalThis.__usersPost = async (url, payload) => {
    posts.push({ url, payload });
    if (postFailure) throw new Error("Account change unavailable");
    return { data: { success: true, data: { id: 2, invitation_email_sent: true } } };
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
});

after(async () => {
  toast.error = originalToastError;
  toast.dismiss = originalToastDismiss;
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "HTMLElement", "Element", "Node",
    "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT",
    "__usersGet", "__usersPost",
  ]) {
    delete globalThis[key];
  }
});

function MutationProbe() {
  const creation = useCreateAdmin();
  const status = useUserStatusMutations();
  React.useEffect(() => {
    mutations = { creation, status };
  }, [creation, status]);
  return null;
}

async function renderPage(route = "/admin-panel/users/all") {
  window.history.replaceState({}, "", route);
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [route] },
        React.createElement(Page),
        React.createElement(MutationProbe))),
  ));
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("User Management did not reach the expected state");
}

function card(title) {
  return [...container.querySelectorAll("h3")]
    .find((heading) => heading.textContent === title)?.closest(".relative.flex");
}

function button(label, scope = document) {
  const result = [...scope.querySelectorAll("button")]
    .find((item) => item.textContent.trim() === label || item.getAttribute("aria-label") === label);
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

async function click(element) {
  await act(async () => element.click());
}

test("overview skeletons resolve independently of directory filters and preserve table controls", async () => {
  pendingReads = [];
  await renderPage("/admin-panel/users/all?search=mara&role=merchant&status=active&page=2&sort=-joined_at");
  assert.equal(container.querySelectorAll('[role="status"]').length, 4);
  assert.deepEqual(
    reads.filter((params) => params.page_size === 1),
    [
      { page: 1, page_size: 1 },
      { status: "active", page: 1, page_size: 1 },
      { role: "merchant", page: 1, page_size: 1 },
      { status: "suspended", page: 1, page_size: 1 },
    ],
  );
  assert.deepEqual(reads.find((params) => params.page_size === 10), {
    search: "mara",
    role: "merchant",
    status: "active",
    ordering: "-joined_at",
    page: 2,
    page_size: 10,
  });
  const finish = pendingReads;
  pendingReads = null;
  await act(async () => finish.forEach((done) => done()));
  await until(() => Boolean(card("Suspended Users")));
  assert.equal(document.title, "User Management | SugboGo Admin");
  assert.match(container.textContent, /User Overview/);
  assert.match(container.textContent, /All Users/);
  for (const [title, value] of [
    ["Total Users", "30"], ["Active Users", "20"], ["Merchants", "7"], ["Suspended Users", "0"],
  ]) {
    assert.equal(card(title).querySelector(".tabular-nums").textContent, value);
  }
  assert.deepEqual(
    [...container.querySelectorAll("thead th")].map((cell) => cell.textContent.trim()),
    ["No.", "User", "Email", "Role", "Status", "Date Joined", "Actions"],
  );
  const row = container.querySelector("tbody tr");
  assert.equal(row.querySelector("td").textContent, "11");
  assert.match(row.textContent, /Nov 5, 2026/);
  assert.ok(button("Rows: 10"));
  assert.ok(button("Add Admin"));
  assert.match(container.textContent, /11–20.*30/);
});

test("count and directory failures retain independent data and retry only their own requests", async () => {
  failedCounts.add("active");
  tableFailure = true;
  await renderPage();
  await until(() => container.textContent.includes("Unable to load active users"));
  assert.equal(card("Total Users").querySelector(".tabular-nums").textContent, "30");
  assert.equal(card("Suspended Users").querySelector(".tabular-nums").textContent, "0");
  assert.equal(card("Active Users"), undefined);
  assert.match(container.textContent, /Unable to load users/);
  assert.ok(notifications.length >= 2);

  failedCounts.clear();
  reads.length = 0;
  const activeError = [...container.querySelectorAll('[role="alert"]')]
    .find((element) => element.textContent.includes("Unable to load active users"));
  await click(button("Retry", activeError));
  await until(() => Boolean(card("Active Users")));
  assert.deepEqual(reads, [{ status: "active", page: 1, page_size: 1 }]);
  assert.match(container.textContent, /Unable to load users/);

  tableFailure = false;
  reads.length = 0;
  const tableError = [...container.querySelectorAll('[role="alert"]')]
    .find((element) => element.textContent.includes("Unable to load users"));
  await click(button("Try Again", tableError));
  await until(() => container.textContent.includes("Mara Merchant"));
  assert.equal(reads.length, 1);
  assert.equal(reads[0].page_size, 10);
});

test("failed count refresh keeps the last value and supports targeted recovery", async () => {
  await renderPage();
  await until(() => Boolean(card("Merchants")));
  failedCounts.add("merchants");
  await act(async () => client.invalidateQueries({ queryKey: userQueryKeys.lists() }));
  await until(() => container.textContent.includes("Refresh failed"));
  assert.equal(card("Merchants").querySelector(".tabular-nums").textContent, "7");
  assert.match(container.textContent, /Showing previously loaded data/);
  assert.match(container.textContent, /Mara Merchant/);
  failedCounts.clear();
  counts.merchants = 8;
  reads.length = 0;
  await click(button("Retry", container.querySelector('[role="alert"]')));
  await until(() => card("Merchants")?.querySelector(".tabular-nums").textContent === "8");
  assert.deepEqual(reads, [{ role: "merchant", page: 1, page_size: 1 }]);
});

test("Admin creation and both status mutations refresh mounted overview counts", async () => {
  await renderPage();
  await until(() => Boolean(card("Total Users")));
  const actions = [
    () => mutations.creation.createAdmin({ first_name: "New", last_name: "Admin", email: "new@example.com" }),
    () => mutations.status.suspend({ userId: 2, reason: "Policy violation" }),
    () => mutations.status.reactivate({ userId: 2 }),
  ];
  for (const action of actions) {
    counts.total += 1;
    reads.length = 0;
    await act(async () => action());
    await until(() => card("Total Users")?.querySelector(".tabular-nums").textContent === String(counts.total));
    assert.equal(reads.filter((params) => params.page_size === 1).length, 4);
  }
  assert.deepEqual(posts.map((post) => post.url), [
    "/admin/users/create-admin/", "/admin/users/2/suspend/", "/admin/users/2/reactivate/",
  ]);
});

test("rejected reactivation stays open for retry without an unhandled promise", async () => {
  postFailure = true;
  await renderPage();
  await until(() => container.textContent.includes("Mara Merchant"));
  await click(button("Actions for Mara Merchant"));
  await click(button("Reactivate User"));
  await click(button("Reactivate User", container.querySelector('[role="dialog"]')));
  await until(() => notifications.some(([message]) => message.includes("Unable to reactivate")));
  assert.ok(container.querySelector('[role="dialog"]'));
  postFailure = false;
  await click(button("Reactivate User", container.querySelector('[role="dialog"]')));
  await until(() => !container.querySelector('[role="dialog"]'));
  assert.equal(posts.length, 2);
});

test("rejected suspension retains its reason and correct business wording for retry", async () => {
  targetStatus = "active";
  postFailure = true;
  await renderPage();
  await until(() => container.textContent.includes("Mara Merchant"));
  await click(button("Actions for Mara Merchant"));
  await click(button("Suspend User"));
  const dialog = container.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /Linked businesses retain their existing status/);
  const reason = dialog.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(reason, "Policy violation");
    reason.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => dialog.querySelector("form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  await until(() => notifications.some(([message]) => message.includes("Unable to suspend")));
  assert.equal(reason.value, "Policy violation");
  postFailure = false;
  await act(async () => dialog.querySelector("form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  await until(() => !container.querySelector('[role="dialog"]'));
  assert.equal(posts.length, 2);
  assert.equal(posts[1].payload.reason, "Policy violation");
});
