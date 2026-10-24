import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let apiClient;
let originalGet;
let service;
let Modal;
let Content;
let Context;
let columns;

const diagnostic = {
  business_id: 42,
  reference_time: "2026-10-24T04:00:00Z",
  window_start: "2026-10-10T04:00:00Z",
  window_end: "2026-10-24T04:00:00Z",
  observation_context: {
    potential_observation_days: 8,
    window_days: 14,
    short_history: true,
  },
  impression_count: 10,
  profile_visit_count: 4,
  unique_saver_count: 2,
  maximum_impression_count: 20,
  maximum_profile_visit_count: 16,
  maximum_unique_saver_count: 10,
  normalized_impressions: "0.50000",
  normalized_profile_visits: "0.25000",
  normalized_saves: "0.20000",
  signal_weights: {
    impressions: "0.50000",
    profile_visits: "0.30000",
    saves: "0.20000",
  },
  comparison_group_level: "CLUSTER",
  comparison_group_size: 7,
  traction: "0.36500",
  visibility_gap: "0.63500",
  coverage_verified: false,
  telemetry_note:
    "Recorded activity may be incomplete; zero recorded events do not establish zero exposure.",
};

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: apiClient } = await server.ssrLoadModule(
    "/src/shared/api/apiClient.js",
  ));
  originalGet = apiClient.get;
  service = await server.ssrLoadModule(
    "/src/features/admin-panel/discovery-scores/services/discoveryScoreService.js",
  );
  ({ default: Modal, VisibilityDiagnosticContent: Content } =
    await server.ssrLoadModule(
      "/src/features/admin-panel/discovery-scores/components/VisibilityDiagnosticsModal.jsx",
    ));
  ({ default: Context } = await server.ssrLoadModule(
    "/src/features/admin-panel/discovery-scores/components/DiscoveryScoreContext.jsx",
  ));
  ({ default: columns } = await server.ssrLoadModule(
    "/src/features/admin-panel/discovery-scores/columns/discoveryScoreColumns.jsx",
  ));
});

after(async () => {
  if (apiClient) apiClient.get = originalGet;
  await server?.close();
});

function renderContent(query) {
  return renderToStaticMarkup(
    React.createElement(Content, { query }),
  ).replaceAll("<!-- -->", "");
}

test("visibility diagnostics fetch only after a business is explicitly selected", async () => {
  const calls = [];
  apiClient.get = async (url, options) => {
    calls.push({ url, signal: options.signal });
    return { data: { data: diagnostic } };
  };
  const client = new QueryClient();
  const observer = new QueryObserver(
    client,
    service.visibilityDiagnosticOptions(null),
  );
  const unsubscribe = observer.subscribe(() => {});
  let finish;
  const loaded = new Promise((resolve) => {
    finish = resolve;
  });
  const stop = observer.subscribe((result) => {
    if (result.isSuccess) finish(result.data);
  });
  try {
    await Promise.resolve();
    assert.equal(calls.length, 0);
    let selected;
    const action = columns((business) => {
      selected = business;
    }).find((column) => column.id === "visibility_diagnostics");
    const business = { id: 42, status: "active", business_name: "Cafe" };
    action.cell({ row: { original: { business } } }).props.onClick();
    assert.equal(selected, business);
    observer.setOptions(service.visibilityDiagnosticOptions(selected.id));
    assert.deepEqual(await loaded, diagnostic);
    observer.setOptions(service.visibilityDiagnosticOptions(selected.id));
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "/admin/analytics/discovery-scores/42/visibility-diagnostics/",
    );
    assert.ok(calls[0].signal instanceof AbortSignal);
    const options = service.visibilityDiagnosticOptions(42);
    assert.equal(options.refetchOnWindowFocus, false);
    assert.equal(options.refetchOnReconnect, false);
    assert.equal(options.retry, false);
  } finally {
    stop();
    unsubscribe();
    client.clear();
  }
});

test("visibility diagnostics warn that current calculations are not historical score explanations", () => {
  const client = new QueryClient();
  client.setQueryData(
    service.visibilityDiagnosticOptions(42).queryKey,
    diagnostic,
  );
  try {
    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(Modal, {
          business: { id: 42, business_name: "Cafe" },
          onClose() {},
        }),
      ),
    );
    assert.match(html, /Current diagnostic calculation/);
    assert.match(
      html,
      /does not reproduce a historical score or update ranking/,
    );
    assert.match(html, /Newer events, group membership, or configuration/);
    assert.match(html, /role="dialog"/);
  } finally {
    client.clear();
  }
});

test("visibility score context separates fresh computation from unverified telemetry and short history", () => {
  const score = {
    computed_at: diagnostic.reference_time,
    score_state: "FRESH",
    is_provisional: false,
    observation_context: diagnostic.observation_context,
  };
  const html = renderToStaticMarkup(
    React.createElement(Context, { score }),
  ).replaceAll("<!-- -->", "");
  assert.match(html, /Refresh state: .*fresh/);
  assert.match(html, /Computed: Yes · Provisional: No/);
  assert.match(html, /Telemetry coverage: Unverified/);
  assert.match(html, /Potential observation period: 8 days of a 14-day window/);
  assert.match(html, /Short history/);
  const provisional = renderToStaticMarkup(
    React.createElement(Context, {
      score: {
        ...score,
        computed_at: null,
        score_state: "PROVISIONAL",
        is_provisional: true,
      },
    }),
  ).replaceAll("<!-- -->", "");
  assert.match(provisional, /Computed: No · Provisional: Yes/);
  assert.match(provisional, /Telemetry coverage: Unverified/);
});

test("visibility diagnostics render recorded counts and normalization without recalculating scores", () => {
  const html = renderContent({ data: diagnostic });
  for (const label of [
    "Recorded activity and normalization",
    "Group maximum",
    "Normalized",
    "Weight",
    "Distinct savers",
    "CLUSTER · 7 active businesses",
  ]) {
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /Current Visibility Gap: .*0\.63500/);
  assert.match(html, /Traction: .*0\.36500/);
  assert.match(html, /8 days of a 14-day window · Short history/);
  assert.match(html, /proxy, not verified tracking duration/);
  assert.match(html, /zero recorded events do not establish zero exposure/);
});

test("visibility diagnostics distinguish loading errors and empty responses", () => {
  assert.match(
    renderContent({ isFetching: true }),
    /role="status" aria-busy="true"/,
  );
  const error = renderContent({
    error: {
      response: { data: { message: "Tracking temporarily unavailable." } },
    },
    refetch() {},
  });
  assert.match(error, /role="alert"/);
  assert.match(error, /Tracking temporarily unavailable/);
  assert.match(error, /Try again/);
  assert.match(renderContent({ data: null }), /No diagnostic data returned/);
  const zeros = {
    ...diagnostic,
    impression_count: 0,
    profile_visit_count: 0,
    unique_saver_count: 0,
    visibility_gap: "1.00000",
  };
  const html = renderContent({ data: zeros });
  assert.doesNotMatch(html, /No diagnostic data returned/);
  assert.match(html, /Current Visibility Gap: .*1\.00000/);
  assert.match(html, /Telemetry coverage: Unverified/);
});
