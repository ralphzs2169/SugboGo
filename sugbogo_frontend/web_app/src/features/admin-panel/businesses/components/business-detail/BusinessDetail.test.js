import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createServer } from "vite";
import {
  businessFixture,
  visitsFixture,
  historyFixture,
} from "./businessDetail.fixtures.js";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let client;
let Page;
let Hero;
let Insights;
let Hours;
let Metrics;
let Application;
let Photos;
let useDetail;
let useSync;
let auth;
let hoursRules;
let business;
let lifecycle;
let visits;
let reads;
let posts;
let get;
let post;
let intersection;
const response = (data) => ({ data: { data } });
const failure = (message = "Request failed") =>
  Object.assign(new Error(message), {
    response: { status: 503, data: { message } },
  });

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
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    IntersectionObserver: class {
      constructor(callback) {
        intersection = callback;
      }
      observe(element) {
        this.target = element;
      }
      disconnect() {}
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return this.tagName === "P" && this.textContent.length > 200 ? 120 : 24;
    },
  });
  localStorage.setItem("access_token", "isolated-test-session");
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [
      {
        name: "detail-test-transport",
        enforce: "pre",
        resolveId(source) {
          if (source === "react-tooltip") return "\0detail-tooltip";
        },
        load(id) {
          if (id === "\0detail-tooltip")
            return "export const Tooltip = () => null;";
          if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js"))
            return "export default { get: (...args) => globalThis.__detailGet(...args), post: (...args) => globalThis.__detailPost(...args) };";
          if (
            id
              .replaceAll("\\", "/")
              .endsWith("/shared/components/maps/BusinessLocationMap.jsx")
          )
            return 'import React from "react"; export default function Map() { return React.createElement("div", null, "Existing interactive map"); }';
        },
      },
    ],
  });
  const base = "/src/features/admin-panel/businesses/";
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/BusinessDetailPage.jsx",
  ));
  ({ default: Hero } = await server.ssrLoadModule(
    base + "components/business-detail/BusinessDetailHero.jsx",
  ));
  ({ default: Insights } = await server.ssrLoadModule(
    base + "components/business-detail/ReviewInsightsCard.jsx",
  ));
  ({ default: Hours } = await server.ssrLoadModule(
    base + "components/business-detail/BusinessHoursPreview.jsx",
  ));
  ({ default: Metrics } = await server.ssrLoadModule(
    base + "components/business-detail/BusinessDetailMetrics.jsx",
  ));
  ({ default: Application } = await server.ssrLoadModule(
    base + "components/business-detail/BusinessApplicationSummary.jsx",
  ));
  ({ default: Photos } = await server.ssrLoadModule(
    base + "components/business-detail/BusinessPhotosPreview.jsx",
  ));
  ({ default: useDetail } = await server.ssrLoadModule(
    base + "hooks/useBusinessDetail.js",
  ));
  ({ default: useSync } = await server.ssrLoadModule(
    base + "hooks/useBusinessInsightSync.js",
  ));
  ({ useAuthStore: auth } = await server.ssrLoadModule(
    "/src/features/auth/storage/auth.store.js",
  ));
  hoursRules = await server.ssrLoadModule("/src/shared/utils/businessHours.js");
});

beforeEach(async () => {
  business = businessFixture();
  lifecycle = {
    business_id: 41,
    status: "active",
    transition_id: 9,
    suspension_reason: null,
    owner_account_status: "active",
  };
  visits = visitsFixture();
  reads = [];
  posts = [];
  auth.getState().setUser({ id: 1, role: "admin" });
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  get = async (url, options) => {
    if (url.includes("status-history/"))
      return response(historyFixture(options?.params?.page));
    if (url.endsWith("status/")) return response(lifecycle);
    if (url.includes("discovery-summary/")) return response(visits);
    return response(business);
  };
  post = async (url) => {
    if (url.endsWith("suspend/"))
      lifecycle = {
        ...lifecycle,
        status: "suspended",
        suspension_reason: "Listing review",
        transition_id: 10,
      };
    if (url.endsWith("reactivate/"))
      lifecycle = {
        ...lifecycle,
        status: "active",
        suspension_reason: null,
        transition_id: 11,
      };
    return response(lifecycle);
  };
  globalThis.__detailGet = (url, options) => {
    reads.push({ url, ...options });
    return get(url, options);
  };
  globalThis.__detailPost = (url, payload) => {
    posts.push({ url, payload });
    return post(url, payload);
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
  await server.close();
  dom.window.close();
});

function Location() {
  return React.createElement(
    "output",
    { "data-location": true },
    useLocation().pathname + useLocation().search,
  );
}
async function render(element) {
  await act(async () =>
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/admin-panel/businesses/41"] },
          element,
          React.createElement(Location),
        ),
      ),
    ),
  );
}
async function page() {
  await render(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/admin-panel/businesses/:businessId",
        element: React.createElement(Page),
      }),
      React.createElement(Route, {
        path: "*",
        element: React.createElement("p", null, "Existing destination"),
      }),
    ),
  );
  await until(() => container.textContent.includes("Cebu Craft Cafe"));
}
async function until(predicate) {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Detail did not reach expected state: " + container.textContent);
}
const button = (label) =>
  [...document.querySelectorAll("button")].find(
    (item) =>
      item.textContent === label || item.getAttribute("aria-label") === label,
  );
const click = async (element) => {
  assert.ok(element, "Expected control exists");
  await act(async () => element.click());
};
const content = () => container.textContent;
async function event(element, type) {
  await act(async () =>
    element.dispatchEvent(new window.Event(type, { bubbles: true })),
  );
}

function insightProps(extra = {}) {
  return { business, onObserve: () => {}, ...extra };
}
function visitsProps(extra = {}) {
  return {
    data: visits,
    isPending: false,
    isFetching: false,
    error: null,
    refetch: () => {},
    ...extra,
  };
}

test("page follows the six-section hierarchy and consumes canonical counts", async () => {
  await page();
  await until(() => content().includes("217"));
  const text = content();
  const sections = [
    "Business Engagement",
    "Review Insights",
    "Recent Reviews & Photo Gallery",
    "Administrative History & Requests",
    "Business Application",
  ];
  sections.forEach((heading, index) => {
    if (index)
      assert.ok(text.indexOf(heading) > text.indexOf(sections[index - 1]));
  });
  for (const value of [
    "Current specialty vouches",
    "Published reviews",
    "Currently saved",
    "Last 30 days",
    "24",
    "28",
    "56",
  ])
    assert.ok(text.includes(value));
  assert.doesNotMatch(
    text,
    /999|998|997|Community trust|Saved by explorers|Coming soon/,
  );
  assert.equal(
    reads.find((read) => read.url.includes("discovery-summary")).params.period,
    "30",
  );
  assert.equal(
    reads.find((read) => read.url.includes("discovery-summary")).params
      .business_id,
    "41",
  );
  assert.equal(
    container.querySelector('a[href^="/admin-panel/reviews"]'),
    null,
  );
});

test("preferred image has no browser-broken state and does not select a gallery fallback", async () => {
  await render(React.createElement(Hero, { business }));
  const image = container.querySelector("img[alt$='listing image']");
  assert.equal(image.getAttribute("src"), business.cover_photo_url);
  await event(image, "error");
  assert.equal(container.querySelector("img[alt$='listing image']"), null);
  assert.match(content(), /Business image unavailable/);
  business = { ...business, cover_photo_url: null };
  await render(React.createElement(Hero, { business }));
  assert.equal(container.querySelector("img[alt$='listing image']"), null);
});

test("description expands only on measured overflow and merchant account uses Task A ID", async () => {
  await render(React.createElement(Hero, { business }));
  assert.equal(button("Show more"), undefined);
  business = {
    ...business,
    description: "A complete administrative listing description. ".repeat(20),
  };
  await render(React.createElement(Hero, { business }));
  await click(button("Show more"));
  assert.equal(button("Show less").getAttribute("aria-expanded"), "true");
  await click(button("Show less"));
  await click(container.querySelector('a[href="/admin-panel/users/12"]'));
  assert.equal(
    container.querySelector("output").textContent,
    "/admin-panel/users/12",
  );
});

test("map action opens the existing modal without a Static Maps request", async () => {
  await page();
  assert.match(content(), /Unit 4, Gorordo Avenue, Barangay Camputhaw/);
  assert.equal(container.querySelector('img[src*="staticmap"]'), null);
  await click(button("View map"));
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /Existing interactive map/,
  );
});

test("current suspension explanation stays separate from merchant status and history", async () => {
  business = { ...business, status: "suspended" };
  lifecycle = {
    ...lifecycle,
    status: "suspended",
    suspension_reason: "Resolve listing location.",
  };
  await page();
  await until(() => content().includes("Resolve listing location."));
  assert.match(content(), /Business suspended/);
  assert.match(content(), /Account statusActive/);
  assert.equal(
    container
      .querySelector('[role="note"]')
      .textContent.includes("Inaccurate business location"),
    false,
  );
});

test("active or unexplained suspension never shows a historical reason as current", async () => {
  await render(
    React.createElement(Hero, {
      business,
      statusInfo: {
        data: { status: "suspended", suspension_reason: "Historical reason" },
      },
    }),
  );
  assert.doesNotMatch(content(), /Historical reason|Business suspended/);
  await render(
    React.createElement(Hero, {
      business: { ...business, status: "suspended" },
      statusInfo: { data: { status: "suspended", suspension_reason: null } },
    }),
  );
  assert.doesNotMatch(content(), /Business suspended/);
});

test("visits zero remains numeric and unavailable stays local with Retry", async () => {
  visits = visitsFixture(0);
  await render(
    React.createElement(Metrics, { business, visits: visitsProps() }),
  );
  const cards = container.querySelectorAll("h3");
  assert.equal(cards.length, 4);
  assert.match(
    cards[3].parentElement.parentElement.parentElement.textContent,
    /0/,
  );
  visits = visitsFixture(null);
  let retried = 0;
  await render(
    React.createElement(Metrics, {
      business,
      visits: visitsProps({
        refetch: () => {
          retried += 1;
        },
      }),
    }),
  );
  assert.match(content(), /Unavailable/);
  assert.match(content(), /Published reviews/);
  await click(button("Retry profile visits"));
  assert.equal(retried, 1);
});

test("ready rating shows scored population, experimental disclosure and Philippine timestamp once", async () => {
  await render(React.createElement(Insights, insightProps()));
  assert.match(content(), /4\.3/);
  assert.match(content(), /24 scored reviews/);
  assert.match(content(), /11:00 AM/);
  assert.match(content(), /Experimental/);
  assert.doesNotMatch(content(), /Positive|Neutral|Negative|28 scored/);
  assert.ok(
    container.querySelector('[aria-label="AI-derived rating 4.3 out of 5"]'),
  );
});

for (const [state, expected] of [
  ["insufficient_data", "Not enough scored reviews"],
  ["pending", "Rating updating"],
  ["unavailable", "Rating unavailable"],
]) {
  test(
    "rating state " + state + " does not display stale stars or zero",
    async () => {
      business.sentiment_rating = {
        ...business.sentiment_rating,
        state,
        value: 4.8,
        contributing_review_count: 3,
      };
      await render(React.createElement(Insights, insightProps()));
      assert.ok(content().includes(expected));
      assert.doesNotMatch(content(), /4\.8|0\.0/);
      if (state === "insufficient_data")
        assert.match(content(), /3 of 5 required/);
    },
  );
}

test("disabled rating and invalid ready snapshot stay unavailable", async () => {
  business.sentiment_rating_enabled = false;
  await render(React.createElement(Insights, insightProps()));
  assert.match(content(), /not enabled/);
  assert.doesNotMatch(content(), /4\.3/);
  business = businessFixture();
  business.sentiment_rating.computed_at = null;
  await render(React.createElement(Insights, insightProps()));
  assert.match(content(), /Rating unavailable/);
});

test("insights show narrative, neutral themes, sampling and truthful empty states", async () => {
  business.review_insights = {
    ...business.review_insights,
    state: "outdated",
    is_sampled: true,
    analyzed_review_count: 100,
    eligible_review_count: 200,
  };
  await render(React.createElement(Insights, insightProps()));
  assert.match(content(), /Reviewers mention attentive service/);
  assert.match(content(), /Attentive service · 7/);
  assert.match(content(), /100 of 200 eligible reviews analyzed · Sampled/);
  assert.match(content(), /Outdated/);
  business.review_insights = {
    ...business.review_insights,
    content_available: false,
    narrative: null,
    frequent_mentions: [],
    state: "insufficient_reviews",
    state_message: "At least five eligible recent reviews are required.",
  };
  await render(React.createElement(Insights, insightProps()));
  assert.match(content(), /At least five/);
  assert.doesNotMatch(content(), /No recurring themes were found/);
});

test("refresh requests reconciliation and preserves content on request failure", async () => {
  let observed = 0;
  await render(
    React.createElement(
      Insights,
      insightProps({
        onObserve: () => {
          observed += 1;
        },
      }),
    ),
  );
  await click(button("Refresh Review Insights"));
  post = async () => {
    throw failure("Refresh could not be requested.");
  };
  await click(button("Request refresh"));
  assert.match(content(), /Reviewers mention attentive service/);
  assert.match(content(), /Refresh could not be requested/);
  post = async () => ({ data: { message: "Reconciliation requested." } });
  await click(button("Request refresh"));
  assert.equal(observed, 1);
  assert.equal(posts.length, 2);
  assert.ok(posts[1].url.endsWith("review-insights/refresh/"));
});

test("history uses pagination and existing update request and application navigation", async () => {
  await page();
  await until(() => button("Show more history"));
  assert.match(content(), /Admin Juan/);
  await click(button("Show more history"));
  await until(() => content().includes("Inaccurate business location."));
  assert.match(content(), /Admin Maria/);
  assert.equal(button("Show more history"), undefined);
  await click(
    container.querySelector('a[href*="update-requests?business_id=41"]'),
  );
  assert.equal(
    container.querySelector("output").textContent,
    "/admin-panel/businesses/update-requests?business_id=41&type=all&status=all",
  );
});

test("missing history and missing application are explicit rather than invented", async () => {
  business.application = null;
  get = async (url) => {
    if (url.includes("status-history/"))
      return response({ items: [], pagination: { page: 1, has_next: false } });
    if (url.endsWith("status/")) return response(lifecycle);
    if (url.includes("discovery-summary/")) return response(visits);
    return response(business);
  };
  await page();
  await until(() => content().includes("No recorded status transitions"));
  assert.match(content(), /No linked application/);
  assert.doesNotMatch(content(), /Never suspended/);
});

test("application outcome determines date wording and preserves attempt count", async () => {
  await render(
    React.createElement(Application, { application: business.application }),
  );
  assert.match(content(), /Approved/);
  assert.match(content(), /2 attempts/);
  await click(
    container.querySelector('a[href="/admin-panel/business/application/88"]'),
  );
  assert.equal(
    container.querySelector("output").textContent,
    "/admin-panel/business/application/88",
  );
  await render(
    React.createElement(Application, {
      application: { ...business.application, status: "rejected" },
    }),
  );
  assert.match(content(), /Rejected/);
  assert.match(content(), /Reviewed/);
  assert.doesNotMatch(content(), /Approved/);
});

test("shared action menu on detail contains only existing management workflows", async () => {
  await page();
  await click(button("More actions"));
  assert.deepEqual(
    [...document.querySelectorAll('[role="menuitem"]')].map(
      (item) => item.textContent,
    ),
    ["View Application", "View Update Requests", "Suspend Business"],
  );
  assert.equal(button("View business"), undefined);
  await click(button("Suspend Business"));
  await until(() => content().includes("Current business status:"));
  assert.ok(container.querySelector("textarea"));
  assert.equal(posts.length, 0);
});

test("shared suspension and reactivation synchronize detail status, explanation and next action", async () => {
  const transition = post;
  post = async (url, payload) => {
    const result = await transition(url, payload);
    business = { ...business, status: lifecycle.status };
    return result;
  };
  await page();
  await click(button("More actions"));
  await click(button("Suspend Business"));
  await until(() => button("Suspend Business")?.disabled === false);
  const input = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set.call(input, "Please correct the listing location.");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await act(async () =>
    container
      .querySelector("form")
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );
  await until(
    () =>
      content().includes("Business suspended") &&
      !container.querySelector("form"),
  );
  assert.equal(posts[0].payload.expected_transition_id, 9);
  await click(button("More actions"));
  await click(button("Reactivate Business"));
  await until(() => button("Reactivate Business")?.disabled === false);
  await act(async () =>
    container
      .querySelector("form")
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      ),
  );
  await until(
    () =>
      !container.querySelector("form") &&
      !content().includes("Business suspended"),
  );
  assert.equal(posts[1].payload.expected_transition_id, 10);
  await click(button("More actions"));
  assert.ok(button("Suspend Business"));
});

test("gallery inspects all server-ordered photos with exact index and one keyboard step", async () => {
  await render(
    React.createElement(Photos, {
      photos: business.photos,
      businessName: business.business_name,
    }),
  );
  await click(button("View all (4)"));
  await click(button("View photo 4"));
  assert.match(content(), /4 \/ 4/);
  await act(async () =>
    document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    ),
  );
  assert.match(content(), /3 \/ 4/);
  await act(async () =>
    document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.equal(
    document.querySelector('[aria-label="Business photo viewer"]'),
    null,
  );
});

test("published review text and attached photos retain modal inspection", async () => {
  const review = business.latest_reviews[0];
  business.latest_reviews = [
    {
      ...review,
      text: "A detailed published review with useful listing feedback. ".repeat(
        10,
      ),
      photos: [{ id: 1, photo_url: business.cover_photo_url }],
    },
  ];
  await page();
  await click(button("Read full review"));
  const modal = document.querySelector('[aria-label="Review preview"]');
  assert.ok(modal);
  assert.match(modal.textContent, /Maria Santos/);
  assert.ok(modal.textContent.includes(business.latest_reviews[0].text));
  assert.ok(modal.querySelector('img[alt="Review photo 1"]'));
  await click(button("Close review"));
  assert.equal(document.querySelector('[aria-label="Review preview"]'), null);
  await click(button("View review photo 1"));
  assert.ok(document.querySelector('[aria-label="Review preview"]'));
});

test("sticky business context starts only after the hero leaves the viewport", async () => {
  await page();
  assert.equal(
    container.querySelector('[aria-label="Business context"]'),
    null,
  );
  await act(async () =>
    intersection([
      { isIntersecting: true, boundingClientRect: { bottom: 400 } },
    ]),
  );
  assert.equal(
    container.querySelector('[aria-label="Business context"]'),
    null,
  );
  await act(async () =>
    intersection([
      { isIntersecting: false, boundingClientRect: { bottom: 60 } },
    ]),
  );
  assert.ok(container.querySelector('[aria-label="Business context"]'));
});

test("initial failure retries and failed background refresh retains successful detail", async () => {
  const successfulGet = get;
  get = async () => {
    throw failure("Offline");
  };
  await render(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/admin-panel/businesses/:businessId",
        element: React.createElement(Page),
      }),
    ),
  );
  await until(() => button("Try Again"));
  assert.doesNotMatch(content(), /Cebu Craft Cafe/);
  get = successfulGet;
  await click(button("Try Again"));
  await until(() => content().includes("Cebu Craft Cafe"));
  get = async (url, options) => {
    if (url.endsWith("41/")) throw failure("Background read failed");
    return successfulGet(url, options);
  };
  await click(button("Refresh business"));
  await until(() => content().includes("Business refresh failed"));
  assert.match(content(), /Cebu Craft Cafe/);
  assert.match(content(), /Published reviews/);
});

function SyncProbe() {
  const detail = useDetail(41);
  const sync = useSync(detail.business, detail.refetch);
  return React.createElement(
    "div",
    null,
    React.createElement("p", null, detail.business?.review_insights?.narrative),
    React.createElement("output", { "data-sync": true }, sync.state),
    React.createElement("button", { onClick: sync.observe }, "Observe"),
  );
}

test("insight observation fetches completion and retains narrative when the read fails", async () => {
  await render(React.createElement(SyncProbe));
  await until(() => content().includes("Reviewers mention"));
  business = {
    ...business,
    review_insights: {
      ...business.review_insights,
      narrative: "Fresh completed narrative.",
    },
  };
  await click(button("Observe"));
  await until(() => content().includes("Fresh completed narrative."));
  assert.equal(container.querySelector("[data-sync]").textContent, "complete");
  get = async () => {
    throw failure("Read failed");
  };
  await click(button("Observe"));
  await until(
    () => container.querySelector("[data-sync]").textContent === "error",
  );
  assert.match(content(), /Fresh completed narrative/);
});

test("hours reuse Manila boundaries, overnight spillover and unavailable state", async () => {
  const { getBusinessDay, getBusinessHoursSummary } = hoursRules;
  const monday = {
    day: "monday",
    is_open: true,
    is_24_hours: false,
    open_time: "22:00",
    close_time: "04:00",
  };
  const closed = {
    day: "tuesday",
    is_open: false,
    is_24_hours: false,
    open_time: null,
    close_time: null,
  };
  assert.equal(getBusinessDay(new Date("2026-10-12T17:00:00Z")), "tuesday");
  assert.equal(
    getBusinessHoursSummary([monday, closed], new Date("2026-10-12T17:00:00Z"))
      .status,
    "open",
  );
  assert.equal(
    getBusinessHoursSummary([monday], new Date("2026-10-11T17:00:00Z")).status,
    "closed",
  );
  assert.equal(
    getBusinessHoursSummary([monday, closed], new Date("2026-10-12T20:00:00Z"))
      .status,
    "closed",
  );
  assert.equal(
    getBusinessHoursSummary(
      [{ ...monday, is_24_hours: true }],
      new Date("2026-10-12T01:00:00Z"),
    ).status,
    "open",
  );
  assert.equal(getBusinessHoursSummary([], new Date()).status, "unavailable");
  await render(React.createElement(Hours, { operatingHours: [] }));
  assert.match(content(), /Hours unavailable/);
  assert.doesNotMatch(content(), /Closed/);
});

test("weekly hours expand by keyboard-accessible button and mark absent days unavailable", async () => {
  await render(
    React.createElement(Hours, {
      operatingHours: [business.operating_hours[0]],
    }),
  );
  await click(button("View all hours"));
  assert.equal(button("Hide hours").getAttribute("aria-expanded"), "true");
  assert.match(content(), /Asia\/Manila/);
  assert.match(content(), /Hours unavailable/);
});

test("normal hours distinguish opening, closing and closed days in Manila", () => {
  const schedule = [
    {
      day: "monday",
      is_open: true,
      is_24_hours: false,
      open_time: "09:00",
      close_time: "18:00",
    },
  ];
  assert.equal(
    hoursRules.getBusinessHoursSummary(
      schedule,
      new Date("2026-10-12T00:59:00Z"),
    ).status,
    "closed",
  );
  assert.equal(
    hoursRules.getBusinessHoursSummary(
      schedule,
      new Date("2026-10-12T01:00:00Z"),
    ).status,
    "open",
  );
  assert.equal(
    hoursRules.getBusinessHoursSummary(
      schedule,
      new Date("2026-10-12T10:00:00Z"),
    ).status,
    "closed",
  );
});

test("optional visits and history failures preserve the core business and retry locally", async () => {
  const successfulGet = get;
  get = async (url, options) => {
    if (url.includes("discovery-summary/") || url.includes("status-history/"))
      throw failure();
    return successfulGet(url, options);
  };
  await page();
  await until(() => button("Retry profile visits") && button("Retry history"));
  assert.match(content(), /Published reviews/);
  assert.match(content(), /Cebu Craft Cafe/);
  get = successfulGet;
  await click(button("Retry profile visits"));
  await click(button("Retry history"));
  await until(
    () => content().includes("217") && content().includes("Admin Juan"),
  );
});

test("resource changes refresh canonical content and status without a new global mechanism", async () => {
  await page();
  business = {
    ...business,
    business_name: "Approved listing name",
    published_review_count: 29,
  };
  lifecycle = {
    ...lifecycle,
    status: "suspended",
    suspension_reason: "Updated listing context",
  };
  await act(async () =>
    window.dispatchEvent(
      new CustomEvent("admin-business-changed", {
        detail: { businessId: null },
      }),
    ),
  );
  await until(
    () =>
      content().includes("Approved listing name") &&
      content().includes("Updated listing context"),
  );
  assert.match(content(), /29/);
});

test("session ownership loss clears detail and rejects an already pending response", async () => {
  await render(React.createElement(SyncProbe));
  await until(() => content().includes("Reviewers mention"));
  let resolveRead;
  get = () =>
    new Promise((resolveReadResult) => {
      resolveRead = resolveReadResult;
    });
  await click(button("Observe"));
  await until(() => Boolean(resolveRead));
  await act(async () => auth.getState().clearUser());
  assert.doesNotMatch(content(), /Reviewers mention/);
  await act(async () => resolveRead(response(business)));
  assert.doesNotMatch(content(), /Reviewers mention/);
});

async function withPollTimers(run) {
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  const timers = new Map();
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 15_000) return originalSet(callback, delay, ...args);
    const token = {};
    timers.set(token, () => callback(...args));
    return token;
  };
  globalThis.clearTimeout = (token) => {
    if (timers.has(token)) timers.delete(token);
    else originalClear(token);
  };
  async function tick() {
    const [token, callback] = timers.entries().next().value || [];
    assert.ok(callback, "A bounded observation timer is scheduled");
    timers.delete(token);
    await act(async () => callback());
  }
  try {
    await run({ timers, tick });
    await act(async () => root.render(null));
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
}

test("insight polling observes processing and retry waits, then stops at completion", async () => {
  await withPollTimers(async ({ timers, tick }) => {
    const pendingBusiness = {
      ...business,
      review_insight_regeneration: {
        status: "scheduled",
        is_outstanding: true,
      },
    };
    let updated = pendingBusiness;
    let calls = 0;
    const refetch = async () => {
      calls += 1;
      return updated;
    };
    function Probe() {
      const sync = useSync(pendingBusiness, refetch);
      return React.createElement("output", null, sync.state);
    }
    await render(React.createElement(Probe));
    await tick();
    updated = {
      ...pendingBusiness,
      review_insight_regeneration: {
        status: "retry_wait",
        is_outstanding: true,
      },
    };
    await tick();
    assert.equal(calls, 2);
    updated = business;
    await tick();
    assert.equal(content().startsWith("complete"), true);
    assert.equal(timers.size, 0);
  });
});

test("insight polling pauses while hidden, resumes visibly and stops on ownership loss", async () => {
  await withPollTimers(async ({ timers, tick }) => {
    let calls = 0;
    const pendingBusiness = {
      ...business,
      review_insight_regeneration: {
        status: "processing",
        is_outstanding: true,
      },
    };
    const refetch = async () => {
      calls += 1;
      return pendingBusiness;
    };
    function Probe() {
      useSync(pendingBusiness, refetch);
      return null;
    }
    await render(React.createElement(Probe));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await tick();
    assert.equal(calls, 0);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await event(document, "visibilitychange");
    assert.equal(calls, 1);
    await act(async () => auth.getState().clearUser());
    assert.equal(timers.size, 0);
  });
});

test("insight observation has a finite request budget and cancels on unmount", async () => {
  await withPollTimers(async ({ timers, tick }) => {
    let calls = 0;
    const pendingBusiness = {
      ...business,
      review_insight_regeneration: {
        status: "processing",
        is_outstanding: true,
      },
    };
    const refetch = async () => {
      calls += 1;
      return pendingBusiness;
    };
    function Probe() {
      const sync = useSync(pendingBusiness, refetch);
      return React.createElement("output", null, sync.state);
    }
    await render(React.createElement(Probe));
    for (let attempt = 0; attempt <= 60; attempt += 1) await tick();
    assert.equal(calls, 60);
    assert.equal(content().startsWith("paused"), true);
    assert.equal(timers.size, 0);
    await render(React.createElement(Probe, { key: "new-owner" }));
    assert.equal(timers.size, 1);
    await act(async () => root.render(null));
    assert.equal(timers.size, 0);
  });
});
