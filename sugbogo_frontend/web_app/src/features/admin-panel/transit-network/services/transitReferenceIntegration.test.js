import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { transitQueryKeys } from "../hooks/transitQueryKeys.js";

let server;
let apiClient;
let originalGet;
let originalPatch;
let service;
let StopSelector;
let TransferForm;
let Inspector;
let useTransitMutations;

before(async () => {
  server = await createServer({
    appType: "custom", server: { middlewareMode: true, ws: false, hmr: false },
    cacheDir: "node_modules/.vite-transit-reference-tests",
  });
  ({ default: apiClient } = await server.ssrLoadModule("/src/shared/api/apiClient.js"));
  service = await server.ssrLoadModule("/src/features/admin-panel/transit-network/services/transitNetworkService.js");
  ({ default: StopSelector } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/route-variant-editor/TransitPointSearchSelect.jsx",
  ));
  originalGet = apiClient.get;
  originalPatch = apiClient.patch;
  ({ default: TransferForm } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/transfers/TransferForm.jsx",
  ));
  ({ default: Inspector } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/workspace/TransitNetworkInspector.jsx",
  ));
  ({ default: useTransitMutations } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/hooks/useTransitMutations.js",
  ));
});

after(async () => {
  if (apiClient) apiClient.get = originalGet;
  if (apiClient) apiClient.patch = originalPatch;
  await server?.close();
});

function pageData(page) {
  return {
    items: Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({
      id: (page - 1) * 100 + index + 1,
      name: `Stop ${(page - 1) * 100 + index + 1}`,
    })),
    pagination: { page, page_size: 100, total_items: 101, total_pages: 2, has_next: page === 1 },
  };
}

test("service forwards cancellation to Axios and a stop after the first 100 reaches the real selector", async () => {
  const controller = new AbortController();
  const calls = [];
  apiClient.get = async (url, options) => {
    calls.push([url, options.params.page]);
    assert.equal(options.signal, controller.signal);
    return { data: { data: pageData(options.params.page) } };
  };
  const points = await service.fetchTransitPointReferences({ signal: controller.signal });
  assert.deepEqual(calls, [["/admin/transit/transit-points/", 1], ["/admin/transit/transit-points/", 2]]);
  const html = renderToStaticMarkup(createElement(StopSelector, {
    id: "stops", transitPoints: points, alwaysOpen: true, label: "Starting stop",
  }));
  assert.match(html, /Stop 101/);
});

test("direction references request every page but ordinary browsing still requests one", async () => {
  const calls = [];
  apiClient.get = async (url, options) => {
    calls.push([url, options.params]);
    return { data: { data: pageData(options.params.page) } };
  };
  const variants = await service.fetchRouteVariantReferences();
  assert.equal(variants.length, 101);
  assert.deepEqual(calls.map(([url, params]) => [url, params.page]), [
    ["/admin/transit/route-variants/", 1], ["/admin/transit/route-variants/", 2],
  ]);
  calls.length = 0;
  await service.fetchTransitPoints({ page: 2, page_size: 10, search: "Church" });
  assert.deepEqual(calls, [["/admin/transit/transit-points/", { page: 2, page_size: 10, search: "Church" }]]);
});

test("transfer selectors can resolve a selected direction beyond the first 100", () => {
  const client = new QueryClient();
  const variants = Array.from({ length: 101 }, (_, i) => ({
    id: i + 1, route_code: `R${i + 1}`,
    origin: { name: `Origin ${i + 1}` }, destination: { name: `Destination ${i + 1}` },
    transit_points: [{ transit_point: { id: (i + 1) * 10, name: `Stop ${i + 1}` } }],
  }));
  client.setQueryData(transitQueryKeys.variantReferences(), variants);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(TransferForm, {
      transfer: {
        source_variant: { id: 101 }, destination_variant: { id: 100 },
        alighting_transit_point: { id: 1010 }, boarding_transit_point: { id: 1000 },
      },
    }),
  ));
  assert.match(html, /R101/);
  assert.match(html, /Stop 101/);
  assert.match(html, /value="101" selected/);
  client.clear();
});

test("route editing waits for the complete stop list instead of offering an empty selector", () => {
  const html = renderToStaticMarkup(createElement(Inspector, {
    context: "routes", mode: "create-variant-draw",
    routeState: { routeReferencePointsQuery: { isLoading: true, items: [] } },
  }));
  assert.match(html, /Loading all stops/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /role="combobox"/);
});

test("failed complete loading blocks a direction editor even if an old cached list exists", () => {
  const html = renderToStaticMarkup(createElement(Inspector, {
    context: "routes", mode: "create-variant-draw",
    routeState: { routeReferencePointsQuery: {
      isLoading: false, error: new Error("Page two failed"), items: [{ id: 1, name: "Old stop" }],
    } },
  }));
  assert.match(html, /complete stop list could not be loaded/);
  assert.doesNotMatch(html, /role="combobox"/);
});

test("renaming a route invalidates complete direction references as well as route pages", async () => {
  const client = new QueryClient();
  const variantsKey = transitQueryKeys.variantReferences();
  const routesKey = transitQueryKeys.routeList({ page: 1 });
  client.setQueryData(variantsKey, [{ id: 101, route_code: "OLD" }]);
  client.setQueryData(routesKey, { items: [{ id: 6, code: "OLD" }] });
  let mutations;
  function Probe() {
    mutations = useTransitMutations();
    return null;
  }
  renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
  apiClient.patch = async () => ({ data: { data: { id: 6, code: "NEW" } } });
  await mutations.updateRoute({ routeId: 6, data: { code: "NEW" } });
  assert.equal(client.getQueryState(variantsKey).isInvalidated, true);
  assert.equal(client.getQueryState(routesKey).isInvalidated, true);
  client.clear();
});
