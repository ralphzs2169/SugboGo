import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let createRoot;
let root;
let container;
const components = {};
const names = [
  "AnalyticsSection", "AnalyticsMetricCard", "AnalyticsMetricGrid", "AnalyticsChartCard",
  "AnalyticsDataNotice", "AnalyticsPeriodControl", "AnalyticsIntervalControl",
  "AnalyticsMetricSelector", "AnalyticsTableSection", "AnalyticsReportSkeleton", "AnalyticsDisclosure", "AnalyticsRanking",
];

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  for (const name of names) {
    ({ default: components[name] } = await server.ssrLoadModule(`/src/features/admin-panel/analytics/components/${name}.jsx`));
  }
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

after(async () => {
  await server?.close();
  dom.window.close();
  for (const key of ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"]) delete globalThis[key];
});

const element = (name, props, ...children) => React.createElement(components[name], props, ...children);
const markup = (name, props, ...children) => renderToStaticMarkup(element(name, props, ...children));
const render = async (name, props, ...children) => act(async () => root.render(element(name, props, ...children)));
const button = (label) => [...container.querySelectorAll("button")].find((item) => item.textContent === label);

function changeDate(input, value) {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

test("metric zero stays zero and null never reaches a formatter or becomes zero percent", () => {
  const zero = markup("AnalyticsMetricCard", { label: "SLA compliance", value: 0, formatValue: (value) => `${value}%` });
  assert.match(zero, />0%<\/div>/);
  const missing = markup("AnalyticsMetricCard", {
    label: "SLA compliance", value: null,
    formatValue: () => { throw new Error("Null must not be formatted"); },
    unavailableMessage: "No classified outcomes.",
  });
  assert.match(missing, /Unavailable/);
  assert.match(missing, /No classified outcomes/);
  assert.doesNotMatch(missing, />0%/);
});

test("metric scope is explicit for snapshots and current-state period cohorts", () => {
  assert.match(markup("AnalyticsMetricCard", { label: "Businesses", value: 4, measurementType: "current_snapshot" }), /Current snapshot/);
  assert.match(markup("AnalyticsMetricCard", { label: "Accounts", value: 0, measurementType: "period", measurementLabel: "Last 30 days" }), /Last 30 days/);
  assert.match(markup("AnalyticsMetricCard", { label: "Published reviews", value: 3, measurementType: "period_current_state", context: "Currently retained records" }), /Selected period · current state/);
});

test("comparison direction is textual and semantic intent does not follow sign automatically", () => {
  const props = { label: "Resubmission recovery", value: 42, comparison: { value: 8, direction: "up", unit: "count" } };
  const neutral = markup("AnalyticsMetricCard", props);
  assert.match(neutral, /Increase:/);
  assert.match(neutral, /vs previous period/);
  assert.doesNotMatch(neutral, /text-emerald-600|text-rose-600/);
  assert.match(markup("AnalyticsMetricCard", { ...props, comparisonIntent: "positive" }), /text-emerald-600/);
  assert.match(markup("AnalyticsMetricCard", { ...props, comparisonIntent: "negative" }), /text-rose-600/);
  assert.match(markup("AnalyticsMetricCard", { ...props, comparison: { value: 0, direction: "unchanged", unit: "percentage_points" } }), /0 pts/);
  assert.match(markup("AnalyticsMetricCard", { ...props, comparison: { value: null, reason: "insufficient_sample" } }), /Comparison unavailable/);
});

test("section headings, descriptions, actions and footer are semantically associated", () => {
  const html = markup("AnalyticsSection", {
    title: "Community health", description: "Retained publication cohorts", footer: "Data through October 27",
    controls: React.createElement("button", null, "Control"), action: React.createElement("a", { href: "/reviews" }, "Review queue"),
  }, "Report content");
  assert.match(html, /<section aria-labelledby="[^"]+" aria-describedby="[^"]+"/);
  assert.match(html, /<h2[^>]*>Community health/);
  assert.match(html, /<footer[^>]*>Data through October 27/);
  assert.match(html, /Report content/);
});

test("initial chart loading reserves space and hides unresolved chart content", () => {
  const html = markup("AnalyticsChartCard", { title: "Activity", isLoading: true }, "unresolved chart");
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-label="Loading report"/);
  assert.match(html, /min-h-64/);
  assert.doesNotMatch(html, /unresolved chart/);
});

test("background refresh retains chart content and signals refreshing", () => {
  const html = markup("AnalyticsChartCard", { title: "Activity", hasData: true, isFetching: true, summary: "Exact values available below." }, "retained chart");
  assert.match(html, /retained chart/);
  assert.match(html, /Refreshing/);
  assert.doesNotMatch(html, /Loading report/);
  assert.match(html, /<figcaption/);
});

test("empty results and source unavailability remain distinct report states", () => {
  const empty = markup("AnalyticsChartCard", { title: "Reviews", hasData: true, isEmpty: true, emptyMessage: "No reviews were recorded during this period." }, "chart");
  assert.match(empty, /No reviews were recorded/);
  assert.doesNotMatch(empty, /Unavailable/);
  const missing = markup("AnalyticsChartCard", { title: "Discovery", hasData: true, unavailable: true, unavailableMessage: "Discovery activity is currently unavailable." }, "chart");
  assert.match(missing, /Discovery activity is currently unavailable/);
  assert.doesNotMatch(missing, /No records|<figure/);
});

test("partial data remains visible with a secondary notice rather than an error", () => {
  const html = markup("AnalyticsChartCard", { title: "Coverage", hasData: true, partialNotice: "Tracking coverage is incomplete." }, "available observations");
  assert.match(html, /available observations/);
  assert.match(html, /Partial coverage/);
  assert.match(html, /Tracking coverage is incomplete/);
  assert.doesNotMatch(html, /role="alert"/);
});

test("request failure reuses the shared error state and Retry calls the supplied callback", async () => {
  let retries = 0;
  await render("AnalyticsChartCard", { title: "Discovery", error: new Error("failed"), errorMessage: "Unable to load discovery activity.", onRetry: () => { retries += 1; } });
  assert.match(container.querySelector("[role='alert']").textContent, /Unable to load discovery activity/);
  assert.ok(button("Retry").className.includes("cursor-pointer"));
  await act(async () => button("Retry").click());
  assert.equal(retries, 1);
});

test("failed background refresh retains report values beside a persistent retry state", async () => {
  let retries = 0;
  await render("AnalyticsChartCard", { title: "Growth", hasData: true, error: new Error("failed"), onRetry: () => { retries += 1; } }, "Retained values");
  assert.match(container.textContent, /Retained values/);
  assert.match(container.textContent, /Previously loaded data is shown/);
  await act(async () => button("Retry").click());
  assert.equal(retries, 1);
});

test("period defaults to 30D and presets emit the shared canonical structures", async () => {
  const selections = [];
  await render("AnalyticsPeriodControl", { onChange: (selection) => selections.push(selection) });
  assert.equal(button("30D").getAttribute("aria-pressed"), "true");
  for (const period of ["7", "30", "90"]) {
    await act(async () => button(`${period}D`).click());
  }
  assert.deepEqual(selections, [{ period: "7" }, { period: "30" }, { period: "90" }]);
});

test("custom dates stay draft until both dates are applied and callbacks contain calendar strings", async () => {
  const selections = [];
  await render("AnalyticsPeriodControl", { onChange: (selection) => selections.push(selection) });
  await act(async () => button("Custom").click());
  assert.equal(button("Custom").getAttribute("aria-expanded"), "true");
  assert.equal(button("Apply range").disabled, true);
  const [start, end] = container.querySelectorAll("input[type='date']");
  assert.ok(start.labels.length && end.labels.length);
  await act(async () => changeDate(start, "2026-10-01"));
  assert.equal(button("Apply range").disabled, true);
  assert.equal(selections.length, 0);
  await act(async () => changeDate(end, "2026-10-07"));
  assert.equal(button("Apply range").disabled, false);
  await act(async () => button("Apply range").click());
  assert.deepEqual(selections, [{ period: "custom", start_date: "2026-10-01", end_date: "2026-10-07" }]);
});

test("reversed custom input is described inline and cannot be applied", async () => {
  let applications = 0;
  await render("AnalyticsPeriodControl", { value: { period: "custom", start_date: "2026-10-07", end_date: "2026-10-01" }, onChange: () => { applications += 1; } });
  assert.equal(button("Apply range").disabled, true);
  const start = container.querySelector("input");
  assert.equal(start.getAttribute("aria-invalid"), "true");
  assert.match(document.getElementById(start.getAttribute("aria-describedby")).textContent, /End date must be/);
  await act(async () => container.querySelector("form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(applications, 0);
});

test("preset selection clears custom dates and external range changes reset the editor", async () => {
  let selection;
  await render("AnalyticsPeriodControl", { value: { period: "custom", start_date: "2026-10-01", end_date: "2026-10-07" }, onChange: (next) => { selection = next; } });
  await act(async () => button("7D").click());
  assert.deepEqual(selection, { period: "7" });
  await render("AnalyticsPeriodControl", { value: { period: "custom", start_date: "2026-10-02", end_date: "2026-10-08" }, onChange: () => {} });
  assert.equal(container.querySelector("input").value, "2026-10-02");
});

test("interval and metric controls use labelled native selects and emit only selected values", async () => {
  let interval;
  await render("AnalyticsIntervalControl", { onChange: (next) => { interval = next; } });
  const select = container.querySelector("select");
  assert.equal(select.labels[0].textContent, "Interval");
  assert.equal(select.value, "daily");
  assert.deepEqual([...select.options].map((option) => option.value), ["daily", "weekly"]);
  await act(async () => { select.value = "weekly"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  assert.equal(interval, "weekly");
  let metric;
  await render("AnalyticsMetricSelector", { label: "Discovery metric", value: "saves", onChange: (next) => { metric = next; }, options: [{ value: "saves", label: "Saves" }, { value: "profile_visits", label: "Profile visits" }] });
  const metricSelect = container.querySelector("select");
  await act(async () => { metricSelect.value = "profile_visits"; metricSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  assert.equal(metric, "profile_visits");
  assert.ok(metricSelect.className.includes("cursor-pointer"));
});

test("metric grid supplies responsive columns and reuses labelled Admin skeletons", () => {
  const loaded = markup("AnalyticsMetricGrid", {}, "cards");
  assert.match(loaded, /grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-4/);
  const loading = markup("AnalyticsMetricGrid", { isLoading: true, skeletonCount: 2 });
  assert.match(loading, /aria-label="Loading metrics"/);
  assert.match(loading, /motion-safe:animate-pulse/);
});

test("table section retains DataTable server pagination and ordinary empty messages", async () => {
  let pagination;
  const tableProps = {
    data: [{ name: "Recorded business" }], columns: [{ accessorKey: "name", header: "Business" }],
    state: { sorting: [] }, pagination: { pageIndex: 0, pageSize: 10 },
    pageCount: 2, totalItems: 12, onPaginationChange: (next) => { pagination = next; },
    config: { emptyState: { title: "No businesses match the selected filters." } },
  };
  await render("AnalyticsTableSection", { title: "Attention", tableProps });
  assert.match(container.querySelector("table").textContent, /Recorded business/);
  await act(async () => container.querySelector("button[aria-label='Next page']").click());
  assert.deepEqual(pagination, { pageIndex: 1, pageSize: 10 });
  await render("AnalyticsTableSection", { title: "Attention", tableProps: { ...tableProps, data: [], totalItems: 0, pageCount: 0 } });
  assert.match(container.textContent, /No businesses match the selected filters/);
  await render("AnalyticsTableSection", { title: "Attention", tableProps: { ...tableProps, data: null }, unavailableMessage: "Attention selection is unavailable." });
  assert.match(container.textContent, /Attention selection is unavailable/);
  assert.equal(container.querySelector("table"), null);
});

test("chart exact-value alternative and compact source context remain readable text", () => {
  const html = markup("AnalyticsChartCard", { title: "Activity", summary: "Recorded activity only.", accessibleData: React.createElement("p", null, "Exact values: zero observations") }, "chart slot");
  assert.match(html, /Exact values: zero observations/);
  assert.match(markup("AnalyticsDataNotice", { kind: "fixed" }, "30 completed days"), /Fixed observation window/);
  assert.match(markup("AnalyticsDataNotice", { kind: "snapshot" }), /Current snapshot/);
});

test("ranking values distinguish measured zero from unavailable support", () => {
  const html = markup("AnalyticsRanking", {
    label: "Support ranking",
    rows: [{ id: 1, name: "Observed support", value: 2 }, { id: 2, name: "Measured zero", value: 0 }, { id: 3, name: "Missing evidence", value: null }],
  });
  assert.match(html, /Measured zero<\/span><span[^>]*>0<\/span>/);
  assert.match(html, /Missing evidence<\/span><span[^>]*>Unavailable<\/span>/);
});
