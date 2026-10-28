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
          export const LabelList = () => null;
          export const Bar = ({dataKey,fill,stackId}) => React.createElement('span', {'data-series':dataKey,'data-series-type':'bar','data-fill':fill,'data-stack':stackId});
          export const XAxis = ({type,dataKey,domain,ticks}) => React.createElement('span',{'data-axis-type':type,'data-axis-key':dataKey,'data-domain':JSON.stringify(domain),'data-ticks':JSON.stringify(ticks)});
          export const YAxis = ({allowDecimals}) => React.createElement('span',{'data-allow-decimals':String(allowDecimals)});
          export const Tooltip = ({filterNull,formatter}) => React.createElement('span',{'data-filter-null':String(filterNull),'data-tooltip-zero':formatter(0,'Selected metric',{payload:{share_percent:0}})[0],'data-tooltip-missing':formatter(null,'Selected metric',{payload:{share_percent:null}})[0]});
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
  assert.equal(reads.length, 5);
  assert.equal(requests("onboarding/").length, 0);
  assert.equal(requests("attention-queue/").length, 0);
  assert.equal(reads.filter(({url}) => url.includes("taxonomy")).length, 0);
  assert.match(metric("Active businesses").textContent, /0/);
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
  await click(periodButton("90"));
  await until(() => client.isFetching() === 0);
  await tab("Operations");
  assert.equal(requests("onboarding/").at(-1).params.period, "90");
  assert.match(container.querySelector("[data-url]").textContent, /campaign=keep.*tab=operations/);
  await tab("Community & Trust");
  assert.equal(requests("attention-queue/").length, 1);
  assert.equal(requests("community-health/").at(-1).params.period, "90");
  await click(container.querySelector("[data-back]"));
  await until(() => Boolean(section("Merchant Onboarding")));
  assert.equal(periodButton("90").getAttribute("aria-pressed"), "true");
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
  await click(periodButton("90"));
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
