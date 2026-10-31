import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { MAP_PDF_UNAVAILABLE, populatePrintDocument, printAnalyticsTab } from "../utils/tabPdfExport.js";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const options = { tab: "growth-discovery", title: "Growth & Discovery", period: { start_date: "2026-10-03", end_date: "2026-11-01" }, now: new Date("2026-11-01T04:00:00Z") };

test("print surface retains SVG definitions, current state and offscreen sections without controls", () => {
  const dom = new JSDOM('<main><section><header><h2>Platform Growth</h2></header><button aria-haspopup="menu">Weekly</button><svg class="recharts-surface" width="800" height="240"><defs><pattern id="progress"><path d="M0 0 L8 8"/></pattern></defs><rect fill="url(#progress)" width="100" height="100"/></svg><img src="https://example.com/decorative.jpg"><div role="tooltip">Hover only</div><table><tbody><tr><td>Current page only</td></tr></tbody></table></section><section style="margin-top:2000px">Below viewport</section></main>');
  const target = dom.window.document.implementation.createHTMLDocument();
  const source = dom.window.document.querySelector("main");
  const navigation = dom.window.document.createElement("a");
  navigation.dataset.analyticsAction = "navigation";
  navigation.textContent = "View applications";
  source.append(navigation);
  const analyticalHeadings = dom.window.document.createElement("div");
  analyticalHeadings.innerHTML = '<ul aria-label="New businesses ranked by cluster"><li><button aria-expanded="false"><span>Culinary</span><span>12</span></button><div id="collapsed" aria-hidden="true">Hidden categories</div></li></ul><ol aria-label="Median resolution time by request type"><li><button><span>Location</span><span>3 min</span><span style="width:50%"></span></button></li></ol>';
  source.append(analyticalHeadings);
  const filename = populatePrintDocument(target, source, options);
  assert.equal(filename, "growth-discovery_2026-10-03_to_2026-11-01.pdf");
  assert.match(target.body.textContent, /Below viewport/);
  assert.match(target.body.textContent, /Current page only/);
  assert.match(target.body.textContent, /Weekly/);
  assert.equal(target.querySelectorAll("button, img, [role=tooltip]").length, 0);
  assert.doesNotMatch(target.body.textContent, /View applications/);
  assert.match(target.body.textContent, /Culinary12/);
  assert.match(target.body.textContent, /Location3 min/);
  assert.doesNotMatch(target.body.textContent, /Hidden categories/);
  assert.ok(target.querySelector("pattern#progress"));
  assert.equal(target.querySelector("rect").getAttribute("fill"), "url(#progress)");
  assert.equal(source.querySelectorAll("button, img").length, 4);
  assert.match(target.head.textContent, /A4 landscape/);
  const responsive = dom.window.document.createElement("div");
  responsive.innerHTML = '<div class="recharts-responsive-container"><div style="width:0;height:0"><div class="recharts-wrapper"><div class="recharts-legend-wrapper"><svg class="recharts-surface" width="14" height="14"></svg>Accounts</div><svg role="application" class="recharts-surface" width="800" height="240"><path d="M0 0L10 10"/></svg></div></div></div>';
  const fixed = dom.window.document.implementation.createHTMLDocument();
  populatePrintDocument(fixed, responsive, options);
  assert.equal(fixed.querySelector(".recharts-responsive-container"), null);
  assert.ok(fixed.querySelector("svg path"));
  assert.equal(fixed.querySelector('svg[role="application"]').getAttribute("viewBox"), "0 0 800 240");
  assert.match(fixed.body.textContent, /Accounts/);
  dom.window.close();
});

test("map and incomplete captures are rejected rather than creating incomplete PDFs", () => {
  const dom = new JSDOM('<main><canvas></canvas><section aria-busy="true">Loading</section></main>');
  const source = dom.window.document.querySelector("main");
  const target = dom.window.document.implementation.createHTMLDocument();
  assert.throws(() => populatePrintDocument(target, source, { ...options, tab: "business-ecosystem" }), { message: MAP_PDF_UNAVAILABLE });
  assert.equal(target.body.children.length, 0);
  assert.throws(() => populatePrintDocument(target, source, options), /finish loading/);
  assert.throws(() => populatePrintDocument(target, source, { ...options, period: null }), /Reporting dates/);
  dom.window.close();
});

test("print workflow cleans up its frame and restores focus on success and failure", async () => {
  const dom = new JSDOM('<button>Export</button><main><section>Operations report</section></main>');
  const originalDocument = globalThis.document;
  globalThis.document = dom.window.document;
  const append = dom.window.document.body.append.bind(dom.window.document.body);
  const button = dom.window.document.querySelector("button");
  let fail = false;
  let printed = 0;
  dom.window.document.body.append = (frame) => {
    append(frame);
    frame.contentWindow.focus = () => {};
    frame.contentWindow.print = () => {
      printed += 1;
      if (fail) throw new Error("Print failed");
      frame.contentWindow.dispatchEvent(new dom.window.Event("afterprint"));
    };
  };
  try {
    button.focus();
    await printAnalyticsTab(dom.window.document.querySelector("main"), options);
    assert.equal(printed, 1);
    assert.equal(dom.window.document.querySelector("iframe"), null);
    assert.equal(dom.window.document.activeElement, button);
    assert.equal(dom.window.document.title, "");
    fail = true;
    await assert.rejects(printAnalyticsTab(dom.window.document.querySelector("main"), options), /Print failed/);
    assert.equal(dom.window.document.querySelector("iframe"), null);
    assert.equal(dom.window.document.title, "");
  } finally {
    globalThis.document = originalDocument;
    dom.window.close();
  }
});
