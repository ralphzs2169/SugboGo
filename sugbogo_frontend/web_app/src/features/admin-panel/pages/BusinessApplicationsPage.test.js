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
          return "export default function Table() { return null; }";
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
  reads = [];
  globalThis.__statisticsTransport = async (url) => {
    reads.push(url);
    assert.equal(url, "/admin/businesses/applications/statistics/");
    if (failure) throw new Error("Statistics unavailable");
    return { data: { data: {
      pending_review: pending,
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
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderPage() {
  await act(async () => root.render(
    React.createElement(MemoryRouter, null, React.createElement(Page)),
  ));
}

function pendingCard() {
  return [...container.querySelectorAll("h3")]
    .find((heading) => heading.textContent === "Pending Review")?.parentElement.parentElement;
}

test("a successful measured zero remains visible as zero", async () => {
  await renderPage();
  assert.ok(pendingCard());
  assert.match(pendingCard().textContent, /Pending Review0/);
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
