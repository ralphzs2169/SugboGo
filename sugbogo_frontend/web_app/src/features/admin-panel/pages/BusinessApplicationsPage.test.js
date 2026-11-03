import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let Page;
let createRoot;
let root;
let container;
let failure;
let pending;
let approaching;
let overdue;
let oldest;
let reads;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "application-statistics-fixture",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__statisticsTransport(...args) };";
        }
        if (path.endsWith("/BusinessApplicationManagementTable.jsx")) {
          return "export default function Table({ tableState }) { globalThis.__applicationTableState = tableState; return null; }";
        }
      },
    }],
  });
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/BusinessApplicationsPage.jsx",
  ));
});

beforeEach(() => {
  mock.method(console, "error", () => {});
  failure = false;
  pending = 0;
  approaching = 0;
  overdue = 0;
  oldest = null;
  reads = [];
  globalThis.__statisticsTransport = async (url) => {
    reads.push(url);
    assert.equal(url, "/admin/businesses/applications/statistics/");
    if (failure) throw new Error("Statistics unavailable");
    return { data: { data: {
      pending_review: pending,
      approaching_sla: approaching,
      overdue,
      oldest_pending_business_days: oldest,
      approved: 0,
      rejected: 0,
      total_applications: pending,
      review_sla_business_days: 5,
      review_sla_approaching_business_days: 3,
    } } };
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mock.restoreAll();
});

after(async () => {
  await server?.close();
  dom.window.close();
  delete globalThis.__statisticsTransport;
  delete globalThis.__applicationTableState;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderPage() {
  await act(async () => root.render(
    React.createElement(MemoryRouter, null, React.createElement(Page)),
  ));
}

function metricCard(title) {
  return [...container.querySelectorAll("h3")]
    .find((heading) => heading.textContent === title)?.closest(".relative.flex");
}

function pendingCard() {
  return metricCard("Pending Review");
}

test("a successful measured zero remains visible as zero", async () => {
  await renderPage();
  assert.ok(pendingCard());
  assert.match(pendingCard().textContent, /Pending Review0/);
  assert.match(metricCard("Approaching SLA").textContent, /Approaching SLA0/);
  assert.match(metricCard("Overdue").textContent, /Overdue0/);
  assert.match(metricCard("Oldest Pending").textContent, /Oldest Pending—/);
  assert.doesNotMatch(container.textContent, /Unable to load application statistics/);
});

test("an initial failure displays a persistent error instead of a pending zero", async () => {
  failure = true;
  await renderPage();
  assert.match(container.textContent, /Unable to load application statistics/);
  assert.equal(pendingCard(), undefined);
  assert.ok([...container.querySelectorAll("button")].some((item) => item.textContent === "Try Again"));
});

test("section Retry recovers values through the existing statistics hook", async () => {
  failure = true;
  await renderPage();
  failure = false;
  pending = 7;
  const retry = [...container.querySelectorAll("button")].find((item) => item.textContent === "Try Again");
  await act(async () => retry.click());
  assert.equal(reads.length, 2);
  assert.doesNotMatch(container.textContent, /Unable to load application statistics/);
  assert.match(pendingCard().textContent, /Pending Review7/);
});

test("four operational cards show backend values without historical indicators", async () => {
  pending = 9;
  approaching = 3;
  overdue = 2;
  oldest = 8;
  await renderPage();

  assert.deepEqual(
    [...container.querySelectorAll("h3")].map((heading) => heading.textContent),
    ["Pending Review", "Approaching SLA", "Overdue", "Oldest Pending"],
  );
  assert.match(pendingCard().textContent, /Pending Review9Applications awaiting a decision/);
  assert.match(metricCard("Approaching SLA").textContent, /Approaching SLA33–4 business days/);
  assert.match(metricCard("Overdue").textContent, /Overdue25\+ business days/);
  assert.match(metricCard("Oldest Pending").textContent, /8 business daysLongest unresolved application/);
  assert.doesNotMatch(container.textContent, /Approval Rate|Resubmission Rate|SLA Compliance|last week|this week/);
  assert.equal(container.querySelector(".recharts-wrapper"), null);
  assert.match(container.textContent, /Current review queue and SLA status · PHT/);
  assert.match(container.textContent, /9 total·0 approved·0 rejected·9 pending/);
  assert.match(container.textContent, /0–2 business days/);
  assert.match(container.textContent, /3–4 business days/);
  assert.match(container.textContent, /5\+ business days/);
  assert.match(container.textContent, /0 approved/);
  assert.match(container.textContent, /0 rejected/);
  assert.match(container.textContent, /9 pending/);
});

test("a newly submitted pending application displays zero business days", async () => {
  pending = 1;
  oldest = 0;
  await renderPage();
  assert.match(metricCard("Oldest Pending").textContent, /0 business days/);
});

test("queue cards reuse table filters and reset pagination", async () => {
  await renderPage();

  for (const [title, queueStatus] of [
    ["Approaching SLA", "approaching"],
    ["Overdue", "overdue"],
    ["Pending Review", undefined],
  ]) {
    await act(async () => {
      globalThis.__applicationTableState.setPagination({ pageIndex: 2, pageSize: 10 });
    });
    const button = container.querySelector(`[aria-label="Filter applications: ${title}"]`);
    await act(async () => button.click());

    assert.equal(globalThis.__applicationTableState.params.status, "submitted");
    assert.equal(globalThis.__applicationTableState.params.queue_status, queueStatus);
    assert.equal(globalThis.__applicationTableState.params.page, 1);
  }
  assert.equal(container.querySelector('[aria-label="Filter applications: Oldest Pending"]'), null);
});
