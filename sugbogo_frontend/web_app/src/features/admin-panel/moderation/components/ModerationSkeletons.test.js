import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

let server;
let ModerationQueueSkeleton;
let ModerationDetailSkeleton;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: ModerationQueueSkeleton } = await server.ssrLoadModule(
    "/src/features/admin-panel/moderation/components/ModerationQueueSkeleton.jsx",
  ));
  ({ default: ModerationDetailSkeleton } = await server.ssrLoadModule(
    "/src/features/admin-panel/moderation/components/ModerationDetailSkeleton.jsx",
  ));
});

after(async () => {
  await server?.close();
});

test("queue skeleton exposes a loading state and review-shaped rows", () => {
  const html = renderToString(React.createElement(ModerationQueueSkeleton, {
    label: "Loading reported reviews",
  }));

  assert.match(html, /role="status"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Loading reported reviews/);
  assert.equal((html.match(/h-8 w-8 shrink-0 rounded-full/g) ?? []).length, 4);
  assert.match(html, /bg-skeleton/);
});

test("detail skeleton keeps investigation sections and decision footer distinct", () => {
  const reported = renderToString(React.createElement(ModerationDetailSkeleton, {
    label: "Loading reported review",
    sections: ["Community Reports", "Individual Reports"],
    showDecision: true,
  }));
  const suspicious = renderToString(React.createElement(ModerationDetailSkeleton, {
    label: "Loading investigation",
    sections: ["Reliability Signals", "Current Related Activity"],
  }));

  assert.match(reported, /Review Content/);
  assert.match(reported, /Community Reports/);
  assert.match(reported, /Individual Reports/);
  assert.match(reported, /border-t border-stroke bg-background/);
  assert.match(suspicious, /Reliability Signals/);
  assert.match(suspicious, /Current Related Activity/);
  assert.doesNotMatch(suspicious, /border-t border-stroke bg-background/);
});
