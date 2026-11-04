import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
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
  reviewFixture,
  summaryFixture,
} from "./allReviewFixtures.js";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Page;
let reads;
let transport;
let navigate;
let keys;
let queries;
let stateUtils;
let moderationDestinations;
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
        name: "all-review-test-transport",
        enforce: "pre",
        load(id) {
          if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
            return "export default { get: (...args) => globalThis.__allReviewGet(...args) };";
          }
        },
      },
    ],
  });
  const base = "/src/features/admin-panel/";
  ({ default: Page } = await server.ssrLoadModule(
    `${base}pages/AllReviewsPage.jsx`,
  ));
  queries = await server.ssrLoadModule(
    `${base}all-reviews/queries/allReviewQueries.js`,
  );
  keys = queries.allReviewKeys;
  stateUtils = await server.ssrLoadModule(
    `${base}all-reviews/utils/allReviewTableState.js`,
  );
  ({ allReviewModerationDestinations: moderationDestinations } =
    await server.ssrLoadModule(
      `${base}all-reviews/utils/allReviewModeration.js`,
    ));
  ({ default: navigation } = await server.ssrLoadModule(
    `${base}config/sidebarNavigation.js`,
  ));
});

beforeEach(async () => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  reads = [];
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (url === "/admin/reviews/") return listFixture(options.params);
    const match = url.match(/^\/admin\/reviews\/(\d+)\/$/);
    if (match) return detailFixture(Number(match[1]));
    throw new Error(`Unexpected request: ${url}`);
  };
  globalThis.__allReviewGet = async (url, options) => {
    reads.push({ url, ...options });
    return { data: { data: await transport(url, options) } };
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
    "__allReviewGet",
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

async function render(route = "/admin-panel/reviews") {
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

const listReads = () => reads.filter((read) => read.url === "/admin/reviews/");
const summaryReads = () =>
  reads.filter((read) => read.url.endsWith("/summary/"));
const detailReads = () =>
  reads.filter((read) => /^\/admin\/reviews\/\d+\/$/.test(read.url));
const dialog = () =>
  document.querySelector('[role="dialog"][aria-describedby]');
const searchInput = () =>
  container.querySelector(
    'input[aria-label="Search reviews, reviewers, or businesses…"]',
  );
const rowNumbers = () =>
  [...container.querySelectorAll("tbody tr")].map(
    (row) => row.querySelector("td")?.textContent,
  );

test("page uses the protected Admin route, sidebar roles, and existing table structure", async () => {
  await render();
  await until(() => container.textContent.includes("Ana Cruz"));
  assert.equal(document.title, "All Reviews | SugboGo Admin");
  assert.match(
    container.textContent,
    /Inspect reviews submitted across SugboGo/,
  );
  assert.deepEqual(
    [...container.querySelectorAll("th")].map((cell) => cell.textContent),
    [
      "No.",
      "Review",
      "Reviewer",
      "Business",
      "Status",
      "Reports",
      "Submitted",
      "Actions",
    ],
  );
  assert.equal(container.querySelector("table").style.minWidth, "1430px");
  assert.equal(
    container.querySelector("table").getAttribute("aria-label"),
    "All reviews",
  );
  const entry = navigation
    .flatMap((section) => section.items)
    .find((item) => item.label === "All Reviews");
  assert.equal(entry.to, "/admin-panel/reviews");
  assert.deepEqual(entry.roles, ["admin", "super_admin"]);
  const app = readFileSync(
    new URL("../../../../App.jsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /path="reviews" element={<AllReviewsPage \/>}/);
  assert.ok(app.indexOf('path="reviews"') > app.indexOf("<ProtectedRoute"));
  assert.equal(detailReads().length, 0);
});

test("global cards use the summary endpoint once and never derive counts from two table rows", async () => {
  await render();
  await until(() =>
    button("Total Reviews: 32. Clear status and reported filters"),
  );
  assert.equal(summaryReads().length, 1);
  assert.equal(listReads().length, 1);
  assert.equal(summaryReads()[0].params, undefined);
  assert.ok(reads.every((read) => read.signal instanceof AbortSignal));
  assert.match(
    container.textContent,
    /Global counts may overlap.*resolved and withdrawn reports/,
  );
  assert.ok(button("Published: 20. Filter published"));
  assert.ok(button("Under Review: 7. Filter under review"));
  assert.ok(button("Reported: 9. Filter reported"));
});

test("metric filters compose and Total clears only status and report criteria", async () => {
  await render("/admin-panel/reviews?search=food&start_date=2026-10-01&page=3");
  await until(() => summaryReads().length === 1 && listReads().length === 1);
  await click("Published: 20. Filter published");
  await until(() => listReads().at(-1).params.status === "published");
  await click("Reported: 9. Filter reported");
  await until(() => listReads().at(-1).params.reported === "true");
  assert.equal(listReads().at(-1).params.status, "published");
  assert.equal(listReads().at(-1).params.page, 1);
  await click("Under Review: 7. Filter under review");
  await until(() => listReads().at(-1).params.status === "under_review");
  await click("Total Reviews: 32. Clear status and reported filters");
  await until(
    () =>
      !listReads().at(-1).params.status && !listReads().at(-1).params.reported,
  );
  assert.equal(listReads().at(-1).params.search, "food");
  assert.equal(listReads().at(-1).params.start_date, "2026-10-01");
  assert.equal(summaryReads().length, 1);
});

test("table renders text-only media, default avatars, missing business images, reports, and Manila dates", async () => {
  await render();
  await until(() => container.textContent.includes("Ana Cruz"));
  assert.deepEqual(rowNumbers(), ["1", "2"]);
  assert.match(container.textContent, /Text only/);
  assert.match(container.textContent, /ana@example.com/);
  assert.match(container.textContent, /Restaurants · Food and Dining/);
  assert.match(container.textContent, /3 reports.*1 pending/);
  assert.match(container.textContent, /Oct 11, 2026.*1:30 AM PHT/);
  assert.ok(container.querySelector('img[alt=""][src]'));
  assert.doesNotMatch(container.innerHTML, /src="null"|src="undefined"/);
  assert.ok(button("View review #41"));
  assert.equal(button("More actions"), undefined);
});

test("all four actual review statuses and media counts render without inventing lifecycle states", async () => {
  transport = async (url, options) =>
    url.endsWith("/summary/")
      ? summaryFixture
      : listFixture(options.params, [
          reviewFixture(1, {
            status: "published",
            first_photo_url: "https://example.com/first.jpg",
            photo_count: 1,
            report_count: 0,
            pending_report_count: 0,
          }),
          reviewFixture(2, { status: "under_review", photo_count: 3 }),
          reviewFixture(3, { status: "flagged" }),
          reviewFixture(4, { status: "rejected" }),
        ]);
  await render();
  await until(() => button("View review #4"));
  const body = container.querySelector("tbody").textContent;
  for (const label of [
    "Published",
    "Under Review",
    "Flagged",
    "Rejected",
    "1 photo",
    "3 photos",
    "No reports",
  ])
    assert.ok(body.includes(label), label);
  assert.ok(
    container.querySelector('img[src="https://example.com/first.jpg"]'),
  );
});

test("search debounces useful backend searches, resets page, and does not refetch metrics", async () => {
  await render("/admin-panel/reviews?page=3");
  await until(() => listReads().length === 1);
  await input(searchInput(), "Ana");
  await input(searchInput(), "Ana Cruz");
  assert.equal(listReads().length, 1);
  await until(() => listReads().at(-1).params.search === "Ana Cruz");
  assert.equal(listReads().at(-1).params.page, 1);
  assert.equal(summaryReads().length, 1);
  assert.equal(listReads().length, 2);
});

test("status and reported menu filters send exact values including false", async () => {
  await render();
  await until(() => listReads().length === 1);
  await click("Filter reviews");
  await click("Choose Status filter");
  await click("Rejected");
  await until(() => listReads().at(-1).params.status === "rejected");
  await click("Filter reviews");
  await click("Choose Reported filter");
  await click("Not reported");
  await until(() => listReads().at(-1).params.reported === "false");
  assert.match(container.textContent, /Reported: Not reported/);
  await click("Remove Reported filter");
  await until(() => listReads().at(-1).params.reported === undefined);
});

test("date range validates locally then applies the exact inclusive date parameters together", async () => {
  await render("/admin-panel/reviews?page=2");
  await until(() => listReads().length === 1);
  await click("Filter submission dates: Submission date");
  await click("Custom date range");
  const dates = () => container.querySelectorAll('input[type="date"]');
  await input(dates()[0], "2026-10-12");
  await input(dates()[1], "2026-10-10");
  await click("Apply dates");
  assert.match(
    container.textContent,
    /End date must be on or after start date/,
  );
  assert.equal(listReads().length, 1);
  await input(dates()[1], "2026-10-14");
  await click("Apply dates");
  await until(() => listReads().at(-1).params.end_date === "2026-10-14");
  assert.equal(listReads().at(-1).params.start_date, "2026-10-12");
  assert.equal(listReads().at(-1).params.page, 1);
});

test("ordering is server-side and returns to the first page", async () => {
  await render("/admin-panel/reviews?page=2");
  await until(() => listReads().length === 1);
  await click("Sort reviews: Newest first");
  await click("Oldest first");
  await until(() => listReads().at(-1).params.ordering === "oldest");
  assert.equal(listReads().at(-1).params.page, 1);
  assert.equal(summaryReads().length, 1);
});

test("pagination and page-size changes use backend metadata and keep row numbers correct", async () => {
  await render();
  await until(() => rowNumbers()[0] === "1");
  await click("Next page");
  await until(() => rowNumbers()[0] === "11");
  assert.equal(listReads().at(-1).params.page, 2);
  await click("Reviews per page: Rows: 10");
  await click("25");
  await until(
    () => listReads().at(-1).params.page_size === 25 && rowNumbers()[0] === "1",
  );
  await click("Next page");
  await until(() => rowNumbers()[0] === "26");
  assert.equal(summaryReads().length, 1);
});

test("reset removes criteria and ordering while preserving the chosen page size", async () => {
  await render(
    "/admin-panel/reviews?search=food&status=flagged&reported=false&start_date=2026-10-01&end_date=2026-10-15&ordering=oldest&page=2&page_size=25",
  );
  await until(() => listReads().length === 1);
  await click("Clear Filters");
  await until(() => listReads().at(-1).params.search === undefined);
  assert.deepEqual(listReads().at(-1).params, {
    search: undefined,
    status: undefined,
    reported: undefined,
    start_date: undefined,
    end_date: undefined,
    ordering: "newest",
    page: 1,
    page_size: 25,
  });
  assert.equal(searchInput().value, "");
});

test("summary and table loading states are independent and preserve the eight columns", async () => {
  let finishSummary;
  let finishList;
  transport = (url) =>
    new Promise((done) => {
      if (url.endsWith("/summary/")) finishSummary = done;
      else finishList = done;
    });
  await render();
  assert.equal(container.querySelectorAll('[role="status"]').length, 4);
  assert.equal(container.querySelectorAll("th").length, 8);
  assert.equal(container.querySelectorAll("tbody tr").length, 10);
  await act(async () => finishList(listFixture()));
  await until(() => container.textContent.includes("Ana Cruz"));
  assert.equal(container.querySelectorAll('[role="status"]').length, 4);
  await act(async () => finishSummary(summaryFixture));
  await until(() =>
    button("Total Reviews: 32. Clear status and reported filters"),
  );
});

test("list error retries without losing filters or disabling the metric cards", async () => {
  let fail = true;
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (fail) throw new Error("List unavailable");
    return listFixture(options.params);
  };
  await render("/admin-panel/reviews?status=published");
  await until(() => container.textContent.includes("Unable to load reviews"));
  assert.ok(button("Total Reviews: 32. Clear status and reported filters"));
  fail = false;
  await click("Try Again");
  await until(() => container.textContent.includes("Ana Cruz"));
  assert.equal(listReads().at(-1).params.status, "published");
});

test("summary error remains contained and retries without refetching the list", async () => {
  let fail = true;
  transport = async (url, options) => {
    if (!url.endsWith("/summary/")) return listFixture(options.params);
    if (fail) throw new Error("Summary unavailable");
    return summaryFixture;
  };
  await render();
  await until(() =>
    container.textContent.includes("Unable to load review metrics"),
  );
  assert.match(container.textContent, /Ana Cruz/);
  fail = false;
  await click("Try Again");
  await until(() =>
    button("Total Reviews: 32. Clear status and reported filters"),
  );
  assert.equal(listReads().length, 1);
});

test("empty inventory and filtered empty results have distinct copy and a reset path", async () => {
  transport = async (url) =>
    url.endsWith("/summary/")
      ? { total_reviews: 0, published: 0, under_review: 0, reported: 0 }
      : {
          items: [],
          pagination: {
            page: 1,
            page_size: 10,
            total_items: 0,
            total_pages: 0,
            has_next: false,
            has_previous: false,
          },
        };
  await render();
  await until(() => container.textContent.includes("No reviews yet"));
  assert.ok(button("Total Reviews: 0. Clear status and reported filters"));
  await input(searchInput(), "No match");
  await until(() =>
    container.textContent.includes("No reviews match your criteria"),
  );
  await click("Clear review filters");
  await until(() => container.textContent.includes("No reviews yet"));
});

test("View fetches only selected details and opens a contained loading drawer", async () => {
  let finish;
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (url === "/admin/reviews/") return listFixture(options.params);
    return new Promise((done) => {
      finish = done;
    });
  };
  await render();
  await until(() => button("View review #41"));
  assert.equal(detailReads().length, 0);
  await click("View review #41");
  await until(() =>
    document.querySelector('[aria-label="Loading review details"]'),
  );
  assert.ok(dialog());
  assert.match(container.textContent, /Ana Cruz/);
  assert.equal(detailReads().length, 1);
  await act(async () => finish(detailFixture()));
  await until(() => document.body.textContent.includes("Full review 41:"));
});

test("drawer presents full content, photos, identities, reports, analysis, timestamps, and recorded history", async () => {
  await render("/admin-panel/reviews?review_id=41");
  await until(() => document.body.textContent.includes("Full review 41:"));
  const text = dialog().textContent;
  for (const value of [
    "We would come back with friends.",
    "Review photos (2)",
    "Ana Cruz",
    "ana@example.com",
    "Sugbo Bistro",
    "Restaurants",
    "Food and Dining",
    "Submitted",
    "Published",
    "Edited",
    "Updated",
    "Reports (3)",
    "1 pending",
    "Spam",
    "Off-topic or Irrelevant",
    "Withdrawn",
    "Concern about repeated review text.",
    "Existing report inspection notes.",
    "Stored automated analysis",
    "Positive",
    "Score 0.75",
    "No content flagged",
    "Decision history",
    "Review approved and published",
    "Cebu Admin",
    "Inspected the content",
  ])
    assert.ok(text.includes(value), value);
  assert.equal(
    dialog().querySelectorAll('button[aria-label^="View review photo"]').length,
    2,
  );
  assert.doesNotMatch(
    text,
    /Approve & Publish|Reject Review|installation|reporter identity|model version/,
  );
});

test("photo lightbox reuses viewer controls, owns Escape, and returns focus to the drawer", async () => {
  await render("/admin-panel/reviews?review_id=41");
  await until(() => button("View review photo 1"));
  await click("View review photo 1");
  await until(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "Review photo viewer",
  );
  assert.ok(document.querySelector('[aria-label="Review photo viewer"]'));
  await act(async () =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  await until(
    () => !document.querySelector('[aria-label="Review photo viewer"]'),
  );
  assert.ok(dialog());
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "View review photo 1",
  );
  assert.equal(document.body.style.overflow, "hidden");
});

test("moderation destinations retain specificity and navigation uses the supplied IDs", async () => {
  await render("/admin-panel/reviews?review_id=41");
  await until(() => button("View review photo 1"));
  const links = [
    ...dialog().querySelectorAll('a[aria-label^="Open in Moderation"]'),
  ];
  assert.equal(links.length, 3);
  assert.equal(
    links[0].getAttribute("href"),
    "/admin-panel/moderation-integrity?tab=under-review&under_review_id=41",
  );
  assert.equal(
    links[1].getAttribute("href"),
    "/admin-panel/moderation-integrity?tab=reported&reported_id=41",
  );
  assert.equal(
    links[2].getAttribute("href"),
    "/admin-panel/moderation-integrity?tab=disputes&dispute_id=73",
  );
  await act(async () => links[2].click());
  await until(() =>
    container
      .querySelector("output")
      .textContent.includes("tab=disputes&dispute_id=73"),
  );
});

test("missing optional detail data remains neutral and no moderation action is invented", async () => {
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (url === "/admin/reviews/") return listFixture(options.params);
    return detailFixture(41, {
      photos: [],
      photo_count: 0,
      reports: [],
      report_count: 0,
      pending_report_count: 0,
      history: [],
      sentiment: { label: null, score: null },
      moderation: null,
      moderation_links: {
        under_review: null,
        reported_review: null,
        review_dispute: null,
      },
    });
  };
  await render("/admin-panel/reviews?review_id=41");
  await until(() =>
    dialog()?.textContent.includes("No administrative decisions are recorded"),
  );
  assert.match(dialog().textContent, /No photos attached/);
  assert.match(dialog().textContent, /No reports have been retained/);
  assert.match(dialog().textContent, /Not available/);
  assert.match(dialog().textContent, /No outcome recorded/);
  assert.equal(
    dialog().querySelectorAll('a[aria-label^="Open in Moderation"]').length,
    0,
  );
});

test("detail error retries independently and can be closed", async () => {
  let fail = true;
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (url === "/admin/reviews/") return listFixture(options.params);
    if (fail) throw new Error("Detail unavailable");
    return detailFixture();
  };
  await render("/admin-panel/reviews?review_id=41");
  await until(() =>
    dialog()?.textContent.includes("Unable to load review details"),
  );
  fail = false;
  await click("Try Again", dialog());
  await until(() => dialog()?.textContent.includes("Full review 41:"));
  await click("Close modal", dialog());
  await until(() => !dialog());
  assert.equal(listReads().length, 1);
  assert.equal(summaryReads().length, 1);
});

test("closing and reopening revalidates the selected review and restores opener focus", async () => {
  await render();
  await until(() => button("View review #41"));
  const opener = button("View review #41");
  opener.focus();
  await click("View review #41");
  await until(() => dialog()?.textContent.includes("Full review 41:"));
  await click("Close modal", dialog());
  await until(() => !dialog());
  assert.equal(document.activeElement, opener);
  await click("View review #41");
  await until(() => detailReads().length === 2);
  assert.equal(summaryReads().length, 1);
  assert.equal(listReads().length, 1);
});

test("rapid selection cancels the old request and never displays another review's detail", async () => {
  let finishOld;
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (url === "/admin/reviews/") return listFixture(options.params);
    if (url.endsWith("/41/"))
      return new Promise((done) => {
        finishOld = done;
      });
    return detailFixture(42);
  };
  await render("/admin-panel/reviews?review_id=41");
  await until(() => detailReads().length === 1);
  await act(async () => navigate("/admin-panel/reviews?review_id=42"));
  await until(() => dialog()?.textContent.includes("Full review 42:"));
  assert.equal(detailReads()[0].signal.aborted, true);
  await act(async () => finishOld(detailFixture(41)));
  assert.doesNotMatch(dialog().textContent, /Full review 41:/);
});

test("late filter responses are cancelled and cannot replace the current results", async () => {
  let finishOld;
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (options.params.status === "published")
      return new Promise((done) => {
        finishOld = done;
      });
    return listFixture(options.params, [
      reviewFixture(90, {
        status: "rejected",
        text: "Current rejected review",
      }),
    ]);
  };
  await render("/admin-panel/reviews?status=published");
  await until(() => listReads().length === 1);
  await act(async () => navigate("/admin-panel/reviews?status=rejected"));
  await until(() => container.textContent.includes("Current rejected review"));
  assert.equal(listReads()[0].signal.aborted, true);
  await act(async () =>
    finishOld(
      listFixture({}, [reviewFixture(1, { text: "Superseded result" })]),
    ),
  );
  assert.doesNotMatch(container.textContent, /Superseded result/);
});

test("drawer Escape and Tab retain modal focus behavior", async () => {
  await render("/admin-panel/reviews?review_id=41");
  await until(() => button("View review photo 2"));
  const last = button("View review photo 2");
  last.focus();
  await act(async () =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.activeElement, button("Close modal"));
  await act(async () =>
    document.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  await until(() => !dialog());
});

test("out-of-range pagination can recover to page one without losing filters", async () => {
  transport = async (url, options) => {
    if (url.endsWith("/summary/")) return summaryFixture;
    if (options.params.page > 1)
      throw Object.assign(new Error("Invalid page"), {
        response: { status: 404 },
      });
    return listFixture(options.params);
  };
  await render("/admin-panel/reviews?page=99&status=published");
  await until(() => button("Return to first page"));
  await click("Return to first page");
  await until(() => container.textContent.includes("Ana Cruz"));
  assert.equal(listReads().at(-1).params.page, 1);
  assert.equal(listReads().at(-1).params.status, "published");
});

test("contract helpers keep query keys independent and reject unsupported moderation destinations", () => {
  assert.notDeepEqual(keys.summary, keys.list({ page: 1 }));
  assert.notDeepEqual(keys.detail(41), keys.detail(42));
  assert.equal(queries.allReviewDetailOptions(null).enabled, false);
  assert.equal(queries.allReviewDetailOptions(41).enabled, true);
  assert.equal(queries.allReviewSummaryOptions().refetchOnMount, "always");
  assert.deepEqual(moderationDestinations({ under_review: null }), []);
  assert.deepEqual(
    moderationDestinations({
      under_review: "https://example.com/41/",
      reported_review: "/api/admin/reviews/41/",
    }),
    [],
  );
  const state = stateUtils.readAllReviewState(
    new URLSearchParams(
      "status=invalid&reported=no&page=-1&page_size=500&review_id=abc",
    ),
  );
  assert.equal(state.status, "");
  assert.equal(state.reported, "");
  assert.equal(state.page, 1);
  assert.equal(state.page_size, 10);
  assert.equal(state.reviewId, null);
  assert.deepEqual(Object.keys(stateUtils.allReviewListParams(state)), [
    "search",
    "status",
    "reported",
    "start_date",
    "end_date",
    "ordering",
    "page",
    "page_size",
  ]);
});
