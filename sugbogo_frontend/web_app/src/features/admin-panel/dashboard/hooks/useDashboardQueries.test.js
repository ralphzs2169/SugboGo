import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let createRoot;
let root;
let container;
let client;
let hooks;
let keys;
let Page;
let ReportedWorkspace;
let mutations;
let mutationResult;
let results;
let reads;
let posts;
let notifications;
let transport;
const originalToastError = toast.error;

const resources = [
  ["summary", "useDashboardSummary", "/admin/dashboard/", "Operational summary"],
  ["recentDecisions", "useDashboardRecentDecisions", "/admin/dashboard/recent-decisions/", "Recent administrative decisions"],
  ["platformOverview", "useDashboardPlatformOverview", "/admin/dashboard/platform-overview/", "Platform overview"],
  ["priorityWorklist", "useDashboardPriorityWorklist", "/admin/dashboard/priority-worklist/", "Priority worklist"],
];
const mutationPaths = {
  applicationApproval: "business-applications/hooks/useApproveBusinessApplication.js",
  applicationRejection: "business-applications/hooks/useRejectBusinessApplication.js",
  businessName: "business-update-requests/hooks/useBusinessUpdateRequestDecisions.js",
  classification: "business-update-requests/hooks/useClassificationUpdateRequestDecisions.js",
  location: "business-update-requests/hooks/useLocationUpdateRequestDecisions.js",
  moderation: "under-review/hooks/useUnderReviewDecisions.js",
  disputes: "review-disputes/hooks/useReviewDisputeMutations.js",
  users: "users/hooks/useUserStatusMutations.js",
  createAdmin: "users/hooks/useCreateAdmin.js",
};

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "dashboard-data-layer-fixtures",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__dashboardRead(...args),
            post: (...args) => globalThis.__dashboardPost(...args),
          };`;
        }
        const widgets = [
          ["MetricRow", "summary", "summary"],
          ["DiscoveryActivity", "overview", "platformOverview"],
          ["LowerDashboardSection", "recentDecisions", "recentDecisions"],
        ];
        for (const [name, prop, resource] of widgets) {
          if (path.endsWith(`/dashboard/components/${name}.jsx`)) {
            return `import React from 'react'; export default function Widget(props) {
              return React.createElement('output', {'data-resource': '${resource}'}, JSON.stringify(props.${prop}));
            }`;
          }
        }
        if (path.endsWith("/reported-reviews/components/ReportedReviewDetail.jsx")) {
          return `import React from 'react'; export default function Detail({onDecision}) {
            return React.createElement('button', {onClick: () => onDecision({id: 12, status: 'published'}, 'keep')}, 'Keep review');
          }`;
        }
        if (path.endsWith("/reported-reviews/components/DecisionDialog.jsx")) {
          return `import React from 'react'; export default function Dialog({target, onConfirm}) {
            return target ? React.createElement('button', {onClick: onConfirm}, 'Confirm reported decision') : null;
          }`;
        }
        if (
          path.endsWith("/reported-reviews/components/QueueItem.jsx")
          || path.endsWith("/reported-reviews/components/QueueFilters.jsx")
        ) {
          return "export default function QueueFixture() { return null; }";
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  hooks = await server.ssrLoadModule(`${base}dashboard/hooks/useDashboardQueries.js`);
  ({ dashboardQueryKeys: keys } = await server.ssrLoadModule(
    `${base}dashboard/queries/dashboardQueryKeys.js`,
  ));
  ({ default: Page } = await server.ssrLoadModule(`${base}pages/Dashboard.jsx`));
  ({ default: ReportedWorkspace } = await server.ssrLoadModule(
    `${base}reported-reviews/components/ReportedReviewWorkspace.jsx`,
  ));
  mutations = {};
  for (const [name, path] of Object.entries(mutationPaths)) {
    ({ default: mutations[name] } = await server.ssrLoadModule(`${base}${path}`));
  }
});

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity } },
  });
  reads = [];
  posts = [];
  notifications = [];
  results = new Map();
  transport = async (url) => ({
    data: { data: { source: url, value: 0 } },
  });
  globalThis.__dashboardRead = (url, options) => {
    reads.push({ url, ...options });
    return transport(url, options);
  };
  globalThis.__dashboardPost = async (...args) => {
    posts.push(args);
    return { data: { data: { id: 12 } } };
  };
  toast.error = (...args) => notifications.push(args);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

after(async () => {
  toast.error = originalToastError;
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT",
    "__dashboardRead", "__dashboardPost",
  ]) {
    delete globalThis[key];
  }
});

function Probe({ name, enabled = true }) {
  const useDashboardQuery = hooks[name];
  const query = useDashboardQuery({ enabled });
  results.set(name, { ...query });
  return null;
}

function MutationProbe({ name }) {
  const useDecision = mutations[name];
  const result = useDecision();
  React.useEffect(() => {
    mutationResult = result;
  }, [result]);
  return null;
}

async function render(children, route = "/admin-panel/dashboard") {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, { initialEntries: [route] }, children),
    ),
  ));
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Dashboard query did not reach the expected state.");
}

function loadedContent(resource) {
  const [, , , label] = resources.find(([name]) => name === resource);
  const section = container.querySelector(`section[aria-label="${label}"]`);
  if (resource === "priorityWorklist") {
    return section?.textContent.includes("Priority worklist data is ready.");
  }
  return Boolean(section?.querySelector("output"));
}

function loadedSectionCount() {
  return resources.filter(([resource]) => loadedContent(resource)).length;
}

test("all four hooks expose independent native query state and cancellation signals", async () => {
  await render(resources.map(([, name]) => React.createElement(Probe, { key: name, name })));
  await until(() => resources.every(([, name]) => results.get(name)?.isSuccess));
  assert.equal(reads.length, 4);
  for (const [, name, url] of resources) {
    const query = results.get(name);
    assert.equal(query.data.source, url);
    assert.equal(query.data.value, 0);
    assert.equal(query.error, null);
    assert.equal(query.isLoading, false);
    assert.equal(query.isFetching, false);
    assert.equal(typeof query.refetch, "function");
    assert.equal(reads.find((request) => request.url === url).signal.aborted, false);
  }
});

test("disabled queries do not fetch and unmount aborts active requests", async () => {
  await render(React.createElement(Probe, { name: "useDashboardSummary", enabled: false }));
  assert.equal(reads.length, 0);
  transport = () => new Promise(() => {});
  await render(resources.map(([, name]) => React.createElement(Probe, { key: name, name })));
  await until(() => reads.length === 4);
  const signals = reads.map((request) => request.signal);
  await render(null);
  assert.equal(signals.every((signal) => signal.aborted), true);
});

for (const [resource, , failingUrl, label] of resources) {
  test(`${resource} page failure remains isolated and Retry refetches only that source`, async () => {
    let failing = true;
    transport = async (url) => {
      if (url === failingUrl && failing) throw new Error(`Failed ${resource}`);
      return { data: { data: { source: url } } };
    };
    await render(React.createElement(Page));
    const section = () => container.querySelector(`section[aria-label="${label}"]`);
    await until(() => section()?.querySelector('[role="alert"]')
      && loadedSectionCount() === 3);
    assert.equal(container.querySelector("h1").textContent, "Dashboard");
    assert.equal(loadedContent(resource), false);
    const notificationIds = notifications.map(([, options]) => options.id);
    const expectedId = resource === "summary"
      ? "admin-dashboard-summary-load-error"
      : resource === "recentDecisions"
        ? "admin-dashboard-decisions-load-error"
        : resource === "priorityWorklist"
          ? "admin-dashboard-priority-worklist-load-error"
          : "admin-dashboard-platform-overview-load-error";
    assert.ok(notificationIds.includes(expectedId));
    failing = false;
    const previousReads = reads.length;
    await act(async () => section().querySelector("button").click());
    await until(() => loadedSectionCount() === 4);
    assert.equal(reads.length, previousReads + 1);
    assert.equal(reads.at(-1).url, failingUrl);
  });
}

test("page header stays visible during four independent initial loads", async () => {
  transport = () => new Promise(() => {});
  await render(React.createElement(Page));
  assert.equal(container.querySelector("h1").textContent, "Dashboard");
  assert.equal(container.querySelectorAll('[role="status"]').length, 4);
  assert.equal(loadedSectionCount(), 0);
});

for (const [resource, label] of [
  ["summary", "Operational summary"],
  ["priorityWorklist", "Priority worklist"],
]) {
  test(`${resource} background refresh and failure preserve loaded section content`, async () => {
    await render(React.createElement(Page));
    await until(() => loadedSectionCount() === 4);
    let reject;
    transport = () => new Promise((resolveRequest, rejectRequest) => { reject = rejectRequest; });
    let refresh;
    await act(async () => {
      refresh = client.refetchQueries({ queryKey: keys[resource], exact: true });
    });
    await until(() => container.textContent.includes(`Refreshing ${label.toLowerCase()}`));
    assert.equal(loadedContent(resource), true);
    await act(async () => { reject(new Error("Refresh failed")); await refresh; });
    await until(() => container.textContent.includes("Previously loaded data remains visible"));
    assert.equal(loadedSectionCount(), 4);
    assert.equal(loadedContent(resource), true);
  });
}

const queueKeys = ["summary", "recentDecisions", "priorityWorklist"];
const mutationCases = [
  ["applicationApproval", "approveApplication", [12, 8], [...queueKeys, "platformOverview"]],
  ["applicationRejection", "rejectApplication", [12, { reason: "Reason" }], queueKeys],
  ["businessName", "approve", 12, queueKeys],
  ["businessName", "reject", { requestId: 12, rejectionReason: "Reason" }, queueKeys],
  ["classification", "approve", 12, queueKeys],
  ["classification", "reject", { requestId: 12, rejectionReason: "Reason" }, queueKeys],
  ["location", "approve", 12, queueKeys],
  ["location", "reject", { requestId: 12, rejectionReason: "Reason" }, queueKeys],
  ["moderation", "approve", 12, [...queueKeys, "platformOverview"]],
  ["moderation", "reject", { reviewId: 12, moderationNotes: "Reason" }, queueKeys],
  ["disputes", "uphold", { disputeId: 12, data: {} }, queueKeys],
  ["disputes", "dismiss", { disputeId: 12, data: {} }, queueKeys],
  ["users", "suspend", { userId: 12, reason: "Reason" }, ["recentDecisions"]],
  ["users", "reactivate", { userId: 12 }, ["recentDecisions"]],
  ["createAdmin", "createAdmin", { email: "admin@example.com" }, ["platformOverview"]],
];

for (const [name, action, args, invalidated] of mutationCases) {
  test(`${name}.${action} invalidates only the appropriate Dashboard resources`, async () => {
    for (const [resource] of resources) client.setQueryData(keys[resource], { value: 1 });
    const analyticsKey = ["admin", "analytics", "sentinel"];
    client.setQueryData(analyticsKey, { value: 1 });
    await render(React.createElement(MutationProbe, { name }));
    const actionArgs = Array.isArray(args) ? args : [args];
    await act(async () => { await mutationResult[action](...actionArgs); });
    for (const [resource] of resources) {
      assert.equal(client.getQueryState(keys[resource]).isInvalidated, invalidated.includes(resource));
    }
    assert.equal(client.getQueryState(analyticsKey).isInvalidated, false);
    assert.equal(posts.length, 1);
    if (name === "applicationApproval") {
      assert.deepEqual(posts[0], [
        "/admin/businesses/applications/12/approve/",
        { expected_submission_id: 8 },
      ]);
    }
    if (name === "applicationRejection") {
      assert.deepEqual(posts[0], [
        "/admin/businesses/applications/12/reject/",
        args[1],
      ]);
    }
  });
}

for (const name of ["applicationApproval", "applicationRejection"]) {
  test(`${name} failure preserves submission errors without invalidating Dashboard data`, async (t) => {
    t.mock.method(console, "error", () => {});
    const failure = new Error("Application decision failed");
    globalThis.__dashboardPost = async () => { throw failure; };
    for (const [resource] of resources) {
      client.setQueryData(keys[resource], { value: 1 });
    }
    await render(React.createElement(MutationProbe, { name }));
    const action = name === "applicationApproval" ? "approveApplication" : "rejectApplication";
    await act(async () => {
      await assert.rejects(mutationResult[action](12, 8), (error) => error === failure);
    });
    assert.equal(mutationResult.error, failure);
    assert.equal(mutationResult.isSubmitting, false);
    for (const [resource] of resources) {
      assert.equal(client.getQueryState(keys[resource]).isInvalidated, false);
    }
  });
}

test("reported-review decision invalidates pending work and decisions without changing overview", async () => {
  for (const [resource] of resources) client.setQueryData(keys[resource], { value: 1 });
  transport = async () => ({ data: { data: { items: [], pagination: { total_pages: 0 } } } });
  await render(React.createElement(ReportedWorkspace), "/admin-panel/moderation-integrity?tab=reported");
  await act(async () => {
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Keep review").click();
  });
  await act(async () => {
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm reported decision").click();
  });
  await until(() => posts.length === 1 && client.getQueryState(keys.summary).isInvalidated);
  assert.equal(client.getQueryState(keys.recentDecisions).isInvalidated, true);
  assert.equal(client.getQueryState(keys.priorityWorklist).isInvalidated, true);
  assert.equal(client.getQueryState(keys.platformOverview).isInvalidated, false);
});
