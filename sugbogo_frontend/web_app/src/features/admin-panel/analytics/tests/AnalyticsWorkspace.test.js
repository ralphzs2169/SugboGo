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
const originalCustomEvent = globalThis.CustomEvent;
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
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, Node: dom.window.Node, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom", ssr: { noExternal: ["recharts"] }, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "dashboard-transport-and-chart-contract", enforce: "pre",
      resolveId(source) { if (source === "recharts") return "\0analytics-recharts"; },
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/analytics/components/GeographicDistributionMap.jsx")) return `import React from 'react'; export default function GeographicMap({cells,onSelect}) {return React.createElement('div', {'data-geographic-map':true}, cells.filter(cell=>cell.eligible_businesses>0).map((cell,index)=>React.createElement('button',{key:cell.id,onClick:()=>onSelect(cell.id)},'Select map area '+(index+1))));}`;
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
  globalThis.CustomEvent = originalCustomEvent;
  for (const key of ["window", "document", "Node", "Element", "HTMLElement", "MutationObserver", "IS_REACT_ACT_ENVIRONMENT", "__dashboardTransport"]) delete globalThis[key];
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
const select = (label, within = container) => [...within.querySelectorAll("button[aria-haspopup]")].find((element) => element.getAttribute("aria-label")?.startsWith(`${label === "Interval" ? "Reporting interval" : label}:`));
const requests = (route) => reads.filter(({ url }) => url === `/admin/analytics/${route}`);
const click = async (element) => act(async () => { await element.click(); });
async function choose(label, value, within = container) {
  if (label === "Discovery metric") {
    await click(container.querySelector(`#discovery-trend-metrics-${value}`));
    await until(() => client.isFetching() === 0);
    await act(async () => new Promise((done) => setTimeout(done, 10)));
    return;
  }
  let trigger = select(label, within);
  if (!trigger && within === section("Business Coverage")) {
    await click(within.querySelector('[aria-label^="Coverage filters:"]'));
    trigger = select(label, within);
  }
  await click(trigger);
  const menu = trigger.parentElement.querySelector('[role="menu"]');
  const options = [...menu.querySelectorAll('[role="menuitemradio"]')];
  const labels = { support: "Low specialty support", discovery: "Low discovery activity", profile_visits: "Recorded profile visits", eligible_businesses: "Business distribution", daily: "Daily", weekly: "Weekly", "2": "Cafes", "1": "Food" };
  await click(options.find((option) => option.textContent.trim() === (labels[value] ?? value)));
  if (within === section("Business Coverage")) {
    const filters = within.querySelector('[aria-label^="Coverage filters:"]');
    if (filters.getAttribute("aria-expanded") === "true") await click(filters);
  }
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
  assert.equal(container.querySelector("#discovery-trend-metrics-saves").getAttribute("aria-selected"), "true");
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
  overrides.set("/admin/analytics/onboarding/", (report) => ({
    ...report,
    review_turnaround: { ...report.review_turnaround, median_hours: 0.05 },
  }));
  overrides.set("/admin/analytics/change-requests/", (report) => ({
    ...report,
    turnaround: { ...report.turnaround, median_hours: 0.03 },
    types: [
      { type: "name", label: "Business name", backlog: report.backlog, turnaround: { median_hours: 1.5, sample_count: 2 }, period_outcomes: { approved: 2, rejected: 1, withdrawn: 3 } },
      { type: "classification", label: "Classification", backlog: report.backlog, turnaround: { median_hours: 0, sample_count: 1 }, period_outcomes: { approved: 0, rejected: 1, withdrawn: 0 } },
      { type: "location", label: "Location", backlog: report.backlog, turnaround: { median_hours: null, sample_count: 0 }, period_outcomes: { approved: 0, rejected: 0, withdrawn: 1 } },
    ],
  }));
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
  const changes = section("Merchant change requests");
  assert.match(changes.textContent, /Median resolution time2 min/);
  assert.doesNotMatch(changes.textContent, /0\.03 hours/);
  assert.match(changes.textContent, /Administrator decisions/);
  assert.match(changes.textContent, /Merchant action/);
  const rows = changes.querySelectorAll("tbody tr");
  const speed = changes.querySelector('[aria-label="Median resolution time by request type"]');
  assert.match(speed.querySelector('[aria-label^="Business name:"]').getAttribute("data-tooltip-content"), /1 hr 30 min.*2 valid decisions/);
  assert.deepEqual([...rows[0].querySelectorAll("td")].slice(-3).map((cell) => cell.textContent), ["2", "1", "3"]);
  assert.match(speed.querySelector('[aria-label^="Classification:"]').textContent, /0 min/);
  assert.match(speed.querySelector('[aria-label^="Location:"]').textContent, /Unavailable/);
  assert.doesNotMatch(changes.textContent, /Unknown age/);
  await click([...changes.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  let drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Current queue aging/);
  assert.match(drawer.textContent, /Unknown age/);
  assert.match(drawer.textContent, /0\.03/);
  assert.match(drawer.textContent, /Missing resolution dates \(all time\)/);
  await click(drawer.querySelector('[aria-label="Close Merchant change requests details"]'));
  const onboarding = section("Merchant Onboarding");
  assert.match(onboarding.textContent, /8 pending · 2 overdue/);
  assert.match(onboarding.textContent, /Median turnaround3 min/);
  assert.match(onboarding.querySelector('[aria-label="About application workload"]').getAttribute("data-tooltip-content"), /independent event counts/);
  await click([...onboarding.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Applications submitted/);
  assert.match(drawer.textContent, /Review decisions/);
  assert.doesNotMatch(drawer.textContent, /Completed reviews/);
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


test("geographic distribution reuses its query across modes and keeps zero, unavailable and exact values distinct", async () => {
  await mount();
  assert.equal(requests("discovery-heatmap/").length, 0);
  await tab("Business Ecosystem");
  const geographic = section("Geographic Distribution");
  assert.ok(geographic);
  assert.equal(geographic.parentElement.getAttribute("role"), "tabpanel");
  assert.equal(requests("discovery-heatmap/").length, 1);
  assert.equal(geographic.querySelector('[aria-label="Geographic area"]'), null);
  assert.doesNotMatch(geographic.textContent, /grid:1:/);
  assert.match(geographic.textContent, /Select an area on the map to inspect it\./);
  assert.equal(geographic.querySelector("h3"), null);
  assert.match(geographic.textContent, /Businesses per grid area/);
  assert.equal(geographic.textContent.match(/Visit recording coverage unverified/g).length, 1);
  assert.doesNotMatch(geographic.textContent, /Business inventory reflects current records|Current eligible businesses by area/);
  await click([...geographic.querySelectorAll("button")].find((button) => button.textContent === "Select map area 1"));
  assert.match(geographic.textContent, /2 businesses/);
  assert.match(geographic.textContent, /0 recorded profile visits · selected period/);
  await click([...geographic.querySelectorAll("button")].find((button) => button.textContent === "Clear selection"));
  assert.match(geographic.textContent, /Select an area on the map to inspect it\./);
  assert.equal(geographic.querySelector("h3"), null);
  await click([...geographic.querySelectorAll("button")].find((button) => button.textContent === "Select map area 2"));
  assert.match(geographic.textContent, /Unavailable recorded profile visits/);
  await choose("Metric", "profile_visits");
  assert.equal(requests("discovery-heatmap/").length, 1);
  assert.match(geographic.textContent, /Visit intensity unavailable/);
  assert.match(geographic.textContent, /Recorded profile visits per grid area/);
  assert.match(geographic.textContent, /Selected area/);
  assert.match(geographic.textContent, /1 businesses · current inventory/);
  await choose("Category", "2");
  assert.equal(requests("discovery-heatmap/").at(-1).params.category, 2);
  assert.match(geographic.textContent, /Select an area on the map to inspect it\./);
  await click([...geographic.querySelectorAll("button")].find((button) => button.textContent === "Select map area 1"));
  await choose("Cluster", "1");
  assert.match(geographic.textContent, /Select an area on the map to inspect it\./);
  assert.equal(requests("discovery-heatmap/").at(-1).params.category, undefined);
  await click([...geographic.querySelectorAll("button")].find((button) => button.textContent === "Select map area 1"));
  await choosePeriod("7");
  await until(() => section("Geographic Distribution")?.textContent.includes("Select an area on the map to inspect it.") && requests("discovery-heatmap/").at(-1)?.params.period === "7" && client.isFetching() === 0);
  const updatedGeographic = section("Geographic Distribution");
  assert.match(updatedGeographic.textContent, /Select an area on the map to inspect it\./);
  assert.equal(requests("discovery-heatmap/").at(-1).params.period, "7");
  await click([...updatedGeographic.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  const drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Current businesses/);
  assert.match(drawer.textContent, /Zero recorded visits/);
  assert.match(drawer.textContent, /Visits unavailable/);
  assert.match(drawer.textContent, /missing_location/);
  assert.match(drawer.textContent, /not explorer location, foot traffic/);
  assert.match(drawer.textContent, /1 km² projected area/);
  assert.match(drawer.textContent, /Recorded activity may be incomplete/);
  const inspect = drawer.querySelector('[aria-label="Inspect grid area grid:1:1"]');
  assert.equal(inspect.getAttribute("aria-pressed"), "false");
  await click(inspect);
  assert.match(updatedGeographic.textContent, /Selected area/);
  assert.match(updatedGeographic.textContent, /0 recorded profile visits/);
});

test("geographic distribution clears selection for changed geometry or a removed populated cell", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  await mount();
  await until(() => client.isFetching() === 0);
  const geographic = section("Geographic Distribution");
  const selectFirstArea = () => click([...geographic.querySelectorAll("button")].find((button) => button.textContent === "Select map area 1"));
  const query = client.getQueryCache().findAll().find((row) => row.queryKey[2] === "discoveryHeatmap");
  await selectFirstArea();
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({
      ...report,
      cells: report.cells.map((cell, index) => index === 0 ? { ...cell, eligible_businesses: 3 } : cell),
    }));
  });
  await until(() => geographic.textContent.includes("3 businesses"));
  assert.match(geographic.textContent, /Selected area/);
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, definition: { version: "changed-grid" } }));
  });
  await until(() => geographic.textContent.includes("Select an area on the map to inspect it."));
  await selectFirstArea();
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, scope: { boundary_wkb_sha256: "changed-boundary" } }));
  });
  await until(() => geographic.textContent.includes("Select an area on the map to inspect it."));
  await selectFirstArea();
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({
      ...report,
      cells: report.cells.map((cell, index) => index === 0 ? { ...cell, eligible_businesses: 0 } : cell),
    }));
  });
  await until(() => geographic.textContent.includes("Select an area on the map to inspect it."));
  assert.equal(geographic.querySelector("h3"), null);
  assert.equal(requests("discovery-heatmap/").length, 1);
});

test("workspace ecosystem preserves low-activity ranking, support scope and distinct business identities", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  overrides.set("/admin/analytics/business-attention/", (report, params) => ({
    ...report,
    items: [9, 15].map((id, index) => ({
      ...report.items[0],
      business_id: id,
      business_name: "Serenity Cove Resort & Spa",
      cover_photo_url: index === 0 ? "https://example.com/storefront.jpg" : null,
      profile_visits: params.ordering === "valid_vouches" ? null : index,
      valid_vouches: index,
      attention_reason: params.attention_mode === "support" ? "No valid specialty endorsements" : "No recorded profile visits",
    })),
  }));
  await mount();
  assert.equal(requests("low-exposure/").length, 0);
  assert.equal(requests("business-attention/").at(-1).params.ordering, "profile_visits");
  assert.equal(requests("platform-growth/").length, 0);
  assert.equal(reads.filter(({url}) => url.includes("taxonomy")).length, 2);
  const attention = section("Businesses Needing Attention");
  assert.match(attention.textContent, /No recorded profile visits/);
  assert.match(attention.textContent, /Based on recorded discovery activity · recording coverage unverified/);
  assert.doesNotMatch(attention.textContent, /Required discovery observations are unavailable/);
  assert.match(attention.textContent, /Business #9/);
  assert.match(attention.textContent, /Business #15/);
  assert.equal(attention.querySelectorAll('a[href^="/admin-panel/businesses/"]').length, 2);
  assert.equal(attention.querySelector("img").getAttribute("src"), "https://example.com/storefront.jpg");
  assert.equal(attention.querySelector("img").getAttribute("loading"), "lazy");
  assert.ok(attention.querySelector('[aria-label="No cover photo available"]'));
  await choose("Category", "2", section("Business Coverage"));
  await choose("Attention mode", "support");
  await choose("Attention category", "2");
  assert.equal(requests("business-attention/").at(-1).params.ordering, "valid_vouches");
  assert.equal(requests("business-attention/").at(-1).params.category, 2);
  assert.match(section("Businesses Needing Attention").textContent, /No valid specialty endorsements/);
  assert.match(section("Businesses Needing Attention").textContent, /Unavailable/);
  assert.doesNotMatch(section("Businesses Needing Attention").textContent, /No recorded profile visits/);
  const attentionCount = requests("business-attention/").length;
  await tab("Community & Trust");
  assert.ok(section("Reports & disputes"));
  assert.equal(requests("change-requests/").length, 0);
  await tab("Business Ecosystem");
  await click(section("Business Coverage").querySelector('[aria-label^="Coverage filters:"]'));
  assert.equal(select("Category", section("Business Coverage")).textContent, "Cafes");
  await click(section("Business Coverage").querySelector('[aria-label^="Coverage filters:"]'));
  assert.equal(select("Attention mode").textContent, "Low specialty support");
  assert.equal(select("Attention category").textContent, "Cafes");
  assert.equal(select("Order by"), undefined);
  assert.equal(requests("business-attention/").length, attentionCount);
  assert.equal(requests("low-exposure/").length, 0);
  assert.equal(reads.filter(({url}) => url.includes("taxonomy")).length, 2);
});


test("business attention renders provisional rows but blocks unavailable observations", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  await mount();
  const attention = section("Businesses Needing Attention");
  assert.ok(attention.querySelector("table"));
  assert.match(attention.textContent, /Based on recorded discovery activity/);
  const query = client.getQueryCache().findAll().find((row) => row.queryKey[2] === "businessAttention");
  assert.equal(container.querySelector("select"), null);
  assert.match(attention.textContent, /Businesses with the lowest recorded discovery activity during the selected period/);
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, items: [], pagination: { ...report.pagination, total_items: 0 } }));
  });
  await until(() => attention.textContent.includes("No businesses to rank for this selection."));
  assert.match(attention.textContent, /No eligible businesses are available for the recorded discovery activity ranking/);
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({
      ...report,
      items: null,
      pagination: null,
      selection_status: "unavailable",
      meta: { ...report.meta, availability: "unavailable" },
    }));
  });
  await until(() => attention.textContent.includes("Required discovery observations are unavailable"));
  assert.equal(attention.querySelector("table"), null);
  await choose("Attention mode", "support");
  const support = client.getQueryCache().findAll().find((row) => row.queryKey[2] === "businessAttention" && row.queryKey[3].attention_mode === "support");
  await act(async () => {
    client.setQueryData(support.queryKey, (report) => ({ ...report, items: [], pagination: { ...report.pagination, total_items: 0 } }));
  });
  await until(() => section("Businesses Needing Attention").textContent.includes("No eligible businesses are available for the specialty support ranking."));
});

test("business attention request failures retain Error and Retry rather than an empty result", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  failures.add("/admin/analytics/business-attention/");
  await mount();
  const attention = section("Businesses Needing Attention");
  assert.match(attention.textContent, /Unable to load/);
  assert.doesNotMatch(attention.textContent, /No businesses currently need attention/);
  const retry = [...attention.querySelectorAll("button")].find((button) => button.textContent.includes("Retry"));
  assert.ok(retry);
  failures.delete("/admin/analytics/business-attention/");
  await click(retry);
  await until(() => Boolean(attention.querySelector("table")));
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
  assert.equal(rows.at(-1).label, "Unknown");
  assert.equal(rows.at(-1).color, "var(--color-neutral)");
  assert.equal(rows[1].label, "Explore");
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

const accountTrendButton = () => container.querySelector("#discovery-trend-metrics-distinct_engaged_explorers");

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
  assert.equal(accountTrendButton().getAttribute("aria-selected"), "true");
  assert.equal(requests("discovery-trend/").at(-1).params.metric, "distinct_engaged_explorers");
  assert.equal(requests("discovery-trend/").at(-1).params.interval, "weekly");
  const report = section("Discovery Activity");
  assert.match(report.textContent, /Distinct discovery participants by week/);
  const rows = JSON.parse(report.querySelector("[data-chart]").getAttribute("data-chart"));
  assert.deepEqual(rows.map((row) => row.value), [2,2,null,0]);
  assert.equal(report.querySelectorAll('[aria-label="Recorded discovery summaries"] button').length, 0);
  await click(report.querySelector('[aria-label="About Discovery Activity"]'));
  await until(() => document.querySelector("dialog[open]"));
  assert.match(document.querySelector("dialog[open]").textContent, /must never be summed/);
  assert.match(document.querySelector("dialog[open]").textContent, /not general app activity/);
  await click(document.querySelector('[aria-label="Close Discovery Activity details"]'));
  await click([...report.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  assert.match(document.querySelector("dialog[open]").textContent, /Participating Accounts/);
  await click(document.querySelector('[aria-label="Close Discovery Activity details"]'));
  const count = requests("discovery-trend/").length;
  await choose("Discovery metric", "saves");
  await selectAccounts();
  assert.equal(requests("discovery-trend/").length, count + 1);
  await choose("Interval", "daily", report);
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
  await until(() => section("Discovery Activity").textContent.includes("No participating accounts were recorded"));
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
  await choose("Interval", "daily", section("Transportation Planning"));
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
  await click(onboarding.querySelector('[aria-label="About Merchant Onboarding"]'));
  let drawer=document.querySelector("dialog[open]");
  assert.match(drawer.textContent,/Overall SLA compliance uses classified outcomes/);
  assert.ok([...drawer.querySelectorAll("summary")].find((node)=>node.textContent === "Technical details"));
  await click(drawer.querySelector('[aria-label="Close Merchant Onboarding details"]'));
  await tab("Community & Trust");
  const community=section("Community Health");
  await click(community.querySelector('[aria-label="About Community Health"]'));
  drawer=document.querySelector("dialog[open]");
  assert.match(drawer.textContent,/Last updated/);
  assert.match(drawer.textContent,/still published today/);
  await click(drawer.querySelector('[aria-label="Close Community Health details"]'));
  await tab("Business Ecosystem");
  await click(section("Discovery Score Health").querySelector('[aria-label="About Discovery Score Health"]'));
  drawer=document.querySelector("dialog[open]");
  assert.match(drawer.textContent,/should not be added together/);
  assert.match(drawer.textContent,/Selected dates do not filter this snapshot/);
  await click(drawer.querySelector('[aria-label="Close Discovery Score Health details"]'));
  const coverage=section("Business Coverage");
  await click(coverage.querySelector('[aria-label="About Business Coverage"]'));
  drawer=document.querySelector("dialog[open]");
  assert.match(drawer.textContent,/Complete recording has not been confirmed/);
  assert.match(drawer.textContent,/not geographic coverage/);
  assert.ok([...drawer.querySelectorAll("summary")].find((node)=>node.textContent === "Technical details"));
});

test("business coverage compacts full coverage and keeps every classification in its drawer", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  overrides.set("/admin/analytics/coverage/", (report) => ({
    ...report,
    overall: { eligible_businesses: 15, visited_businesses: 11, zero_recorded_visit_businesses: 4, coverage_percentage: 73.33 },
    categories: [
      ...[[9, 100], [3, 50], [2, 100], [5, 0], [4, 75], [6, 100]].map(([id, percentage]) => ({
        id,
        name: `Category ${id}`,
        eligible_businesses: 4,
        visited_businesses: percentage / 25,
        zero_recorded_visit_businesses: 4 - percentage / 25,
        coverage_percentage: percentage,
      })),
      { id: 8, name: "Empty category", eligible_businesses: 0, visited_businesses: 0, zero_recorded_visit_businesses: 0, coverage_percentage: null },
    ],
  }));
  await mount();
  const coverage = section("Business Coverage");
  assert.equal(coverage.querySelector("table"), null);
  assert.equal(coverage.querySelector("details"), null);
  assert.doesNotMatch(coverage.textContent, /Highest coverage|View full coverage|Empty category/);
  assert.deepEqual([...coverage.querySelectorAll("h3")].map((heading) => heading.textContent), ["Coverage by category"]);
  assert.match(coverage.textContent, /73.3% coverage/);
  assert.doesNotMatch(coverage.textContent, /73.33%/);
  assert.match(coverage.textContent, /11 of 15 eligible businesses received recorded profile visits/);
  assert.deepEqual([...container.querySelectorAll("h2")].map((heading) => heading.textContent), ["Geographic Distribution", "Business Coverage", "Discovery Score Health", "Businesses Needing Attention"]);
  assert.match(coverage.textContent, /4 businesses had no recorded profile visits/);
  assert.deepEqual([...coverage.querySelectorAll("ol li")].map((row) => row.textContent), ["Category 50%", "Category 350%", "Category 475%", "3 other categories100%"]);
  assert.deepEqual([...coverage.querySelectorAll('ol [aria-hidden="true"] > div')].map((bar) => bar.style.width), ["0%", "50%", "75%", "100%"]);
  assert.doesNotMatch(coverage.textContent, /Lowest coverage first|Showing 5 of|Compare clusters/);
  assert.equal(coverage.querySelectorAll('[aria-label="About Business Coverage"]').length, 1);
  assert.equal(coverage.textContent.match(/Coverage unverified/g).length, 1);
  assert.ok(coverage.querySelector("ol").compareDocumentPosition([...coverage.querySelectorAll("p")].find((node) => node.textContent.includes("4 businesses had no recorded"))) & window.Node.DOCUMENT_POSITION_FOLLOWING);

  const filters = coverage.querySelector('[aria-label^="Coverage filters:"]');
  await click(filters);
  assert.equal(filters.getAttribute("aria-haspopup"), "dialog");
  assert.equal(document.activeElement, select("Cluster", coverage));
  const categoryFilter = select("Category", coverage);
  await click(categoryFilter);
  await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(categoryFilter.getAttribute("aria-expanded"), "false");
  assert.equal(filters.getAttribute("aria-expanded"), "true");
  await act(async () => categoryFilter.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  assert.equal(filters.getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, filters);
  const dimension = coverage.querySelector('[aria-label="Coverage dimension"]');
  await click([...dimension.querySelectorAll('[role="tab"]')].find((button) => button.textContent === "Cluster"));
  assert.match(coverage.textContent, /Coverage by cluster/);
  await act(async () => dimension.querySelector('[aria-selected="true"]').dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
  assert.match(coverage.textContent, /Coverage by category/);
  await act(async () => dimension.querySelector('[aria-selected="true"]').dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  assert.match(coverage.textContent, /Coverage by cluster/);
  assert.equal(requests("coverage/").length, 1);
  assert.deepEqual([...coverage.querySelectorAll("ol li")].map((row) => row.textContent), ["Food50%"]);
  await choose("Cluster", "1", section("Business Coverage"));
  await choose("Category", "2", section("Business Coverage"));
  assert.deepEqual(requests("coverage/").at(-1).params, { period: "30", cluster: 1, category: 2 });
  await choosePeriod("7");
  await until(() => requests("coverage/").at(-1)?.params.period === "7" && client.isFetching() === 0 && coverage.textContent.includes("50%"));
  assert.equal(requests("discovery-scores/").length, 1);
  const action = [...coverage.querySelectorAll("button")].find((button) => button.textContent.includes("View data"));
  await act(async () => action.focus());
  await click(action);
  const drawer = document.querySelector("dialog[open]");
  assert.equal(drawer.querySelectorAll("table").length, 2);
  assert.equal(drawer.querySelectorAll("tbody tr").length, 8);
  assert.match(drawer.textContent, /Empty category000Unavailable/);
  assert.match(drawer.textContent, /Category 9/);
  assert.match(drawer.textContent, /Covered businesses/);
  assert.match(drawer.textContent, /not an average of classification percentages/);
  await click(drawer.querySelector('[aria-label="Close Business Coverage details"]'));
  assert.equal(document.activeElement, action);
});

test("business coverage retains every incomplete classification and summarizes each dimension independently", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  overrides.set("/admin/analytics/coverage/", (report) => ({
    ...report,
    categories: [0, 25, 50, 75, 99, 99.99, 100, 100].map((percentage, index) => ({
      id: index + 1, name: `Category ${index + 1}`, eligible_businesses: 10000,
      visited_businesses: percentage * 100, zero_recorded_visit_businesses: 10000 - percentage * 100,
      coverage_percentage: percentage,
    })),
    clusters: [3, 1, 2].map((id) => ({ id, name: `Cluster ${id}`, eligible_businesses: 1, visited_businesses: 1, zero_recorded_visit_businesses: 0, coverage_percentage: 100 })),
  }));
  await mount();
  const coverage = section("Business Coverage");
  assert.equal(coverage.querySelectorAll("ol li").length, 8);
  assert.match(coverage.querySelector("ol").textContent, /Category 699.99%/);
  assert.doesNotMatch(coverage.querySelector("ol").textContent, /other categories/);
  const dimension = coverage.querySelector('[aria-label="Coverage dimension"]');
  await click([...dimension.querySelectorAll('[role="tab"]')].find((button) => button.textContent === "Cluster"));
  assert.deepEqual([...coverage.querySelectorAll("ol li")].map((row) => row.textContent), ["3 clusters100%"]);
  assert.doesNotMatch(coverage.textContent, /No classified coverage is available/);
  const query = client.getQueryCache().findAll().find((row) => row.queryKey[2] === "coverage");
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, clusters: report.clusters.slice(0, 2) }));
  });
  await until(() => coverage.querySelectorAll("ol li").length === 2);
  assert.deepEqual([...coverage.querySelectorAll("ol li")].map((row) => row.textContent), ["Cluster 1100%", "Cluster 3100%"]);
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, categories: report.clusters.map((row) => ({ ...row, id: row.id + 10, name: `Category ${row.id}` })).concat([{ id: 99, name: "Category 99", eligible_businesses: 1, visited_businesses: 1, zero_recorded_visit_businesses: 0, coverage_percentage: 100 }]) }));
  });
  await click([...dimension.querySelectorAll('[role="tab"]')].find((button) => button.textContent === "Category"));
  assert.deepEqual([...coverage.querySelectorAll("ol li")].map((row) => row.textContent), ["3 categories100%"]);
  assert.equal(requests("coverage/").length, 1);
});

test("business coverage preserves unavailable visits and known empty eligibility", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  overrides.set("/admin/analytics/coverage/", (report) => ({
    ...report,
    overall: { ...report.overall, visited_businesses: null, zero_recorded_visit_businesses: null, coverage_percentage: null },
    categories: report.categories.map((row) => ({ ...row, visited_businesses: null, zero_recorded_visit_businesses: null, coverage_percentage: null })),
    clusters: report.clusters.map((row) => ({ ...row, visited_businesses: null, zero_recorded_visit_businesses: null, coverage_percentage: null })),
    sources: { ...report.sources, visibility: { availability: "unavailable" } },
  }));
  await mount();
  const coverage = section("Business Coverage");
  assert.match(coverage.textContent, /Unavailable coverage/);
  assert.match(coverage.textContent, /4 eligible businesses · recorded profile visits unavailable/);
  assert.match(coverage.textContent, /Current eligible-business counts remain available/);
  assert.equal(coverage.querySelectorAll("ol li").length, 0);
  assert.doesNotMatch(coverage.textContent, /0 businesses had no recorded profile visits|0%/);
  await click([...coverage.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  const drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Covered businessesUnavailable/);
  await click(drawer.querySelector('[aria-label="Close Business Coverage details"]'));
  const query = client.getQueryCache().findAll().find((row) => row.queryKey[2] === "coverage");
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, overall: { ...report.overall, eligible_businesses: 0 } }));
  });
  await until(() => coverage.textContent.includes("No eligible active businesses match the selected scope."));
});

test("discovery score health distinguishes healthy, unhealthy, empty and unavailable snapshots", async () => {
  initialEntries = ["/admin-panel/analytics?tab=business-ecosystem"];
  overrides.set("/admin/analytics/discovery-scores/", (report) => ({
    ...report,
    coverage: { ...report.coverage, active_businesses: 15, fresh: 15, stale: 0, pending: 0, failed: 0, missing: 0, provisional: 0 },
  }));
  await mount();
  const health = section("Discovery Score Health");
  assert.match(health.textContent, /15 \/ 15 active businesses have fresh scores/);
  assert.ok(health.querySelector(".text-3xl").classList.contains("text-success"));
  assert.match(health.textContent, /Fresh15Stale0Pending0Failed0/);
  assert.match(health.textContent, /Missing 0 · Provisional 0/);
  assert.equal(health.querySelector("a").getAttribute("href"), "/admin-panel/analytics/discovery-scores");
  assert.equal(health.querySelector("table"), null);
  const query = client.getQueryCache().findAll().find((row) => row.queryKey[2] === "discoveryScores");
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({
      ...report,
      coverage: { ...report.coverage, fresh: 10, stale: 3, pending: 1, failed: 1, missing: 1, provisional: 1 },
    }));
  });
  await until(() => health.textContent.includes("10 / 15"));
  const values = [...health.querySelectorAll("dl dd")];
  assert.equal(values[1].textContent, "3");
  assert.ok(values[1].classList.contains("text-warning"));
  assert.ok(values[2].classList.contains("text-warning"));
  assert.ok(values[3].classList.contains("text-danger"));
  assert.ok(!health.querySelector(".text-3xl").classList.contains("text-success"));
  await click([...health.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  const drawer = document.querySelector("dialog[open]");
  assert.equal(drawer.querySelectorAll("tbody tr").length, 6);
  assert.match(drawer.textContent, /Selected dates do not filter this snapshot/);
  assert.match(drawer.textContent, /Freshness threshold: 24 hours/);
  assert.match(drawer.textContent, /should not be added together/);
  await click(drawer.querySelector('[aria-label="Close Discovery Score Health details"]'));
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, coverage: { ...report.coverage, fresh: null, failed: null } }));
  });
  await until(() => health.textContent.includes("Unavailable / 15"));
  assert.equal(health.querySelectorAll("dl dd")[3].textContent, "Unavailable");
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, coverage: { ...report.coverage, active_businesses: 0 } }));
  });
  await until(() => health.textContent.includes("No active businesses to assess."));
  await act(async () => {
    client.setQueryData(query.queryKey, (report) => ({ ...report, coverage: null }));
  });
  await until(() => health.textContent.includes("Discovery Score health counts are unavailable."));
  assert.equal(health.querySelector("dl"), null);
  assert.equal(requests("discovery-scores/").length, 1);
});

test("community report drawers retain exact buckets, sentiment and the complete specialty breakdown", async () => {
  initialEntries = ["/admin-panel/analytics?tab=community-trust"];
  overrides.set("/admin/analytics/specialty-support/", (report) => ({
    ...report,
    specialties: Array.from({ length: 7 }, (_, index) => ({
      specialty_id: index + 1,
      name: `Specialty ${index + 1}`,
      valid_vouches: 7 - index,
      distinct_supporters: 1,
      supported_businesses: 1,
    })),
  }));
  await mount();
  const community = section("Community Health");
  const specialty = section("Specialty Support");
  for (const report of [community, specialty]) {
    assert.equal(report.querySelector("table"), null);
    assert.equal(report.querySelector("details"), null);
  }
  const action = [...community.querySelectorAll("button")].find((button) => button.textContent.includes("View data"));
  action.focus();
  await click(action);
  let drawer = document.querySelector("dialog[open]");
  assert.match(drawer.textContent, /Bucket date/);
  assert.match(drawer.textContent, /Published reviews/);
  assert.match(drawer.textContent, /Sentiment details/);
  assert.match(drawer.textContent, /Excluded from denominator/);
  assert.match(drawer.textContent, /still published today/);
  assert.match(drawer.textContent, /Data reliability/);
  await click(drawer.querySelector('[aria-label="Close Community Health details"]'));
  assert.equal(document.activeElement, action);
  await click([...specialty.querySelectorAll("button")].find((button) => button.textContent.includes("View data")));
  drawer = document.querySelector("dialog[open]");
  assert.equal(drawer.querySelectorAll("tbody tr").length, 7);
  assert.match(drawer.textContent, /Specialty 7/);
  assert.match(drawer.textContent, /Valid endorsements/);
  assert.match(drawer.textContent, /Distinct supporters/);
  assert.match(drawer.textContent, /Supported businesses/);
  assert.match(drawer.textContent, /Selected dates do not filter/);
  assert.match(drawer.textContent, /must not be added together/);
  assert.doesNotMatch(drawer.textContent, /Reporting dates unavailable/);
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
  assert.match(activity.textContent,/Participating Accounts/);
  assert.match(activity.textContent,/Accounts with recorded discovery activity during each interval/);
  for(const metric of ["profile_visits","impressions","saves"]) {
    await choose("Discovery metric",metric);
    assert.equal(activity.querySelector(`#discovery-trend-metrics-${metric}`).getAttribute("aria-selected"),"true");
    assert.equal(accountTrendButton().getAttribute("aria-selected"),"false");
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

test("discovery summaries are noninteractive and Activity Trend tabs support keyboard selection",async()=>{
  await mount();
  const report=section("Discovery Activity");
  const summary=report.querySelector('[aria-label="Recorded discovery summaries"]');
  assert.equal(summary.querySelectorAll("dd").length,3);
  assert.equal(summary.querySelectorAll("button").length,0);
  const tabs=report.querySelector('[aria-label="Activity Trend"][role="tablist"]');
  assert.deepEqual([...tabs.querySelectorAll("button")].map((node)=>node.textContent),["Visits","Impressions","Saves","Participating Accounts"]);
  await act(async()=>tabs.querySelector('[aria-selected="true"]').dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"End",bubbles:true})));
  await until(()=>client.isFetching() === 0);
  assert.equal(accountTrendButton().getAttribute("aria-selected"),"true");
  assert.match(report.textContent,/Distinct discovery participants by week/);
  assert.equal(document.activeElement,accountTrendButton());
  assert.ok(report.querySelector(`#${accountTrendButton().getAttribute("aria-controls")}`));
});
