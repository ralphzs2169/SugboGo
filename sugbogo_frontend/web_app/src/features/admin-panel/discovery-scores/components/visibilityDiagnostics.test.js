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
let Overview;
let DetailContent;
let keys;
let presentation;

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
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
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
  ({ default: Overview } = await server.ssrLoadModule(
    "/src/features/admin-panel/discovery-scores/components/DiscoveryScoreOverview.jsx",
  ));
  ({ DiscoveryScoreDetailContent: DetailContent } = await server.ssrLoadModule(
    "/src/features/admin-panel/discovery-scores/components/DiscoveryScoreDetailsModal.jsx",
  ));
  ({ analyticsQueryKeys: keys } = await server.ssrLoadModule(
    "/src/features/admin-panel/analytics/queries/analyticsQueryKeys.js",
  ));
  presentation = await server.ssrLoadModule(
    "/src/features/admin-panel/discovery-scores/utils/presentation.js",
  );
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
    }).find((column) => column.id === "actions");
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
  assert.match(html, /Current Visibility Gap: .*0\.635/);
  assert.match(html, /Traction: .*0\.365/);
  assert.match(html, /8 days of a 14-day window/);
  assert.match(html, /Short history/);
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
  assert.match(error, /Retry visibility diagnostics/);
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
  assert.match(html, /Current Visibility Gap: .*1\.000/);
  assert.match(html, /Telemetry coverage: Unverified/);
});

test("score overview uses authoritative attention and original counts without trends", () => {
  const client = new QueryClient();
  client.setQueryData(keys.discoveryScores({ page_size: 1 }), {
    coverage: {
      computed: 29, fresh: 21, failed: 4, stale: 6, needs_attention: 7,
      telemetry_coverage: { value: null, reason: "coverage_unverified", coverage_verified: false },
    },
  });
  try {
    const html = renderToStaticMarkup(React.createElement(
      QueryClientProvider, { client }, React.createElement(Overview),
    ));
    for (const label of ["Scored Businesses", "Up-to-Date Scores", "Refresh Failures", "Businesses Needing Attention", "Businesses with failed refreshes or outdated scores"]) {
      assert.ok(html.includes(label), label);
    }
    for (const value of [29, 21, 4, 7]) assert.ok(html.includes(`>${value}<`));
    assert.doesNotMatch(html, /Telemetry Coverage|Unverified/);
    assert.doesNotMatch(html, /\d%|vs last week|14\s*\/\s*15/);
    assert.match(html, /text-danger/);
  } finally {
    client.clear();
  }
});

test("table identity omits specialty tags and exposes only supported orderings", () => {
  const definitions = columns(() => {});
  assert.deepEqual(definitions.map((column) => column.header), [
    "No.", "Business", "Specialty Score", "Visibility Gap", "Discovery Score", "Refresh Status", "Last Computed", "Actions",
  ]);
  const business = {
    id: 42, business_name: "Cafe", category_name: "Coffee", cluster_name: "Food",
    specialty_tags: [{ id: 1, name: "Do not show this tag", color: "blue" }],
  };
  const identity = definitions.find((column) => column.id === "business_name");
  const html = renderToStaticMarkup(identity.cell({ row: { original: { business } } }));
  for (const label of ["Cafe", "Coffee", "Food"]) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /Do not show this tag/);
  assert.equal(definitions.find((column) => column.accessorKey === "refresh_status").enableSorting, false);
  assert.equal(definitions[0].cell({ row: { index: 2 }, table: { getState: () => ({ pagination: { pageIndex: 2, pageSize: 10 } }) } }), 23);
  assert.equal(presentation.formatScore("0.69827"), "0.698");
  assert.equal(presentation.formatScore("0.00000"), "0.000");
  for (const value of [null, undefined, "", "invalid"]) assert.equal(presentation.formatScore(value), "—");
  assert.equal(presentation.telemetryPresentation({ value: 0, unit: "percent", coverage_verified: true }).value, "0%");
  assert.equal(presentation.telemetryPresentation({ value: 90, coverage_verified: false }).value, "Unavailable");
});

test("persisted details retain last success, current tag scores and historical limitations", () => {
  const html = renderToStaticMarkup(React.createElement(DetailContent, {
    query: { data: {
      business: { specialty_tags: [{ id: 1, name: "Local Coffee", tag_score: "0.12345", color: "blue" }] },
      specialty_score: "0.72000", visibility_gap: "0.61000", discovery_score: "0.69800",
      refresh_status: "FAILED", computed_at: "2026-11-03T18:38:00Z",
      last_attempt_at: "2026-11-04T18:38:00Z", last_error_code: "VisibilityTrackingUnavailable",
      score_breakdown: { specialty_weight: "0.80000", visibility_weight: "0.20000", weighted_specialty_contribution: "0.5760000000", weighted_visibility_contribution: "0.1220000000" },
    } },
  })).replaceAll("<!-- -->", "");
  for (const text of ["0.698", "0.576", "0.122", "Local Coffee", "0.123", "Current-configuration contributions", "Historical weights and observation windows were not persisted", "last successfully computed score remains available", "VisibilityTrackingUnavailable"]) assert.ok(html.includes(text), text);
  assert.match(html, /Nov 4, 2026, 2:38 AM/);
  assert.match(html, /80%/);
  assert.match(html, /20%/);
  assert.match(html, /Contributions use current configuration and stored component scores/);
  assert.match(html, /Specialty Tag/);
  assert.match(html, /Last Updated/);
});

test("detail and diagnostic errors retain loaded data and expose separate retry actions", () => {
  const error = { response: { data: { message: "Temporarily unavailable" } } };
  const html = renderToStaticMarkup(React.createElement(DetailContent, {
    query: { data: { discovery_score: "0.69800" }, error, refetch() {} },
  }));
  assert.match(html, /0\.698/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Retry score details/);
  const diagnosticHtml = renderContent({ data: diagnostic, error, refetch() {} });
  assert.match(diagnosticHtml, /0\.635/);
  assert.match(diagnosticHtml, /Retry visibility diagnostics/);
});
