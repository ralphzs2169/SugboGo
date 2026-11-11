import toast from "react-hot-toast";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const queues = [
  {
    name: "Review Moderation",
    module: "under-review/components/UnderReviewWorkspace.jsx",
    endpoint: "/admin/under-review/",
    queryKey: ["admin", "under-review", "list"],
    sortLabel: "Sort review moderation",
    newestLabel: "Newest first",
  },
  {
    name: "Reported Reviews",
    module: "reported-reviews/components/ReportedReviewWorkspace.jsx",
    endpoint: "/admin/review-reports/reviews/",
    queryKey: ["admin", "reported-reviews", "list"],
    sortLabel: "Sort reported reviews",
    newestLabel: "Newest Report",
  },
];
const notificationSurfaces = [
  [
    "suspicious-reviews/components/SuspiciousReviewWorkspace.jsx",
    "suspicious-reviews-list",
    {}
  ],
  [
    "suspicious-vouches/components/SuspiciousVouchWorkspace.jsx",
    "suspicious-vouches-list",
    {}
  ],
  [
    "under-review/components/UnderReviewDetail.jsx",
    "under-review-detail",
    {
      "reviewId": 7
    }
  ],
  [
    "reported-reviews/components/ReportedReviewDetail.jsx",
    "reported-reviews-detail",
    {
      "reviewId": 7
    }
  ],
  [
    "suspicious-reviews/components/InvestigationDetail.jsx",
    "suspicious-reviews-detail",
    {
      "reviewId": 7
    }
  ],
  [
    "review-disputes/components/ReviewDisputeWorkspace.jsx",
    "review-disputes-list",
    {}
  ],
  [
    "review-disputes/components/DisputeInvestigation.jsx",
    "review-disputes-detail",
    {
      "disputeId": 7
    }
  ],
  [
    "moderation/components/ModerationMetrics.jsx",
    "moderation-metrics",
    {
      "tab": "under-review",
      "tabLabel": "Review Moderation"
    }
  ]
];
let dom;
let server;
let root;
let container;
let client;
let reads;
let transport;
let notifications;
let dismissed;

function pageData(page) {
  return {
    items: [{
      id: page,
      author: { id: 7, first_name: "Queue", last_name: "Explorer" },
      business: { id: 9, name: `Page ${page} business`, cover_photo_url: "/cover.webp" },
      text_preview: `Page ${page} review`,
      submitted_at: "2026-11-01T00:00:00Z",
      latest_pending_at: "2026-11-01T00:00:00Z",
      hold_reasons: [],
      reason_counts: {},
      pending_report_count: 1,
    }],
    pagination: {
      page,
      page_size: 10,
      total_pages: 2,
      total_items: 11,
      has_previous: page > 1,
      has_next: page < 2,
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
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: "moderation-pagination-test-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__moderationPaginationGet(...args) };";
        }
      },
    }],
  });
  for (const surface of notificationSurfaces) {
    ({ default: surface[3] } = await server.ssrLoadModule(`/src/features/admin-panel/${surface[0]}`));
  }
  for (const queue of queues) {
    ({ default: queue.Component } = await server.ssrLoadModule(
      `/src/features/admin-panel/${queue.module}`,
    ));
  }
});

beforeEach(async () => {
  notifications = [];
  dismissed = [];
  mock.method(toast, "error", (...args) => notifications.push(args));
  mock.method(toast, "dismiss", (id) => dismissed.push(id));
  reads = [];
  transport = async (params) => pageData(params.page);
  globalThis.__moderationPaginationGet = async (url, { params } = {}) => {
    assert.ok(queues.some((queue) => queue.endpoint === url), `Unexpected read: ${url}`);
    reads.push({ ...params });
    return { data: { data: await transport(params) } };
  };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});

afterEach(async () => {
  mock.restoreAll();
  await act(async () => root.unmount());
  client.clear();
  onlineManager.setOnline(true);
  container.remove();
});

after(async () => {
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "HTMLElement", "Element", "Node",
    "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT",
    "__moderationPaginationGet",
  ]) {
    delete globalThis[key];
  }
});

const button = (label) => [...container.querySelectorAll("button")].find(
  (item) => item.textContent === label,
);

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 20)));
  }
  assert.fail("Moderation queue did not reach the expected state");
}

async function renderQueue(queue, ready = true) {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, null, React.createElement(queue.Component)),
    ),
  ));
  if (ready) await until(() => button("Next") && !button("Next").disabled);
}

async function search(value) {
  const input = container.querySelector('input[type="search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await until(() => reads.at(-1)?.search === value && !button("Next")?.disabled);
}

function apiError(status, message) {
  return Object.assign(new Error(message), {
    response: {
      status,
      data: { success: false, code: status === 404 ? "NOT_FOUND" : "ERROR", message },
    },
  });
}

for (const queue of queues) {
  test(`${queue.name}: rapid paging respects boundaries and unlocks after fetching`, async () => {
    let finishPage;
    transport = (params) => params.page === 2
      ? new Promise((done) => { finishPage = done; })
      : Promise.resolve(pageData(params.page));
    await renderQueue(queue);
    assert.equal(button("Previous").disabled, true);

    const next = button("Next");
    await act(async () => {
      next.click();
      next.click();
      next.click();
    });
    await until(() => finishPage);
    assert.deepEqual(reads.map((params) => params.page), [1, 2]);
    assert.equal(button("Next").disabled, true);
    assert.equal(button("Previous").disabled, true);
    assert.match(container.textContent, /Loading page 2/);
    assert.doesNotMatch(container.textContent, /Page 1 review/);
    await act(async () => {
      button("Next").click();
      button("Previous").click();
      finishPage(pageData(2));
    });
    await until(() => button("Previous") && !button("Previous").disabled);
    assert.match(container.textContent, /Page 2 of 2/);
    assert.equal(button("Next").disabled, true);
    const previous = button("Previous");
    await act(async () => {
      previous.click();
      previous.click();
    });
    await until(() => button("Next") && !button("Next").disabled);
    assert.match(container.textContent, /Page 1 of 2/);
    assert.equal(button("Previous").disabled, true);
    assert.deepEqual(reads.map((params) => params.page), [1, 2, 1]);
  });

  test(`${queue.name}: paused placeholder data cannot authorize navigation`, async () => {
    await renderQueue(queue);
    onlineManager.setOnline(false);
    await act(async () => button("Next").click());
    const pending = client.getQueryCache().findAll({ queryKey: queue.queryKey }).find(
      (query) => query.queryKey.at(-1).page === 2,
    );
    assert.equal(pending.state.fetchStatus, "paused");
    assert.equal(button("Next").disabled, true);
    assert.equal(button("Previous").disabled, true);
    assert.match(container.textContent, /Loading page 2/);
    await act(async () => button("Next").click());
    assert.deepEqual(reads.map((params) => params.page), [1]);
    await act(async () => onlineManager.setOnline(true));
    await until(() => button("Previous") && !button("Previous").disabled);
    assert.deepEqual(reads.map((params) => params.page), [1, 2]);
  });

  test(`${queue.name}: an unavailable page recovers to page one with search and sorting intact`, async () => {
    await renderQueue(queue);
    await search("Cafe");
    await act(async () => container.querySelector(`[aria-label^="${queue.sortLabel}:"]`).click());
    await act(async () => button(queue.newestLabel).click());
    await until(() => reads.at(-1)?.ordering === "newest" && !button("Next")?.disabled);
    await act(async () => button("Next").click());
    await until(() => button("Previous") && !button("Previous").disabled);
    transport = async (params) => {
      if (params.page === 2) throw apiError(404, "Invalid page.");
      return pageData(1);
    };
    await act(async () => client.invalidateQueries({ queryKey: queue.queryKey }));
    await until(() => button("Return to first page"));
    assert.match(container.textContent, /This page is no longer available/);
    assert.equal(button("Try Again"), undefined);
    const unavailableReads = reads.filter((params) => params.page === 2).length;
    await act(async () => button("Return to first page").click());
    await until(() => button("Next") && !button("Next").disabled);
    assert.equal(reads.at(-1).page, 1);
    assert.equal(reads.at(-1).search, "Cafe");
    assert.equal(reads.at(-1).ordering, "newest");
    assert.equal(reads.at(-1).page_size, 10);
    assert.equal(reads.filter((params) => params.page === 2).length, unavailableReads);

    await act(async () => button("Next").click());
    await until(() => button("Return to first page"));
    await search("Bakery");
    assert.equal(reads.at(-1).page, 1);
    assert.equal(reads.at(-1).ordering, "newest");
  });

  for (const failure of [
    { status: 500, message: "Server unavailable." },
    { status: 404, message: "Resource not found." },
  ]) {
    test(`${queue.name}: ${failure.status} ordinary errors retry the requested page`, async () => {
      await renderQueue(queue);
      transport = async () => { throw apiError(failure.status, failure.message); };
      await act(async () => button("Next").click());
      await until(() => button("Try Again"));
      assert.ok(container.querySelector('[role="alert"]'));
      const toastId = queue.name === "Review Moderation"
        ? "admin-under-review-list-load-error"
        : "admin-reported-reviews-list-load-error";
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0][0], failure.message);
      assert.equal(notifications[0][1].id, toastId);
      await renderQueue(queue, false);
      assert.equal(notifications.length, 1);
      assert.equal(button("Return to first page"), undefined);
      transport = async (params) => pageData(params.page);
      await act(async () => button("Try Again").click());
      await until(() => button("Previous") && !button("Previous").disabled);
      assert.equal(reads.at(-1).page, 2);
      assert.match(container.textContent, /Page 2 of 2/);
      assert.ok(dismissed.includes(toastId));
    });
  }
}

for (const surface of notificationSurfaces) {
  test(surface[1] + ": one notification per query failure survives rerenders and retries", async () => {
    let count = 0;
    globalThis.__moderationPaginationGet = async () => {
      count += 1;
      throw apiError(500, "Section unavailable.");
    };
    const mount = () => root.render(React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, null, React.createElement(surface[3], surface[2]))));
    await act(async () => mount());
    await until(() => notifications.length > 0);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0][1].id, "admin-" + surface[1] + "-load-error");
    assert.equal(notifications[0][0], "Section unavailable.");
    assert.ok(container.querySelector('[role="alert"]'));
    await act(async () => mount());
    assert.equal(notifications.length, 1);
    assert.equal(count, 1);
    await act(async () => button("Try Again").click());
    await until(() => count === 2);
    assert.equal(notifications.every((entry) => entry[1].id === notifications[0][1].id), true);
  });
}
