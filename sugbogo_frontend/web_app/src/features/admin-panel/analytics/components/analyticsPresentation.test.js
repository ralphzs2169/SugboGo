import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let GrowthTooltip;
let DiscoveryTooltip;
let CategoryTooltip;
let Footer;
let readablePeriod;
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));

before(async () => {
  server = await createServer({appType:"custom",optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false}});
  ({GrowthTooltip} = await server.ssrLoadModule("/src/features/admin-panel/analytics/sections/PlatformGrowthSection.jsx"));
  ({DiscoveryTooltip} = await server.ssrLoadModule("/src/features/admin-panel/analytics/sections/DiscoveryActivitySection.jsx"));
  ({AnalyticsCategoryTooltip:CategoryTooltip} = await server.ssrLoadModule("/src/features/admin-panel/analytics/components/AnalyticsTooltip.jsx"));
  ({default:Footer} = await server.ssrLoadModule("/src/features/admin-panel/analytics/components/AnalyticsReportFooter.jsx"));
  ({readablePeriod} = await server.ssrLoadModule("/src/features/admin-panel/analytics/utils/reportClarity.js"));
});
after(async () => server?.close());

test("all four chart tooltips share one surface while retaining report-specific exact values", () => {
  const bucket={date:"2026-10-05",start:"2026-10-05T00:00:00+08:00",end_exclusive:"2026-10-12T00:00:00+08:00",new_consumer_accounts:1200,new_businesses:0,newly_approved_businesses:2,value:0};
  const growth=render(GrowthTooltip,{active:true,payload:[{payload:bucket}],inProgressDate:bucket.date});
  const activity=render(DiscoveryTooltip,{active:true,payload:[{payload:bucket}],interval:"weekly",selected:{label:"Discovery-active accounts",color:"var(--color-neutral)"}});
  const sources=render(CategoryTooltip,{active:true,payload:[{payload:{label:"Unknown",count:1200,share_percent:60}}],unit:"visits"});
  const routes=render(CategoryTooltip,{active:true,payload:[{payload:{label:"Jeepney guidance",method:"JEEPNEY",count:800,share_percent:40}}],unit:"requests",colors:{JEEPNEY:"var(--color-primary)"}});
  const surfaces=[growth,activity,sources,routes];
  assert.equal(new Set(surfaces.map((html)=>html.match(/class="([^"]+)"/)[1])).size,1);
  for(const html of surfaces) assert.match(html,/role="tooltip"/);
  assert.match(growth,/1,200/);
  assert.match(growth,/Week in progress/);
  assert.match(activity,/>0</);
  assert.match(sources,/Unknown/);
  assert.match(sources,/60%/);
  assert.match(routes,/Jeepney guidance/);
  assert.match(routes,/var\(--color-primary\)/);
  assert.equal(render(CategoryTooltip,{active:false,payload:[],unit:"visits"}),"");
});

test("tooltip zero, missing observations and unknown shares stay distinct", () => {
  const missing=render(DiscoveryTooltip,{active:true,payload:[{payload:{date:"2026-10-05",value:null}}],interval:"daily",selected:{label:"Visits"}});
  assert.match(missing,/Observation unavailable/);
  const unknown=render(CategoryTooltip,{active:true,payload:[{payload:{label:"Other",count:0,share_percent:null}}],unit:"requests"});
  assert.match(unknown,/>0</);
  assert.match(unknown,/Unavailable/);
});

test("shared footer uses named help and data actions, explicit partial coverage and update time", () => {
  const html=render(Footer,{title:"Discovery Sources",meta:{generated_at:"2026-10-28T04:00:00Z",is_partial:true},hasData:true,onAbout:()=>{},onData:()=>{}});
  assert.match(html,/aria-label="About Discovery Sources"/);
  assert.match(html,/Partial coverage/);
  assert.match(html,/View data/);
  assert.match(html,/cursor-pointer/);
  assert.match(html,/min-h-8 min-w-8/);
  assert.match(render(Footer,{title:"Loading",hasData:false}),/disabled=""/);
});

test("period display uses readable Philippine calendar dates across years", () => {
  const normal=readablePeriod({start_date:"2026-09-29",end_date:"2026-10-28"});
  assert.match(normal,/Sep/);
  assert.match(normal,/Oct/);
  assert.doesNotMatch(normal,/2026-09-29/);
  const crossYear=readablePeriod({start_date:"2025-12-29",end_date:"2026-01-02"});
  assert.match(crossYear,/2025/);
  assert.match(crossYear,/2026/);
});
