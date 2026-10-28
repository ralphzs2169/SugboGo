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
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom", ssr: { noExternal: ["recharts"] }, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "dashboard-transport-and-chart-contract", enforce: "pre",
      resolveId(source) { if (source === "recharts") return "\0analytics-recharts"; },
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) return "export default { get: (...args) => globalThis.__dashboardTransport(...args) };";
        if (id === "\0analytics-recharts") return `import React from 'react';
          export const ResponsiveContainer = ({children}) => React.createElement('div', null, children);
          export const LineChart = ({data, children}) => React.createElement('div', {'data-chart': JSON.stringify(data)}, children);
          export const Line = ({dataKey,connectNulls}) => React.createElement('span', {'data-series':dataKey,'data-connect-nulls':String(connectNulls)});
          export const XAxis = ({type}) => React.createElement('span',{'data-axis-type':type});
          export const YAxis = () => null; export const Tooltip = () => null;
          export const CartesianGrid = () => null; export const Legend = () => null;`;
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
  await until(() => reads.length >= 13 && client.isFetching() === 0);
  await act(async () => new Promise((done) => setTimeout(done, 10)));
}
const section = (title) => [...container.querySelectorAll("h2")].find((heading) => heading.textContent === title)?.closest("section");
const select = (label) => [...container.querySelectorAll("select")].find((element) => element.labels[0]?.textContent === label);
const requests = (route) => reads.filter(({ url }) => url === `/admin/analytics/${route}`);
const click = async (element) => act(async () => element.click());
async function choose(label, value) {
  await act(async () => { const input = select(label); input.value = value; input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => client.isFetching() === 0);
  await act(async () => new Promise((done) => setTimeout(done, 10)));
}
const periodButton = (period) => [...container.querySelectorAll("button")].find((button) => button.textContent === `${period}D`);

test("MVP mounts reports once, shares taxonomy options, and defers low exposure and heatmap", async () => {
  await mount();
  assert.equal(reads.length, 13);
  assert.equal(new Set(reads.map(({ url }) => url)).size, 13);
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
  assert.match(overview.textContent, /New current-Explorer accounts/);
  assert.match(overview.textContent, /Increase: 2/);
  assert.match(overview.textContent, /Discovery-active accounts \(not total app MAU\)Unavailable/);
});

test("growth switches locally between persisted series and preserves temporal nulls and zeroes", async () => {
  await mount();
  const growth = section("Platform Growth");
  const rows = JSON.parse(growth.querySelector("[data-chart]").dataset.chart);
  assert.equal(rows[1].new_consumer_accounts, null);
  assert.equal(rows[2].new_consumer_accounts, 0);
  assert.equal(rows[2].time - rows[0].time, 2 * 24 * 60 * 60 * 1000);
  assert.ok([...growth.querySelectorAll("[data-connect-nulls]")].every((line) => line.dataset.connectNulls === "false"));
  await choose("Growth metric", "newly_approved_businesses");
  assert.equal(requests("platform-growth/").length, 1);
  assert.equal(growth.querySelector("[data-series]").dataset.series, "newly_approved_businesses");
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
  assert.match(section("Merchant Onboarding").textContent, /Pending applications8/);
  assert.match(section("Community Health").textContent, /Unclassified reviews1/);
  const total = reads.length;
  failures.clear();
  await click(section("Discovery Activity").querySelector("button"));
  await until(() => client.isFetching() === 0);
  assert.equal(reads.length, total + 1);
  await until(() => !section("Discovery Activity").querySelector("[role='alert']"));
  assert.doesNotMatch(section("Discovery Activity").textContent, /Unable to load discovery activity/);
});

test("discovery controls request only supported metric/interval variants and show partial context", async () => {
  await mount();
  await choose("Discovery metric", "saves");
  assert.equal(requests("discovery-trend/").at(-1).params.metric, "saves");
  const localInterval = section("Discovery Activity").querySelectorAll("select")[1];
  await act(async () => { localInterval.value = "weekly"; localInterval.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-trend/").at(-1).params.interval, "weekly");
  await until(() => section("Discovery Activity").querySelector("[data-chart]"));
  assert.match(section("Discovery Activity").textContent, /Tracking coverage is unverified/);
  assert.match(section("Discovery Activity").textContent, /Comparison unavailable/);
  assert.equal(requests("onboarding/").length, 1);
});

test("successful unavailable discovery is not an HTTP failure or a zero and preserves other sections", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({ ...report, value: null, series: null, meta: { ...report.meta, availability: "unavailable" } }));
  await mount();
  assert.match(section("Discovery Activity").textContent, /Discovery activity is currently unavailable/);
  assert.equal(section("Discovery Activity").querySelector("[role='alert']"), null);
  assert.match(section("Overview").textContent, /Approved businesses12/);
});

test("onboarding exposes workload, paired throughput, null turnaround and overlapping rejection sections", async () => {
  await mount();
  const onboarding = section("Merchant Onboarding");
  assert.match(onboarding.textContent, /On time3/);
  assert.match(onboarding.textContent, /Overdue2/);
  assert.match(onboarding.textContent, /Median review turnaroundUnavailable/);
  assert.doesNotMatch(onboarding.textContent, /Median review turnaround0 hours/);
  assert.equal(onboarding.querySelector("[data-series='submissions']").dataset.connectNulls, "false");
  assert.ok(onboarding.querySelector("[data-series='completed_reviews']"));
  assert.match(onboarding.textContent, /Sections overlap; shares need not total 100%/);
  assert.match(onboarding.textContent, /Identity/);
  assert.match(onboarding.textContent, /Location/);
  assert.match(onboarding.textContent, /strictly after a rejection/);
});

test("community uses persisted sentiment, classified shares, and discloses unclassified current-state history", async () => {
  await mount();
  const community = section("Community Health");
  assert.match(community.textContent, /positive1100%/);
  assert.match(community.textContent, /neutral00%/);
  assert.match(community.textContent, /unclassified1Excluded from denominator/);
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
  assert.match(section("Reports & disputes").textContent, /Median dispute resolution · selected period4 hours/);
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
