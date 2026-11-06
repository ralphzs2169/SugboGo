import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

import { moderationMetricParams } from "../utils/moderationMetricNavigation.js";

let server;
let ModerationMetrics;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: ModerationMetrics } = await server.ssrLoadModule(
    "/src/features/admin-panel/moderation/components/ModerationMetrics.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function renderMetrics({ tab = "under-review", data, error = false } = {}) {
  const queryClient = new QueryClient();
  const queryKey = ["admin", "moderation-summary", tab];
  if (data) {
    queryClient.setQueryData(queryKey, data);
  }
  if (error) {
    queryClient.getQueryCache().build(queryClient, { queryKey }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Summary unavailable"),
    });
  }
  return renderToString(React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(ModerationMetrics, {
      tab,
      tabLabel: tab === "suspicious" ? "Suspicious" : "Review Moderation",
      onSelectQueue: () => {},
    }),
  )).replaceAll("<!-- -->", "");
}

const summary = {
  pending: 12,
  aging_cases: 3,
  aging_threshold_hours: 48,
  unknown_age_count: 0,
  oldest_pending: { id: 42, queue: "under-review", seconds: 176400 },
  resolved_today: 4,
};

test("four shared cards keep visible section headings and active-tab scope", () => {
  const html = renderMetrics({ data: summary });
  for (const title of ["Awaiting Decision", "Oldest Pending", "Aging Cases", "Resolved Today"]) {
    assert.match(html, new RegExp(`<h3[^>]*>${title}</h3>`));
  }
  assert.match(html, /aria-label="Review Moderation metrics"/);
  assert.match(html, /<h2[^>]*>.*Moderation Overview<\/h2>/s);
  assert.match(html, /Awaiting Decision: 12\. Show all pending cases/);
  assert.match(html, /Oldest Pending: 2 days\. Open the oldest case/);
  assert.match(html, /Aging Cases: 3\. Show aging cases/);
  assert.match(html, /48\+ elapsed hours/);
  assert.match(html, /Decisions since midnight · Philippine time/);
  assert.match(html, /independent of queue filters/);
});

test("empty queues preserve real zeros without an actionable oldest case", () => {
  const html = renderMetrics({ data: {
    ...summary,
    pending: 0,
    aging_cases: 0,
    oldest_pending: null,
    resolved_today: 0,
  } });
  assert.match(html, /Awaiting Decision: 0/);
  assert.match(html, /Aging Cases: 0/);
  assert.match(html, /No pending cases/);
  assert.doesNotMatch(html, /Open the oldest case/);
  assert.doesNotMatch(html, /text-warning/);
});

test("loading and failed summaries never present invented zero counts", () => {
  const loading = renderMetrics();
  assert.equal((loading.match(/aria-label="Loading metric"/g) ?? []).length, 4);
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /Awaiting Decision: 0/);
  const failed = renderMetrics({ error: true });
  assert.match(failed, /Unable to load moderation metrics/);
  assert.match(failed, /Try Again/);
  assert.equal((failed.match(/>Unavailable</g) ?? []).length, 4);
  const retained = renderMetrics({ data: summary, error: true });
  assert.match(retained, /Showing previously loaded data/);
  assert.match(retained, /Awaiting Decision: 12/);
});

test("advisory queues distinguish untracked decisions and unknown signal times", () => {
  const html = renderMetrics({ tab: "suspicious", data: {
    ...summary,
    resolved_today: null,
    unknown_age_count: 2,
  } });
  assert.match(html, /Not tracked/);
  assert.match(html, /Advisory signals have no resolution action/);
  assert.match(html, /2 with unrecorded entry times excluded/);
  assert.match(html, /Since the signal was recorded/);
});

test("metric navigation clears conflicting selections and opens the correct subtype", () => {
  const previous = new URLSearchParams(
    "tab=suspicious&suspicious_type=reviews&suspicious_id=12&status=rejected&queue_scope=aging",
  );
  const oldest = moderationMetricParams(previous, "oldest", {
    id: 71,
    queue: "suspicious-vouches",
  });
  assert.equal(oldest.get("suspicious_type"), "vouches");
  assert.equal(oldest.get("suspicious_vouch_id"), "71");
  assert.equal(oldest.has("suspicious_id"), false);
  assert.equal(oldest.has("status"), false);
  assert.equal(oldest.get("queue_scope"), "pending");
  assert.equal(previous.get("suspicious_id"), "12");
  const aging = moderationMetricParams(oldest, "aging");
  assert.equal(aging.get("queue_scope"), "aging");
  assert.equal(aging.has("suspicious_vouch_id"), false);
  const pending = moderationMetricParams(aging, "pending");
  assert.equal(pending.get("queue_scope"), "pending");
});
