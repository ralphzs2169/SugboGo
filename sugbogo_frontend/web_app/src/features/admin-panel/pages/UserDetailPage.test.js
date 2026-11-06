import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import toast from "react-hot-toast";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const originalTimezone = process.env.TZ;
const originalError = toast.error;
const originalSuccess = toast.success;
const originalDismiss = toast.dismiss;
const timestamp = "2026-11-04T16:30:00Z";
let dom;
let server;
let Page;
let authStore;
let keys;
let root;
let container;
let client;
let account;
let activities;
let history;
let reads;
let posts;
let failures;
let postFailure;
let notifications;
let historyPages;

before(async () => {
  process.env.TZ = "UTC";
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/admin-panel/users/2",
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
      name: "user-detail-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__userDetailGet(...args),
            post: (...args) => globalThis.__userDetailPost(...args),
          };`;
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Page } = await server.ssrLoadModule(`${base}pages/UserDetailPage.jsx`));
  ({ userQueryKeys: keys } = await server.ssrLoadModule(`${base}users/hooks/userQueryKeys.js`));
  ({ useAuthStore: authStore } = await server.ssrLoadModule("/src/features/auth/storage/auth.store.js"));
});

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  account = {
    id: 2,
    name: "Mara Merchant",
    email: `${"long-email".repeat(8)}@example.com`,
    role: "merchant",
    status: "active",
    joined_at: timestamp,
    email_verified: true,
    email_verified_at: timestamp,
    reputation: "0.23456",
    invitation_resend_eligible: false,
    application: { id: 40, status: "approved" },
    business: { id: 20, name: "Mara Cafe", status: "active" },
    activity_summary: { reviews: 4, vouches: 3, reports: 2, review_disputes: 1 },
  };
  activities = [
    { type: "review_created", description_data: { review_id: 11, business_id: 20, business_name: "Mara Cafe", status: "under_review" } },
    { type: "business_vouched", description_data: { vouch_id: 12, business_id: 20, specialty_tag_name: "Local coffee" } },
    { type: "review_reported", description_data: { report_id: 13, review_id: 11, report_type: "off_topic", status: "withdrawn" } },
    { type: "merchant_application_created", description_data: { application_id: 40, status: "approved" } },
    { type: "merchant_application_submitted", description_data: { application_id: 40, submission_number: 2 } },
    { type: "review_dispute_created", description_data: { dispute_id: 14, review_id: 11, status: "upheld", reason: "factual_error" } },
  ].map((event) => ({ ...event, timestamp }));
  history = [
    { id: 6, action: "user_suspended", context: { reason: "Repeated policy violations" } },
    { id: 5, action: "review_moderation_rejected", context: { review_id: 11, business_id: 20, previous_review_status: "under_review", review_status: "rejected", moderation_notes: "Confirmed moderation finding." } },
    { id: 4, action: "review_report_approved", context: { report_id: 13, review_id: 11, report_type: "off_topic", admin_notes: "Report investigated." } },
    { id: 3, action: "review_dispute_upheld", context: { dispute_id: 14, review_id: 11, previous_dispute_status: "pending", dispute_status: "upheld" } },
    { id: 2, action: "business_reactivated", context: { business_id: 20, previous_status: "suspended", status: "active" } },
    { id: 1, action: "admin_created", context: {} },
  ].map((entry) => ({
    ...entry,
    timestamp,
    actor: { id: 1, name: "Sofia Admin", email: "sofia@example.com", role: "super_admin" },
  }));
  reads = [];
  posts = [];
  failures = new Set();
  postFailure = false;
  notifications = [];
  historyPages = 1;
  authStore.setState({ user: { id: 1, role: "super_admin" } });
  toast.error = (...args) => notifications.push(args);
  toast.success = () => {};
  toast.dismiss = () => {};
  globalThis.__userDetailGet = async (url, { params } = {}) => {
    const resource = url.endsWith("/activity/")
      ? "activity"
      : url.endsWith("/administrative-history/") ? "history" : "detail";
    reads.push({ resource, params });
    if (failures.has(resource)) throw new Error(`${resource} unavailable`);
    let data = account;
    if (resource === "activity") data = activities;
    if (resource === "history") {
      data = {
        items: params.page > 1 ? history.slice(-1) : history,
        pagination: { page: params.page, total_pages: historyPages, has_previous: params.page > 1, has_next: params.page < historyPages },
      };
    }
    return { data: { data: structuredClone(data) } };
  };
  globalThis.__userDetailPost = async (url, payload) => {
    posts.push({ url, payload });
    if (postFailure) throw new Error("Action unavailable");
    if (url.endsWith("/suspend/") || url.endsWith("/reactivate/")) {
      const suspend = url.endsWith("/suspend/");
      account.status = suspend ? "suspended" : "active";
      history.unshift({
        id: history.length + 1,
        action: suspend ? "user_suspended" : "user_reactivated",
        timestamp,
        actor: { id: 1, name: "Sofia Admin", role: "super_admin" },
        context: suspend ? { reason: payload.reason } : {},
      });
    }
    return { data: { success: true, data: { id: 2, status: account.status } } };
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
  toast.error = originalError;
  toast.success = originalSuccess;
  toast.dismiss = originalDismiss;
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "HTMLElement", "Element", "Node",
    "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT",
    "__userDetailGet", "__userDetailPost",
  ]) delete globalThis[key];
});

function section(label) {
  const result = container.querySelector(`section[aria-label="${label}"]`);
  assert.ok(result, `Missing section: ${label}`);
  return result;
}

function button(label, scope = container) {
  const result = [...scope.querySelectorAll("button")]
    .find((element) => element.textContent.trim() === label);
  assert.ok(result, `Missing button: ${label}`);
  return result;
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("User Details did not reach the expected state");
}

async function renderPage() {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: ["/admin-panel/users/2"] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: "/admin-panel/users/:userId", element: React.createElement(Page) })))),
  ));
  await until(() => client.isFetching() === 0 && Boolean(container.querySelector('[aria-label="Account information"]')));
}

test("account information uses the stored reputation scale, role badge, and PHT dates", async () => {
  await renderPage();
  const info = section("Account information");
  assert.match(info.textContent, /0\.23456 \/ 1\.00/);
  assert.match(info.textContent, /0–1 scale.*contribution rewards and confirmed-violation penalties/);
  assert.match(info.textContent, /Verified Nov 5, 2026, 12:30 AM · PHT/);
  assert.match(info.textContent, /Date JoinedNov 5, 2026.*12:30 AM · PHT/);
  const email = [...info.querySelectorAll("dd")].find((element) => element.textContent === account.email);
  assert.ok(email.className.includes("overflow-wrap:anywhere"));
  const role = [...info.querySelectorAll("span")].find((element) => element.textContent === "Merchant");
  assert.ok(role.className.includes("rounded-full"));
  assert.ok(role.className.includes("border-info"));
  assert.equal(role.querySelector("span"), null);
  const summary = section("Activity summary");
  assert.ok(container.querySelector('[aria-label="Merchant information"]'));
  assert.ok(info.parentElement.parentElement.className.includes("lg:grid-cols-"));
  assert.equal(info.nextElementSibling, section("Account actions"));
  assert.equal(info.parentElement, section("Account actions").parentElement);
  assert.ok(!section("Account actions").className.includes("fixed"));
  assert.ok(info.querySelector("img").className.includes("h-20"));
  for (const heading of container.querySelectorAll("section h2")) {
    assert.ok(heading.className.includes("text-base"));
    assert.ok(!heading.className.includes("uppercase"));
    assert.ok(heading.querySelector("svg"));
  }
  for (const [label, count] of [
    ["Reviews Submitted", 4], ["Non-withdrawn Vouches", 3], ["Reports Submitted", 2], ["Review Disputes", 1],
  ]) {
    const heading = [...summary.querySelectorAll("h3")].find((item) => item.textContent === label);
    assert.ok(heading.closest(".relative.flex").textContent.includes(String(count)));
  }
});

test("Explorer summaries omit Merchant disputes and show a measured zero accurately", async () => {
  account.role = "explorer";
  account.reputation = "0.00000";
  account.activity_summary.reviews = 0;
  await renderPage();
  assert.match(section("Account information").textContent, /0\.00 \/ 1\.00/);
  const summary = section("Activity summary");
  assert.equal(summary.querySelectorAll("h3").length, 3);
  assert.doesNotMatch(summary.textContent, /Review Disputes/);
  assert.match(summary.textContent, /Reviews Submitted0/);
  assert.match(summary.innerHTML, /sm:grid-cols-3/);
  assert.equal(container.querySelector('[aria-label="Merchant information"]'), null);
});

for (const role of ["admin", "super_admin"]) {
  test(`${role} profiles preserve account information without merchant sections`, async () => {
    account.role = role;
    await renderPage();
    assert.doesNotMatch(section("Account information").textContent, /Reputation Score|0\.23456/);
    assert.equal(container.querySelector('[aria-label="Merchant information"]'), null);
    assert.equal(section("Activity summary").querySelectorAll("h3").length, 3);
  });
}

test("activity and history expose accurate event context and supported record destinations", async () => {
  await renderPage();
  const recent = section("Recent activity");
  assert.equal(recent.querySelectorAll("ol > li").length, 3);
  assert.equal(recent.parentElement, section("Activity summary").parentElement);
  await act(async () => button("View All", recent).click());
  assert.equal(container.querySelector('[role="dialog"]').querySelectorAll("ol > li").length, 6);
  assert.match(container.querySelector('[role="dialog"]').textContent, /up to 20 records/);
  assert.match(recent.textContent, /Submitted a review/);
  assert.doesNotMatch(recent.textContent, /Posted a review/);
  assert.match(recent.textContent, /Status: Under Review/);
  assert.match(recent.textContent, /Specialty: Local coffee/);
  assert.match(recent.textContent, /Report type: Off Topic/);
  assert.match(recent.textContent, /Submission #2 · Resubmission/);
  assert.match(recent.textContent, /Nov 5, 2026, 12:30 AM · PHT/);
  const destinations = [...recent.querySelectorAll("a")].map((link) => link.getAttribute("href"));
  for (const destination of [
    "/admin-panel/reviews?review_id=11",
    "/admin-panel/moderation-integrity?tab=reported&reported_id=11",
    "/admin-panel/moderation-integrity?tab=disputes&dispute_id=14",
    "/admin-panel/business/application/40",
    "/admin-panel/businesses/20",
  ]) assert.ok(destinations.includes(destination));
  assert.ok(destinations.every((destination) => !destination.includes("/reports/13")));

  await act(async () => container.querySelector('[aria-label="Close modal"]').click());
  const audit = section("Administrative history");
  assert.equal(audit.querySelectorAll("ol > li").length, 3);
  await act(async () => button("View All", audit).click());
  assert.equal(container.querySelector('[role="dialog"]').querySelectorAll("ol > li").length, 6);
  assert.match(audit.textContent, /Admin account created/);
  assert.match(audit.textContent, /Review rejected after moderation/);
  assert.match(audit.textContent, /Sofia Admin · Super Admin/);
  assert.match(audit.textContent, /Confirmed moderation finding/);
  assert.match(audit.textContent, /Report investigated/);
  assert.match(audit.textContent, /Review: Under Review → Rejected/);
  assert.match(audit.textContent, /Business: Suspended → Active/);
  assert.match(audit.textContent, /Repeated policy violations/);
  assert.doesNotMatch(audit.textContent, /admin_created|review_moderation_rejected/);
  assert.ok(audit.querySelector('a[href="/admin-panel/users/1"]'));
  for (const list of [recent, audit]) {
    for (const action of list.querySelectorAll("a.text-primary")) {
      assert.match(action.textContent, /^View (review|reported review|application|business|dispute)$/);
      assert.ok(action.querySelector("svg"));
    }
    const record = [...list.querySelectorAll("p.text-text-secondary")]
      .find((element) => element.textContent.includes("Review #11"));
    assert.ok(record);
    assert.equal(record.querySelector("a"), null);
  }
  const status = [...recent.querySelectorAll("span")]
    .find((element) => element.textContent === "Under Review");
  assert.ok(status.className.includes("rounded-full"));
});

test("history dialog pagination leaves the three newest records in the main preview", async () => {
  historyPages = 2;
  await renderPage();
  const main = section("Administrative history");
  await act(async () => button("View All", main).click());
  await until(() => client.isFetching() === 0);
  const dialog = container.querySelector('[role="dialog"]');
  assert.ok(dialog.querySelector('[class*="overflow-y-auto"]'));
  await act(async () => button("Next", dialog).click());
  await until(() => dialog.textContent.includes("Page 2 of 2"));
  assert.equal(dialog.querySelectorAll("ol > li").length, 1);
  assert.match(dialog.textContent, /Admin account created/);
  await act(async () => dialog.querySelector('[aria-label="Close modal"]').click());
  assert.equal(main.querySelectorAll("ol > li").length, 3);
  assert.match(main.textContent, /Review report approved/);
  assert.doesNotMatch(main.textContent, /Admin account created/);
});

test("three or fewer records do not offer View All", async () => {
  activities = activities.slice(0, 3);
  history = history.slice(0, 2);
  await renderPage();
  for (const label of ["Recent activity", "Administrative history"]) {
    assert.ok(!section(label).textContent.includes("View All"));
  }
});

test("failed refreshes preserve all loaded sections and Retry refetches only its own resource", async () => {
  await renderPage();
  failures = new Set(["detail", "activity", "history"]);
  await act(async () => client.invalidateQueries({ queryKey: keys.all }));
  await until(() => container.querySelectorAll('[role="alert"]').length === 3);
  assert.match(section("Account information").textContent, /Mara Merchant/);
  assert.match(section("Recent activity").textContent, /Submitted a review/);
  assert.match(section("Administrative history").textContent, /Review report approved/);
  for (const [resource, label] of [
    ["detail", "Account information"], ["activity", "Recent activity"], ["history", "Administrative history"],
  ]) {
    failures.delete(resource);
    reads.length = 0;
    const alert = container.querySelector(`[role="alert"][aria-label="${label}"]`);
    await act(async () => button("Retry", alert).click());
    await until(() => !container.querySelector(`[role="alert"][aria-label="${label}"]`));
    assert.deepEqual(reads.map((read) => read.resource), [resource]);
  }
});

for (const resource of ["activity", "history"]) {
  test(`initial ${resource} failure preserves independently loaded sections`, async () => {
    failures.add(resource);
    await renderPage();
    const label = resource === "activity" ? "Recent activity" : "Administrative history";
    const failedSection = section(label);
    assert.ok(failedSection.querySelector('[role="alert"]'));
    assert.match(section("Account information").textContent, /Mara Merchant/);
    const other = resource === "activity" ? "Administrative history" : "Recent activity";
    assert.equal(section(other).querySelector('[role="alert"]'), null);
    assert.ok(notifications.length);
    failures.clear();
    reads.length = 0;
    await act(async () => button("Retry", failedSection).click());
    await until(() => !failedSection.querySelector('[role="alert"]'));
    assert.deepEqual(reads.map((read) => read.resource), [resource]);
  });
}

test("empty activity and history remain valid loaded data after a failed refresh", async () => {
  activities = [];
  history = [];
  await renderPage();
  failures = new Set(["activity", "history"]);
  await act(async () => client.invalidateQueries({ queryKey: keys.all }));
  await until(() => container.querySelectorAll('[role="alert"]').length === 2);
  assert.match(section("Recent activity").textContent, /No recent contributions/);
  assert.match(section("Administrative history").textContent, /No administrative actions recorded/);
  assert.match(section("Administrative history").textContent, /account, business, and moderation actions/);
  assert.match(section("Recent activity").textContent, /Showing previously loaded data/);
});

test("eligible Admin invitation failures can be retried using the existing endpoint", async () => {
  account.role = "admin";
  account.status = "pending";
  account.email_verified = false;
  account.email_verified_at = null;
  account.invitation_resend_eligible = true;
  postFailure = true;
  await renderPage();
  assert.doesNotMatch(section("Account information").textContent, /Verified Nov/);
  await act(async () => button("Resend Invitation", section("Account actions")).click());
  await until(() => notifications.some(([message]) => message.includes("Unable to resend")));
  postFailure = false;
  await act(async () => button("Resend Invitation", section("Account actions")).click());
  await until(() => posts.length === 2 && !section("Account actions").textContent.includes("Sending Invitation"));
  assert.deepEqual(posts.map((post) => post.url), [
    "/admin/users/2/resend-invitation/", "/admin/users/2/resend-invitation/",
  ]);
});

test("suspension and reactivation still refresh account state and recorded history", async () => {
  await renderPage();
  await act(async () => button("Suspend User", section("Account actions")).click());
  const dialog = container.querySelector('[role="dialog"]');
  const reason = dialog.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, "value").set.call(reason, "Confirmed repeated violations");
    reason.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await act(async () => dialog.querySelector("form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  await until(() => !container.querySelector('[role="dialog"]') && section("Account actions").textContent.includes("Reactivate User"));
  assert.match(section("Administrative history").textContent, /Confirmed repeated violations/);
  await act(async () => button("Reactivate User", section("Account actions")).click());
  await act(async () => button("Reactivate User", container.querySelector('[role="dialog"]')).click());
  await until(() => !container.querySelector('[role="dialog"]') && section("Account actions").textContent.includes("Suspend User"));
  assert.match(section("Administrative history").textContent, /Account reactivated/);
  assert.deepEqual(posts.map((post) => post.url), [
    "/admin/users/2/suspend/", "/admin/users/2/reactivate/",
  ]);
});

test("User Details loads live data without development preview controls", async () => {
  await renderPage();
  assert.equal(container.querySelector("#user-detail-preview"), null);
  assert.match(section("Account information").textContent, /Mara Merchant/);
  assert.deepEqual(reads.map((read) => read.resource).sort(), ["activity", "detail", "history"]);
  assert.ok(section("Activity summary").querySelector("svg.lucide-heart"));
  assert.ok(section("Recent activity").querySelector("svg.lucide-heart"));
  assert.equal(posts.length, 0);
});
