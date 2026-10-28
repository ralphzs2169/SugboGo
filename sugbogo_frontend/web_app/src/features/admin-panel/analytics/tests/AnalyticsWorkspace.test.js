import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
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
let initialEntries;

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
          export const PieChart = ({children}) => React.createElement('div', {'data-pie-chart':true}, children);
          export const Pie = ({data,children}) => React.createElement('div', {'data-pie':JSON.stringify(data)},children);
          export const Cell = () => null;
          export const LabelList = () => null;
          export const Bar = ({dataKey,fill,stackId}) => React.createElement('span', {'data-series':dataKey,'data-series-type':'bar','data-fill':fill,'data-stack':stackId});
          export const XAxis = ({type,dataKey,domain,ticks}) => React.createElement('span',{'data-axis-type':type,'data-axis-key':dataKey,'data-domain':JSON.stringify(domain),'data-ticks':JSON.stringify(ticks)});
          export const YAxis = ({allowDecimals}) => React.createElement('span',{'data-allow-decimals':String(allowDecimals)});
          export const Tooltip = ({filterNull,formatter}) => React.createElement('span',{'data-filter-null':String(filterNull),'data-tooltip-zero':formatter?.(0,'Selected metric',{payload:{share_percent:0}})[0],'data-tooltip-missing':formatter?.(null,'Selected metric',{payload:{share_percent:null}})[0]});
          export const ReferenceArea = ({x1,x2}) => React.createElement("span", {"data-partial-start":x1,"data-partial-end":x2});
          export const CartesianGrid = () => null; export const Legend = () => React.createElement("span", {"data-legend":"true"});`;
      },
    }],
  });
  ({ default: Page } = await server.ssrLoadModule("/src/features/admin-panel/pages/Analytics.jsx"));
});

beforeEach(() => {
  initialEntries = ["/admin-panel/analytics?campaign=keep"];
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
  await act(async () => root.render(React.createElement(QueryClientProvider, { client }, React.createElement(MemoryRouter, { initialEntries }, React.createElement(RouterProbe), React.createElement(Page)))));
  await until(() => reads.length >= 1 && client.isFetching() === 0);
  await act(async () => new Promise((done) => setTimeout(done, 10)));
}
const section = (title) => [...container.querySelectorAll("h2")].find((heading) => heading.textContent === title)?.closest("section");
const select = (label) => [...container.querySelectorAll("select")].find((element) => element.labels[0]?.textContent === label);
const requests = (route) => reads.filter(({ url }) => url === `/admin/analytics/${route}`);
const metric = (label) => [...container.querySelectorAll("h3")].find((heading) => heading.textContent === label)?.closest(".relative");
const click = async (element) => act(async () => { await element.click(); });
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
async function choosePeriod(period) {
  await click(container.querySelector('[aria-label^="Reporting period:"]'));
  await click([...container.querySelectorAll('[role="menuitemradio"]')].find((button)=>button.textContent === `Last ${period} days`));
}

/** Exposes router navigation in the integration harness without replacing browser history semantics. */
function RouterProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return React.createElement("div", null,
    React.createElement("output", { "data-url": true }, location.search),
    React.createElement("button", { "data-back": true, onClick: () => navigate(-1) }, "Back"),
    React.createElement("button", { "data-forward": true, onClick: () => navigate(1) }, "Forward"));
}
async function tab(name) {
  await click([...container.querySelectorAll("[role='tab']")].find((button) => button.textContent === name));
  await until(() => client.isFetching() === 0);
  await act(async () => new Promise((done) => setTimeout(done, 10)));
}

test("workspace mounts only Growth reports and reuses cached queries with retained selections", async () => {
  await mount();
  assert.equal(reads.length, 6);
  assert.equal(requests("onboarding/").length, 0);
  assert.equal(requests("attention-queue/").length, 0);
  assert.equal(reads.filter(({url}) => url.includes("taxonomy")).length, 0);
  await choose("Discovery metric", "saves");
  const count = requests("discovery-trend/").length;
  await tab("Operations");
  assert.ok(section("Merchant Onboarding"));
  assert.equal(requests("change-requests/").length, 1);
  assert.equal(requests("attention-queue/").length, 0);
  assert.equal(section("Discovery Activity"), undefined);
  await tab("Growth & Discovery");
  assert.equal(container.querySelector("[aria-label='Show recorded saves']").getAttribute("aria-pressed"), "true");
  assert.equal(requests("discovery-trend/").length, count);
  assert.equal(requests("discovery-summary/").length, 1);
});

test("workspace preserves global dates, URL parameters and browser Back/Forward", async () => {
  await mount();
  await choosePeriod("90");
  await until(() => client.isFetching() === 0);
  await tab("Operations");
  assert.equal(requests("onboarding/").at(-1).params.period, "90");
  assert.match(container.querySelector("[data-url]").textContent, /campaign=keep.*tab=operations/);
  await tab("Community & Trust");
  assert.equal(requests("attention-queue/").length, 1);
  assert.equal(requests("community-health/").at(-1).params.period, "90");
  await click(container.querySelector("[data-back]"));
  await until(() => Boolean(section("Merchant Onboarding")));
  assert.match(container.querySelector('[aria-label^="Reporting period:"]').textContent,/Last 90 days/);
  await click(container.querySelector("[data-forward]"));
  await until(() => Boolean(section("Reports & disputes")));
});

test("workspace deep links isolate Operations errors and Retry", async () => {
  initialEntries = ["/admin-panel/analytics?tab=operations"];
  failures.add("/admin/analytics/change-requests/");
  await mount();
  assert.equal(reads.length, 2);
  assert.ok(section("Merchant Onboarding"));
  assert.match(section("Merchant change requests").textContent, /Unable to load/);
  failures.clear();
  await click([...section("Merchant change requests").querySelectorAll("button")].find((button) => button.textContent === "Retry"));
  await until(() => client.isFetching() === 0);
  assert.equal(requests("onboarding/").length, 1);
  assert.equal(requests("change-requests/").length, 2);
});

test("workspace invalid tabs fall back safely and arrow keys activate semantic panels", async () => {
  initialEntries = ["/admin-panel/analytics?tab=invalid"];
  await mount();
  const selected = container.querySelector("[role='tab'][aria-selected='true']");
  assert.equal(selected.textContent, "Growth & Discovery");
  await act(async () => selected.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  await until(() => Boolean(section("Merchant Onboarding")));
  const active = container.querySelector("[role='tab'][aria-selected='true']");
  assert.equal(active.textContent, "Operations");
  assert.equal(document.activeElement, active);
  assert.equal(container.querySelector("[role='tabpanel']").getAttribute("aria-labelledby"), active.id);
});


test("workspace ecosystem preserves scope and low-attention mode without fetching inactive reports", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  await mount();
  assert.equal(requests("low-exposure/").length, 0);
  assert.equal(requests("platform-growth/").length, 0);
  assert.equal(reads.filter(({url}) => url.includes("taxonomy")).length, 2);
  await choose("Coverage category", "2");
  await choose("Attention mode", "low");
  await choose("Order by", "-valid_vouches");
  const lowCount = requests("low-exposure/").length;
  await tab("Community & Trust");
  assert.ok(section("Reports & disputes"));
  assert.equal(requests("change-requests/").length, 0);
  await tab("Business Ecosystem");
  assert.equal(select("Coverage category").value, "2");
  assert.equal(select("Attention mode").value, "low");
  assert.equal(select("Order by").value, "-valid_vouches");
  assert.equal(requests("low-exposure/").length, lowCount);
  assert.equal(reads.filter(({url}) => url.includes("taxonomy")).length, 2);
});


test("shared table tabs retain their default click and count presentation without analytics semantics", async () => {
  const { default: TableTabs } = await server.ssrLoadModule("/src/features/admin-panel/components/data-table/TableTabs.jsx");
  let changed;
  await act(async () => root.render(React.createElement(TableTabs, {
    tabs: [{ id: "pending", label: "Pending", count: 3 }, { id: "done", label: "Done" }],
    activeTab: "pending", onTabChange: (value) => { changed = value; },
  })));
  assert.match(container.textContent, /Pending3/);
  assert.equal(container.querySelector("[role='tablist']"), null);
  const buttons = container.querySelectorAll("button");
  assert.ok(buttons[0].classList.contains("cursor-pointer"));
  await click(buttons[1]);
  assert.equal(changed, "done");
  assert.equal(reads.length, 0);
});

 test("sources rank all categories, expose exact values, and reuse period cache", async () => {
  await mount();
  const report = section("Discovery Sources");
  assert.ok(report);
  const rows = JSON.parse(report.querySelector("[data-chart]").getAttribute("data-chart"));
  assert.equal(rows.length, 7);
  assert.equal(rows[0].label, "Map");
  assert.equal(rows[1].label, "Unknown");
  assert.equal(rows[2].label, "Explore");
  await click([...report.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  assert.match(document.querySelector("dialog[open]").textContent, /66.67/);
  await click(document.querySelector('[aria-label="Close Discovery Sources details"]'));
  await tab("Operations");
  const count = requests("discovery-sources/").length;
  await tab("Growth & Discovery");
  assert.equal(requests("discovery-sources/").length, count);
  await choosePeriod("90");
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-sources/").at(-1).params.period, "90");
 });

 test("sources independently recover errors and distinguish zero from unavailable", async () => {
  failures.add("/admin/analytics/discovery-sources/");
  await mount();
  assert.match(section("Discovery Sources").textContent, /Unable to load/);
  failures.clear();
  overrides.set("/admin/analytics/discovery-sources/", (report) => ({...report, total_profile_visits:0, sources:report.sources.map((row) => ({...row,count:0,share_percent:null}))}));
  await click([...section("Discovery Sources").querySelectorAll("button")].find((button) => button.textContent === "Retry"));
  await until(() => client.isFetching() === 0);
  await until(() => section("Discovery Sources").textContent.includes("No profile visits were recorded"));
  overrides.set("/admin/analytics/discovery-sources/", (report) => ({...report, total_profile_visits:null, sources:null, meta:{...report.meta,availability:"unavailable"}}));
  await act(async () => { await client.invalidateQueries({queryKey:["admin","analytics","discoverySources"]}); });
  await until(() => section("Discovery Sources").textContent.includes("does not mean zero visits"));
 });

test("sources remain dormant on other tabs and retain cached data after refresh failure", async () => {
  initialEntries = ["/admin-panel/analytics?tab=operations"];
  await mount();
  assert.equal(requests("discovery-sources/").length, 0);
  await tab("Growth & Discovery");
  failures.add("/admin/analytics/discovery-sources/");
  await act(async () => { await client.invalidateQueries({queryKey:["admin","analytics","discoverySources"]}); });
  await until(() => section("Discovery Sources").textContent.includes("Previously loaded data"));
  assert.ok(section("Discovery Sources").querySelector("[data-chart]"));
  failures.clear();
  await click([...section("Discovery Sources").querySelectorAll("button")].find((button) => button.textContent === "Retry"));
  await until(() => client.isFetching() === 0);
  await until(() => !section("Discovery Sources").textContent.includes("Refresh failed"));
});

const accountTrendButton = () => container.querySelector('[aria-label="Show recorded discovery-active accounts"]');

async function selectAccounts() {
  await click(accountTrendButton());
  await until(() => client.isFetching() === 0 && section("Discovery Activity").querySelector("[data-chart]"));
}

test("discovery accounts reuse trend parameters, bucket values, drawer and cache without summing", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report, params) => params.metric === "distinct_engaged_explorers" ? {
    ...report, value: 3, series: [{date:"2026-10-01",value:2},{date:"2026-10-02",value:2}],
    timeline: report.timeline.slice(0, 4).map((row, index) => ({...row,value:[2,2,null,0][index]})),
  } : report);
  await mount();
  await selectAccounts();
  assert.equal(accountTrendButton().getAttribute("aria-pressed"), "true");
  assert.equal(requests("discovery-trend/").at(-1).params.metric, "distinct_engaged_explorers");
  assert.equal(requests("discovery-trend/").at(-1).params.interval, "weekly");
  const report = section("Discovery Activity");
  assert.match(report.textContent, /Recorded accounts participating by week/);
  const rows = JSON.parse(report.querySelector("[data-chart]").getAttribute("data-chart"));
  assert.deepEqual(rows.map((row) => row.value), [2,2,null,0]);
  assert.equal(report.querySelectorAll('[aria-label="Recorded discovery metric"] button').length, 3);
  await click(report.querySelector('[aria-label="About Discovery Activity"]'));
  await until(() => document.querySelector("dialog[open]"));
  assert.match(document.querySelector("dialog[open]").textContent, /must never be summed/);
  assert.match(document.querySelector("dialog[open]").textContent, /not general app activity/);
  await click(document.querySelector('[aria-label="Close Discovery Activity details"]'));
  await click([...report.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  assert.match(document.querySelector("dialog[open]").textContent, /Accounts participating/);
  await click(document.querySelector('[aria-label="Close Discovery Activity details"]'));
  const count = requests("discovery-trend/").length;
  await choose("Discovery metric", "saves");
  await selectAccounts();
  assert.equal(requests("discovery-trend/").length, count + 1);
  const interval = report.querySelector("select");
  await act(async () => { interval.value = "daily"; interval.dispatchEvent(new dom.window.Event("change", {bubbles:true})); });
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-trend/").at(-1).params.interval, "daily");
  await choosePeriod("7");
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-trend/").at(-1).params.period, "7");
  await tab("Operations");
  const inactiveCount = requests("discovery-trend/").length;
  await choosePeriod("90");
  await until(() => client.isFetching() === 0);
  assert.equal(requests("discovery-trend/").length, inactiveCount);
});

test("account trend handles unavailable and healthy zero without fabricated observations", async () => {
  overrides.set("/admin/analytics/discovery-trend/", (report, params) => params.metric === "distinct_engaged_explorers" ? {...report,value:null,series:null,timeline:null,meta:{...report.meta,availability:"unavailable"}} : report);
  await mount();
  await click(accountTrendButton());
  await until(() => section("Discovery Activity").textContent.includes("Discovery activity is currently unavailable"));
  assert.equal(section("Discovery Activity").querySelector("[data-chart]"), null);
  overrides.set("/admin/analytics/discovery-trend/", (report) => ({...report,value:0,series:[],timeline:report.timeline.map((row) => ({...row,value:null}))}));
  await choosePeriod("7");
  await until(() => section("Discovery Activity").textContent.includes("No accounts participating were recorded"));
  const rows = JSON.parse(section("Discovery Activity").querySelector("[data-chart]").getAttribute("data-chart"));
  assert.ok(rows.every((row) => row.value === null));
});

test("account trend retry is independent and retains cached observations on refresh failure", async () => {
  await mount();
  failures.add("/admin/analytics/discovery-trend/");
  await click(accountTrendButton());
  await until(() => section("Discovery Activity").textContent.includes("Unable to load report"));
  assert.equal(section("Discovery Activity").querySelector("[data-chart]"), null);
  const sourceCount = requests("discovery-sources/").length;
  failures.clear();
  await click([...section("Discovery Activity").querySelectorAll("button")].find((button) => button.textContent === "Retry"));
  await until(() => section("Discovery Activity").querySelector("[data-chart]"));
  failures.add("/admin/analytics/discovery-trend/");
  await act(async () => { await client.invalidateQueries({queryKey:["admin","analytics","discoveryTrend"]}); });
  await until(() => section("Discovery Activity").textContent.includes("Previously loaded data"));
  assert.ok(section("Discovery Activity").querySelector("[data-chart]"));
  assert.equal(requests("discovery-sources/").length, sourceCount);
});

test("transportation donut reconciles methods and drawer destinations with period cache reuse", async () => {
  await mount();
  const report = section("Transportation Planning");
  const methods = JSON.parse(report.querySelector("[data-pie]").getAttribute("data-pie"));
  assert.equal(methods.reduce((sum,row) => sum + row.count,0), 5);
  assert.match(report.textContent, /60%/);
  assert.match(report.textContent, /Distinct requesting accounts: 2/);
  assert.match(report.textContent, /not completed journeys/);
  assert.ok(report.querySelector(".sm\\:grid-cols-2"));
  await click([...report.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  assert.match(document.querySelector("dialog[open]").textContent, /Recorded planning activity/);
  assert.equal(document.querySelector('dialog[open] a').getAttribute("href"), "/admin-panel/businesses/10");
  await click(document.querySelector('[aria-label="Close Transportation Planning details"]'));
  await click(report.querySelector('[aria-label="About Transportation Planning"]'));
  assert.match(document.querySelector("dialog[open]").textContent, /UTC day/);
  assert.match(document.querySelector("dialog[open]").textContent, /Tracking started/);
  await click(document.querySelector('[aria-label="Close Transportation Planning details"]'));
  const count = requests("transportation-planning/").length;
  await tab("Operations");
  await tab("Growth & Discovery");
  assert.equal(requests("transportation-planning/").length,count);
  const interval = report.querySelector("select");
  // Resolve the newly mounted section after returning to the tab.
  const mountedInterval = section("Transportation Planning").querySelector("select");
  assert.ok(interval);
  await act(async () => { mountedInterval.value="daily"; mountedInterval.dispatchEvent(new dom.window.Event("change",{bubbles:true})); });
  await until(() => client.isFetching() === 0);
  assert.equal(requests("transportation-planning/").at(-1).params.interval,"daily");
  await choosePeriod("7");
  await until(() => client.isFetching() === 0);
  assert.equal(requests("transportation-planning/").at(-1).params.period,"7");
});

test("transportation separates zero, unavailable and request failure with independent retry", async () => {
  initialEntries=["/admin-panel/analytics?tab=operations"];
  await mount();
  assert.equal(requests("transportation-planning/").length,0);
  failures.add("/admin/analytics/transportation-planning/");
  await tab("Growth & Discovery");
  assert.match(section("Transportation Planning").textContent,/Unable to load/);
  const sources=requests("discovery-sources/").length;
  failures.clear();
  overrides.set("/admin/analytics/transportation-planning/", (report) => ({...report,total_requests:0,methods:report.methods.map((row)=>({...row,count:0,share_percent:null}))}));
  await click([...section("Transportation Planning").querySelectorAll("button")].find((button)=>button.textContent === "Retry"));
  await until(()=>section("Transportation Planning").textContent.includes("No transportation-planning requests"));
  assert.equal(section("Transportation Planning").querySelector("[data-pie]"),null);
  assert.equal(requests("discovery-sources/").length,sources);
  overrides.set("/admin/analytics/transportation-planning/", (report) => ({...report,total_requests:null,methods:null,meta:{...report.meta,availability:"unavailable"}}));
  await choosePeriod("7");
  await until(()=>section("Transportation Planning").textContent.includes("unavailable, not zero"));
  assert.equal(section("Transportation Planning").querySelector("[data-pie]"),null);
});

test("transportation keeps cached donut on refresh failure and discloses pretracking periods", async () => {
  await mount();
  failures.add("/admin/analytics/transportation-planning/");
  await act(async () => { await client.invalidateQueries({queryKey:["admin","analytics","transportationPlanning"]}); });
  await until(()=>section("Transportation Planning").textContent.includes("Previously loaded data"));
  assert.ok(section("Transportation Planning").querySelector("[data-pie]"));
  failures.clear();
  overrides.set("/admin/analytics/transportation-planning/", (report) => ({...report,total_requests:null,methods:null,meta:{...report.meta,availability:"unavailable",partial_reasons:["tracking_not_started_in_period"]}}));
  await choosePeriod("7");
  await until(()=>section("Transportation Planning").textContent.includes("before transportation tracking began"));
  assert.equal(section("Transportation Planning").querySelector("[data-pie]"),null);
});

test("business acquisition switches grouping without a request and preserves period/retry", async () => {
  await mount();
  assert.match(section("Business Acquisition").textContent,/Cafes/);
  const count=requests("business-acquisition/").length;
  await click([...section("Business Acquisition").querySelectorAll("button")].find((button)=>button.textContent === "By Cluster"));
  await until(()=>section("Business Acquisition").textContent.includes("Food"));
  assert.equal(requests("business-acquisition/").length,count);
  const selected=section("Business Acquisition").querySelector('[aria-selected="true"]');
  await act(async()=>selected.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"ArrowLeft",bubbles:true})));
  assert.match(section("Business Acquisition").textContent,/Cafes/);
  await click([...section("Business Acquisition").querySelectorAll("button")].find((button)=>button.textContent.includes("View data")));
  assert.match(document.querySelector("dialog[open]").textContent,/Acquisition by category/);
  assert.match(document.querySelector("dialog[open]").textContent,/Created: 1/);
  await click(document.querySelector('[aria-label="Close Business Acquisition details"]'));
  failures.add("/admin/analytics/business-acquisition/");
  await choosePeriod("7");
  await until(()=>section("Business Acquisition").textContent.includes("Unable to load report"));
  assert.equal(requests("business-acquisition/").at(-1).params.period,"7");
  failures.clear();
  overrides.set("/admin/analytics/business-acquisition/",(report)=>({...report,categories:[],clusters:[],totals:{created:0,approved:0}}));
  await click([...section("Business Acquisition").querySelectorAll("button")].find((button)=>button.textContent === "Retry"));
  await until(()=>section("Business Acquisition").textContent.includes("No business creations"));
});

test("report drawers lead with readable methodology and hide raw flags in technical details", async () => {
  overrides.set("/admin/analytics/discovery-sources/",(report)=>({...report,meta:{...report.meta,data_through:null,partial_reasons:["best_effort_delivery","current_day_incomplete","coverage_unverified","freshness_unverified"]}}));
  await mount();
  for (const title of ["Discovery Sources","Transportation Planning","Business Acquisition","Discovery Activity","Platform Growth"]) {
    const trigger=section(title).querySelector(`[aria-label="About ${title}"]`);
    await click(trigger);
    const drawer=document.querySelector("dialog[open]");
    const primary=drawer.cloneNode(true);
    primary.querySelectorAll("details").forEach((node)=>node.remove());
    assert.match(primary.textContent,/What this report shows/);
    assert.match(primary.textContent,/How the numbers are calculated/);
    assert.match(primary.textContent,/Data reliability/);
    assert.match(primary.textContent,/Philippine time/);
    assert.doesNotMatch(primary.textContent,/best_effort_delivery|coverage_unverified|PROFILE_VISIT|MongoDB|positive numeric|half-open|Asia\/Manila/);
    const technical=[...drawer.querySelectorAll("summary")].find((node)=>node.textContent === "Technical details");
    assert.equal(technical.parentElement.open,false);
    await click(technical);
    assert.equal(technical.parentElement.open,true);
    if(title === "Discovery Sources") {
      assert.match(primary.textContent,/latest fully captured date has not been confirmed/);
      assert.match(primary.textContent,/first recorded source/);
      assert.match(primary.textContent,/still in progress/);
      assert.match(technical.parentElement.textContent,/best_effort_delivery/);
    }
    await click(drawer.querySelector(`[aria-label="Close ${title} details"]`));
  }
});

test("shared explanations preserve Operations, Community and Ecosystem report details", async () => {
  await mount();
  await tab("Operations");
  const onboarding=section("Merchant Onboarding");
  await click([...onboarding.querySelectorAll("button")].find((button)=>button.textContent.includes("About this report")));
  let drawer=document.querySelector("dialog[open]");
  assert.match(drawer.textContent,/Overall SLA compliance uses classified outcomes/);
  assert.ok([...drawer.querySelectorAll("summary")].find((node)=>node.textContent === "Technical details"));
  await click(drawer.querySelector('[aria-label="Close Merchant Onboarding details"]'));
  await tab("Community & Trust");
  const community=section("Community Health");
  const explanation=[...community.querySelectorAll("summary")].find((node)=>node.textContent === "About this report");
  await click(explanation);
  assert.match(explanation.parentElement.textContent,/Last updated/);
  assert.match(explanation.parentElement.textContent,/still published today/);
  await tab("Business Ecosystem");
  assert.match(section("Discovery Score Health").textContent,/should not be added together/);
  const coverage=section("Business Coverage");
  await click([...coverage.querySelectorAll("summary")].find((node)=>node.textContent === "About this report"));
  assert.match(coverage.textContent,/Complete recording has not been confirmed/);
  assert.ok([...coverage.querySelectorAll("summary")].find((node)=>node.textContent === "Technical details"));
});

test("acquisition loading is independent and inactive tabs do not fetch it", async () => {
  let release;
  overrides.set("/admin/analytics/business-acquisition/", (report) => new Promise((resolveReport) => { release=()=>resolveReport(report); }));
  await act(async () => root.render(React.createElement(QueryClientProvider, {client}, React.createElement(MemoryRouter, {initialEntries}, React.createElement(Page)))));
  await until(()=>release && section("Business Acquisition"));
  assert.equal(section("Business Acquisition").getAttribute("aria-busy"),"true");
  assert.ok(section("Platform Growth"));
  await act(async()=>release());
  await until(()=>section("Business Acquisition").textContent.includes("Cafes"));
  await tab("Operations");
  const count=requests("business-acquisition/").length;
  await choosePeriod("90");
  await until(()=>client.isFetching() === 0);
  assert.equal(requests("business-acquisition/").length,count);
});

test("growth layout keeps full-width acquisition above paired discovery panels", async () => {
  await mount();
  const growth=section("Platform Growth");
  const activity=section("Discovery Activity");
  const sources=section("Discovery Sources");
  assert.equal(activity.parentElement,sources.parentElement);
  assert.ok(activity.parentElement.classList.contains("xl:grid-cols-2"));
  assert.equal(growth.parentElement,activity.parentElement.parentElement);
  await selectAccounts();
  assert.match(activity.textContent,/Accounts participating/);
  assert.match(activity.textContent,/Distinct accounts with recorded discovery activity during each interval/);
  for(const metric of ["profile_visits","impressions","saves"]) {
    await choose("Discovery metric",metric);
    const label={profile_visits:"profile visits",impressions:"impressions",saves:"saves"}[metric];
    assert.equal(activity.querySelector(`[aria-label="Show recorded ${label}"]`).getAttribute("aria-pressed"),"true");
    assert.equal(accountTrendButton().getAttribute("aria-pressed"),"false");
  }
  assert.ok(section("Business Acquisition"));
  assert.ok(section("Transportation Planning"));
});

test("overview is removed and its endpoint remains dormant", async () => {
  await mount();
  assert.equal(section("Overview"),undefined);
  assert.equal(requests("").length,0);
  assert.equal(container.querySelector('[role="tabpanel"] h2').textContent,"Platform Growth");
});
