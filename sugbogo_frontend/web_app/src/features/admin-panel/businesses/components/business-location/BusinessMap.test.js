import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import React, { act } from "react";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import markerClustering from "@googlemaps/markerclusterer";
const { SuperClusterAlgorithm } = markerClustering;
import { clusterSize } from "./businessMapClusterPolicy.js";
import { mapPopupPosition } from "./mapPopupPosition.js";
let server;
let Popup;
let Marker;
let ManagementMap;
before(async () => {
  server = await createServer({
    ssr: {
      noExternal: ["@googlemaps/markerclusterer", "@vis.gl/react-google-maps"],
    },
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: "map-test-surface",
        enforce: "pre",
        resolveId(source) {
          if (source === "@vis.gl/react-google-maps")
            return "\0map-test-surface";
        },
        load(id) {
          if (id === "\0map-test-surface")
            return `import React from 'react';
        export const useMap = () => null;
        export const useApiLoadingStatus = () => 'LOADED';
        export const APILoadingStatus = { FAILED: 'FAILED' };
        export const ControlPosition = { TOP_LEFT: 1, TOP_RIGHT: 2, CENTER: 3 };
        export const Map = ({children}) => React.createElement('div', null, children);
        export const MapControl = Map;
        export const AdvancedMarker = React.forwardRef(({children, onClick, title}, ref) => React.createElement('button', {ref, onClick, title}, children));
        export const InfoWindow = ({children, onCloseClick}) => React.createElement('aside', null, children, React.createElement('button', {onClick: onCloseClick}, 'Close popup'));
      `;
        },
      },
    ],
  });
  ({ default: Popup } = await server.ssrLoadModule(
    "/src/features/admin-panel/businesses/components/business-location/BusinessMapInfoWindow.jsx",
  ));
  ({ default: ManagementMap } = await server.ssrLoadModule(
    "/src/features/admin-panel/businesses/components/business-location/BusinessManagementMap.jsx",
  ));
  ({ default: Marker } = await server.ssrLoadModule(
    "/src/shared/components/maps/BusinessMapMarker.jsx",
  ));
});
after(async () => {
  await server?.close();
  delete globalThis.google;
});
test("Mobile cluster size thresholds are retained", () => {
  assert.deepEqual([2, 10, 30, 100].map(clusterSize), [40, 46, 52, 58]);
});
test("spatial clusters count businesses, update after filtering and expand at high zoom", () => {
  class LatLng {
    constructor(lat, lng) {
      this.latitude = typeof lat === "object" ? lat.lat : lat;
      this.longitude = typeof lat === "object" ? lat.lng : lng;
    }
    lat() {
      return this.latitude;
    }
    lng() {
      return this.longitude;
    }
  }
  globalThis.google = { maps: { LatLng } };
  const markers = Array.from({ length: 12 }, (_, id) => ({
    getPosition: () => new LatLng(10.3 + id * 0.00001, 123.9),
    getVisible: () => true,
  }));
  const algorithm = new SuperClusterAlgorithm({
    radius: 56,
    minPoints: 3,
    maxZoom: 20,
  });
  const calculate = (items, zoom) =>
    algorithm.calculate({ markers: items, map: { getZoom: () => zoom } })
      .clusters;
  assert.equal(calculate(markers, 12)[0].count, 12);
  assert.equal(calculate(markers.slice(0, 5), 12)[0].count, 5);
  assert.equal(calculate(markers.slice(0, 5), 22).length, 5);
  assert.equal(calculate([], 12).length, 0);
});
test("popup uses response image or neutral placeholder and soft status badges", () => {
  for (const status of ["active", "suspended"]) {
    const business = {
      id: 1,
      business_name: "Long business name ".repeat(20),
      location: "Long address ".repeat(20),
      status,
      cluster_name: "Food",
      category_name: "Cafe",
      cover_photo_url: "https://example.com/storefront.jpg",
    };
    const html = renderToStaticMarkup(
      React.createElement(Popup, { business, onView: () => {} }),
    );
    assert.ok(html.includes("https://example.com/storefront.jpg"));
    assert.ok(
      html.includes(status === "active" ? "bg-success/10" : "bg-warning/10"),
    );
    assert.ok(html.includes("View business"));
    assert.ok(html.includes("title="));
    const empty = renderToStaticMarkup(
      React.createElement(Popup, {
        business: { ...business, cover_photo_url: null },
      }),
    );
    assert.ok(!empty.includes("<img"));
  }
});
test("suspended and selected pins retain category identity and a non-color suspension indicator", () => {
  const html = renderToStaticMarkup(
    React.createElement(Marker, {
      variant: "business",
      suspended: true,
      selected: true,
    }),
  );
  assert.ok(html.includes("Ⅱ"));
  assert.ok(html.includes("scale-110"));
  assert.ok(html.includes("border-primary"));
});

test("selection uses refreshed status, clears on removal, and counts matching results", async () => {
  const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
  );
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
  });
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const business = {
    id: 41,
    business_name: "Cafe",
    status: "active",
    latitude: 10.3,
    longitude: 123.9,
  };
  let viewed;
  const render = async (items, extras = {}) =>
    act(async () =>
      root.render(
        React.createElement(ManagementMap, {
          businesses: items,
          onViewBusiness: (item) => {
            viewed = item;
          },
          ...extras,
        }),
      ),
    );
  try {
    await render([business]);
    assert.ok(document.body.textContent.includes("1 business"));
    await act(async () =>
      document.querySelector('button[title="Cafe — active"]').click(),
    );
    assert.ok(document.querySelector("aside"));
    await render([{ ...business, status: "suspended" }]);
    assert.ok(
      document.querySelector("aside").textContent.includes("Suspended"),
    );
    await act(async () =>
      [...document.querySelectorAll("aside button")]
        .find((button) => button.textContent.includes("View business"))
        .click(),
    );
    assert.equal(viewed.status, "suspended");
    await act(async () =>
      [...document.querySelectorAll("aside button")]
        .find(
          (button) =>
            button.getAttribute("aria-label") === "Close business popup",
        )
        .click(),
    );
    assert.equal(document.querySelector("aside"), null);
    await act(async () =>
      document.querySelector('button[title="Cafe — suspended"]').click(),
    );
    await render([], { hasActiveFilters: true });
    assert.equal(document.querySelector("aside"), null);
    assert.ok(document.body.textContent.includes("No businesses match"));
    await render([business]);
    assert.equal(document.querySelector("aside"), null);
    const other = {
      ...business,
      id: 42,
      business_name: "Cafe Annex",
      category_name: "Restaurant",
      status: "suspended",
    };
    await render([{ ...business, category_name: "Resort & Spa" }, other]);
    await act(async () =>
      document.querySelector('button[title="Cafe — active"]').click(),
    );
    assert.ok(
      document.querySelector("aside").textContent.includes("Choose a business"),
    );
    assert.ok(
      document.querySelector("aside").textContent.includes("Resort & Spa"),
    );
    assert.ok(
      document.querySelector("aside").textContent.includes("Restaurant"),
    );
    assert.ok(
      document.querySelector("aside").textContent.includes("Suspended"),
    );
    const row = [...document.querySelectorAll("aside button")].find((button) =>
      button.textContent.includes("Cafe Annex"),
    );
    assert.equal(row.type, "button");
    await act(async () => row.click());
    assert.ok(
      !document
        .querySelector("aside")
        .textContent.includes("Choose a business"),
    );
    assert.ok(
      document.querySelector("aside").textContent.includes("Cafe Annex"),
    );
    await act(async () =>
      [...document.querySelectorAll("aside button")]
        .find((button) => button.textContent.includes("View business"))
        .click(),
    );
    assert.equal(viewed.id, 42);
    await act(async () =>
      document.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      ),
    );
    assert.equal(document.querySelector("aside"), null);
    await act(async () =>
      document.querySelector('button[title="Cafe — active"]').click(),
    );
    await act(async () =>
      document.body.dispatchEvent(
        new dom.window.Event("pointerdown", { bubbles: true }),
      ),
    );
    assert.equal(document.querySelector("aside"), null);
    await render([], { error: new Error("Unavailable") });
    assert.ok(
      document.body.textContent.includes("Unable to load business locations"),
    );
    assert.ok(!document.body.textContent.includes("0 businesses"));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

test("popup positioning flips at edges and remains inside the map control-safe bounds", () => {
  for (const [x, y] of [
    [20, 20],
    [780, 20],
    [20, 580],
    [780, 580],
    [400, 300],
  ]) {
    const position = mapPopupPosition({
      x,
      y,
      width: 320,
      height: 350,
      mapWidth: 800,
      mapHeight: 600,
    });
    assert.ok(position.left >= 12 && position.left + 320 <= 736);
    assert.ok(position.top >= 12 && position.top + 350 <= 568);
  }
  const below = mapPopupPosition({
    x: 400,
    y: 30,
    width: 320,
    height: 350,
    mapWidth: 800,
    mapHeight: 600,
  });
  assert.ok(below.top > 30);
});
