import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { buildVariantPayload, moveListItem } from "../../utils/variantEditorUtils.js";

let server;
let OrderedTransitPointPanel;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, ws: false, hmr: false },
    appType: "custom",
    cacheDir: "node_modules/.vite-ordered-stop-tests",
  });
  ({ default: OrderedTransitPointPanel } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/route-variant-editor/OrderedTransitPointPanel.jsx",
  ));
});

after(async () => { await server?.close(); });

test("intermediate controls remain visible independently of passenger-facing role labels", () => {
  const html = renderToStaticMarkup(createElement(OrderedTransitPointPanel, {
    transitPoints: [
      { id: 1, name: "Guadalupe Church" },
      { id: 2, name: "Fuente Osmena Circle" },
      { id: 3, name: "Carbon Public Market" },
      { id: 4, name: "COMELEC" },
    ],
    originId: "1", destinationId: "4", intermediatePointIds: ["2", "3"], errors: {},
  }));
  assert.match(html, /aria-label="Move Fuente Osmena Circle later"/);
  assert.match(html, /aria-label="Move Carbon Public Market earlier"/);
  assert.match(html, /aria-label="Remove Fuente Osmena Circle from route"/);
  assert.match(html, /aria-label="Remove Carbon Public Market from route"/);
  assert.doesNotMatch(html, /aria-label="(?:Move|Remove) (?:Guadalupe Church|COMELEC)/);
});

test("swapping the middle stops preserves endpoints and the original draft array", () => {
  const original = ["2", "3"];
  const swapped = moveListItem(original, 0, 1);
  const payload = buildVariantPayload({
    routeId: "6", originId: "1", destinationId: "4",
    intermediatePointIds: swapped, geometry: [],
  });
  assert.deepEqual(payload.transit_point_ids, [1, 3, 2, 4]);
  assert.deepEqual(original, ["2", "3"]);
  assert.deepEqual(moveListItem(swapped, 0, -1), swapped);
});
