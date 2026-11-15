import toast from "react-hot-toast";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { createServer } from "vite";
import {
  detailFixture,
  listFixture,
  paymentFixture,
  summaryFixture,
} from "./paymentFixtures.js";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Page;
let reads;
let transport;
let notifications;
let dismissed;
let navigate;
let keys;
let queries;
let stateUtils;
let navigation;
const originalFormData = globalThis.FormData;

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
    plugins: [
      {
        name: "payment-test-transport",
        enforce: "pre",
        load(id) {
          if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
            return "export default { get: (...args) => globalThis.__paymentGet(...args) };";
          }
        },
      },
    ],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Page } = await server.ssrLoadModule(
    `${base}pages/PaymentsPage.jsx`,
  ));
  queries = await server.ssrLoadModule(
    `${base}payments/queries/paymentQueries.js`,
  );
  keys = queries.paymentKeys;
  stateUtils = await server.ssrLoadModule(
    `${base}payments/utils/paymentTableState.js`,
  );
  ({ default: navigation } = await server.ssrLoadModule(
    `${base}config/sidebarNavigation.js`,
  ));
});

beforeEach(async () => {
  notifications = [];
  dismissed = [];
  mock.method(toast, "error", (...args) => notifications.push(args));
  mock.method(toast, "dismiss", (id) => dismissed.push(id));
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  reads = [];
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (url === "/admin/payments/") return listFixture(options.params);
    const match = url.match(/^\/admin\/payments\/(\d+)\/$/);
    if (match) return detailFixture(Number(match[1]));
    throw new Error(`Unexpected request: ${url}`);
  };
  globalThis.__paymentGet = async (url, options) => {
    reads.push({ url, ...options });
    return { data: { data: await transport(url, options) } };
  };
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});

afterEach(async () => {
  mock.restoreAll();
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.body.style.overflow, "");
});

after(async () => {
  await server.close();
  dom.window.close();
  globalThis.FormData = originalFormData;
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "Element",
    "Node",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT",
    "__paymentGet",
  ])
    delete globalThis[key];
});

function RouterProbe() {
  const location = useLocation();
  const go = useNavigate();
  React.useEffect(() => {
    navigate = go;
  }, [go]);
  return React.createElement(
    "output",
    { "data-location": true },
    location.pathname + location.search,
  );
}

async function render(route = "/admin-panel/payments") {
  await act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          MemoryRouter,
          { initialEntries: [route] },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(Page),
            React.createElement(RouterProbe),
          ),
        ),
      ),
    ),
  );
}

async function until(predicate) {
  for (let index = 0; index < 150; index += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("All Reviews did not reach the expected state");
}

function button(label, scope = document) {
  return [...scope.querySelectorAll("button")].find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      item.textContent.trim() === label,
  );
}

async function click(label, scope) {
  const target = button(label, scope);
  assert.ok(target, `Missing button: ${label}`);
  await act(async () => {
    target.focus();
    target.click();
  });
}

async function input(element, value) {
  assert.ok(element, "Missing input");
  const prototype =
    element.tagName === "SELECT"
      ? dom.window.HTMLSelectElement.prototype
      : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(
      element,
      value,
    );
    element.dispatchEvent(
      new dom.window.Event(element.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}

const listReads = () => reads.filter((read) => read.url === "/admin/payments/");
const summaryReads = () =>
  reads.filter((read) => read.url.endsWith("/summary/"));

const dialog = () =>
  document.querySelector('[role="dialog"][aria-describedby]');
const inspect = (id = 1) => `Inspect payment ${paymentFixture(id).reference}`;
const searchInput = () =>
  container.querySelector(
    'input[aria-label="Search reference, merchant, business, or provider payment ID…"]',
  );

test("renders the protected directory, sidebar entry, standard columns and Test chips", async () => {
  await render();
  await until(() => button(inspect()));
  assert.equal(container.querySelector("h1").textContent, "Payments");
  assert.match(container.textContent, /Read-only/);
  assert.match(
    container.querySelector("tbody").textContent,
    /Maya.*Test.*₱1.00/,
  );
  assert.match(container.querySelector("tbody").textContent, /PayMongo/);
  assert.deepEqual(
    [...container.querySelectorAll("th")].map((cell) => cell.textContent),
    [
      "Reference",
      "Merchant / Business",
      "Provider",
      "Mode",
      "Amount",
      "Financial",
      "Fulfilment",
      "Checkout outcome",
      "Created",
      "Actions",
    ],
  );
  const entry = navigation
    .flatMap((section) => section.items)
    .find((item) => item.label === "Payments");
  assert.equal(entry.to, "/admin-panel/payments");
  assert.deepEqual(entry.roles, ["admin", "super_admin"]);
  const app = readFileSync(
    new URL("../../../../App.jsx", import.meta.url),
    "utf8",
  );
  assert.ok(app.indexOf('path="payments"') > app.indexOf("<ProtectedRoute"));
  assert.equal(
    reads.filter((read) => /\/payments\/\d+\/$/.test(read.url)).length,
    0,
  );
});

test("uses separate global summary metrics and clickable stored-evidence filters", async () => {
  await render();
  await until(() => button("Needs Review: 3. Filter needs review"));
  assert.equal(summaryReads().length, 1);
  assert.ok(button("Total Payments: 32. Filter total payments"));
  assert.ok(button("Paid: 20. Filter paid"));
  assert.ok(button("Pending: 12. Filter pending"));
  await click("Needs Review: 3. Filter needs review");
  await until(() => listReads().at(-1).params.needs_review === "true");
  await click("Paid: 20. Filter paid");
  await until(() => listReads().at(-1).params.financial_status === "paid");
  assert.equal(listReads().at(-1).params.needs_review, "true");
  await click("Total Payments: 32. Filter total payments");
  await until(
    () =>
      !listReads().at(-1).params.financial_status &&
      !listReads().at(-1).params.needs_review,
  );
  assert.equal(summaryReads().length, 1);
});

test("debounces search, resets the page, and preserves global metrics", async () => {
  await render("/admin-panel/payments?page=3");
  await until(() => listReads().length === 1);
  await input(searchInput(), "Cebu");
  await input(searchInput(), "Cebu Heritage");
  assert.equal(listReads().length, 1);
  await until(() => listReads().at(-1).params.search === "Cebu Heritage");
  assert.equal(listReads().at(-1).params.page, 1);
  assert.equal(summaryReads().length, 1);
});

test("all filter dimensions send backend values, including false", async () => {
  await render();
  await until(() => button(inspect()));
  for (const [dimension, choice, key, value] of [
    ["Financial status", "Paid", "financial_status", "paid"],
    ["Fulfilment", "Fulfilled", "fulfilment_status", "fulfilled"],
    ["Provider", "PayMongo", "provider", "paymongo"],
    ["Mode", "Test", "mode", "test"],
    ["Checkout outcome", "Cancelled", "checkout_outcome", "cancelled"],
    ["Review evidence", "No stored review flag", "needs_review", "false"],
  ]) {
    await click("Filter payments");
    await click(`Choose ${dimension} filter`);
    await click(choice);
    await until(() => listReads().at(-1).params[key] === value);
  }
});

test("dates validate before applying an inclusive Philippine calendar range", async () => {
  await render();
  await until(() => listReads().length === 1);
  await click("Filter creation dates: Creation date");
  await click("Custom date range");
  const dates = () => container.querySelectorAll('input[type="date"]');
  await input(dates()[0], "2026-11-16");
  await input(dates()[1], "2026-11-15");
  await click("Apply dates");
  assert.match(
    container.textContent,
    /End date must be on or after start date/,
  );
  assert.equal(listReads().length, 1);
  await input(dates()[1], "2026-11-17");
  await click("Apply dates");
  await until(() => listReads().at(-1).params.end_date === "2026-11-17");
  assert.equal(listReads().at(-1).params.start_date, "2026-11-16");
});

test("ordering, page size, and pagination remain server-driven", async () => {
  await render();
  await until(() => button(inspect()));
  await click("Next page");
  await until(() => listReads().at(-1).params.page === 2);
  await click("Sort payments: Newest first");
  await click("Amount: highest first");
  await until(() => listReads().at(-1).params.ordering === "amount_highest");
  assert.equal(listReads().at(-1).params.page, 1);
  await click("Payments per page: Rows: 10");
  await click("25");
  await until(() => listReads().at(-1).params.page_size === 25);
  assert.equal(listReads().at(-1).params.page, 1);
});

test("opens all safe drawer sections and chronological provider-event metadata on demand", async () => {
  await render();
  await until(() => button(inspect()));
  const opener = button(inspect());
  await click(inspect());
  await until(() => dialog()?.textContent.includes("PAYMENT_SUCCESS"));
  for (const label of [
    "Payment",
    "Merchant & Business",
    "Checkout",
    "Verification",
    "Fulfilment / Merchant Plus entitlement",
    "Provider events",
  ]) {
    assert.ok(dialog().querySelector(`section[aria-label="${label}"]`));
  }
  assert.match(dialog().textContent, /Creation unknown/);
  assert.match(dialog().textContent, /Conflicting provider evidence/);
  assert.match(dialog().textContent, /Oldest received first/);
  assert.match(dialog().textContent, /Sandbox \/ test activity/);
  assert.ok(reads.every((read) => read.signal instanceof AbortSignal));
  await act(async () =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  await until(() => !dialog());
  assert.equal(document.activeElement, opener);
});

test("historical PayMongo and paid but unfinished fulfilment remain inspectable", async () => {
  await render("/admin-panel/payments?payment_id=2");
  await until(() =>
    dialog()?.textContent.includes("checkout_session.payment.paid"),
  );
  assert.match(dialog().textContent, /PayMongo/);
  assert.match(dialog().textContent, /Paid · Fulfilment not completed/);
  assert.match(dialog().textContent, /Entitlement createdNo/);
});

test("fulfilled Maya entitlement shows its real source and access period", async () => {
  await render("/admin-panel/payments?payment_id=3");
  await until(() => dialog()?.textContent.includes("maya_test"));
  assert.match(dialog().textContent, /Entitlement createdYes/);
  assert.match(dialog().textContent, /Active in stored environmentYes/);
  assert.match(dialog().textContent, /Dec 15, 2026/);
  assert.doesNotMatch(dialog().textContent, /Paid · Fulfilment not completed/);
});

test("no payment mutation, export, or hosted checkout actions are rendered", async () => {
  await render("/admin-panel/payments?payment_id=1");
  await until(() => dialog()?.textContent.includes("PAYMENT_SUCCESS"));
  for (const label of [
    "Mark paid",
    "Approve payment",
    "Retry checkout",
    "Retry fulfilment",
    "Activate Plus",
    "Refund",
    "Cancel payment",
    "Delete",
    "Export",
    "CSV",
  ]) {
    assert.equal(button(label), undefined, label);
  }
  assert.equal(dialog().querySelector("form"), null);
  assert.equal(dialog().querySelector('a[href*="paymaya"]'), null);
  assert.doesNotMatch(
    dialog().textContent,
    /authorization|signature|card_last4|PWEV_DATA/i,
  );
});

test("list and drawer loading use shared skeletons", async () => {
  transport = () => new Promise(() => {});
  await render("/admin-panel/payments?payment_id=1");
  assert.ok(container.querySelector('[aria-busy="true"]'));
  assert.ok(dialog());
  assert.match(dialog().textContent, /Loading payment details/);
});

test("empty and filtered-empty states use the standard table treatment", async () => {
  transport = async (url, options) =>
    url.endsWith("/summary/")
      ? summaryFixture
      : {
          ...listFixture(options.params, []),
          pagination: {
            page: 1,
            page_size: 10,
            total_items: 0,
            total_pages: 0,
          },
        };
  await render();
  await until(() => container.textContent.includes("No payments yet"));
  await input(searchInput(), "missing");
  await until(() =>
    container.textContent.includes("No payments match your criteria"),
  );
  await click("Clear payment filters");
  await until(() => !listReads().at(-1).params.search);
});

test("list errors retain filters and expose only a read retry", async () => {
  transport = async (url) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    throw new Error("unavailable");
  };
  await render("/admin-panel/payments?mode=test");
  await until(() => container.textContent.includes("Unable to load payments"));
  assert.match(container.textContent, /filters are preserved/);
  assert.equal(listReads().at(-1).params.mode, "test");
});

test("drawer errors preserve the list and selection", async () => {
  const normal = transport;
  transport = async (url, options) => {
    if (/\/payments\/\d+\/$/.test(url)) throw new Error("detail unavailable");
    return normal(url, options);
  };
  await render("/admin-panel/payments?payment_id=1");
  await until(() =>
    dialog()?.textContent.includes("Unable to load payment details"),
  );
  assert.ok(button(inspect()));
});

test("invalid URL criteria are normalized and reset preserves selected payment and page size", () => {
  const params = new URLSearchParams(
    "provider=attacker&mode=sandbox&financial_status=cancelled&payment_id=3&page_size=25&page=2",
  );
  const state = stateUtils.readPaymentState(params);
  assert.equal(state.provider, "");
  assert.equal(state.mode, "");
  assert.equal(state.financial_status, "");
  const reset = stateUtils.resetPaymentParams(params);
  assert.equal(reset.get("payment_id"), "3");
  assert.equal(reset.get("page_size"), "25");
  assert.equal(reset.get("page"), null);
  assert.deepEqual(keys.summary, ["admin", "payments", "summary"]);
});

test("URL navigation updates the selected inspection without mutating payment state", async () => {
  await render();
  await until(() => button(inspect()));
  await act(async () =>
    navigate("/admin-panel/payments?payment_id=3&mode=test"),
  );
  await until(() => dialog()?.textContent.includes("maya_test"));
  assert.equal(listReads().at(-1).params.mode, "test");
});
