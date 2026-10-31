import { readablePeriod } from "./reportClarity.js";
import { formatTimestamp } from "./presentation.js";

export const MAP_PDF_UNAVAILABLE = "PDF export is temporarily unavailable for Business Ecosystem because the geographic map cannot be captured reliably.";

const PRINT_CSS = `
@page { size: A4 landscape; margin: 12mm; }
:root { color-scheme: light; --color-background:#F8FAFC; --color-surface:#F1F5F9;
 --color-surface-muted:#F1F5F9; --color-text-primary:#0F172A; --color-text-secondary:#64748B;
 --color-primary:#F27F0D; --color-info:#3B82F6; --color-success:#16A34A; --color-danger:#EF4444;
 --color-warning:#F59E0B; --color-neutral:#64748B; --color-stroke:#E5E7EB; --color-stroke-strong:#D1D5DB; }
html,body { margin:0; background:white!important; color:#0F172A; font-family:Inter,Arial,sans-serif; }
html { scrollbar-gutter:auto!important; }
body { width:1024px; max-width:100%; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
.pdf-heading { margin:0 0 12px; padding:0 0 8px; line-height:1.25; border-bottom:1px solid #D1D5DB; }
.pdf-heading p { margin:2px 0; font-size:12px; color:#64748B; }
.pdf-heading h1 { margin:4px 0; font-size:20px; }
dt { min-height:0!important; }
[data-pdf-workspace] { display:block!important; width:100%!important; }
section { break-inside:avoid-page; page-break-inside:avoid; margin-bottom:14px; }
[data-pdf-workspace] > section:first-child { break-inside:auto; page-break-inside:auto; }
section > header { break-after:avoid-page; }
figure, svg.recharts-surface, tr { break-inside:avoid; }
thead { display:table-header-group; }
table { width:100%!important; min-width:0!important; table-layout:auto!important; font-size:12px!important; }
th,td { overflow:visible!important; overflow-wrap:anywhere; padding:6px!important; }
[data-pdf-workspace] * { animation:none!important; transition:none!important; }
[data-pdf-workspace] [class*="overflow"] { overflow:visible!important; max-height:none!important; }
[data-pdf-workspace] > div[class*="grid"] { display:block!important; }
[data-pdf-workspace] [class~="lg:grid-cols-2"] { display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; }
[data-pdf-workspace] .recharts-wrapper { break-inside:avoid; max-width:100%!important; }
button { display:none!important; }
`;

/** Copies only the current report surface; SVGs stay vector graphics and controls become context. */
export function populatePrintDocument(target, source, { tab, title, period, now = new Date() }) {
  if (tab === "business-ecosystem") throw new Error(MAP_PDF_UNAVAILABLE);
  if (!period?.start_date || !period?.end_date) throw new Error("Reporting dates are unavailable. Wait for the report to load and try again.");
  if (source.querySelector('[aria-busy="true"]')) throw new Error("Wait for reports to finish loading before exporting.");
  if (source.querySelector("canvas")) throw new Error("This workspace contains a graphic that cannot be printed reliably. PDF export was stopped.");
  target.documentElement.lang = "en";
  target.title = `${tab.replace(/[^a-z0-9-]/g, "")}_${period.start_date}_to_${period.end_date}.pdf`;
  for (const sheet of source.ownerDocument.querySelectorAll('style, link[rel="stylesheet"]')) target.head.append(target.importNode(sheet, true));
  const style = target.createElement("style");
  style.textContent = PRINT_CSS;
  target.head.append(style);
  const header = target.createElement("header");
  header.className = "pdf-heading";
  for (const [tag, text] of [["p", "SugboGo Admin Analytics"], ["h1", title], ["p", `${readablePeriod(period)} · Philippine time`], ["p", `Generated ${formatTimestamp(now)} PHT`]]) {
    const element = target.createElement(tag);
    element.textContent = text;
    header.append(element);
  }
  target.body.append(header);
  const clone = target.importNode(source, true);
  clone.setAttribute("data-pdf-workspace", "");
  clone.removeAttribute("tabindex");
  // These clickable headings carry report values, rather than control-only actions.
  clone.querySelectorAll('ul[aria-label="New businesses ranked by cluster"] button[aria-expanded], ol[aria-label="Median resolution time by request type"] button').forEach((button) => {
    const content = target.createElement("div");
    content.className = button.className;
    content.append(...button.childNodes);
    button.replaceWith(content);
  });
  clone.querySelectorAll('ul[aria-label="New businesses ranked by cluster"] div[id][aria-hidden="true"]').forEach((panel) => panel.remove());
  // Selected controls describe the captured state; no dropdowns or interactive UI are printed.
  for (const button of clone.querySelectorAll('button[aria-haspopup], button[aria-selected="true"], button[aria-pressed="true"]')) {
    if (button.getAttribute("aria-label")?.startsWith("About ")) continue;
    const label = target.createElement("span");
    label.textContent = button.textContent.trim() || button.getAttribute("aria-label");
    label.style.cssText = "font-size:11px;margin-right:8px;color:#64748B";
    button.replaceWith(label);
  }
  clone.querySelectorAll('button, input, select, dialog, [data-analytics-action], [role="menu"], [role="tooltip"], [role="dialog"], .recharts-tooltip-wrapper, .react-tooltip, nav[aria-label="Table pagination"]').forEach((node) => node.remove());
  clone.querySelectorAll("img").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
    node.removeAttribute("tabindex");
  });
  // ResponsiveContainer has zero-sized measurement wrappers; flatten those for static printing.
  clone.querySelectorAll(".recharts-responsive-container").forEach((container) => {
    const svg = container.querySelector('svg.recharts-surface[role="application"]') ?? container.querySelector(".recharts-wrapper > svg.recharts-surface");
    if (!svg || Number(svg.getAttribute("width")) <= 0 || Number(svg.getAttribute("height")) <= 0) throw new Error("A chart is not ready to print. Please try again.");
    svg.setAttribute("viewBox", svg.getAttribute("viewBox") || `0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`);
    svg.style.cssText = "display:block;width:100%;height:100%;";
    const chart = target.createElement("div");
    chart.style.cssText = `position:relative;width:100%;height:${svg.getAttribute("height")}px;`;
    const plot = target.createElement("div");
    plot.style.cssText = `width:100%;height:${svg.getAttribute("height")}px;break-inside:avoid;`;
    plot.append(svg);
    chart.append(plot);
    const legend = container.querySelector(".recharts-legend-wrapper");
    if (legend) {
      legend.style.cssText = "position:absolute;left:0;bottom:0;top:auto;width:100%;font-size:12px;";
      chart.append(legend);
    }
    container.replaceWith(chart);
  });
  target.body.append(clone);
  return target.title;
}

/** Uses the browser's vector PDF destination; the isolated frame never changes the live theme/layout. */
export async function printAnalyticsTab(source, options) {
  if (!source) throw new Error("The Analytics workspace is unavailable. Please try again.");
  const focus = document.activeElement;
  const originalTitle = document.title;
  let printTitle;
  const frame = document.createElement("iframe");
  frame.title = "Analytics PDF preparation";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-12000px;top:0;width:1120px;height:800px;border:0;";
  document.body.append(frame);
  let timeout;
  try {
    const target = frame.contentDocument;
    printTitle = populatePrintDocument(target, source, options);
    const ready = Promise.all([...target.querySelectorAll('link[rel="stylesheet"]')].map((link) => new Promise((resolve, reject) => {
      if (link.sheet) return resolve();
      link.onload = resolve;
      link.onerror = () => reject(new Error("Report styles could not be prepared. Please try again."));
    })));
    await Promise.race([
      ready.then(() => target.fonts?.ready),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("Report preparation timed out. Please try again.")), 15000); }),
    ]);
    clearTimeout(timeout);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => {
      frame.contentWindow.addEventListener("afterprint", resolve, { once: true });
      timeout = setTimeout(resolve, 120000);
      document.title = printTitle;
      frame.contentWindow.focus();
      frame.contentWindow.print();
    });
  } finally {
    clearTimeout(timeout);
    frame.remove();
    if (document.title === printTitle) document.title = originalTitle;
    if (focus?.isConnected) focus.focus({ preventScroll: true });
  }
}
