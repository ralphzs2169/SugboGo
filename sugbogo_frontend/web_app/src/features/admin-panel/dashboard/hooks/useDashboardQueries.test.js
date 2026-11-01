import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import toast from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { dashboardFixture } from "../tests/dashboardFixtures.js";

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
let auth;
let presentation;
let analyticsKeys;
const originalToastError = toast.error;
const originalEvent = globalThis.Event;
const originalCustomEvent = globalThis.CustomEvent;

const resources = [
  [
    "summary",
    "useDashboardSummary",
    "/admin/dashboard/",
    "Administrative Queues",
  ],
  [
    "recentDecisions",
    "useDashboardRecentDecisions",
    "/admin/dashboard/recent-decisions/",
    "Recent Administrative Decisions",
  ],
  [
    "platformOverview",
    "useDashboardPlatformOverview",
    "/admin/dashboard/platform-overview/",
    "Platform Activity Trend",
  ],
  [
    "priorityWorklist",
    "useDashboardPriorityWorklist",
    "/admin/dashboard/priority-worklist/",
    "Priority Worklist",
  ],
];
const mutationPaths = {
  applicationApproval:
    "business-applications/hooks/useApproveBusinessApplication.js",
  applicationRejection:
    "business-applications/hooks/useRejectBusinessApplication.js",
  businessName:
    "business-update-requests/hooks/useBusinessUpdateRequestDecisions.js",
  classification:
    "business-update-requests/hooks/useClassificationUpdateRequestDecisions.js",
  location:
    "business-update-requests/hooks/useLocationUpdateRequestDecisions.js",
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
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    ssr: { noExternal: ["recharts"] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [
      {
        name: "dashboard-data-layer-fixtures",
        enforce: "pre",
        resolveId(source) {
          if (source === "recharts") return "\0dashboard-recharts";
        },
        load(id) {
          if (id === "\0dashboard-recharts") {
            return `import React from 'react';
            export const ResponsiveContainer = ({children}) => React.createElement('div', null, children);
            export const BarChart = ({data, children}) => React.createElement('div', {'data-chart-kind':'bar','data-chart':JSON.stringify(data)}, children);
            export const LineChart = ({data,children}) => React.createElement('div', {'data-chart-kind':'line','data-chart':JSON.stringify(data)},children);
            export const Line = ({dataKey,strokeDasharray}) => React.createElement('span',{'data-line':dataKey,'data-dash':strokeDasharray});
            export const CartesianGrid = () => null;
            export const Tooltip = () => null;
            export const PieChart = ({children}) => React.createElement('div', null, children);
            export const Pie = ({data, children}) => React.createElement('div', {'data-chart-kind':'pie','data-chart':JSON.stringify(data)}, children);
            export const Bar = ({children}) => React.createElement('div', null, children);
            export const XAxis = () => null;
            export const YAxis = () => null;
            export const Cell = () => null;`;
          }
          const path = id.replaceAll("\\", "/");
          if (path.endsWith("/shared/api/apiClient.js")) {
            return `export default {
            get: (...args) => globalThis.__dashboardRead(...args),
            post: (...args) => globalThis.__dashboardPost(...args),
          };`;
          }
          if (
            path.endsWith(
              "/reported-reviews/components/ReportedReviewDetail.jsx",
            )
          ) {
            return `import React from 'react'; export default function Detail({onDecision}) {
            return React.createElement('button', {onClick: () => onDecision({id: 12, status: 'published'}, 'keep')}, 'Keep review');
          }`;
          }
          if (
            path.endsWith("/reported-reviews/components/DecisionDialog.jsx")
          ) {
            return `import React from 'react'; export default function Dialog({target, onConfirm}) {
            return target ? React.createElement('button', {onClick: onConfirm}, 'Confirm reported decision') : null;
          }`;
          }
          if (
            path.endsWith("/reported-reviews/components/QueueItem.jsx") ||
            path.endsWith("/reported-reviews/components/QueueFilters.jsx")
          ) {
            return "export default function QueueFixture() { return null; }";
          }
        },
      },
    ],
  });
  const base = "/src/features/admin-panel/";
  hooks = await server.ssrLoadModule(
    `${base}dashboard/hooks/useDashboardQueries.js`,
  );
  ({ dashboardQueryKeys: keys } = await server.ssrLoadModule(
    `${base}dashboard/queries/dashboardQueryKeys.js`,
  ));
  ({ default: Page } = await server.ssrLoadModule(
    `${base}pages/Dashboard.jsx`,
  ));
  ({ useAuthStore: auth } = await server.ssrLoadModule(
    "/src/features/auth/storage/auth.store.js",
  ));
  presentation = await server.ssrLoadModule(
    `${base}dashboard/utils/dashboardPresentation.js`,
  );
  ({ analyticsQueryKeys: analyticsKeys } = await server.ssrLoadModule(
    `${base}analytics/queries/analyticsQueryKeys.js`,
  ));
  ({ default: ReportedWorkspace } = await server.ssrLoadModule(
    `${base}reported-reviews/components/ReportedReviewWorkspace.jsx`,
  ));
  mutations = {};
  for (const [name, path] of Object.entries(mutationPaths)) {
    ({ default: mutations[name] } = await server.ssrLoadModule(
      `${base}${path}`,
    ));
  }
});

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
    },
  });
  reads = [];
  posts = [];
  notifications = [];
  results = new Map();
  transport = async (url) => ({
    data: { data: { source: url, value: 0, ...dashboardFixture(url) } },
  });
  auth.getState().setUser({ role: "admin" });
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
  globalThis.Event = originalEvent;
  globalThis.CustomEvent = originalCustomEvent;
  await server?.close();
  dom.window.close();
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "MutationObserver",
    "getComputedStyle",
    "IS_REACT_ACT_ENVIRONMENT",
    "__dashboardRead",
    "__dashboardPost",
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
  await act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          MemoryRouter,
          { initialEntries: [route] },
          children,
        ),
      ),
    ),
  );
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
  const selectors = {
    summary: "article",
    priorityWorklist: "ul",
    platformOverview: '[role="group"]',
    recentDecisions: "ul",
  };
  return Boolean(section?.querySelector(selectors[resource]));
}

function loadedSectionCount() {
  return resources.filter(([resource]) => loadedContent(resource)).length;
}

test("all four hooks expose independent native query state and cancellation signals", async () => {
  await render(
    resources.map(([, name]) =>
      React.createElement(Probe, { key: name, name }),
    ),
  );
  await until(() =>
    resources.every(([, name]) => results.get(name)?.isSuccess),
  );
  assert.equal(reads.length, 4);
  for (const [, name, url] of resources) {
    const query = results.get(name);
    assert.equal(query.data.source, url);
    assert.equal(query.data.value, 0);
    assert.equal(query.error, null);
    assert.equal(query.isLoading, false);
    assert.equal(query.isFetching, false);
    assert.equal(typeof query.refetch, "function");
    assert.equal(
      reads.find((request) => request.url === url).signal.aborted,
      false,
    );
  }
});

test("disabled queries do not fetch and unmount aborts active requests", async () => {
  await render(
    React.createElement(Probe, { name: "useDashboardSummary", enabled: false }),
  );
  assert.equal(reads.length, 0);
  transport = () => new Promise(() => {});
  await render(
    resources.map(([, name]) =>
      React.createElement(Probe, { key: name, name }),
    ),
  );
  await until(() => reads.length === 4);
  const signals = reads.map((request) => request.signal);
  await render(null);
  assert.equal(
    signals.every((signal) => signal.aborted),
    true,
  );
});

for (const [resource, , failingUrl, label] of resources) {
  test(`${resource} page failure remains isolated and Retry refetches only that source`, async () => {
    let failing = true;
    transport = async (url) => {
      if (url === failingUrl && failing) throw new Error(`Failed ${resource}`);
      return { data: { data: dashboardFixture(url) } };
    };
    await render(React.createElement(Page));
    const section = () =>
      container.querySelector(`section[aria-label="${label}"]`);
    await until(
      () =>
        section()?.querySelector('[role="alert"]') &&
        loadedSectionCount() === 3,
    );
    assert.equal(container.querySelector("h1").textContent, "Dashboard");
    assert.equal(loadedContent(resource), false);
    const notificationIds = notifications.map(([, options]) => options.id);
    const expectedId =
      resource === "summary"
        ? "admin-dashboard-summary-load-error"
        : resource === "recentDecisions"
          ? "admin-dashboard-decisions-load-error"
          : resource === "priorityWorklist"
            ? "admin-dashboard-priority-worklist-load-error"
            : "admin-dashboard-platform-overview-load-error";
    assert.ok(notificationIds.includes(expectedId));
    failing = false;
    const previousReads = reads.length;
    await act(async () =>
      section().querySelector('[role="alert"] button').click(),
    );
    await until(() => loadedSectionCount() === 4);
    assert.equal(reads.length, previousReads + 1);
    assert.equal(reads.at(-1).url, failingUrl);
  });
}

test("page header stays visible during four independent initial loads", async () => {
  transport = () => new Promise(() => {});
  await render(React.createElement(Page));
  assert.equal(container.querySelector("h1").textContent, "Dashboard");
  for (const [, , , label] of resources) {
    assert.ok(
      container.querySelector(`section[aria-label="${label}"] [role="status"]`),
    );
  }
  assert.equal(loadedSectionCount(), 0);
  assert.equal(container.querySelector("time"), null);
});

test("top sections retain formatted KPI values and explicit measurement scopes", async () => {
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (url === "/admin/dashboard/platform-overview/") {
      data.activity.applications_submitted = 12345;
      data.activity.reviews_published = 0;
    }
    return { data: { data } };
  };
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const overview = container.querySelector(
    'section[aria-label="Platform Overview"]',
  );
  for (const [label, count, scope] of [
    ["Applications Submitted", "12,345", "Last 7 days"],
    ["Active Businesses", "137", "Current count"],
    ["Reviews Published", "0", "Last 7 days"],
    ["Vouches Created", "47", "Last 7 days"],
  ]) {
    const card = overview.querySelector(`section[aria-label="${label}"]`);
    assert.equal(card.querySelector("h3").textContent, label);
    assert.ok(card.querySelector(".bg-metric-header.border-b"));
    assert.ok(
      [...card.querySelectorAll("div")].some(
        (node) => node.textContent === count,
      ),
    );
    assert.equal(card.querySelector("p").textContent, scope);
  }
  assert.match(
    overview.querySelector(".grid").className,
    /sm:grid-cols-2 xl:grid-cols-4/,
  );
});

test("top sections queue semantics, links and focus targets stay accurate", async () => {
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const queues = container.querySelector(
    'section[aria-label="Administrative Queues"]',
  );
  assert.match(
    queues.textContent,
    /Open review workflows and pending cases. Categories may overlap./,
  );
  const cards = [...queues.querySelectorAll("article")];
  const destinations = [
    "/admin-panel/businesses/applications?status=submitted",
    "/admin-panel/businesses/update-requests?type=all&status=pending",
    "/admin-panel/moderation-integrity?tab=under-review",
    "/admin-panel/moderation-integrity?tab=reported",
    "/admin-panel/moderation-integrity?tab=disputes",
  ];
  assert.equal(cards.length, 5);
  for (const [index, card] of cards.entries()) {
    const link = card.querySelector("h3 a");
    assert.equal(link.getAttribute("href"), destinations[index]);
    assert.equal(link.querySelector("a, button"), null);
    assert.ok(link.getAttribute("aria-label").includes("Open queue"));
    assert.match(link.className, /focus-visible:after:outline-2/);
    assert.match(card.className, /cursor-pointer/);
    link.focus();
    assert.equal(document.activeElement, link);
  }
  for (const link of queues.querySelectorAll("a")) {
    assert.match(link.className, /cursor-pointer/);
    assert.match(link.className, /focus-visible:/);
  }
  assert.match(cards[0].className, /border-danger\/40/);
  const overdue = cards[0].querySelector(
    'a[aria-label="5 overdue applications"]',
  );
  assert.match(overdue.className, /bg-danger\/15/);
  assert.equal(
    overdue.getAttribute("href"),
    `${destinations[0]}&queue_status=overdue`,
  );
  const approaching = cards[0].querySelector(
    'a[aria-label="4 applications approaching deadline"]',
  );
  assert.match(approaching.className, /bg-warning\/15/);
  assert.equal(
    approaching.getAttribute("href"),
    `${destinations[0]}&queue_status=approaching`,
  );
  for (const type of ["business_name", "classification", "location"]) {
    assert.ok(
      cards[1].querySelector(
        `a[href="/admin-panel/businesses/update-requests?type=${type}&status=pending"]`,
      ),
    );
  }
  assert.match(cards[2].textContent, /Includes automated processing/);
  assert.match(cards[3].textContent, /Distinct reviewsWith pending reports/);
  assert.doesNotMatch(cards[3].textContent, /Counted by distinct case/);
  assert.equal(cards[4].querySelector('[class*="bg-success"]'), null);
  assert.match(
    queues.querySelector(".grid").className,
    /sm:grid-cols-2 xl:grid-cols-5/,
  );
  for (const card of cards) {
    assert.ok(card.querySelector('[class*="flex-wrap"]'));
  }
});

test("top sections zero aging stays neutral while unknown aging remains separate", async () => {
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (url === "/admin/dashboard/") {
      data.applications.aging = {
        on_time: 15,
        approaching: 0,
        overdue: 0,
        unknown_age: 2,
      };
    }
    return { data: { data } };
  };
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const application = container.querySelector(
    'section[aria-label="Administrative Queues"] article',
  );
  assert.doesNotMatch(application.className, /border-danger/);
  for (const label of [
    "0 overdue applications",
    "0 applications approaching deadline",
  ]) {
    const chip = application.querySelector(`a[aria-label="${label}"]`);
    assert.match(chip.className, /bg-neutral\/10/);
    assert.doesNotMatch(chip.className, /bg-danger|bg-warning|opacity-60/);
  }
  assert.match(application.textContent, /2 age unavailable/);
});

test("top sections freshness identifies independent source updates, not decision times", async () => {
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (url === "/admin/dashboard/platform-overview/") {
      data.as_of = "2026-11-01T05:00:00Z";
    }
    if (url === "/admin/dashboard/recent-decisions/") {
      data.items[0].timestamp = "2026-11-01T06:00:00Z";
    }
    return { data: { data } };
  };
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const freshness = container.querySelector(
    'time[datetime="2026-11-01T05:00:00Z"]',
  ).parentElement;
  assert.match(freshness.textContent, /Latest source update/);
  assert.match(freshness.textContent, /Manila/);
  assert.match(freshness.textContent, /Sections refresh independently./);
  assert.equal(
    presentation.latestDashboardTimestamp(undefined, "invalid", null),
    undefined,
  );
});

for (const [resource, label] of [
  ["summary", "Administrative Queues"],
  ["priorityWorklist", "Priority Worklist"],
]) {
  test(`${resource} background refresh and failure preserve loaded section content`, async () => {
    await render(React.createElement(Page));
    await until(() => loadedSectionCount() === 4);
    let reject;
    transport = () =>
      new Promise((resolveRequest, rejectRequest) => {
        reject = rejectRequest;
      });
    let refresh;
    await act(async () => {
      refresh = client.refetchQueries({
        queryKey: keys[resource],
        exact: true,
      });
    });
    await until(() =>
      container.textContent.includes(`Refreshing ${label.toLowerCase()}`),
    );
    assert.equal(loadedContent(resource), true);
    await act(async () => {
      reject(new Error("Refresh failed"));
      await refresh;
    });
    await until(() =>
      container.textContent.includes("Previously loaded data remains visible"),
    );
    assert.equal(loadedSectionCount(), 4);
    assert.equal(loadedContent(resource), true);
  });
}

test("real query values populate attention, activity, inventory, decisions and both charts", async () => {
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const attention = container.querySelector(
    'section[aria-label="Administrative Queues"]',
  );
  for (const value of ["17", "19", "23", "29", "31"]) {
    assert.ok(
      [...attention.querySelectorAll("article")].some((card) =>
        card.textContent.includes(value),
      ),
    );
  }
  assert.match(attention.textContent, /4\s*approaching/);
  assert.match(attention.textContent, /5\s*overdue/);
  assert.match(attention.textContent, /3\s*Name/);
  assert.match(attention.textContent, /7\s*Classification/);
  assert.match(attention.textContent, /9\s*Location/);
  assert.equal(
    container
      .querySelector('a[aria-label^="Applications:"]')
      .getAttribute("href"),
    "/admin-panel/businesses/applications?status=submitted",
  );
  assert.match(
    container.querySelector('section[aria-label="Active businesses"]')
      .textContent,
    /137/,
  );
  const activity = container.querySelector(
    'section[aria-label="Platform Activity Trend"]',
  );
  const overview = container.querySelector(
    'section[aria-label="Platform Overview"]',
  );
  for (const [label, value] of [
    ["Applications Submitted", "41"],
    ["Active Businesses", "137"],
    ["Reviews Published", "43"],
    ["Vouches Created", "47"],
  ]) {
    assert.match(
      overview.querySelector('section[aria-label="' + label + '"]').textContent,
      new RegExp(value),
    );
  }
  assert.match(overview.textContent, /Current count/);
  assert.match(overview.textContent, /Last 7 days/);
  assert.match(activity.textContent, /PHT · Today is partial/);
  assert.ok(
    activity.querySelector(
      'button[aria-label="About Platform Activity Trend"]',
    ),
  );
  const bars = JSON.parse(
    container.querySelector('[data-chart-kind="bar"]').dataset.chart,
  );
  assert.deepEqual(
    bars.map(({ key, count }) => ({ key, count })),
    [
      { key: "on_time", count: 6 },
      { key: "approaching", count: 4 },
      { key: "overdue", count: 5 },
    ],
  );
  assert.match(
    container.querySelector('section[aria-label="Application Review Aging"]')
      .textContent,
    /2 submissions have unavailable aging data/,
  );
  const roles = JSON.parse(
    container.querySelector('[data-chart-kind="pie"]').dataset.chart,
  );
  assert.deepEqual(
    roles.map(({ count }) => count),
    [53, 59, 2, 1, 3],
  );
  const distribution = container.querySelector(
    'section[aria-label="User Distribution"]',
  );
  assert.match(distribution.textContent, /Registered accounts118/);
  assert.match(distribution.textContent, /Unknown role3/);
  assert.match(distribution.textContent, /All account statuses included/);
  assert.ok(
    container.querySelector('a[href="/admin-panel/business/application/12"]'),
  );
  assert.ok(
    container.querySelector(
      'a[href="/admin-panel/moderation-integrity?tab=reported&reported_id=18"]',
    ),
  );
  assert.match(container.textContent, /Fixture administrator/);
  assert.ok(container.querySelector('time[datetime="2026-11-01T04:01:00Z"]'));
  assert.doesNotMatch(
    container.textContent,
    /12,482|Under-Discovered|Top Trending|Suspicious Activity|HIGH|vs last week|Priority worklist data is ready/,
  );
  for (const link of container.querySelectorAll("a")) {
    assert.match(link.className, /cursor-pointer/);
    assert.match(link.className, /focus-visible:/);
  }
});

test("seven-day trend preserves server rows and lets the keyboard legend isolate any scale", async () => {
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const chart = () => container.querySelector('[data-chart-kind="line"]');
  assert.deepEqual(
    JSON.parse(chart().dataset.chart).map((row) => ({
      date: row.date,
      applications_submitted: row.applications_submitted,
      reviews_published: row.reviews_published,
      vouches_created: row.vouches_created,
    })),
    dashboardFixture("/admin/dashboard/platform-overview/").activity.daily,
  );
  assert.equal(container.querySelectorAll("[data-line]").length, 3);
  const section = container.querySelector(
    'section[aria-label="Platform Activity Trend"]',
  );
  assert.equal(section.querySelectorAll("tbody tr").length, 0);
  const button = [...section.querySelectorAll("button")].find((item) =>
    item.textContent.includes("Vouches created"),
  );
  await act(async () => button.click());
  assert.deepEqual(
    [...container.querySelectorAll("[data-line]")].map(
      (line) => line.dataset.line,
    ),
    ["vouches_created"],
  );
  assert.equal(button.getAttribute("aria-pressed"), "true");
  await act(async () => button.click());
  assert.equal(container.querySelectorAll("[data-line]").length, 3);
  assert.match(section.textContent, /Today is partial/);
  assert.match(section.textContent, /same count axis/);
  const viewData = [...section.querySelectorAll("button")].find((item) =>
    item.textContent.includes("View data"),
  );
  await act(async () => viewData.click());
  assert.ok(document.querySelector("dialog[open]"));
  assert.equal(document.querySelectorAll("dialog[open] tbody tr").length, 7);
  assert.equal(
    container
      .querySelector(
        'a[href="/admin-panel/businesses/applications?status=submitted"]',
      )
      .textContent.includes("View applications"),
    false,
  );
});

test("trend title information and View data use the shared Analytics methodology and exact-data drawers", async () => {
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const section = container.querySelector(
    'section[aria-label="Platform Activity Trend"]',
  );
  assert.equal(section.querySelector("details"), null);
  const about = section.querySelector(
    'button[aria-label="About Platform Activity Trend"]',
  );
  about.focus();
  await act(async () => about.click());
  let dialog = document.querySelector("dialog[open]");
  assert.ok(dialog);
  assert.match(dialog.textContent, /About Platform Activity Trend/);
  assert.match(dialog.textContent, /Persisted first publications/);
  assert.match(dialog.textContent, /Retained latest submissions/);
  await act(async () =>
    dialog
      .querySelector(
        'button[aria-label="Close Platform Activity Trend details"]',
      )
      .click(),
  );
  assert.equal(document.querySelector("dialog[open]"), null);
  assert.equal(document.activeElement, about);
  const data = [...section.querySelectorAll("button")].find((button) =>
    button.textContent.includes("View data"),
  );
  await act(async () => data.click());
  dialog = document.querySelector("dialog[open]");
  assert.match(dialog.textContent, /Platform Activity Trend — Exact Data/);
  assert.equal(dialog.querySelectorAll("tbody tr").length, 7);
  assert.match(dialog.textContent, /2026-10-26/);
  assert.match(dialog.textContent, /Today is partial/);
});

test("Dashboard follows the agreed eight-section hierarchy and removes the mixed-worklist CTA", async () => {
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  assert.deepEqual(
    [...container.querySelectorAll("h2")].map((heading) => heading.textContent),
    [
      "Platform Overview",
      "Administrative Queues",
      "Platform Activity Trend",
      "User Distribution",
      "Priority Worklist",
      "Application Review Aging",
      "Recent Administrative Decisions",
      "Discovery Health",
    ],
  );
  const worklist = container.querySelector(
    'section[aria-label="Priority Worklist"]',
  );
  assert.doesNotMatch(
    worklist.textContent,
    /View applications|View all queues/,
  );
  assert.equal(worklist.querySelectorAll("li > a").length, 2);
  assert.match(
    container.querySelector('section[aria-label="Discovery Health"]')
      .textContent,
    /does not confirm a currently failing process/,
  );
});

test("malformed daily data has targeted Retry while valid KPI counts remain visible", async () => {
  let invalid = true;
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (url === "/admin/dashboard/platform-overview/" && invalid)
      data.activity.daily = data.activity.daily.slice(1);
    return { data: { data } };
  };
  await render(React.createElement(Page));
  const trend = () =>
    container.querySelector('section[aria-label="Platform Activity Trend"]');
  await until(
    () =>
      trend()?.querySelector('[role="alert"]') && loadedSectionCount() === 4,
  );
  assert.match(
    container.querySelector('section[aria-label="Applications Submitted"]')
      .textContent,
    /41/,
  );
  assert.equal(trend().querySelector('[data-chart-kind="line"]'), null);
  const readsBefore = reads.length;
  invalid = false;
  await act(async () => trend().querySelector('[role="alert"] button').click());
  await until(() => trend().querySelector('[data-chart-kind="line"]'));
  assert.equal(reads.length, readsBefore + 1);
  assert.equal(reads.at(-1).url, "/admin/dashboard/platform-overview/");
});

test("all work-item types and decision entity types map to actual workflow routes", () => {
  const routes = {
    merchant_application: "/admin-panel/business/application/12",
    business_name_change: "/admin-panel/businesses/update-requests/12",
    classification_change:
      "/admin-panel/businesses/update-requests/classification/12",
    location_change: "/admin-panel/businesses/update-requests/location/12",
    under_review:
      "/admin-panel/moderation-integrity?tab=under-review&under_review_id=12",
    reported_review:
      "/admin-panel/moderation-integrity?tab=reported&reported_id=12",
    review_dispute: "/admin-panel/review-disputes/12",
  };
  for (const [type, destination] of Object.entries(routes)) {
    assert.equal(presentation.workItemDestination(type, 12), destination);
  }
  for (const status of ["on_time", "approaching", "overdue", "unknown_age"]) {
    const label = presentation.workItemStatus({
      type: "merchant_application",
      application_aging: { status },
    });
    assert.equal(
      label,
      {
        on_time: "On time",
        approaching: "Approaching",
        overdue: "Overdue",
        unknown_age: "Aging unavailable",
      }[status],
    );
  }
  assert.equal(presentation.workItemDestination("unsupported", 12), null);
  assert.equal(
    presentation.workItemDestination("merchant_application", null),
    null,
  );
  const entities = {
    merchant_application: routes.merchant_application,
    business_name_change_request: routes.business_name_change,
    business_classification_change_request: routes.classification_change,
    business_location_change_request: routes.location_change,
    review_dispute: routes.review_dispute,
    user: "/admin-panel/users/12",
    review: routes.under_review,
  };
  for (const [type, destination] of Object.entries(entities)) {
    assert.equal(
      presentation.decisionDestination({
        entity: { type, id: 12 },
        action: "review_moderation_approved",
      }),
      destination,
    );
  }
  assert.equal(
    presentation.decisionDestination({
      entity: { type: "review", id: 12 },
      action: "reported_review_kept",
    }),
    routes.reported_review,
  );
  assert.equal(
    presentation.decisionDestination({
      entity: { type: "user", id: null },
      action: "user_suspended",
    }),
    null,
  );
});

test("unknown ages stay nonurgent and missing decision targets remain safe plain text", async () => {
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (url.endsWith("/priority-worklist/")) {
      data.items[0].application_aging = {
        status: "unknown_age",
        business_days: null,
      };
      data.items[0].priority = "pending";
      data.items[0].timestamp = null;
      data.items[0].entity.label = "Application unavailable";
    }
    if (url.endsWith("/recent-decisions/")) {
      data.items[0].entity = {
        type: "user",
        id: null,
        label: "User unavailable",
      };
      data.items[0].administrator_name = "Administrator unavailable";
      data.items[0].context = { fingerprint: "PRIVATE_FINGERPRINT" };
      data.items[0].administrator_email = "private-admin@example.test";
    }
    return { data: { data } };
  };
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const worklist = container.querySelector(
    'section[aria-label="Priority Worklist"]',
  );
  assert.match(worklist.textContent, /Aging unavailable/);
  assert.match(worklist.textContent, /Queue time unavailable/);
  assert.doesNotMatch(worklist.textContent, /Overdue/);
  const decisions = container.querySelector(
    'section[aria-label="Recent Administrative Decisions"]',
  );
  assert.match(decisions.textContent, /User unavailable/);
  assert.match(decisions.textContent, /Administrator unavailable/);
  assert.equal(decisions.querySelector("a"), null);
  assert.doesNotMatch(
    container.textContent,
    /PRIVATE_FINGERPRINT|private-admin@example.test/,
  );
});

test("worklist renders request types and separate review workflows in returned order", async () => {
  const types = [
    "business_name_change",
    "classification_change",
    "location_change",
    "under_review",
    "review_dispute",
  ];
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (url.endsWith("/priority-worklist/")) {
      data.items = types.map((type, index) => ({
        id: `${type}:${index + 1}`,
        type,
        title: "Pending workflow",
        entity: { id: index + 1, label: `Workflow ${index + 1}` },
        status: type === "under_review" ? "under_review" : "pending",
        priority: "pending",
        timestamp: "2026-10-30T02:00:00Z",
        application_aging: null,
        pending_report_count: null,
      }));
    }
    return { data: { data } };
  };
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const rows = [
    ...container.querySelectorAll('section[aria-label="Priority Worklist"] li'),
  ];
  assert.equal(rows.length, 5);
  for (const [index, row] of rows.entries()) {
    assert.match(row.textContent, new RegExp(`Workflow ${index + 1}`));
    assert.equal(
      row.querySelector("a").getAttribute("href"),
      presentation.workItemDestination(types[index], index + 1),
    );
  }
  assert.match(rows[3].textContent, /Under review/);
  assert.doesNotMatch(rows[3].textContent, /manual/i);
});

test("empty queues and zero inventories remain valid without fabricated chart segments", async () => {
  transport = async (url) => {
    const data = dashboardFixture(url);
    if (data.items) data.items = [];
    if (data.applications) {
      data.applications.aging = {
        on_time: 0,
        approaching: 0,
        overdue: 0,
        unknown_age: 0,
      };
      data.active_businesses = 0;
    }
    if (data.user_distribution) {
      for (const key of [
        "total",
        "explorer",
        "merchant",
        "admin",
        "super_admin",
        "unknown_role",
      ]) {
        data.user_distribution[key] = 0;
      }
      data.activity.applications_submitted = 0;
      data.activity.reviews_published = 0;
      data.activity.vouches_created = 0;
      data.activity.daily = data.activity.daily.map((row) => ({
        ...row,
        applications_submitted: 0,
        reviews_published: 0,
        vouches_created: 0,
      }));
    }
    return { data: { data } };
  };
  await render(React.createElement(Page));
  await until(() =>
    container.textContent.includes("No recorded administrative decisions yet."),
  );
  assert.match(
    container.textContent,
    /No pending work. Your queues are clear./,
  );
  assert.match(container.textContent, /No registered accounts./);
  assert.match(container.textContent, /No submissions with known aging./);
  assert.doesNotMatch(
    container.textContent,
    /submissions have unavailable aging data/,
  );
  assert.equal(
    container.querySelector('[data-chart-kind="bar"], [data-chart-kind="pie"]'),
    null,
  );
  assert.match(
    container.textContent,
    /No recorded platform activity in this window/,
  );
  assert.match(
    container.querySelector('section[aria-label="Active businesses"]')
      .textContent,
    /0/,
  );
  assert.ok(
    [
      ...container.querySelectorAll(
        'section[aria-label="Platform Activity Trend"] td',
      ),
    ].every((cell) => cell.textContent === "0"),
  );
});

test("missing metric fields display unavailable instead of zero", async () => {
  transport = async (url) => ({
    data: {
      data:
        url === "/admin/dashboard/platform-overview/"
          ? {}
          : dashboardFixture(url),
    },
  });
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  const activity = container.querySelector(
    'section[aria-label="Platform Activity Trend"]',
  );
  assert.match(activity.textContent, /Daily activity is unavailable/);
  assert.match(
    container.querySelector('section[aria-label="Applications Submitted"]')
      .textContent,
    /Unavailable/,
  );
  assert.match(activity.textContent, /Activity window unavailable/);
});

test("Analytics CTA follows existing navigation roles and score coverage reuses its canonical cache", async () => {
  const scoreKey = analyticsKeys.discoveryScores({ page_size: 1 });
  client.setQueryData(scoreKey, { coverage: { failed: 7 } });
  await render(React.createElement(Page));
  await until(() => loadedSectionCount() === 4);
  assert.equal(
    reads.some(({ url }) => url === "/admin/analytics/discovery-scores/"),
    false,
  );
  assert.match(
    container.querySelector(
      'section[aria-label="Recorded score error markers"]',
    ).textContent,
    /7/,
  );
  assert.equal(
    container.querySelector('a[href="/admin-panel/analytics"]'),
    null,
  );
  await act(async () => auth.getState().setUser({ role: "super_admin" }));
  assert.match(
    container.querySelector('a[href="/admin-panel/analytics"]').textContent,
    /Explore detailed Analytics/,
  );
});

test("Discovery health failure leaves active business inventory visible and retries only its source", async () => {
  let failing = true;
  transport = async (url) => {
    if (failing && url === "/admin/analytics/discovery-scores/")
      throw new Error("Score health unavailable");
    return { data: { data: dashboardFixture(url) } };
  };
  await render(React.createElement(Page));
  const section = () =>
    container.querySelector(
      'section[aria-label="Recorded score error markers"]',
    );
  await until(
    () =>
      section()?.querySelector('[role="alert"]') && loadedSectionCount() === 4,
  );
  assert.match(
    container.querySelector('section[aria-label="Active businesses"]')
      .textContent,
    /137/,
  );
  assert.ok(
    notifications.some(
      ([, options]) =>
        options.id === "admin-dashboard-discovery-health-load-error",
    ),
  );
  const previousReads = reads.length;
  failing = false;
  await act(async () => section().querySelector("button").click());
  await until(() =>
    section().textContent.includes("recorded score error marker"),
  );
  assert.equal(reads.length, previousReads + 1);
  assert.equal(reads.at(-1).url, "/admin/analytics/discovery-scores/");
});

const queueKeys = ["summary", "recentDecisions", "priorityWorklist"];
const mutationCases = [
  [
    "applicationApproval",
    "approveApplication",
    [12, 8],
    [...queueKeys, "platformOverview"],
  ],
  [
    "applicationRejection",
    "rejectApplication",
    [12, { reason: "Reason" }],
    queueKeys,
  ],
  ["businessName", "approve", 12, queueKeys],
  [
    "businessName",
    "reject",
    { requestId: 12, rejectionReason: "Reason" },
    queueKeys,
  ],
  ["classification", "approve", 12, queueKeys],
  [
    "classification",
    "reject",
    { requestId: 12, rejectionReason: "Reason" },
    queueKeys,
  ],
  ["location", "approve", 12, queueKeys],
  [
    "location",
    "reject",
    { requestId: 12, rejectionReason: "Reason" },
    queueKeys,
  ],
  ["moderation", "approve", 12, [...queueKeys, "platformOverview"]],
  [
    "moderation",
    "reject",
    { reviewId: 12, moderationNotes: "Reason" },
    queueKeys,
  ],
  ["disputes", "uphold", { disputeId: 12, data: {} }, queueKeys],
  ["disputes", "dismiss", { disputeId: 12, data: {} }, queueKeys],
  ["users", "suspend", { userId: 12, reason: "Reason" }, ["recentDecisions"]],
  ["users", "reactivate", { userId: 12 }, ["recentDecisions"]],
  [
    "createAdmin",
    "createAdmin",
    { email: "admin@example.com" },
    ["platformOverview"],
  ],
];

for (const [name, action, args, invalidated] of mutationCases) {
  test(`${name}.${action} invalidates only the appropriate Dashboard resources`, async () => {
    for (const [resource] of resources)
      client.setQueryData(keys[resource], { value: 1 });
    const analyticsKey = ["admin", "analytics", "sentinel"];
    client.setQueryData(analyticsKey, { value: 1 });
    await render(React.createElement(MutationProbe, { name }));
    const actionArgs = Array.isArray(args) ? args : [args];
    await act(async () => {
      await mutationResult[action](...actionArgs);
    });
    for (const [resource] of resources) {
      assert.equal(
        client.getQueryState(keys[resource]).isInvalidated,
        invalidated.includes(resource),
      );
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
    globalThis.__dashboardPost = async () => {
      throw failure;
    };
    for (const [resource] of resources) {
      client.setQueryData(keys[resource], { value: 1 });
    }
    await render(React.createElement(MutationProbe, { name }));
    const action =
      name === "applicationApproval"
        ? "approveApplication"
        : "rejectApplication";
    await act(async () => {
      await assert.rejects(
        mutationResult[action](12, 8),
        (error) => error === failure,
      );
    });
    assert.equal(mutationResult.error, failure);
    assert.equal(mutationResult.isSubmitting, false);
    for (const [resource] of resources) {
      assert.equal(client.getQueryState(keys[resource]).isInvalidated, false);
    }
  });
}

test("reported-review decision invalidates pending work and decisions without changing overview", async () => {
  for (const [resource] of resources)
    client.setQueryData(keys[resource], { value: 1 });
  transport = async () => ({
    data: { data: { items: [], pagination: { total_pages: 0 } } },
  });
  await render(
    React.createElement(ReportedWorkspace),
    "/admin-panel/moderation-integrity?tab=reported",
  );
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Keep review")
      .click();
  });
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent === "Confirm reported decision")
      .click();
  });
  await until(
    () =>
      posts.length === 1 && client.getQueryState(keys.summary).isInvalidated,
  );
  assert.equal(client.getQueryState(keys.recentDecisions).isInvalidated, true);
  assert.equal(client.getQueryState(keys.priorityWorklist).isInvalidated, true);
  assert.equal(
    client.getQueryState(keys.platformOverview).isInvalidated,
    false,
  );
});
