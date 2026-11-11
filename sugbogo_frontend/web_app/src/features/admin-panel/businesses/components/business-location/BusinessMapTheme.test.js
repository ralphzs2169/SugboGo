import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act, useState } from "react";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const instances = [];
const markers = [];
const dataLayers = [];
let server;
let ManagementMap;
let LocationMap;
let ComparisonMap;
let TransitMap;
let GeographicMap;
let useGoogleMapTheme;
let GoogleMap;
let googleMapsConfig;
let ThemeToggle;
let APIProviderContext;

// Exercise the installed vis.gl Map lifecycle without loading the network API.
class NativeMap {
  constructor(
    element,
    options,
  ) {
    this.element = element;
    this.options = options;
    this.camera = {
      center: options.center,
      zoom: options.zoom,
      heading: options.heading ?? 0,
      tilt: options.tilt ?? 0,
    };
    this.listeners = new Map();
    this.panorama = new NativePanorama();
    this.fitCount = 0;
    this.controls = Array.from({ length: 26 }, () => {
      const items = [];
      return {
        push: (item) => {
          items.push(item);
          element.appendChild(item);
        },
        getArray: () => items,
        removeAt: (index) => items.splice(index, 1)[0]?.remove(),
      };
    });
    instances.push(this);
  }

  addListener(
    type,
    callback,
  ) {
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(type, callbacks);
    return { remove: () => callbacks.delete(callback) };
  }

  moveCamera(camera) {
    Object.assign(this.camera, camera);
    this.listeners.get("bounds_changed")?.forEach((callback) => callback());
  }

  setOptions(options) {
    Object.assign(this.options, options);
  }

  getCenter() {
    return { toJSON: () => this.camera.center };
  }

  getZoom() {
    return this.camera.zoom;
  }

  getHeading() {
    return this.camera.heading;
  }

  getTilt() {
    return this.camera.tilt;
  }

  getBounds() {
    return { toJSON: () => ({ north: 11, south: 10, east: 124, west: 123 }) };
  }

  getDiv() {
    return this.element;
  }

  getStreetView() {
    return this.panorama;
  }

  getMapCapabilities() {
    return { isAdvancedMarkersAvailable: true };
  }

  getMapTypeId() {
    return this.options.mapTypeId ?? "roadmap";
  }

  setMapTypeId(mapTypeId) {
    this.options.mapTypeId = mapTypeId;
    this.listeners.get("maptypeid_changed")?.forEach((callback) => callback());
  }

  panTo(center) {
    this.setCenter(center);
  }

  setCenter(center) {
    this.moveCamera({ center });
  }

  setZoom(zoom) {
    this.moveCamera({ zoom });
  }

  fitBounds() {
    this.fitCount += 1;
    this.moveCamera({ center: { lat: 10.32, lng: 123.89 }, zoom: 13 });
  }
}

class NativePanorama {
  constructor() {
    this.listeners = new Map();
    this.state = {
      visible: false,
      pano: "",
      pov: { heading: 0, pitch: 0 },
      zoom: 0,
    };
  }

  addListener(...args) {
    return NativeMap.prototype.addListener.call(this, ...args);
  }
  getVisible() {
    return this.state.visible;
  }
  getPano() {
    return this.state.pano;
  }
  getPosition() {
    return null;
  }
  getPov() {
    return this.state.pov;
  }
  getZoom() {
    return this.state.zoom;
  }
  setPano(pano) {
    this.state.pano = pano;
  }
  setPosition(position) {
    this.state.position = position;
  }
  setPov(pov) {
    this.state.pov = pov;
  }
  setZoom(zoom) {
    this.state.zoom = zoom;
  }
  setVisible(visible) {
    this.state.visible = visible;
    this.listeners.get("visible_changed")?.forEach((callback) => callback());
  }
}

class NativeMarker {
  constructor() {
    const element = document.createElement("button");
    element.listeners = new Map();
    element.addListener = (...args) =>
      NativeMap.prototype.addListener.call(element, ...args);
    let map;
    let content;
    Object.defineProperties(element, {
      map: {
        get: () => map,
        set: (next) => {
          map = next;
          if (map) map.getDiv().appendChild(element);
          else element.remove();
        },
      },
      content: {
        get: () => content,
        set: (next) => {
          content = next;
          element.replaceChildren(next);
        },
      },
    });
    markers.push(element);
    return element;
  }
}

class NativeInfoWindow {
  constructor(options) {
    this.listeners = new Map();
    this.options = options;
  }
  addListener(...args) {
    return NativeMap.prototype.addListener.call(this, ...args);
  }
  setContent(content) {
    this.content = content;
  }
  setOptions(options) {
    this.options = options;
  }
  set() {}
  open({ map, anchor }) {
    map.getDiv().appendChild(this.content);
    if (
      anchor?.position &&
      !this.options?.disableAutoPan &&
      Math.abs(map.camera.center.lat - anchor.position.lat) > 0.05
    ) {
      map.moveCamera({ center: anchor.position });
    }
  }
  close() {
    this.content?.remove();
  }
}

class NativeData {
  constructor({ map }) {
    this.map = map;
    this.listeners = new Map();
    dataLayers.push(this);
  }
  addListener(...args) {
    return NativeMap.prototype.addListener.call(this, ...args);
  }
  addGeoJson({ features }) {
    this.features = features.map((feature) => ({
      getId: () => feature.id,
      getGeometry: () => ({
        forEachLatLng: (callback) => callback({ lat: 10.3, lng: 123.9 }),
      }),
    }));
  }
  forEach(callback) {
    this.features.forEach(callback);
  }
  setMap(map) {
    this.map = map;
  }
  setStyle(style) {
    this.styles = this.features.map(style);
  }
}

class NativeBounds {
  constructor() {
    this.points = [];
  }
  extend(point) {
    this.points.push(point);
  }
  isEmpty() {
    return this.points.length === 0;
  }
  getNorthEast() {
    return { equals: () => false };
  }
  getSouthWest() {
    return {};
  }
}

const loadedLibraries = {
  maps: { Data: NativeData, InfoWindow: NativeInfoWindow },
  marker: { AdvancedMarkerElement: NativeMarker },
  streetView: {},
};

before(async () => {
  server = await createServer({
    define: {
      "import.meta.env.VITE_GOOGLE_MAP_ID": JSON.stringify("theme-test-map"),
    },
    ssr: { noExternal: ["@vis.gl/react-google-maps"] },
    server: { middlewareMode: true, ws: false, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      {
        name: "theme-test-overlays",
        enforce: "pre",
        resolveId(source) {
          if (source === "./BusinessMapClusters") return "\0theme-markers";
          if (source === "./AnchoredMapPopup") return "\0theme-popup";
        },
        load(id) {
          if (id === "\0theme-markers") {
            return `import React from 'react';
            export default function Markers({ businesses, onSelect }) {
              return businesses.map(business => React.createElement('button', {
                key: business.id,
                onClick: () => onSelect(business),
              }, business.business_name));
            }`;
          }
          if (id === "\0theme-popup") {
            return `import React from 'react';
            export default function Popup({ children }) {
              return React.createElement('aside', null, children);
            }`;
          }
        },
      },
    ],
  });
  ({ default: ManagementMap } = await server.ssrLoadModule(
    "/src/features/admin-panel/businesses/components/business-location/BusinessManagementMap.jsx",
  ));
  ({ default: ThemeToggle } = await server.ssrLoadModule(
    "/src/shared/components/ThemeToggle.jsx",
  ));
  ({ APIProviderContext, Map: GoogleMap } = await server.ssrLoadModule(
    "@vis.gl/react-google-maps",
  ));
  ({ default: LocationMap } = await server.ssrLoadModule(
    "/src/shared/components/maps/BusinessLocationMap.jsx",
  ));
  ({ default: ComparisonMap } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-update-requests/components/LocationComparisonMap.jsx",
  ));
  ({ default: TransitMap } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/workspace/TransitNetworkMapCanvas.jsx",
  ));
  ({ default: GeographicMap } = await server.ssrLoadModule(
    "/src/features/admin-panel/analytics/components/GeographicDistributionMap.jsx",
  ));
  ({ default: useGoogleMapTheme } = await server.ssrLoadModule(
    "/src/shared/hooks/useGoogleMapTheme.js",
  ));
  ({ googleMapsConfig } = await server.ssrLoadModule(
    "/src/shared/utils/googleMapsConfig.js",
  ));
});

after(async () => {
  await server?.close();
});

function LoadedProvider({ children }) {
  const [mapInstances, setMapInstances] = useState({});
  return React.createElement(
    APIProviderContext.Provider,
    {
      value: {
        status: "LOADED",
        mapInstances,
        loadedLibraries,
        importLibrary: (name) => Promise.resolve(loadedLibraries[name]),
        addMapInstance: (map, id = "default") =>
          setMapInstances((current) => ({
            ...current,
            [id]: map,
          })),
        removeMapInstance: (id = "default") =>
          setMapInstances((current) =>
            Object.fromEntries(
              Object.entries(current).filter(([key]) => key !== id),
            ),
          ),
      },
    },
    children,
  );
}

async function createMapHarness(theme) {
  instances.length = 0;
  markers.length = 0;
  dataLayers.length = 0;
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://admin.example.test",
  });
  const observers = new Set();
  let requests = 0;
  class ThemeObserver extends dom.window.MutationObserver {
    observe(...args) {
      observers.add(this);
      super.observe(...args);
    }
    disconnect() {
      observers.delete(this);
      super.disconnect();
    }
  }
  const event = {
    addListener: (target, type, callback) => target.addListener(type, callback),
    addListenerOnce: (target, type, callback) => {
      const listener = target.addListener(type, (...args) => {
        listener.remove();
        callback(...args);
      });
      return listener;
    },
    removeListener: (listener) => listener.remove(),
    clearInstanceListeners: (target) => target.listeners.clear(),
    trigger: (target, type) => {
      target.listeners.get(type)?.forEach((callback) => callback());
    },
  };
  const globals = {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    Node: dom.window.Node,
    Element: dom.window.Element,
    MutationObserver: ThemeObserver,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    cancelAnimationFrame: clearTimeout,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => {
      requests += 1;
      throw new Error(
        "A theme change must not request business data or reload the API",
      );
    },
    google: {
      maps: {
        version: "3.65.0",
        Map: NativeMap,
        InfoWindow: NativeInfoWindow,
        LatLngBounds: NativeBounds,
        event,
      },
    },
  };
  const previousGlobals = Object.fromEntries(
    Object.keys(globals).map((key) => [key, globalThis[key]]),
  );
  const previousConfig = { ...googleMapsConfig };
  Object.assign(globalThis, globals);
  window.google = globalThis.google;
  window.fetch = globals.fetch;
  Object.assign(googleMapsConfig, {
    apiKey: "theme-test-key",
    mapId: "theme-test-map",
  });
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {},
    getImageData: () => ({ data: [80, 90, 100, 255] }),
  });
  localStorage.setItem("theme", theme);
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));

  return {
    observers,
    render: (children) =>
      act(async () => {
        root.render(
          React.createElement(
            LoadedProvider,
            null,
            React.createElement(ThemeToggle),
            children,
          ),
        );
      }),
    toggle: () =>
      act(async () => {
        document.querySelector('[aria-label="Toggle theme"]').click();
      }),
    close: async () => {
      try {
        await act(async () => root.unmount());
        assert.equal(observers.size, 0);
        assert.equal(requests, 0);
        assert.ok(
          instances.every((map) =>
            [...map.listeners.values()].every(
              (callbacks) => callbacks.size === 0,
            ),
          ),
        );
        assert.ok(markers.every((marker) => marker.map === null));
        assert.ok(dataLayers.every((layer) => layer.map === null));
      } finally {
        Object.assign(googleMapsConfig, previousConfig);
        dom.window.close();
        for (const [key, value] of Object.entries(previousGlobals)) {
          if (value === undefined) delete globalThis[key];
          else globalThis[key] = value;
        }
      }
    },
  };
}

const movedCamera = {
  center: { lat: 10.51, lng: 123.71 },
  zoom: 19,
  heading: 25,
  tilt: 35,
};

function mapScenario(name) {
  const firstPosition = { latitude: 10.3, longitude: 123.9 };
  const secondPosition = { latitude: 10.4, longitude: 123.8 };
  const selected = [];

  if (name === "business location") {
    return {
      component: LocationMap,
      props: {
        ...firstPosition,
        landmarks: [{ id: "market", name: "Market", ...secondPosition }],
        focusPosition: { lat: 10.4, lng: 123.8 },
        selectedLandmarkId: "market",
      },
      verify: (map) => {
        assert.equal(markers.filter((marker) => marker.map === map).length, 2);
        assert.ok(map.getDiv().textContent.includes("Market"));
        assert.equal(map.options.streetViewControl, true);
      },
    };
  }

  if (name === "location comparison") {
    return {
      component: ComparisonMap,
      props: {
        states: [
          { id: "previous", label: "Previous", location: firstPosition },
          { id: "proposed", label: "Proposed", location: secondPosition },
        ],
      },
      verify: (map) => {
        const active = markers.filter((marker) => marker.map === map);
        assert.deepEqual(
          active.map((marker) => marker.title),
          ["Previous", "Proposed"],
        );
        assert.equal(map.options.fullscreenControl, false);
        assert.equal(map.options.streetViewControl, true);
      },
    };
  }

  if (name === "transit network") {
    const point = { id: "point-1", name: "Terminal", ...firstPosition };
    return {
      component: TransitMap,
      props: {
        context: "transit-points",
        mode: "browse",
        routeVariants: [],
        referenceRouteVariants: [],
        transitPoints: [point],
        selectedPoint: point,
        focusRequest: {
          positions: [
            { lat: 10.3, lng: 123.9 },
            { lat: 10.4, lng: 123.8 },
          ],
        },
        onTransitPointSelect: (item) => selected.push(item.id),
      },
      verify: async (map) => {
        await act(async () =>
          globalThis.google.maps.event.trigger(map, "tilesloaded"),
        );
        const marker = markers.find((marker) => marker.map === map);
        assert.equal(marker.title, "Terminal");
        assert.equal(marker.zIndex, 500);
        await act(async () =>
          marker.dispatchEvent(new window.Event("gmp-click")),
        );
        assert.equal(selected.at(-1), "point-1");
        assert.equal(map.options.gestureHandling, "greedy");
      },
    };
  }

  const cell = {
    id: "cell-a",
    eligible_businesses: 3,
    profile_visits: 6,
    geometry: { type: "Polygon", coordinates: [] },
  };
  return {
    component: GeographicMap,
    props: {
      cells: [cell],
      metric: "eligible_businesses",
      selected: cell.id,
      hovered: { id: cell.id, position: { lat: 10.3, lng: 123.9 } },
      hoveredCell: cell,
      scopeText: "Selected city",
      onSelect: (id) => selected.push(id),
      onHover: () => {},
    },
    verify: (map) => {
      const layer = dataLayers.find((item) => item.map === map);
      assert.equal(layer.styles[0].strokeWeight, 3);
      layer.listeners.get("click").forEach((callback) =>
        callback({
          feature: layer.features[0],
          latLng: { toJSON: () => ({ lat: 10.3, lng: 123.9 }) },
          stop() {},
        }),
      );
      assert.equal(selected.at(-1), cell.id);
      assert.ok(map.getDiv().textContent.includes("Selected city"));
      assert.equal(dataLayers.filter((item) => item.map).length, 1);
      assert.equal(map.options.fullscreenControl, true);
    },
  };
}

for (const name of [
  "business location",
  "location comparison",
  "transit network",
  "analytics",
]) {
  for (const theme of ["light", "dark"]) {
    test(`${name}: ${theme} initialization, camera, selection and cleanup survive both theme directions`, async () => {
      const harness = await createMapHarness(theme);
      const scenario = mapScenario(name);
      const element = React.createElement(scenario.component, scenario.props);

      try {
        await harness.render(element);
        assert.equal(instances.length, 1);
        assert.equal(instances[0].options.colorScheme, theme.toUpperCase());
        await scenario.verify(instances[0]);
        if (name === "business location") {
          await act(async () => instances[0].setMapTypeId("terrain"));
        }
        await act(async () => instances[0].moveCamera(movedCamera));

        for (let index = 0; index < 2; index += 1) {
          const previous = instances.at(-1);
          await harness.toggle();
          const current = instances.at(-1);
          assert.equal(instances.length, index + 2);
          assert.equal(
            current.options.colorScheme,
            localStorage.getItem("theme").toUpperCase(),
          );
          assert.deepEqual(current.camera, movedCamera);
          assert.equal(current.fitCount, 0);
          assert.ok(
            [...previous.listeners.values()].every(
              (callbacks) => callbacks.size === 0,
            ),
          );
          assert.equal(previous.element.isConnected, false);
          assert.equal(harness.observers.size, 1);
          if (name === "business location") {
            assert.equal(current.getMapTypeId(), "terrain");
          }
          await scenario.verify(current);
        }

        // Unrelated root-class mutations must not recreate any native maps.
        await act(async () =>
          document.documentElement.classList.add("disable-theme-transitions"),
        );
        await harness.render(element);
        assert.equal(instances.length, 3);
        assert.deepEqual(instances.at(-1).camera, movedCamera);

        if (name === "business location" || name === "location comparison") {
          const panorama = instances.at(-1).getStreetView();
          await act(async () => {
            panorama.setPano("selected-panorama");
            panorama.setPov({ heading: 140, pitch: 15 });
            panorama.setZoom(2);
            panorama.setVisible(true);
          });
          const streetView = { ...panorama.state };
          await harness.toggle();
          assert.deepEqual(instances.at(-1).getStreetView().state, streetView);
          assert.deepEqual(instances.at(-1).camera, movedCamera);
          assert.equal(instances.at(-1).fitCount, 0);
        }
      } finally {
        await harness.close();
      }
    });
  }
}

function ThemeMapProbe({ id }) {
  const themeProps = useGoogleMapTheme({
    id,
    center: { lat: 10.3, lng: 123.9 },
    zoom: 12,
  });
  return React.createElement(GoogleMap, { ...themeProps, id });
}

test("multiple mounted maps share one observer and retain independent cameras", async () => {
  const harness = await createMapHarness("dark");
  const first = React.createElement(ThemeMapProbe, {
    key: "first",
    id: "first",
  });
  const second = React.createElement(ThemeMapProbe, {
    key: "second",
    id: "second",
  });
  try {
    await harness.render([first, second]);
    assert.equal(instances.length, 2);
    assert.equal(harness.observers.size, 1);
    const otherCamera = { ...movedCamera, zoom: 16 };
    await act(async () => {
      instances[0].moveCamera(movedCamera);
      instances[1].moveCamera(otherCamera);
    });
    await harness.toggle();
    assert.equal(instances.length, 4);
    assert.deepEqual(instances[2].camera, movedCamera);
    assert.deepEqual(instances[3].camera, otherCamera);
    await harness.render([second]);
    assert.equal(harness.observers.size, 1);
    assert.equal(instances.filter((map) => map.element.isConnected).length, 1);
  } finally {
    await harness.close();
  }
});

test("location coordinates arriving after an empty state initialize in the active theme", async () => {
  const harness = await createMapHarness("light");
  try {
    await harness.render(React.createElement(LocationMap));
    assert.equal(instances.length, 0);
    assert.ok(document.body.textContent.includes("Map location unavailable"));
    await harness.toggle();
    await harness.render(
      React.createElement(LocationMap, {
        latitude: 10.4,
        longitude: 123.8,
      }),
    );
    assert.equal(instances.length, 1);
    assert.equal(instances[0].options.colorScheme, "DARK");
    assert.deepEqual(instances[0].camera.center, { lat: 10.4, lng: 123.8 });
    assert.equal(instances[0].camera.zoom, 17);
  } finally {
    await harness.close();
  }
});

test("comparison coordinates arriving after an unavailable state initialize in the active theme", async () => {
  const harness = await createMapHarness("light");
  try {
    await harness.render(React.createElement(ComparisonMap, { states: [] }));
    assert.equal(instances.length, 0);
    await harness.toggle();
    await harness.render(
      React.createElement(ComparisonMap, {
        states: [
          {
            id: "proposed",
            label: "Requested",
            location: { latitude: 10.4, longitude: 123.8 },
          },
        ],
      }),
    );
    assert.equal(instances.length, 1);
    assert.equal(instances[0].options.colorScheme, "DARK");
    assert.deepEqual(instances[0].camera.center, { lat: 10.4, lng: 123.8 });
    assert.equal(instances[0].camera.zoom, 18);
  } finally {
    await harness.close();
  }
});

for (const name of [
  "business location",
  "location comparison",
  "transit network",
  "analytics",
]) {
  test(`${name}: actual focus or location-data changes still update the viewport after switching themes`, async () => {
    const harness = await createMapHarness("dark");
    const scenario = mapScenario(name);
    const position = { lat: 10.6, lng: 123.6 };
    try {
      await harness.render(
        React.createElement(scenario.component, scenario.props),
      );
      await act(async () => instances.at(-1).moveCamera(movedCamera));
      await harness.toggle();
      let changes;
      if (name === "business location") {
        changes = { focusPosition: position };
      } else if (name === "location comparison") {
        changes = {
          states: [
            {
              id: "proposed",
              label: "Requested",
              location: { latitude: position.lat, longitude: position.lng },
            },
          ],
        };
      } else if (name === "transit network") {
        changes = { focusRequest: { positions: [position] } };
      } else {
        changes = { cells: [{ ...scenario.props.cells[0], id: "cell-b" }] };
      }
      await harness.render(
        React.createElement(scenario.component, {
          ...scenario.props,
          ...changes,
        }),
      );
      assert.equal(instances.length, 2);
      const map = instances.at(-1);
      if (name === "analytics") {
        assert.equal(map.fitCount, 1);
        assert.equal(map.camera.zoom, 13);
      } else {
        assert.deepEqual(map.camera.center, position);
      }
    } finally {
      await harness.close();
    }
  });
}

for (const theme of ["light", "dark"]) {
  test(`${theme} initialization, persisted reload and bidirectional theme changes preserve the camera`, async () => {
    instances.length = 0;
    const dom = new JSDOM('<div id="root"></div>', {
      url: "https://admin.example.test",
    });
    const observers = new Set();

    class ThemeObserver extends dom.window.MutationObserver {
      observe(...args) {
        observers.add(this);
        super.observe(...args);
      }

      disconnect() {
        observers.delete(this);
        super.disconnect();
      }
    }

    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      localStorage: dom.window.localStorage,
      MutationObserver: ThemeObserver,
      requestAnimationFrame: (callback) => setTimeout(callback, 0),
      IS_REACT_ACT_ENVIRONMENT: true,
      google: {
        maps: {
          Map: NativeMap,
          LatLngBounds: class {
            extend() {}
          },
          event: {
            addListener: (map, type, callback) =>
              map.addListener(type, callback),
            clearInstanceListeners: (map) => map.listeners.clear(),
          },
        },
      },
    });
    localStorage.setItem("theme", theme);
    const { createRoot } = await import("react-dom/client");
    let root = createRoot(document.getElementById("root"));
    const businesses = [
      {
        id: 1,
        business_name: "Cafe",
        latitude: 10.3,
        longitude: 123.9,
      },
      {
        id: 2,
        business_name: "Bakery",
        latitude: 10.4,
        longitude: 123.8,
      },
    ];
    let viewed;
    const render = (items = businesses, extras = {}) =>
      act(async () => {
        root.render(
          React.createElement(
            LoadedProvider,
            null,
            React.createElement(ThemeToggle),
            React.createElement(ManagementMap, {
              businesses: items,
              onViewBusiness: (business) => {
                viewed = business;
              },
              ...extras,
            }),
          ),
        );
      });

    try {
      await render();
      assert.equal(instances.length, 1);
      assert.equal(instances[0].options.colorScheme, theme.toUpperCase());
      assert.equal(instances[0].fitCount, 1);
      const camera = {
        center: { lat: 10.5, lng: 123.7 },
        zoom: 17,
        heading: 30,
        tilt: 40,
      };
      await act(async () => instances.at(-1).moveCamera(camera));
      await act(async () => {
        [...document.querySelectorAll("button")]
          .find((button) => button.textContent === "Cafe")
          .click();
      });

      for (let index = 0; index < 4; index += 1) {
        const previous = instances.at(-1);
        await act(async () => {
          document.querySelector('[aria-label="Toggle theme"]').click();
        });
        const current = instances.at(-1);
        assert.equal(instances.length, index + 2);
        assert.equal(
          current.options.colorScheme,
          localStorage.getItem("theme").toUpperCase(),
        );
        assert.deepEqual(current.camera, camera);
        assert.equal(current.fitCount, 0);
        assert.equal(previous.element.isConnected, false);
        assert.equal(previous.listeners.size, 0);
        assert.equal(
          instances.filter((instance) => instance.element.isConnected).length,
          1,
        );
        assert.equal(observers.size, 1);
        assert.equal(
          document.querySelectorAll('[data-testid="map"]').length,
          1,
        );
        assert.ok(document.querySelector("aside").textContent.includes("Cafe"));
        assert.equal(current.options.fullscreenControl, true);
        assert.equal(current.options.mapTypeControl, false);
        assert.equal(current.options.streetViewControl, false);
      }

      // Transition suppression changes root classes without changing the theme.
      const count = instances.length;
      await act(async () => {
        document.documentElement.classList.add("disable-theme-transitions");
      });
      await render(businesses, { isFetching: true });
      assert.equal(instances.length, count);
      assert.deepEqual(instances.at(-1).camera, camera);
      await act(async () => {
        [...document.querySelectorAll("aside button")]
          .find((button) => button.textContent.includes("View business"))
          .click();
      });
      assert.equal(viewed.id, 1);

      await render([businesses[1]]);
      assert.equal(document.querySelector("aside"), null);
      assert.deepEqual(instances.at(-1).camera.center, {
        lat: 10.4,
        lng: 123.8,
      });
      assert.equal(instances.at(-1).camera.zoom, 15);
      assert.equal(instances.length, count);

      // Simulate a page remount using the theme persisted by the real toggle.
      await act(async () => root.unmount());
      assert.equal(instances.at(-1).listeners.size, 0);
      assert.equal(observers.size, 0);
      root = createRoot(document.getElementById("root"));
      await render();
      assert.equal(instances.length, count + 1);
      assert.equal(instances.at(-1).options.colorScheme, theme.toUpperCase());
    } finally {
      await act(async () => root.unmount());
      assert.equal(observers.size, 0);
      dom.window.close();
      for (const key of [
        "window",
        "document",
        "localStorage",
        "MutationObserver",
        "requestAnimationFrame",
        "IS_REACT_ACT_ENVIRONMENT",
        "google",
      ]) {
        delete globalThis[key];
      }
    }
  });
}
