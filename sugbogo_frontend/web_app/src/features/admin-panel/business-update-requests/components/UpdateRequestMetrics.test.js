import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let UpdateRequestMetrics;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: UpdateRequestMetrics } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-update-requests/components/UpdateRequestMetrics.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function renderMetrics({ data, error = false } = {}) {
  const client = new QueryClient();
  const params = { request_type: "location", business_id: 7 };
  const queryKey = ["admin", "update-request-summary", params];
  if (data) client.setQueryData(queryKey, data);
  if (error) {
    client.getQueryCache().build(client, { queryKey }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Summary unavailable"),
    });
  }
  return renderToString(React.createElement(
    QueryClientProvider,
    { client },
    React.createElement(UpdateRequestMetrics, {
      requestType: "location",
      typeLabel: "Location & Landmarks",
      businessId: 7,
      onFilterQueue: () => {},
      onOpenRequest: () => {},
    }),
  )).replaceAll("<!-- -->", "");
}

const summary = {
  pending: 3,
  aging_requests: 1,
  aging_threshold_hours: 48,
  oldest_pending: { id: 8, request_type: "location", seconds: 180000 },
  resolved_today: 2,
};

test("shared cards show visible heading, scope, counts, and request actions", () => {
  const html = renderMetrics({ data: summary });
  assert.match(html, /<h2[^>]*>.*Update Request Overview<\/h2>/s);
  assert.match(html, /Location &amp; Landmarks · Business #7 · PHT/);
  assert.match(html, /Pending Requests: 3\. Filter queue/);
  assert.match(html, /Oldest Pending: 2 days\. Open request/);
  assert.match(html, /Aging Requests: 1\. Filter queue/);
  assert.match(html, /Resolved Today: 2\. Filter queue/);
  assert.match(html, /48\+ elapsed hours pending/);
  assert.match(html, /independent of search and status filters/);
});

test("empty queues preserve zeros and do not offer a nonexistent oldest request", () => {
  const html = renderMetrics({ data: {
    ...summary,
    pending: 0,
    aging_requests: 0,
    oldest_pending: null,
    resolved_today: 0,
  } });
  assert.match(html, /Pending Requests: 0/);
  assert.match(html, /Resolved Today: 0/);
  assert.match(html, /No pending requests/);
  assert.doesNotMatch(html, /Open request|text-warning/);
});

test("loading, failure, and retained refresh states do not invent counts", () => {
  assert.match(renderMetrics(), /aria-busy="true"/);
  const failure = renderMetrics({ error: true });
  assert.match(failure, /Unable to load update request metrics/);
  assert.match(failure, /Try Again/);
  assert.equal((failure.match(/>Unavailable</g) ?? []).length, 4);
  const retained = renderMetrics({ data: summary, error: true });
  assert.match(retained, /Showing previously loaded data/);
  assert.match(retained, /Pending Requests: 3/);
});
