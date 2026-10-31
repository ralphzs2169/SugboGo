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


async function openPeriod() {
  await act(async()=>container.querySelector('[aria-label^="Reporting period:"]').click());
}
async function openCustom() {
  await openPeriod();
  await act(async()=>button("Custom range").click());
}
test("date dropdown applies presets immediately without permanent preset buttons", async () => {
  const selections=[];
  await render("AnalyticsPeriodControl",{onChange:(value)=>selections.push(value)});
  assert.equal(container.querySelectorAll("button").length,1);
  for(const period of ["7","30","90"]) {
    await openPeriod();
    await act(async()=>[...container.querySelectorAll('[role="menuitemradio"]')].find((node)=>node.textContent === `Last ${period} days`).click());
  }
  assert.deepEqual(selections,[{period:"7"},{period:"30"},{period:"90"}]);
});
test("custom dates require Apply and preserve calendar strings", async()=>{
  const selections=[];
  await render("AnalyticsPeriodControl",{onChange:(value)=>selections.push(value)});
  await openCustom();
  assert.equal(button("Apply range").disabled,true);
  const [start,end]=container.querySelectorAll('input[type="date"]');
  await act(async()=>changeDate(start,"2026-10-01"));
  await act(async()=>changeDate(end,"2026-10-07"));
  assert.equal(selections.length,0);
  await act(async()=>button("Apply range").click());
  assert.deepEqual(selections,[{period:"custom",start_date:"2026-10-01",end_date:"2026-10-07"}]);
  assert.equal(container.querySelector('[role="dialog"]'),null);
});
test("Cancel, Escape and outside dismissal discard unapplied custom edits",async()=>{
  let changes=0;
  await render("AnalyticsPeriodControl",{onChange:()=>{changes+=1;}});
  for(const dismissal of ["cancel","escape","outside"]) {
    await openCustom();
    assert.equal(container.querySelector("input").value,"");
    await act(async()=>changeDate(container.querySelector("input"),"2026-10-01"));
    if(dismissal === "cancel") await act(async()=>button("Cancel").click());
    else if(dismissal === "escape") await act(async()=>container.querySelector("input").dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"Escape",bubbles:true})));
    else await act(async()=>document.body.dispatchEvent(new dom.window.MouseEvent("mousedown",{bubbles:true})));
    assert.equal(container.querySelector("input"),null);
    assert.equal(changes,0);
  }
});
test("reversed dates remain invalid and unapplied",async()=>{
  await render("AnalyticsPeriodControl",{value:{period:"custom",start_date:"2026-10-07",end_date:"2026-10-01"},onChange:()=>assert.fail("Invalid apply")});
  await openCustom();
  assert.equal(container.querySelector("input").getAttribute("aria-invalid"),"true");
  assert.equal(button("Apply range").disabled,true);
});

test("interval and metric controls share popovers and emit selected values", async () => {
  const click = async (element) => act(async () => element.click());
  let interval;
  await render("AnalyticsIntervalControl", { onChange: (next) => { interval = next; } });
  assert.equal(container.querySelector("select"), null);
  await click(container.querySelector('[aria-label="Reporting interval: Daily"]'));
  await click([...container.querySelectorAll('[role="menuitemradio"]')].find((option) => option.textContent === "Weekly"));
  assert.equal(interval, "weekly");
  let metric;
  await render("AnalyticsMetricSelector", { label: "Discovery metric", value: "saves", onChange: (next) => { metric = next; }, options: [{ value: "saves", label: "Saves" }, { value: "profile_visits", label: "Profile visits" }] });
  const trigger = container.querySelector('[aria-label="Discovery metric: Saves"]');
  await click(trigger);
  assert.equal(container.querySelector('[aria-checked="true"]').textContent, "Saves");
  await click([...container.querySelectorAll('[role="menuitemradio"]')].find((option) => option.textContent === "Profile visits"));
  assert.equal(metric, "profile_visits");
  assert.equal(document.activeElement, trigger);
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
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

test("reused Moderation sort menu retains default keyboard selection and focus recovery",async()=>{
  ({default:components.SortMenu}=await server.ssrLoadModule("/src/features/admin-panel/components/data-table/SortMenu.jsx"));
  let selected;
  await render("SortMenu",{value:"new",options:[{value:"new",label:"Newest first"},{value:"old",label:"Oldest first"}],onChange:(value)=>{selected=value;}});
  const trigger=container.querySelector('[aria-label="Sort items: Newest first"]');
  await act(async()=>trigger.click());
  assert.equal(container.querySelector('[role="dialog"]'),null);
  assert.equal(document.activeElement.textContent,"Newest first");
  await act(async()=>document.activeElement.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"ArrowDown",bubbles:true})));
  assert.equal(document.activeElement.textContent,"Oldest first");
  await act(async()=>document.activeElement.click());
  assert.equal(selected,"old");
  assert.equal(document.activeElement,trigger);
});
