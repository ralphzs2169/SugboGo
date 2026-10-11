import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let ModerationIntegrityPage;
let navigation;
let getLegacyModerationDestination;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });

  ({ default: ModerationIntegrityPage } = await server.ssrLoadModule(
    "/src/features/admin-panel/pages/ModerationIntegrityPage.jsx",
  ));

  ({ default: navigation } = await server.ssrLoadModule(
    "/src/features/admin-panel/config/sidebarNavigation.js",
  ));

  ({ getLegacyModerationDestination } = await server.ssrLoadModule(
    "/src/features/admin-panel/utils/moderationNavigation.js",
  ));
});

after(async () => {
  await server?.close();
  delete globalThis.window;
});

function renderPage(url) {
  globalThis.window = {
    location: { search: new URL(url, "http://localhost").search },
  };

  const queryClient = new QueryClient();

  return renderToString(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        MemoryRouter,
        { initialEntries: [url] },
        React.createElement(ModerationIntegrityPage),
      ),
    ),
  );
}

test("sidebar has one Trust & Safety destination", () => {
  const section = navigation.find(
    (item) => item.section === "Trust & Safety",
  );

  assert.equal(section.items.length, 1);
  assert.equal(section.items[0].label, "Moderation & Integrity");
  assert.equal(section.items[0].to, "/admin-panel/moderation-integrity");
  assert.ok(
    section.items[0].activePaths.includes(
      "/admin-panel/review-disputes/[disputeId]",
    ),
  );
});

test("legacy list URLs redirect to the correct tab and retain dispute filters", () => {
  assert.deepEqual(
    getLegacyModerationDestination("?status=pending&page=2", "disputes"),
    {
      pathname: "/admin-panel/moderation-integrity",
      search: "?status=pending&page=2&tab=disputes",
    },
  );

  assert.deepEqual(
    getLegacyModerationDestination("", "under-review"),
    {
      pathname: "/admin-panel/moderation-integrity",
      search: "?tab=under-review",
    },
  );
});

test("legacy list routes redirect while the dispute detail route remains", () => {
  const appSource = readFileSync(
    new URL("../../../App.jsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /path="moderation-integrity"/);
  assert.match(appSource, /path="flags-suspicious"/);
  assert.match(appSource, /LegacyModerationRedirect tab="under-review"/);
  assert.match(appSource, /path="review-disputes"/);
  assert.match(appSource, /LegacyModerationRedirect tab="disputes"/);
  assert.match(appSource, /path="review-disputes\/:disputeId"/);
});

test("default and invalid tabs show the Under Review placeholder", () => {
  for (const url of [
    "/admin-panel/moderation-integrity",
    "/admin-panel/moderation-integrity?tab=invalid",
  ]) {
    const html = renderPage(url);

    assert.match(html, /Moderation &amp; Integrity/);
    assert.match(html, /Under Review management is coming next/);
    assert.match(html, /rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2/);
    assert.doesNotMatch(html, /Search review disputes/);
  }
});

test("all four tabs render and placeholder content follows the URL", () => {
  const suspicious = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious",
  );
  const reported = renderPage(
    "/admin-panel/moderation-integrity?tab=reported",
  );

  for (const label of ["Under Review", "Suspicious", "Reported", "Disputes"]) {
    assert.match(suspicious, new RegExp(label));
  }

  assert.match(suspicious, /Suspicious review signals are coming next/);
  assert.match(reported, /Reported reviews are coming next/);
  assert.doesNotMatch(suspicious, /Search review disputes/);
  assert.doesNotMatch(reported, /Search review disputes/);
});

test("Disputes tab renders the existing dispute table controls", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=disputes",
  );

  assert.ok(html.includes("Search review disputes"));
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(html.includes("rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2"));
  assert.ok(html.indexOf("Under Review") < html.indexOf("Search review disputes"));
  assert.ok(html.includes("Status"));
  assert.ok(html.includes("Filter"));
  assert.ok(!html.includes("management is coming next"));
});
