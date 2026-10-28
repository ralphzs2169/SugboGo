import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";
import { fixtureReport, fixtureTaxonomy } from "./dashboardFixtures.js";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let dom;
let server;
let Page;
let createRoot;
let root;
let container;
let client;
let reads;
let failures;
let overrides;

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom", ssr: { noExternal: ["recharts"] }, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "dashboard-transport-and-chart-contract", enforce: "pre",
      resolveId(source) { if (source === "recharts") return "\0analytics-recharts"; },
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) return "export default { get: (...args) => globalThis.__dashboardTransport(...args) };";
        if (id === "\0analytics-recharts") return `import React from 'react';
          const SeriesData = React.createContext([]);
          export const ResponsiveContainer = ({children}) => React.createElement('div', null, children);
          export const LineChart = ({data, children}) => React.createElement('div', {'data-chart': JSON.stringify(data),'data-chart-type':'line'}, children);
          export const BarChart = ({data, children, maxBarSize}) => React.createElement('div', {'data-chart': JSON.stringify(data),'data-chart-type':'bar','data-max-bar-size':maxBarSize}, React.Children.map(children, (child) => child?.type === 'defs' ? React.createElement('svg', null, child) : child));
          export const ComposedChart = ({data,children}) => React.createElement(SeriesData.Provider, {value:data}, React.createElement('div', {'data-chart':JSON.stringify(data),'data-chart-type':'line','data-area-fade':'true'}, React.Children.map(children, (child) => child?.type === 'defs' ? React.createElement('svg', null, child) : child)));
          export const Area = ({connectNulls}) => React.createElement('span', {'data-area-connect-nulls':String(connectNulls)});
          export const Line = ({dataKey,connectNulls,dot}) => {
            const rows = React.useContext(SeriesData);
            return React.createElement('span', {'data-series':dataKey,'data-series-type':'line','data-connect-nulls':String(connectNulls)},
              React.createElement('svg', {'data-observation-markers':true}, typeof dot === 'function' ? rows.map((row,index) => dot({index,cx:index * 10,cy:20,payload:row})) : null));
          };
          export const Bar = ({dataKey,fill,stackId}) => React.createElement('span', {'data-series':dataKey,'data-series-type':'bar','data-fill':fill,'data-stack':stackId});
          export const XAxis = ({type,dataKey,domain,ticks}) => React.createElement('span',{'data-axis-type':type,'data-axis-key':dataKey,'data-domain':JSON.stringify(domain),'data-ticks':JSON.stringify(ticks)});
          export const YAxis = ({allowDecimals}) => React.createElement('span',{'data-allow-decimals':String(allowDecimals)});
          export const Tooltip = ({filterNull,formatter}) => React.createElement('span',{'data-filter-null':String(filterNull),'data-tooltip-zero':formatter(0,'Selected metric')[0],'data-tooltip-missing':formatter(null,'Selected metric')[0]});
          export const ReferenceArea = ({x1,x2}) => React.createElement("span", {"data-partial-start":x1,"data-partial-end":x2});
          export const CartesianGrid = () => null; export const Legend = () => React.createElement("span", {"data-legend":"true"});`;
      },
    }],
  });
  ({ default: Page } = await server.ssrLoadModule("/src/features/admin-panel/pages/Analytics.jsx"));
});

beforeEach(() => {
  reads = [];
  failures = new Set();
  overrides = new Map();
  globalThis.__dashboardTransport = async (url, { params }) => {
    reads.push({ url, params });
    if (failures.has(url)) throw new Error(`Failed ${url}`);
    let report = url.includes("/taxonomy/") ? fixtureTaxonomy(url) : fixtureReport(url.replace("/admin/analytics/", ""), params);
    if (overrides.has(url)) report = await overrides.get(url)(report, params);
    return { data: { data: report } };
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity } } });
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
  await server?.close();
  dom.window.close();
  for (const key of ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT", "__dashboardTransport"]) delete globalThis[key];
});

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Dashboard did not reach expected state");
}
async function mount() {
  await act(async () => root.render(React.createElement(QueryClientProvider, { client }, React.createElement(MemoryRouter, null, React.createElement(Page)))));
  await until(() => reads.length >= 14 && client.isFetching() === 0);
  await act(async () => new Promise((done) => setTimeout(done, 10)));
}
const section = (title) => [...container.querySelectorAll("h2")].find((heading) => heading.textContent === title)?.closest("section");
const select = (label) => [...container.querySelectorAll("select")].find((element) => element.labels[0]?.textContent === label);
const requests = (route) => reads.filter(({ url }) => url === `/admin/analytics/${route}`);
const metric = (label) => [...container.querySelectorAll("h3")].find((heading) => heading.textContent === label)?.closest(".relative");
const click = async (element) => act(async () => element.click());
async function choose(label, value) {
  if (label === "Discovery metric") {
    const name = { profile_visits: "profile visits", impressions: "impressions", saves: "saves" }[value];
    await click(container.querySelector(`[aria-label="Show recorded ${name}"]`));
    await until(() => client.isFetching() === 0);
    await act(async () => new Promise((done) => setTimeout(done, 10)));
    return;
  }
  await act(async () => { const input = select(label); input.value = value; input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => client.isFetching() === 0);
  await act(async () => new Promise((done) => setTimeout(done, 10)));
}
const periodButton = (period) => [...container.querySelectorAll("button")].find((button) => button.textContent === `${period}D`);

function primaryText(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll("details:not([open])").forEach((details) => details.replaceWith(details.querySelector("summary").cloneNode(true)));
  clone.querySelectorAll(".sr-only").forEach((item) => item.remove());
  return clone.textContent;
}

const disclosure = (element, label) => [...element.querySelectorAll("summary")].find((summary) => summary.getAttribute("aria-label") === label);

test("MVP mounts reports once, shares taxonomy options, and defers low exposure and heatmap", async () => {
  await mount();
  assert.equal(reads.length, 14);
  assert.equal(new Set(reads.map(({ url }) => url)).size, 14);
  assert.equal(requests("low-exposure/").length, 0);
  assert.equal(requests("discovery-heatmap/").length, 0);
  assert.equal(requests("discovery-scores/")[0].params.page_size, 1);
  assert.equal(container.querySelector("h1").textContent, "Analytics");
});

test("overview preserves measured zero, missing activity, valid comparison and snapshot semantics", async () => {
  await mount();
  const overview = section("Overview");
  const active = [...overview.querySelectorAll("h3")].find((item) => item.textContent === "Active businesses").parentElement.parentElement;
  assert.match(active.textContent, /0Current snapshot/);
  assert.doesNotMatch(active.textContent, /Increase|previous period/);
  assert.match(overview.textContent, /New Explorer accounts/);
  assert.match(overview.textContent, /whose current role is Explorer/);
  assert.match(overview.textContent, /Increase: 2/);
  assert.equal(metric("Discovery-active accounts").querySelector(".text-3xl").textContent, "Unavailable");
  assert.match(overview.textContent, /not general platform MAU/);
});

test("growth displays all three persisted series and preserves temporal nulls and zeroes", async () => {
  await mount();
  const growth = section("Platform Growth");
  const rows = JSON.parse(growth.querySelector("[data-chart]").dataset.chart);
  assert.equal(rows[1].new_consumer_accounts, null);
  assert.equal(rows[2].new_consumer_accounts, 0);
  assert.equal(rows[2].time - rows[0].time, 2 * 24 * 60 * 60 * 1000);
  assert.equal(growth.querySelector("[data-chart-type]").dataset.chartType, "bar");
  assert.equal(growth.querySelector("[data-axis-type]").dataset.axisType, "category");
  assert.equal(growth.querySelector("[data-series]").dataset.seriesType, "bar");
  assert.equal(select("Growth metric"), undefined);
  assert.equal(requests("platform-growth/").length, 1);
  assert.equal(growth.querySelectorAll("[data-series-type='bar']").length, 3);
});

test("7/90/30 presets change affected queries but do not refetch current-only reports", async () => {
  await mount();
  for (const period of ["7", "90", "30"]) {
    await click(periodButton(period));
    await until(() => client.isFetching() === 0);
    assert.equal(periodButton(period).getAttribute("aria-pressed"), "true");
    if (period !== "30") assert.equal(requests("platform-growth/").at(-1).params.period, period);
  }
  assert.equal(requests("specialty-support/").length, 1);
  assert.equal(requests("discovery-scores/").length, 1);
  assert.equal(reads.filter(({ url }) => url.includes("/taxonomy/")).length, 2);
});

test("custom ranges issue no draft requests and send inclusive calendar strings only after apply", async () => {
  await mount();
  const original = reads.length;
  await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Custom"));
  const inputs = container.querySelectorAll("input[type='date']");
  const setDate = (input, value) => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  };
  await act(async () => setDate(inputs[0], "2026-10-01"));
  assert.equal(reads.length, original);
  await act(async () => setDate(inputs[1], "2026-10-07"));
  await click([...container.querySelectorAll("button")].find((button) => button.textContent === "Apply range"));
  await until(() => client.isFetching() === 0);
  assert.deepEqual(requests("").at(-1).params, { period: "custom", start_date: "2026-10-01", end_date: "2026-10-07" });
});

test("discovery failure leaves onboarding/community usable and Retry only requests discovery", async () => {
  failures.add("/admin/analytics/discovery-trend/");
  await mount();
  assert.match(section("Discovery Activity").textContent, /Unable to load discovery activity/);
  assert.match(section("Merchant Onboarding").textContent, /Pending \/ overdue8 \/ 2/);
  assert.match(section("Community Health").textContent, /Unclassified reviews1/);
  const total = reads.length;
  failures.clear();
  await click([...section("Discovery Activity").querySelectorAll("button")].find((button) => button.textContent === "Retry"));
  await until(() => client.isFetching() === 0);
  assert.equal(reads.length, total + 1);
  await until(() => !section("Discovery Activity").querySelector("[role='alert']"));
  assert.doesNotMatch(section("Discovery Activity").textContent, /Unable to load discovery activity/);
});

test("discovery controls request only supported metric/interval variants and show partial context", async () => {
  await mount();
  await choose("Discovery metric", "saves");
  assert.equal(requests("discovery-trend/").at(-1).params.metric, "saves");
  const localInterval = section("Discovery Activity").querySelector("select");
  await act(async () => { localInterval.value = "daily"; localInterval.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-trend/").at(-1).params.interval, "daily");
  await until(() => section("Discovery Activity").querySelector("[data-chart]"));
  assert.match(section("Discovery Activity").textContent, /Partial coverage/);
  assert.doesNotMatch(section("Discovery Activity").textContent, /Tracking coverage is unverified/);
  assert.match(section("Discovery Activity").textContent, /Partial coverage/);
  assert.equal(requests("onboarding/").length, 1);
});

test("successful unavailable discovery is not an HTTP failure or a zero and preserves other sections", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({ ...report, value: null, series: null, timeline: null, meta: { ...report.meta, availability: "unavailable" } }));
  await mount();
  assert.match(section("Discovery Activity").textContent, /Discovery activity is currently unavailable/);
  assert.equal(section("Discovery Activity").querySelector("[role='alert']"), null);
  assert.equal(metric("Approved businesses").querySelector(".text-3xl").textContent, "12");
});

test("onboarding presents grouped workload, compact scoped statistics and complete report details", async () => {
  await mount();
  const onboarding = section("Merchant Onboarding");
  assert.equal(onboarding.querySelector("[data-chart-type]").dataset.chartType, "bar");
  assert.equal(onboarding.querySelectorAll("[data-series-type='bar']").length, 2);
  assert.equal(onboarding.querySelector("[data-stack]"), null);
  assert.equal(onboarding.querySelector("[data-series-type='line']"), null);
  assert.match(onboarding.textContent, /Pending \/ overdue8 \/ 2/);
  assert.match(onboarding.textContent, /Current snapshot/);
  assert.match(onboarding.textContent, /All classified recorded reviews/);
  assert.match(onboarding.textContent, /Median review turnaroundUnavailable/);
  assert.equal(onboarding.querySelectorAll(".text-3xl").length, 0);
  assert.match(onboarding.textContent, /Sections may overlap/);
  assert.match(onboarding.textContent, /All-time · as of now/);
  await click([...onboarding.querySelectorAll("button")].find((button) => button.textContent.includes("About this report")));
  const drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /On time3/);
  assert.match(drawer.textContent, /strictly after a rejection/);
  assert.match(drawer.textContent, /unknowns are excluded/);
  assert.match(drawer.textContent, /Missing timestamps/);
});

test("community uses persisted sentiment, classified shares, and discloses unclassified current-state history", async () => {
  await mount();
  const community = section("Community Health");
  assert.match(community.textContent, /Positive100% · 1/);
  assert.match(community.textContent, /Neutral0% · 0/);
  assert.match(community.textContent, /Unclassified1Excluded from denominator/);
  assert.match(community.textContent, /not immutable publication history/);
});

test("coverage filtering is scoped and a zero-denominator category has unavailable percentage", async () => {
  await mount();
  assert.match(section("Business Coverage").textContent, /Empty category000Unavailable/);
  await choose("Coverage cluster", "1");
  await choose("Coverage category", "2");
  assert.deepEqual(requests("coverage/").at(-1).params, { period: "30", cluster: 1, category: 2 });
  assert.equal(requests("business-attention/").length, 1);
});

test("business attention uses server pagination and accessible ordering with page reset", async () => {
  await mount();
  const attention = section("Businesses Needing Attention");
  await click(attention.querySelector("button[aria-label='Next page']"));
  await until(() => client.isFetching() === 0);
  assert.equal(requests("business-attention/").at(-1).params.page, 2);
  await choose("Order by", "-valid_vouches");
  assert.equal(requests("business-attention/").at(-1).params.page, 1);
  assert.equal(requests("business-attention/").at(-1).params.ordering, "-valid_vouches");
  assert.match(section("Businesses Needing Attention").textContent, /Unavailable/);
});

test("low-attention mode mounts on demand, uses fixed dates and ignores global period changes", async () => {
  await mount();
  await choose("Attention mode", "low");
  assert.equal(requests("low-exposure/").length, 1);
  assert.equal(requests("business-attention/").length, 1);
  assert.equal(requests("low-exposure/")[0].params.period, undefined);
  assert.match(section("Businesses Needing Attention").textContent, /2026-09-01 to 2026-09-30/);
  assert.match(section("Businesses Needing Attention").textContent, /not a ranking of business quality/);
  await click(periodButton("7"));
  await until(() => client.isFetching() === 0);
  assert.equal(requests("low-exposure/").length, 1);
  assert.equal(requests("business-attention/").length, 1);
});

test("operations, specialty global distincts and overlapping score counters are explicit", async () => {
  await mount();
  assert.match(section("Reports & disputes").textContent, /Pending review reports3/);
  assert.match(section("Merchant change requests").textContent, /Withdrawn · selected period1/);
  const specialty = section("Specialty Support");
  assert.match(specialty.textContent, /Distinct supporters2/);
  assert.match(specialty.textContent, /must not be summed/);
  assert.match(section("Discovery Score Health").textContent, /Counters can overlap/);
  const paths = [...container.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href"));
  for (const path of ["/admin-panel/businesses/applications", "/admin-panel/moderation-integrity", "/admin-panel/businesses/update-requests", "/admin-panel/analytics/discovery-scores", "/admin-panel/businesses/10"]) assert.ok(paths.includes(path));
});

test("coverage visibility outage preserves SQL denominators without invented percentages", async () => {
  overrides.set("/admin/analytics/coverage/", (report) => ({
    ...report,
    overall: { ...report.overall, visited_businesses: null, zero_recorded_visit_businesses: null, coverage_percentage: null },
    sources: { visibility: { availability: "unavailable" } },
  }));
  await mount();
  assert.match(section("Business Coverage").textContent, /Eligible businesses4/);
  assert.match(section("Business Coverage").textContent, /Businesses with recorded visitsUnavailable/);
  assert.match(section("Business Coverage").textContent, /Current eligible-business counts remain available/);
});

test("merchant request failure does not hide reports or disputes", async () => {
  failures.add("/admin/analytics/change-requests/");
  await mount();
  assert.ok(section("Merchant change requests").querySelector("[role='alert']"));
  assert.match(section("Reports & disputes").textContent, /Median dispute resolution4 hours/);
});

test("unavailable attention selection remains unavailable rather than an empty table", async () => {
  overrides.set("/admin/analytics/business-attention/", (report) => ({ ...report, items: null, pagination: null }));
  await mount();
  assert.match(section("Businesses Needing Attention").textContent, /This selection is unavailable/);
  assert.equal(section("Businesses Needing Attention").querySelector("table"), null);
  assert.doesNotMatch(section("Businesses Needing Attention").textContent, /No businesses match/);
});

test("shared taxonomy queries fetch all option pages once instead of truncating at 100", async () => {
  overrides.set("/admin/taxonomy/clusters/", (report, params) => params.page === 1
    ? { ...report, pagination: { has_next: true } }
    : { items: [{ id: 5, name: "Later-page cluster" }], pagination: { has_next: false } });
  await mount();
  const optionReads = reads.filter(({ url }) => url === "/admin/taxonomy/clusters/");
  assert.deepEqual(optionReads.map(({ params }) => params.page), [1, 2]);
  assert.ok([...select("Coverage cluster").options].some((option) => option.value === "5"));
  assert.ok([...select("Attention cluster").options].some((option) => option.value === "5"));
});

test("background refetch retains rendered values and shows section refresh progress", async () => {
  await mount();
  let finish;
  overrides.set("/admin/analytics/community-health/", (report) => new Promise((resolveReport) => {
    finish = () => resolveReport(report);
  }));
  let refetch;
  await act(async () => { refetch = client.refetchQueries({ queryKey: ["admin", "analytics", "communityHealth"] }); });
  await until(() => section("Community Health").textContent.includes("Refreshing"));
  assert.match(section("Community Health").textContent, /Published reviews in period2/);
  assert.equal(section("Community Health").querySelector("[aria-label='Loading report']"), null);
  await act(async () => { finish(); await refetch; });
});

test("compact overview keeps definitions behind named keyboard-operable info disclosures", async () => {
  await mount();
  const card = metric("New Explorer accounts");
  assert.doesNotMatch(primaryText(card), /whose current role|promotion to Merchant/);
  assert.match(primaryText(card), /Last 30 days/);
  const trigger = disclosure(card, "About New Explorer accounts");
  assert.equal(trigger.parentElement.open, false);
  await click(trigger);
  assert.equal(trigger.parentElement.open, true);
  assert.match(primaryText(card), /whose current role is Explorer/);
  await act(async () => trigger.parentElement.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(trigger.parentElement.open, false);
  assert.equal(document.activeElement, trigger);
});

test("report metadata and coverage caveats are secondary but remain available on expansion", async () => {
  await mount();
  const growth = section("Platform Growth");
  assert.doesNotMatch(primaryText(growth), /Report generated:|Data through:|Accounts exclude staff/);
  const trigger = growth.querySelector("[aria-label='About Platform Growth']");
  trigger.focus();
  await click(trigger);
  const drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Report generated|Data through/);
  assert.match(drawer.textContent, /Accounts exclude staff/);
  await click(drawer.querySelector("button"));
  assert.equal(document.activeElement, trigger);
  const partial = section("Discovery Activity").querySelector("[aria-label='About Discovery Activity']");
  await click(partial);
  const discoveryDrawer = document.querySelector("dialog[open]");
  assert.match(discoveryDrawer.textContent, /About Discovery Activity/);
  assert.match(discoveryDrawer.textContent, /coverage is not fully verified/);
  await click(discoveryDrawer.querySelector("button"));
  assert.equal(reads.length, 14);
});

test("onboarding ranks all rejection sections and opens exact breakdown and workload in the drawer", async () => {
  overrides.set("/admin/analytics/onboarding/", (report) => ({ ...report, review_turnaround: { ...report.review_turnaround, median_hours: 0.05 }, rejection_insights: { ...report.rejection_insights, sections: report.rejection_insights.sections.map((row) => ({ ...row, rejection_decisions: row.section === "identity" ? 4 : 1 })) } }));
  await mount();
  const onboarding = section("Merchant Onboarding");
  assert.match(onboarding.textContent, /Median review turnaround3 min/);
  const ranking = onboarding.querySelector("ol");
  assert.deepEqual([...ranking.querySelectorAll("li")].map((row) => row.textContent), ["Identity4", "Location1"]);
  await click([...onboarding.querySelectorAll("button")].find((button) => button.textContent.includes("View breakdown")));
  let drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Distinct applications|Share of decisions/);
  await click(drawer.querySelector("button"));
  await click([...onboarding.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Merchant Onboarding — Exact Data/);
  assert.match(drawer.textContent, /Completed reviews/);
  assert.equal(onboarding.querySelector("table"), null);
  assert.equal(onboarding.querySelector("a").getAttribute("href"), "/admin-panel/businesses/applications");
  assert.equal(requests("onboarding/").length, 1);
});

test("onboarding duration preserves hour and minute units without changing values", async () => {
  overrides.set("/admin/analytics/onboarding/", (report) => ({ ...report, review_turnaround: { ...report.review_turnaround, median_hours: 1.5 } }));
  await mount();
  assert.match(section("Merchant Onboarding").textContent, /Median review turnaround1 hr 30 min/);
});

test("sentiment primary composition retains backend shares and unclassified count without a raw table", async () => {
  await mount();
  const community = section("Community Health");
  assert.match(primaryText(community), /Positive100% · 1/);
  assert.match(primaryText(community), /Unclassified reviews1/);
  assert.equal(community.querySelector("table").closest("details").open, false);
  await click(disclosure(community, "Sentiment details"));
  assert.match(primaryText(community), /Excluded from denominator/);
});

test("coverage surfaces the pooled insight before its expandable full denominator table", async () => {
  await mount();
  const coverage = section("Business Coverage");
  assert.match(primaryText(coverage), /50% coverage/);
  assert.match(primaryText(coverage), /2 of 4 eligible businesses/);
  assert.doesNotMatch(primaryText(coverage), /Empty category/);
  await click(disclosure(coverage, "View full coverage"));
  assert.match(primaryText(coverage), /Empty category000Unavailable/);
});

test("specialty ranking uses endorsement counts while full distinct populations stay available", async () => {
  await mount();
  const specialty = section("Specialty Support");
  assert.match(primaryText(specialty), /Distinct supporters2/);
  assert.deepEqual([...specialty.querySelectorAll("ol li")].map((row) => row.textContent), ["Coffee4", "Desserts2"]);
  assert.equal(specialty.querySelector("table").closest("details").open, false);
  await click(disclosure(specialty, "View specialty breakdown"));
  assert.match(primaryText(specialty), /Coffee422/);
});

test("attention retains all metrics in fewer columns and section navigation targets existing regions", async () => {
  await mount();
  const attention = section("Businesses Needing Attention");
  assert.equal(attention.querySelectorAll("th").length, 6);
  assert.match(attention.querySelector("tbody").textContent, /Cafes · Food/);
  for (const link of container.querySelectorAll("nav[aria-label='Analytics sections'] a")) assert.ok(container.querySelector(link.getAttribute("href")));
  assert.equal(reads.length, 14);
});

test("all growth metrics use independent bars while daily/weekly controls preserve request reuse", async () => {
  await mount();
  for (const key of ["new_consumer_accounts", "new_businesses", "newly_approved_businesses"]) {

    const growth = section("Platform Growth");
    assert.equal(growth.querySelector("[data-chart-type]").dataset.chartType, "bar");
    assert.ok([...growth.querySelectorAll("[data-series]")].some((bar) => bar.dataset.series === key));
    assert.equal(new Set([...growth.querySelectorAll("[data-fill]")].map((bar) => bar.dataset.fill)).size, 3);
    assert.equal(growth.querySelector("[data-series-type='line']"), null);
    assert.equal(growth.querySelector("[data-stack]"), null);
    assert.equal(growth.querySelector("[data-allow-decimals]").dataset.allowDecimals, "false");
    assert.equal(growth.querySelector("[data-filter-null]").dataset.filterNull, "false");
    assert.equal(growth.querySelector("[data-axis-key]").dataset.axisKey, "date");
    assert.equal(growth.querySelector("[data-tooltip-zero]").dataset.tooltipZero, "0");
    assert.equal(growth.querySelector("[data-tooltip-missing]").dataset.tooltipMissing, "Unavailable");
    assert.equal(growth.querySelector("[data-max-bar-size]").dataset.maxBarSize, "28");
  }
  assert.equal(requests("platform-growth/").length, 1);
  assert.equal(requests("platform-growth/")[0].params.interval, "weekly");
  const interval = section("Platform Growth").querySelector("select");
  await act(async () => { interval.value = "daily"; interval.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => section("Platform Growth").querySelector("[data-chart-type='bar']") && client.isFetching() === 0);
  assert.equal(requests("platform-growth/").at(-1).params.interval, "daily");
  assert.equal(requests("platform-growth/").length, 2);
  await act(async () => { interval.value = "weekly"; interval.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => section("Platform Growth").querySelector("[data-chart-type='bar']") && client.isFetching() === 0);
  assert.equal(requests("platform-growth/").length, 2);
  assert.equal(requests("discovery-trend/").length, 1);
  assert.equal(requests("onboarding/").length, 1);
});

test("growth exact values retain null/zero and other analytics charts remain lines", async () => {
  await mount();
  const growth = section("Platform Growth");
  const rows = JSON.parse(growth.querySelector("[data-chart]").dataset.chart);
  assert.equal(rows[1].new_consumer_accounts, null);
  assert.equal(rows[2].new_consumer_accounts, 0);
  const exact = [...growth.querySelectorAll("button")].find((button) => button.textContent === "View data →");
  await click(exact);
  const drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Platform Growth — Exact Data/);
  assert.match(drawer.textContent, /Unavailable/);
  assert.match(drawer.textContent, /Accounts/);
  await act(async () => drawer.dispatchEvent(new dom.window.Event("cancel", { cancelable: true })));
  assert.equal(document.querySelector("dialog[open]"), null);
  for (const title of ["Discovery Activity", "Community Health"]) {
    const report = section(title);
    assert.equal(report.querySelector("[data-chart-type]").dataset.chartType, "line");
    assert.equal(report.querySelector("[data-series-type='bar']"), null);
    assert.ok([...report.querySelectorAll("[data-connect-nulls]")].every((line) => line.dataset.connectNulls === "false"));
  }
});


test("growth measured-zero activity keeps three KPIs and an explicit empty chart state", async () => {
  overrides.set("/admin/analytics/platform-growth/", (report) => ({
    ...report,
    activity: Object.fromEntries(Object.entries(report.activity).map(([key, value]) => [key, { ...value, value: 0 }])),
    series: report.series.map((row) => ({ ...row, new_consumer_accounts: 0, new_businesses: 0, newly_approved_businesses: 0 })),
  }));
  await mount();
  const growth = section("Platform Growth");
  for (const title of ["New accounts", "New businesses", "Business approvals"]) {
    assert.match(metric(title).textContent, /0/);
  }
  assert.match(growth.textContent, /No growth activity in this period/);
  assert.equal(growth.querySelector("[data-chart]"), null);
});

test("growth request failure retries independently without enabling report drawers", async () => {
  failures.add("/admin/analytics/platform-growth/");
  await mount();
  const growth = section("Platform Growth");
  assert.match(growth.textContent, /Unable to load platform growth/);
  assert.equal(growth.querySelector("[aria-label='About Platform Growth']").disabled, true);
  assert.ok(section("Discovery Activity").querySelector("[data-chart]"));
  const discoveryRequests = requests("discovery-trend/").length;
  failures.clear();
  await click([...growth.querySelectorAll("button")].find((button) => button.textContent.includes("Retry")));
  await until(() => growth.querySelector("[data-chart]") && client.isFetching() === 0);
  assert.equal(requests("platform-growth/").length, 2);
  assert.equal(requests("discovery-trend/").length, discoveryRequests);
});


test("growth comparisons remain numeric, neutral and explicit about previous values", async () => {
  overrides.set("/admin/analytics/platform-growth/", (report) => ({
    ...report,
    activity: {
      ...report.activity,
      new_businesses: { ...report.activity.new_businesses, change: { value: -3, direction: "down", unit: "count" } },
      newly_approved_businesses: { ...report.activity.newly_approved_businesses, change: { value: 0, direction: "unchanged", unit: "count" } },
    },
  }));
  await mount();
  assert.match(metric("New accounts").textContent, /Previous 2 · ↑ 2/);
  assert.equal(metric("New accounts").querySelector(".text-emerald-600"), null);
  assert.match(metric("New businesses").textContent, /Previous 2 · ↓ 3/);
  assert.equal(metric("New businesses").querySelector(".text-rose-600"), null);
  assert.match(metric("Business approvals").textContent, /Previous 2 · No change/);
});


test("growth exposes period context and marks only a currently capped incomplete week", async () => {
  const { growthWeekInProgress, growthBucketLabel } = await server.ssrLoadModule("/src/features/admin-panel/analytics/utils/growthPresentation.js");
  const row = { date: "2026-10-26", start: "2026-10-25T16:00:00Z", end_exclusive: "2026-10-28T07:50:00Z", new_consumer_accounts: 0, new_businesses: null, newly_approved_businesses: 0 };
  overrides.set("/admin/analytics/platform-growth/", (report) => ({
    ...report,
    series: [row],
    meta: {
      ...report.meta,
      generated_at: row.end_exclusive,
      period: { ...report.meta.period, previous_start: "2026-09-01T16:00:00Z", previous_end_exclusive: "2026-09-30T16:00:00Z" },
    },
  }));
  await mount();
  const growth = section("Platform Growth");
  assert.match(growth.textContent, /Selected period:/);
  assert.match(growth.textContent, /Compared with: Sep 2, 2026 – Sep 30, 2026/);
  assert.match(growth.textContent, /Weekly activity · selected period only/);
  assert.equal(growth.querySelector("[data-partial-start]").dataset.partialStart, row.date);
  assert.equal(growthWeekInProgress({ series: [row], meta: { generated_at: "2026-11-02T00:00:00Z" } }, "weekly"), null);
  assert.equal(growthWeekInProgress({ series: [row], meta: { generated_at: row.end_exclusive } }, "daily"), null);
  assert.equal(growthBucketLabel(row), "Oct 26 – Oct 28");
  assert.equal(growthBucketLabel({ start: "2026-10-18T16:00:00Z", end_exclusive: "2026-10-25T16:00:00Z" }), "Oct 19 – Oct 25");
});


test("discovery uses one recorded-activity series with consistent colors and shared data drawer", async () => {
  await mount();
  const discovery = section("Discovery Activity");
  assert.match(discovery.textContent, /Recorded profile visits by week/);
  assert.equal(requests("discovery-trend/")[0].params.interval, "weekly");
  assert.equal(discovery.querySelector("[data-legend]"), null);
  assert.equal(discovery.querySelectorAll("[data-series-type='bar']").length, 1);
  assert.equal(discovery.querySelector("[data-series-type='line']"), null);
  assert.equal(discovery.querySelector("linearGradient"), null);
  const rows = JSON.parse(discovery.querySelector("[data-chart]").dataset.chart);
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].value, 0);
  assert.equal(discovery.querySelector("[data-fill]").dataset.fill, "var(--color-info)");
  await choose("Discovery metric", "impressions");
  assert.equal(discovery.querySelector("[data-fill]").dataset.fill, "var(--color-primary)");
  await choose("Discovery metric", "saves");
  assert.equal(discovery.querySelector("[data-fill]").dataset.fill, "var(--color-success)");
  const trigger = [...discovery.querySelectorAll("button")].find((button) => button.textContent.trim() === "View data");
  await click(trigger);
  const drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Discovery Activity — Exact Data/);
  assert.match(drawer.textContent, /Saves/);
  assert.match(drawer.textContent, /Unavailable/);
  assert.equal(discovery.querySelector("table"), null);
  await click(drawer.querySelector("button"));
  assert.equal(requests("discovery-trend/").length, 3);
  assert.equal(requests("discovery-summary/").length, 1);
});

test("discovery measured zero is empty recorded activity rather than unavailable", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({
    ...report, value: 0, series: report.series.map((row) => ({ ...row, value: 0 })), timeline: report.timeline.map((row) => ({ ...row, value: 0 })),
  }));
  await mount();
  const discovery = section("Discovery Activity");
  assert.match(discovery.textContent, /0profile visits/);
  assert.match(discovery.textContent, /No profile visits were recorded during this period/);
  assert.doesNotMatch(discovery.textContent, /Discovery activity is currently unavailable/);
  assert.match(discovery.textContent, /Previous-period comparison unavailable/);
});


test("discovery summary remains independent of card selection, intervals and a failed trend", async () => {
  failures.add("/admin/analytics/discovery-trend/");
  await mount();
  const discovery = section("Discovery Activity");
  assert.match(metric("Profile visits").textContent, /10/);
  assert.match(metric("Impressions").textContent, /20/);
  assert.match(metric("Saves").textContent, /3/);
  assert.match(discovery.textContent, /Unable to load discovery activity/);
  assert.equal(requests("discovery-summary/").length, 1);
  failures.clear();
  await click([...discovery.querySelectorAll("button")].find((button) => button.textContent === "Retry"));
  await until(() => discovery.querySelector("[data-chart]") && client.isFetching() === 0);
  await choose("Discovery metric", "saves");
  assert.equal(discovery.querySelector("[aria-label='Show recorded saves']").getAttribute("aria-pressed"), "true");
  assert.equal(discovery.querySelector("[aria-label='Show recorded profile visits']").getAttribute("aria-pressed"), "false");
  assert.equal(requests("discovery-summary/").length, 1);
  const interval = discovery.querySelector("select");
  await act(async () => { interval.value = "weekly"; interval.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-summary/").length, 1);
  await until(() => discovery.textContent.includes("Week in progress"));
  const before = requests("discovery-trend/").length;
  await click(periodButton("7"));
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-summary/").length, 2);
  assert.equal(requests("discovery-trend/").length, before + 1);
});

test("discovery summary retries without removing or refetching a successful trend", async () => {
  failures.add("/admin/analytics/discovery-summary/");
  await mount();
  const discovery = section("Discovery Activity");
  assert.ok(discovery.querySelector("[data-chart]"));
  assert.match(metric("Saves").textContent, /Unavailable/);
  assert.match(discovery.textContent, /Unable to load discovery summary/);
  failures.clear();
  await click([...discovery.querySelectorAll("button")].find((button) => button.textContent === "Retry summary"));
  await until(() => client.isFetching() === 0 && metric("Saves").textContent.includes("3"));
  assert.match(metric("Saves").textContent, /3/);
  assert.equal(requests("discovery-trend/").length, 1);
  assert.equal(requests("discovery-summary/").length, 2);
});

test("discovery keeps full reporting axis and null tail without inferring a watermark", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({
    ...report, meta: { ...report.meta, data_through: null },
  }));
  await mount();
  const discovery = section("Discovery Activity");
  const domain = JSON.parse(discovery.querySelector("[data-domain]").dataset.domain);
  assert.equal(domain[0], Date.parse("2026-09-30T16:00:00Z"));
  assert.equal(domain[1], Date.parse("2026-10-30T04:00:00Z") - 1);
  const rows = JSON.parse(discovery.querySelector("[data-chart]").dataset.chart);
  assert.equal(rows.length, 30);
  assert.equal(rows.at(-1).value, null);
  assert.equal(rows[2].value, 0);
  assert.doesNotMatch(discovery.textContent, /Recorded coverage through/);
  assert.match(discovery.textContent, /Previous-period comparison unavailable/);
  await click(discovery.querySelector("[aria-label='Why previous-period comparison is unavailable']"));
  assert.match(document.querySelector("dialog[open]").textContent, /last event does not establish coverage/);
});

test("discovery marks a supplied earlier coverage cutoff without making missing values zero", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({
    ...report, meta: { ...report.meta, data_through: "2026-10-22T16:00:00Z" },
  }));
  await mount();
  const discovery = section("Discovery Activity");
  assert.match(discovery.textContent, /Recorded coverage through/);
  assert.equal(Number(discovery.querySelector("[data-partial-start]").dataset.partialStart), Date.parse("2026-10-22T16:00:00Z"));
  assert.equal(JSON.parse(discovery.querySelector("[data-chart]").dataset.chart).at(-1).value, null);
});


test("discovery displays a future valid backend comparison without calculating a replacement", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({
    ...report, previous_value: 8,
    change: { value: 25, direction: "up", unit: "percent", reason: null },
    meta: { ...report.meta, coverage_verified: true },
  }));
  await mount();
  const discovery = section("Discovery Activity");
  assert.match(discovery.textContent, /Increase: 25% vs previous period/);
  assert.match(discovery.textContent, /compared with/);
  assert.equal(discovery.querySelector("[aria-label='Why previous-period comparison is unavailable']"), null);
});


test("recorded discovery columns preserve all time positions and distinguish null from measured zero", async () => {
  await mount();
  const discovery = section("Discovery Activity");
  const rows = JSON.parse(discovery.querySelector("[data-chart]").dataset.chart);
  assert.equal(rows.length, 30);
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].value, 0);
  assert.equal(rows.at(-1).value, null);
  assert.equal(discovery.querySelector("[data-axis-type]").dataset.axisType, "number");
  assert.equal(discovery.querySelector("[data-axis-key]").dataset.axisKey, "time");
  assert.equal(discovery.querySelector("[data-max-bar-size]").dataset.maxBarSize, "40");
  assert.equal(discovery.querySelector("[data-filter-null]").dataset.filterNull, "false");
  assert.equal(discovery.querySelector("[data-tooltip-zero]").dataset.tooltipZero, "0");
  assert.equal(discovery.querySelector("[data-tooltip-missing]").dataset.tooltipMissing, "Unavailable");
  const selected = discovery.querySelector("[aria-label='Show recorded profile visits']");
  assert.match(selected.textContent, /Selected/);
  assert.equal(selected.style.borderColor, "");
  assert.match(selected.style.boxShadow, /inset/);
  const interval = discovery.querySelector("select");
  await act(async () => { interval.value = "daily"; interval.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => discovery.textContent.includes("Recorded profile visits by day") && discovery.querySelector("[data-max-bar-size]") && client.isFetching() === 0);
  assert.equal(discovery.querySelector("[data-max-bar-size]").dataset.maxBarSize, "18");
  assert.equal(requests("discovery-summary/").length, 1);
});


test("final discovery polish labels bucket starts and keeps totals only in selectable cards", async () => {
  await mount();
  const discovery = section("Discovery Activity");
  assert.match(discovery.textContent, /Recorded profile visits by week/);
  assert.doesNotMatch(discovery.textContent, /10profile visits|Previous-period comparison unavailable/);
  const selected = discovery.querySelector("[aria-label='Show recorded profile visits']");
  assert.equal(selected.getAttribute("aria-pressed"), "true");
  assert.equal(selected.textContent.trim(), "");
  const rows = JSON.parse(discovery.querySelector("[data-chart]").dataset.chart);
  const ticks = JSON.parse(discovery.querySelector("[data-ticks]").dataset.ticks);
  assert.deepEqual(ticks, rows.map((row) => Date.parse(row.start)));
  assert.equal(rows[1].value, null);
  assert.equal(rows[2].value, 0);
  await click(discovery.querySelector("[aria-label='About Discovery Activity']"));
  assert.match(document.querySelector("dialog[open]").textContent, /comparisons are hidden/);
});
