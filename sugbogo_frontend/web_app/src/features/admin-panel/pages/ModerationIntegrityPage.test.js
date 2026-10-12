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

function renderPage(url, {
  list,
  detail,
  suspiciousList,
  suspiciousDetail,
  suspiciousError,
  suspiciousDetailError,
} = {}) {
  globalThis.window = {
    location: { search: new URL(url, "http://localhost").search },
  };

  const queryClient = new QueryClient();
  if (list) {
    queryClient.setQueryData(
      ["admin", "under-review", "list", {
        page: 1,
        page_size: 10,
        search: "",
        reason: undefined,
        content: undefined,
        ordering: "oldest",
      }],
      list,
    );
  }
  if (detail) {
    queryClient.setQueryData(
      ["admin", "under-review", "detail", detail.id],
      detail,
    );
  }
  if (suspiciousList) {
    queryClient.setQueryData(
      ["admin", "suspicious-reviews", "list", {
        page: 1,
        page_size: 10,
        search: "",
        signal: undefined,
        ordering: "newest",
      }],
      suspiciousList,
    );
  }
  if (suspiciousError) {
    queryClient.getQueryCache().build(queryClient, {
      queryKey: ["admin", "suspicious-reviews", "list", {
        page: 1,
        page_size: 10,
        search: "",
        signal: undefined,
        ordering: "newest",
      }],
    }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Network unavailable"),
    });
  }
  if (suspiciousDetail) {
    queryClient.setQueryData(
      ["admin", "suspicious-reviews", "detail", suspiciousDetail.id],
      suspiciousDetail,
    );
  }
  if (suspiciousDetailError) {
    queryClient.getQueryCache().build(queryClient, {
      queryKey: ["admin", "suspicious-reviews", "detail", suspiciousDetailError],
    }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Review unavailable"),
    });
  }

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

test("default and invalid tabs show the Under Review queue", () => {
  for (const url of [
    "/admin-panel/moderation-integrity",
    "/admin-panel/moderation-integrity?tab=invalid",
  ]) {
    const html = renderPage(url);

    assert.match(html, /Moderation &amp; Integrity/);
    assert.match(html, /Under Review Queue/);
    assert.match(html, /Search held reviews/);
    assert.match(html, /Oldest first/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2/);
    assert.doesNotMatch(html, /Search review disputes/);
  }
});

const heldReview = {
  id: 42,
  author: { id: 7, first_name: "Ana", last_name: "Cruz" },
  business: { id: 9, name: "Cebu Cafe" },
  text_preview: "A sample held review",
  first_photo_url: "https://example.com/first.jpg",
  photo_count: 2,
  submitted_at: "2026-10-10T09:00:00Z",
  status: "under_review",
  hold_reasons: ["text_flagged", "image_flagged"],
};

const heldList = {
  items: [heldReview],
  pagination: {
    page: 1,
    total_items: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  },
};

test("queue renders held reviews and a neutral no-selection panel", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    { list: heldList },
  );

  assert.match(html, /A sample held review/);
  assert.match(html, /Ana Cruz/);
  assert.match(html, /Cebu Cafe/);
  assert.match(html, /Text flagged/);
  assert.match(html, /Image flagged/);
  assert.match(html, /Select a review/);
  assert.match(html, /aria-pressed="false"/);
});

test("selected detail separates text and photo findings", () => {
  const detail = {
    ...heldReview,
    text: "Full held review content",
    photos: [
      {
        id: 12,
        photo_url: "https://example.com/first.jpg",
        checked: true,
        flagged_categories: [],
      },
      {
        id: 13,
        photo_url: "https://example.com/second.jpg",
        checked: true,
        flagged_categories: ["violence"],
      },
    ],
    moderation: {
      text_checked: true,
      text_flagged_categories: ["harassment"],
      provider_unavailable: false,
      retry_state: null,
      checked_at: "2026-10-10T09:00:00Z",
    },
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42",
    { list: heldList, detail },
  );

  assert.match(html, /Full held review content/);
  assert.match(html, /Photo 1/);
  assert.match(html, /Photo 2/);
  assert.match(html, /Harassment/);
  assert.match(html, /Violence/);
  assert.match(html, /No findings/);
  assert.match(html, /Approve &amp; Publish/);
  assert.match(html, /Reject Review/);
  assert.match(html, /aria-pressed="true"/);
});

test("provider failure is shown as unavailable, not unsafe content", () => {
  const detail = {
    ...heldReview,
    hold_reasons: ["provider_failure"],
    text: "Content awaiting a check",
    photos: [],
    moderation: {
      text_checked: false,
      text_flagged_categories: [],
      provider_unavailable: true,
      retry_state: "retrying",
      checked_at: null,
    },
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42",
    { list: { ...heldList, items: [detail] }, detail },
  );

  assert.match(html, /Automated moderation unavailable/);
  assert.match(html, /A background check may still be retried/);
  assert.match(html, /Not checked/);
  assert.doesNotMatch(html, /potential concerns/);
});

test("local Cebuano safety finding identifies its source and review text", () => {
  const detail = {
    ...heldReview,
    hold_reasons: ["local_cebuano_safety"],
    text: "Patyon nako ang mga customer.",
    photos: [],
    moderation: {
      text_checked: true,
      text_flagged_categories: [],
      local_safety_findings: [
        {
          category: "violence_threat",
          matched_rule: "direct_kill_threat",
        },
      ],
      provider_unavailable: false,
      retry_state: null,
      checked_at: "2026-10-10T09:00:00Z",
    },
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42",
    { list: { ...heldList, items: [detail] }, detail },
  );

  assert.match(html, /Potential violent threat/);
  assert.match(html, /Detected in/);
  assert.match(html, /Review text/);
  assert.match(html, /Local Cebuano safety fallback/);
  assert.doesNotMatch(html, /direct_kill_threat/);
});

test("empty queue renders the moderation empty state", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    {
      list: {
        items: [],
        pagination: { total_items: 0, total_pages: 0 },
      },
    },
  );

  assert.match(html, /No reviews currently need moderation/);
});

test("all four tabs render and Suspicious has its investigation workspace", () => {
  const suspicious = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious",
  );
  const reported = renderPage(
    "/admin-panel/moderation-integrity?tab=reported",
  );

  for (const label of ["Under Review", "Suspicious", "Reported", "Disputes"]) {
    assert.match(suspicious, new RegExp(label));
  }

  assert.match(suspicious, /Suspicious Reviews/);
  assert.match(suspicious, /Select a review/);
  assert.match(reported, /Reported reviews are coming next/);
  assert.doesNotMatch(suspicious, /Search review disputes/);
  assert.doesNotMatch(reported, /Search review disputes/);
});

const suspiciousReview = {
  id: 83,
  author: { id: 7, first_name: "Ana", last_name: "Cruz" },
  business: { id: 9, name: "Cebu Cafe" },
  text_preview: "Exact repeated review text",
  first_photo_url: "https://example.com/photo.jpg",
  photo_count: 2,
  submitted_at: "2026-10-10T09:00:00Z",
  reasons: ["duplicate_content", "rapid_submission"],
};

test("Suspicious queue shows items, badges, filters, and no moderation actions", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious",
    {
      suspiciousList: {
        items: [suspiciousReview],
        pagination: { page: 1, total_pages: 1 },
      },
    },
  );
  assert.match(html, /Review #<!-- -->83/);
  assert.match(html, /Exact repeated review text/);
  assert.match(html, /Duplicate Content/);
  assert.match(html, /Rapid Submission/);
  assert.match(html, /Search suspicious reviews/);
  assert.match(html, /All signals/);
  assert.match(html, /Newest first/);
  assert.doesNotMatch(html, /Approve &amp; Publish|Reject review|Remove Review/);
});

test("selected Suspicious detail separates detection evidence and live activity", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousList: {
        items: [suspiciousReview],
        pagination: { page: 1, total_pages: 1 },
      },
      suspiciousDetail: {
        ...suspiciousReview,
        text: "Exact repeated review text",
        status: "published",
        photos: [],
        detection_evidence: {
          duplicate_content: {
            prior_match_count: 2,
            basis: "same_user",
            matched_reviews: [
              { id: 41, available: true },
              { id: 47, available: false },
            ],
          },
          rapid_submission: { review_count: 11, window_hours: 24 },
        },
        current_related_activity: {
          duplicate_content: { review_count: 0, reviews: [] },
          rapid_submission: { review_count: 0, reviews: [] },
        },
      },
    },
  );
  assert.match(html, /Why It Was Flagged/);
  assert.match(html, /Same normalized review text detected/);
  assert.match(html, /2<!-- --> prior matching reviews/);
  assert.match(html, /Review #<!-- -->47<!-- --> · unavailable\/deleted/);
  assert.match(html, /11<!-- --> reviews with the same app installation identifier within <!-- -->24<!-- --> hours/);
  assert.match(html, /Current Related Activity/);
  assert.match(html, /Live data currently available/);
  assert.doesNotMatch(html, /Highly similar content|private-installation/);
});

test("shared installation evidence shows historical and current account counts separately", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousDetail: {
        ...suspiciousReview,
        reasons: ["shared_installation_accounts"],
        text: "A review for investigation",
        status: "published",
        photos: [],
        detection_evidence: {
          shared_installation_accounts: {
            distinct_account_count: 4,
          },
        },
        current_related_activity: {
          shared_installation_accounts: {
            distinct_account_count: 2,
            review_count: 2,
            reviews: [],
          },
        },
      },
    },
  );
  assert.match(html, /Shared Installation \/ Accounts/);
  assert.match(html, /4<!-- --> distinct accounts/);
  assert.match(html, /2<!-- --> distinct accounts currently retained/);
});

test("Suspicious empty and loading states render", () => {
  const loading = renderPage("/admin-panel/moderation-integrity?tab=suspicious");
  assert.match(loading, /Loading suspicious reviews/);
  const empty = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious",
    {
      suspiciousList: {
        items: [],
        pagination: { page: 1, total_pages: 0 },
      },
    },
  );
  assert.match(empty, /No suspicious reviews found/);
  const error = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious",
    { suspiciousError: true },
  );
  assert.match(error, /Unable to load suspicious reviews/);
  assert.match(error, /Try Again/);
  const detailError = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    { suspiciousDetailError: 83 },
  );
  assert.match(detailError, /Unable to load this investigation/);
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
