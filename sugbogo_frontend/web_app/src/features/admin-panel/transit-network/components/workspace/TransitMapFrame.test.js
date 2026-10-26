import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let TransitMapFrame;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    cacheDir: "node_modules/.vite-transit-map-tests",
  });
  ({ default: TransitMapFrame } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/workspace/TransitMapFrame.jsx",
  ));
});

after(async () => { await server?.close(); });

test("configuration errors render an alert without mounting Google Maps", () => {
  function MapThatMustNotMount() { throw new Error("Map mounted before configuration was ready"); }
  const html = renderToStaticMarkup(createElement(TransitMapFrame, {
    canMountMap: false,
    notice: { title: "Map setup needed", description: "Restore the browser key", kind: "error" },
  }, createElement(MapThatMustNotMount)));
  assert.match(html, /role="alert"/);
  assert.match(html, /Restore the browser key/);
});

test("loading is announced without exposing interactive map controls", () => {
  const html = renderToStaticMarkup(createElement(TransitMapFrame, {
    canMountMap: false,
    notice: { title: "Loading transit map", description: "Waiting for Maps", kind: "loading" },
  }, createElement("button", null, "Map control")));
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /Map control/);
});

test("capability errors retain the map for recovery but make its controls inert", () => {
  const html = renderToStaticMarkup(createElement(TransitMapFrame, {
    canMountMap: true,
    notice: { title: "Markers unavailable", description: "Check the map ID", kind: "error" },
  }, createElement("button", null, "Map control")));
  assert.match(html, /inert=""/);
  assert.match(html, /Map control/);
  assert.match(html, /role="alert"/);
});

test("a ready map has interactive controls and no failure overlay", () => {
  const html = renderToStaticMarkup(createElement(TransitMapFrame, {
    canMountMap: true, notice: null,
  }, createElement("button", null, "Map control")));
  assert.match(html, /Map control/);
  assert.doesNotMatch(html, /inert=|role="alert"|role="status"/);
});
