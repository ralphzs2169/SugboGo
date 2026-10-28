import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let Sparkline;

before(async () => {
  server = await createServer({
    appType: "custom",
    ssr: { noExternal: ["recharts"] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "sparkline-chart-contract",
      enforce: "pre",
      resolveId(source) {
        if (source === "recharts") return "\0sparkline-recharts";
      },
      load(id) {
        if (id !== "\0sparkline-recharts") return;
        return `import React from "react";
          export const ResponsiveContainer = ({ children }) => children;
          export const AreaChart = ({ data, children }) => React.createElement(
            "svg", { "data-series": JSON.stringify(data) }, children,
          );
          export const Area = ({ connectNulls }) => React.createElement(
            "g", { "data-connect-nulls": String(connectNulls) },
          );
          export const XAxis = () => null;
          export const Tooltip = () => null;
        `;
      },
    }],
  });
  ({ default: Sparkline } = await server.ssrLoadModule(
    "/src/features/admin-panel/components/MetricSparkline.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function render(values) {
  const data = values.map((value, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    value,
  }));
  return renderToStaticMarkup(React.createElement(Sparkline, { data }));
}

test("null buckets reach Recharts at their original dates and disable connecting gaps", () => {
  const html = render([10, null, null, 20]);
  assert.match(html, /2026-10-02&quot;,&quot;value&quot;:null/);
  assert.match(html, /2026-10-03&quot;,&quot;value&quot;:null/);
  assert.match(html, /data-connect-nulls="false"/);
});

test("measured zero and valid series remain observations", () => {
  const html = render([10, 0, 20]);
  assert.match(html, /2026-10-02&quot;,&quot;value&quot;:0/);
  assert.match(html, /2026-10-03/);
});

test("unknown-only and insufficient-observation series do not invent a trend", () => {
  assert.equal(render([null, null]), "");
  assert.equal(render([null, 10, null]), "");
});
