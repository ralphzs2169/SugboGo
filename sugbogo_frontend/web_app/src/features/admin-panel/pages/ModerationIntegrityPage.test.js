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
let DecisionDialog;
let ReportedQueueFilters;
let SuspiciousQueueFilters;
let SuspiciousCurrentActivity;
let UnderReviewDecisionDialog;
let UnderReviewQueueFilters;

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
  ({ DecisionDialog } = await server.ssrLoadModule(
    "/src/features/admin-panel/reported-reviews/components/ReportedReviewWorkspace.jsx",
  ));
  ({ default: ReportedQueueFilters } = await server.ssrLoadModule(
    "/src/features/admin-panel/reported-reviews/components/QueueFilters.jsx",
  ));
  ({ default: SuspiciousQueueFilters } = await server.ssrLoadModule(
    "/src/features/admin-panel/suspicious-reviews/components/QueueFilters.jsx",
  ));
  ({ default: SuspiciousCurrentActivity } = await server.ssrLoadModule(
    "/src/features/admin-panel/suspicious-reviews/components/CurrentActivity.jsx",
  ));
  ({ default: UnderReviewDecisionDialog } = await server.ssrLoadModule(
    "/src/features/admin-panel/under-review/components/DecisionDialog.jsx",
  ));
  ({ default: UnderReviewQueueFilters } = await server.ssrLoadModule(
    "/src/features/admin-panel/under-review/components/QueueFilters.jsx",
  ));
});

after(async () => {
  await server?.close();
  delete globalThis.window;
});

function renderPage(url, {
  list,
  detail,
  clusters,
  suspiciousList,
  suspiciousDetail,
  suspiciousError,
  suspiciousDetailError,
  vouchList,
  vouchDetail,
  vouchError,
  vouchDetailError,
  reportedList,
  reportedDetail,
  reportedBusinessDetails,
  reportedError,
  reportedDetailError,
  reportedGone,
  tabCounts,
  countError,
} = {}) {
  globalThis.window = {
    location: { search: new URL(url, "http://localhost").search },
  };

  const queryClient = new QueryClient();
  const vouchListKey = ["admin", "suspicious-vouches", "list", {
    page: 1,
    page_size: 10,
    search: "",
    ordering: "newest",
  }];
  if (vouchList) {
    queryClient.setQueryData(vouchListKey, vouchList);
  }
  if (vouchDetail) {
    queryClient.setQueryData(["admin", "suspicious-vouches", "detail", vouchDetail.id], vouchDetail);
  }
  if (vouchError || vouchDetailError) {
    const queryKey = vouchError
      ? vouchListKey
      : ["admin", "suspicious-vouches", "detail", vouchDetailError];
    queryClient.getQueryCache().build(queryClient, { queryKey }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Vouch unavailable"),
    });
  }
  for (const [tabId, count] of Object.entries(tabCounts ?? {})) {
    queryClient.setQueryData(["admin", "moderation-counts", tabId], count);
  }
  if (countError) {
    queryClient.getQueryCache().build(queryClient, {
      queryKey: ["admin", "moderation-counts", countError],
    }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Count unavailable"),
    });
  }
  if (list) {
    queryClient.setQueryData(
      ["admin", "under-review", "list", {
        page: 1,
        page_size: 10,
        search: "",
        status: "pending",
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
  if (clusters) {
    for (const review of [detail, suspiciousDetail, reportedDetail]) {
      if (review?.business.cluster_name) {
        queryClient.setQueryData(
          ["admin", "taxonomy", "clusters", "by-name", review.business.cluster_name],
          { items: clusters },
        );
      }
    }
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
  const reportedListKey = ["admin", "reported-reviews", "list", {
    page: 1,
    page_size: 10,
    search: "",
    reason: undefined,
    status: undefined,
    ordering: "most_reported",
  }];
  if (reportedList) {
    queryClient.setQueryData(reportedListKey, reportedList);
  }
  if (reportedBusinessDetails) {
    for (const business of reportedBusinessDetails) {
      queryClient.setQueryData(
        ["admin", "businesses", "detail", business.id],
        business,
      );
    }
  }
  if (reportedError) {
    queryClient.getQueryCache().build(queryClient, {
      queryKey: reportedListKey,
    }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Network unavailable"),
    });
  }
  if (reportedDetail) {
    queryClient.setQueryData(
      ["admin", "reported-reviews", "detail", reportedDetail.id],
      reportedDetail,
    );
  }
  if (reportedDetailError) {
    queryClient.getQueryCache().build(queryClient, {
      queryKey: ["admin", "reported-reviews", "detail", reportedDetailError],
    }).setState({
      status: "error",
      fetchStatus: "idle",
      error: new Error("Review unavailable"),
    });
  }
  if (reportedGone) {
    queryClient.getQueryCache().build(queryClient, {
      queryKey: ["admin", "reported-reviews", "detail", reportedGone],
    }).setState({
      status: "error",
      fetchStatus: "idle",
      error: { response: { status: 404 } },
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

test("vouch selector preserves default review links and uses separate selection", () => {
  const reviews = renderPage("/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83");
  assert.match(reviews, /Suspicious Reviews/);
  assert.match(reviews, /aria-label="Suspicious activity type"/);
  assert.match(reviews, /aria-pressed="true"[^>]*>Reviews/);
  assert.doesNotMatch(reviews, /Suspicious Vouches/);

  const vouches = renderPage("/admin-panel/moderation-integrity?tab=suspicious&suspicious_type=vouches&suspicious_id=83");
  assert.match(vouches, /Suspicious Vouches/);
  assert.match(vouches, /Select a vouch/);
  assert.doesNotMatch(vouches, /Suspicious Reviews/);
});

test("vouch workspace presents read-only findings pagination and historical context", () => {
  const vouch = {
    id: 9,
    author: { id: 2, first_name: "Vouch", last_name: "Explorer" },
    business: { id: 3, name: "Sugbo Bistro" },
    specialty: { id: 4, name: "Spicy" },
    submitted_at: "2026-10-24T00:00:00Z",
    withdrawn_at: "2026-10-24T01:00:00Z",
    evidence_is_valid: false,
    reasons: ["unknown_reason"],
    detection_evidence: {},
    current_related_activity: { items: [], window_unavailable: true },
  };
  const html = renderPage("/admin-panel/moderation-integrity?tab=suspicious&suspicious_type=vouches&suspicious_vouch_id=9", {
    vouchList: {
      items: [vouch],
      pagination: { page: 1, total_pages: 2, has_next: true, has_previous: false },
    },
    vouchDetail: vouch,
  });
  const visibleHtml = html.replace(/<!--.*?-->/g, "");
  for (const label of ["Vouch Explorer", "Sugbo Bistro", "Spicy", "Reason not recorded", "Invalid evidence", "Withdrawn", "Page 1 of 2", "Next", "original detection window is unavailable"]) {
    assert.ok(visibleHtml.includes(label), label);
  }
  assert.doesNotMatch(html, />Approve<|>Reject<|>Publish<|Review Content/);
});

test("vouch workspace renders loading empty list error and detail error states", () => {
  const url = "/admin-panel/moderation-integrity?tab=suspicious&suspicious_type=vouches";
  assert.match(renderPage(url), /Loading suspicious vouches/);
  assert.match(renderPage(url, { vouchList: { items: [], pagination: { total_pages: 0 } } }), /No suspicious vouches found/);
  assert.match(renderPage(url, { vouchError: true }), /Unable to load suspicious vouches/);
  assert.match(renderPage(`${url}&suspicious_vouch_id=9`, { vouchDetailError: 9 }), /Unable to load this vouch/);
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
    assert.match(html, /Review Moderation/);
    assert.match(html, /Search moderation reviews/);
    assert.match(html, /Oldest first/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2/);
    assert.doesNotMatch(html, /Search review disputes/);
  }
});

test("moderation tabs show queue totals including zero without blocking navigation", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    { tabCounts: { "under-review": 8, suspicious: 12, reported: 0, disputes: 3 } },
  );
  const tabs = html.match(/<nav aria-label="Moderation &amp; Integrity sections"[\s\S]*?<\/nav>/)?.[0];

  assert.ok(tabs);
  assert.match(tabs, /Review Moderation[\s\S]*?>8<\/span>/);
  assert.match(tabs, /Suspicious[\s\S]*?>12<\/span>/);
  assert.match(tabs, /Reported[\s\S]*?>0<\/span>/);
  assert.match(tabs, /Disputes[\s\S]*?>3<\/span>/);
});

test("moderation count loading and errors keep tabs usable without false zeros", () => {
  const loading = renderPage("/admin-panel/moderation-integrity?tab=under-review");
  assert.match(loading, /animate-pulse rounded-full bg-surface-muted/);
  assert.match(loading, /Review Moderation/);

  const errored = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    { tabCounts: { "under-review": 4 }, countError: "reported" },
  );
  assert.match(errored, /Review Moderation/);
  assert.doesNotMatch(errored, /Reported[\s\S]{0,180}>0<\/span>/);
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
  assert.doesNotMatch(html, /Review photo thumbnail/);
  assert.match(html, /lucide-store/);
  assert.match(html.replaceAll("<!-- -->", ""), /2 photos/);
  assert.match(html, /Remove Reason filter|>Filter</);
  assert.match(html, /Select a review/);
  assert.match(html, /aria-pressed="false"/);
});

test("text-only queue rows show an author avatar without a photo placeholder", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    {
      list: {
        ...heldList,
        items: [{ ...heldReview, first_photo_url: null, photo_count: 0 }],
      },
    },
  );

  assert.match(html, /Ana Cruz/);
  assert.match(html, /rounded-full border border-stroke object-cover/);
  assert.doesNotMatch(html, /Review photo thumbnail/);
  assert.doesNotMatch(html, /0 photos/);
});

test("queue shows neutral photo, reply, and edit context without likes", () => {
  const review = {
    ...heldReview,
    photo_count: 1,
    has_reply: true,
    is_edited: true,
    like_count: 12,
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    { list: { ...heldList, items: [review] } },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];

  assert.ok(queue);
  assert.match(queue.replaceAll("<!-- -->", ""), /1 photo/);
  assert.match(queue, /Merchant replied/);
  assert.match(queue, /Edited/);
  assert.match(queue, /Text flagged/);
  assert.equal(
    (queue.match(/rounded-md border px-2 py-0.5 text-xs font-medium text-text-primary border-danger\/25 bg-danger\/10/g) ?? []).length,
    2,
  );
  assert.match(queue, /gap-x-3 gap-y-1 text-xs text-text-secondary/);
  assert.doesNotMatch(queue, /12 likes/);

  const withoutContext = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review",
    {
      list: {
        ...heldList,
        items: [{ ...review, photo_count: 0, has_reply: false, is_edited: false }],
      },
    },
  );
  const emptyQueue = withoutContext.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];
  assert.doesNotMatch(emptyQueue, /1 photo|Reply|Edited/);
});

test("Under Review queue shares the blue selected state and compact business identity", () => {
  const review = {
    ...heldReview,
    business: {
      ...heldReview.business,
      cover_photo_url: "https://example.com/business-cover.jpg",
    },
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42",
    { list: { ...heldList, items: [review] } },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];

  assert.match(queue, /border-l-info bg-info\/5/);
  assert.match(queue, /focus-visible:outline-info/);
  assert.match(queue, /src="https:\/\/example.com\/business-cover.jpg"/);
  assert.match(queue, /Review #<!-- -->42/);
  assert.doesNotMatch(queue, /Review photo thumbnail/);
});

test("Under Review filters use the shared sort popover and active filter chips", () => {
  const html = renderToString(React.createElement(UnderReviewQueueFilters, {
    filters: {
      search: "Cebu Cafe",
      reason: "image_flagged",
      content: "has_photos",
      ordering: "newest",
    },
    onChange: () => {},
  })).replaceAll("<!-- -->", "");

  assert.match(html, /Reason: Image flagged/);
  assert.match(html, /Content: Has photos/);
  assert.match(html, /aria-label="Sort review moderation: Newest first"/);
  assert.doesNotMatch(html, /<select/);
});

test("Under Review decision dialogs explain approval and rejection", () => {
  const props = {
    reviewId: 42,
    pending: false,
    notes: "",
    onNotesChange: () => {},
    onClose: () => {},
    onConfirm: () => {},
  };
  const approve = renderToString(React.createElement(UnderReviewDecisionDialog, {
    ...props,
    decision: "approve",
  }));
  const reject = renderToString(React.createElement(UnderReviewDecisionDialog, {
    ...props,
    decision: "reject",
  }));
  const pending = renderToString(React.createElement(UnderReviewDecisionDialog, {
    ...props,
    decision: "reject",
    pending: true,
  }));
  const validReject = renderToString(React.createElement(UnderReviewDecisionDialog, {
    ...props,
    decision: "reject",
    notes: "The review contains threatening language.",
    error: "Please provide more detail.",
  }));

  assert.match(approve, /Approve and publish this review\?/);
  assert.match(approve, /visible to Explorers and the business/);
  assert.match(approve, /Approve &amp; Publish/);
  assert.doesNotMatch(approve, /Moderation Notes|Quick reasons/);
  assert.match(reject, /Reject this review\?/);
  assert.match(reject, /will not be published/);
  assert.match(reject, /Reject Review/);
  assert.match(reject, /Harassment/);
  assert.match(reject, /Threatening content/);
  assert.match(reject, /Other policy violation/);
  assert.match(reject, /id="under-review-moderation-notes"/);
  assert.match(reject, /disabled=""/);
  assert.match(validReject, /Please provide more detail/);
  assert.match(validReject, /The review contains threatening language/);
  assert.doesNotMatch(validReject, /Reject Review<\/button>.*disabled=""/);
  assert.doesNotMatch(pending, /aria-label="Close modal"/);
  assert.match(pending, /disabled=""/);
});

test("selected detail separates text and photo findings", () => {
  const detail = {
    ...heldReview,
    author: {
      ...heldReview.author,
      avatar_url: "https://example.com/author-avatar.jpg",
    },
    business: {
      ...heldReview.business,
      cover_photo_url: "https://example.com/business-cover.jpg",
      cluster_name: "Food and Dining",
      category_name: "Restaurants",
    },
    text: "Full held review content",
    like_count: 12,
    is_edited: true,
    edited_at: "2026-10-11T01:42:00Z",
    reply: {
      id: 28,
      text: "Thank you for sharing your visit.",
      created_at: "2026-10-11T02:15:00Z",
    },
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
    {
      list: heldList,
      detail,
      clusters: [{ name: "Food and Dining", icon: "utensils" }],
    },
  );

  assert.match(html, /Full held review content/);
  const header = html.match(/<header[^>]*>(.*?)<\/header>/s)?.[1];
  assert.ok(header);
  assert.match(html, /pointer-events-none sticky top-0 z-30 h-0/);
  assert.match(html, /aria-hidden="true" class="flex h-14[^"]*bg-background\/80[^"]*backdrop-blur-md/);
  assert.match(html, /class="min-h-0 flex-1 overflow-y-auto lg:max-h-/);
  assert.doesNotMatch(header, /sticky top-0/);
  assert.match(header, /flex flex-wrap items-start justify-between gap-2/);
  assert.match(header, /items-start gap-x-3 gap-y-3/);
  assert.match(header, /mt-0\.5 flex min-w-0 items-center gap-1\.5 text-xs text-text-secondary/);
  assert.match(header, /border-t border-stroke pt-3 text-xs text-text-secondary/);
  assert.match(header, /ml-auto inline-flex shrink-0 items-center gap-1.5/);
  assert.match(header, /src="https:\/\/example.com\/business-cover.jpg"/);
  assert.match(header, /src="https:\/\/example.com\/author-avatar.jpg"/);
  assert.match(header, /lucide-utensils/);
  assert.doesNotMatch(header, /h-20 w-20/);
  assert.doesNotMatch(header, /src="https:\/\/example.com\/first.jpg"/);
  assert.match(header, /href="\/admin-panel\/users\/7"/);
  assert.match(header, /href="\/admin-panel\/businesses\/9"/);
  assert.equal((header.match(/lucide-external-link/g) ?? []).length, 2);
  assert.match(header, /border-info\/25 bg-info\/10 text-info/);
  assert.doesNotMatch(header, />Business cover</);
  assert.match(header, /Food and Dining/);
  assert.match(header, /Restaurants/);
  assert.match(header, /Oct 10, 2026 ·/);
  assert.match(html, /Review photos/);
  const reviewContent = html.match(/<section aria-label="Review content" class="[^"]*rounded-lg border border-stroke bg-surface p-4[^"]*">(.*?)<\/section>/s)?.[1];
  assert.ok(reviewContent);
  assert.doesNotMatch(reviewContent, /lucide-quote|REVIEW CONTENT/);
  assert.match(reviewContent, /lucide-thumbs-up/);
  assert.doesNotMatch(reviewContent, /lucide-heart/);
  assert.match(reviewContent.replaceAll("<!-- -->", ""), /12 found this helpful/);
  assert.match(reviewContent.replaceAll("<!-- -->", ""), /Review photos \(2\)/);
  assert.doesNotMatch(reviewContent.replaceAll("<!-- -->", ""), />2 photos</);
  assert.match(reviewContent, /Edited Oct 11, 2026 ·/);
  assert.match(reviewContent, /Merchant Response/);
  assert.match(reviewContent, /border-l-2 border-l-primary/);
  assert.match(reviewContent, /Thank you for sharing your visit/);
  assert.match(reviewContent, /dateTime="2026-10-11T02:15:00Z"/);
  assert.doesNotMatch(header, /12 likes|2 photos|Edited|Merchant reply/);
  assert.doesNotMatch(html, /Submission context/);
  assert.match(html, /Photo 1/);
  assert.match(html, /Photo 2/);
  assert.match(html, /aria-label="View review photo 1"/);
  assert.match(html, /aria-label="View review photo 2"/);
  assert.doesNotMatch(html, /<a[^>]+href="https:\/\/example.com\/(first|second)\.jpg"/);
  assert.match(html, /Harassment/);
  assert.match(html, /Violence/);
  assert.match(html, /No findings/);
  assert.equal(
    (html.match(/flex items-start gap-3 rounded-lg border p-3 border-danger\/25 bg-danger\/10/g) ?? []).length,
    2,
  );
  assert.match(html, /Approve &amp; Publish/);
  assert.match(html, /Reject Review/);
  assert.match(html, /aria-pressed="true"/);
});

test("header uses compact business image and existing identity fallbacks", () => {
  const detail = {
    ...heldReview,
    business: {
      ...heldReview.business,
      cover_photo_url: "https://example.com/business-cover.jpg",
    },
    text: "Text only review",
    photos: [
      {
        id: 12,
        photo_url: "https://example.com/first.jpg",
        checked: true,
        flagged_categories: [],
      },
    ],
    moderation: {
      text_checked: true,
      text_flagged_categories: ["harassment"],
      provider_unavailable: false,
    },
  };
  const url = "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42";
  const coverHtml = renderPage(url, { list: heldList, detail });
  const coverHeader = coverHtml.match(/<header[^>]*>(.*?)<\/header>/s)?.[1];

  assert.match(coverHeader, /src="https:\/\/example.com\/business-cover.jpg"/);
  assert.match(coverHeader, /h-6 w-6 shrink-0 rounded-full/);
  assert.match(coverHeader, /alt=""/);
  assert.doesNotMatch(coverHeader, /h-20 w-20/);
  assert.doesNotMatch(coverHeader, /src="https:\/\/example.com\/first.jpg"/);
  assert.doesNotMatch(coverHeader, />Business cover</);
  assert.doesNotMatch(coverHtml, /Merchant Response/);

  const noCoverDetail = {
    ...detail,
    business: { ...detail.business, cover_photo_url: null },
  };
  const noCoverHtml = renderPage(url, {
    list: heldList,
    detail: noCoverDetail,
  });
  const noCoverHeader = noCoverHtml.match(/<header[^>]*>(.*?)<\/header>/s)?.[1];

  assert.match(noCoverHeader, /lucide-store/);
  assert.match(noCoverHeader, /h-6 w-6 shrink-0 rounded-full/);
  assert.match(noCoverHeader, /explorer-avatar-1.webp/);
  assert.doesNotMatch(noCoverHeader, /src="https:\/\/example.com\/first.jpg"/);
  assert.doesNotMatch(noCoverHeader, />Business cover</);
});

test("provider failure copy follows retry state without a manual retry action", () => {
  const baseDetail = {
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
  const url = "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42";
  const cases = [
    [
      "retrying",
      "The automated safety check could not be completed. Another attempt may run automatically. You can still review the content directly before deciding.",
    ],
    [
      "exhausted",
      "The automated safety check could not be completed after multiple attempts. Review the content directly before deciding.",
    ],
    [
      null,
      "The automated safety check could not be completed. Review the content directly before deciding.",
    ],
  ];

  for (const [retryState, expectedCopy] of cases) {
    const detail = {
      ...baseDetail,
      moderation: { ...baseDetail.moderation, retry_state: retryState },
    };
    const html = renderPage(url, {
      list: { ...heldList, items: [detail] },
      detail,
    });

    assert.match(html, /Automated moderation unavailable/);
    assert.match(html, /Check unavailable/);
    assert.match(html, /border-warning\/30 bg-warning\/10 p-3/);
    assert.match(html, /border-warning\/30 bg-warning\/10/);
    assert.ok(html.includes(expectedCopy));
    assert.match(html, /Not checked/);
    assert.doesNotMatch(html, /potential concerns/);
    assert.doesNotMatch(html, /<button[^>]*>Retry<\/button>/);
  }
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
  assert.match(html, /border-danger\/25 bg-danger\/10/);
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

  for (const label of ["Review Moderation", "Suspicious", "Reported", "Disputes"]) {
    assert.match(suspicious, new RegExp(label));
  }

  assert.match(suspicious, /Suspicious Reviews/);
  assert.match(suspicious, /Select a review/);
  assert.match(reported, /Reported Reviews/);
  assert.match(reported, /Search reported reviews/);
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
  reliability_check_outcome: "checked",
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
  assert.match(html, />Filter</);
  assert.match(html, /Sort suspicious reviews: Newest first/);
  assert.match(html, /Newest first/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /Approve &amp; Publish|Reject review|Remove Review/);
});

test("Suspicious queue shows an active signal filter chip and shared sort control", () => {
  const html = renderToString(React.createElement(SuspiciousQueueFilters, {
    search: "Cebu Cafe",
    signal: "duplicate_content",
    ordering: "oldest",
    onSearchChange: () => {},
    onSignalChange: () => {},
    onOrderingChange: () => {},
  })).replaceAll("<!-- -->", "");

  assert.match(html, /Reliability signal: Duplicate Content/);
  assert.match(html, /Remove Reliability signal filter/);
  assert.match(html, /aria-label="Sort suspicious reviews: Oldest first"/);
  assert.match(html, /value="Cebu Cafe"/);
});

test("Suspicious queue uses review identity and neutral context without likes", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousList: {
        items: [{
          ...suspiciousReview,
          author: {
            ...suspiciousReview.author,
            avatar_url: "https://example.com/avatar.jpg",
          },
          business: {
            ...suspiciousReview.business,
            cover_photo_url: "https://example.com/cover.jpg",
          },
          has_reply: true,
          is_edited: true,
          like_count: 12,
        }],
        pagination: { page: 1, total_pages: 1 },
      },
    },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];

  assert.ok(queue);
  assert.match(queue, /src="https:\/\/example.com\/avatar.jpg"/);
  assert.match(queue, /src="https:\/\/example.com\/cover.jpg"/);
  assert.doesNotMatch(queue, /Review photo thumbnail/);
  assert.match(queue, /border-l-info bg-info\/5/);
  assert.match(queue, /focus-visible:outline-info/);
  assert.match(queue, /Duplicate Content/);
  assert.match(queue, /Rapid Submission/);
  assert.match(queue, /bg-surface-muted/);
  assert.match(queue.replaceAll("<!-- -->", ""), /2 photos/);
  assert.match(queue, /Merchant replied/);
  assert.match(queue, /Edited/);
  assert.doesNotMatch(queue, /12 likes/);
});

test("Suspicious queue uses the API cover and keeps the Store fallback", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious",
    {
      suspiciousList: {
        items: [
          {
            ...suspiciousReview,
            business: {
              ...suspiciousReview.business,
              cover_photo_url: "https://example.com/queue-cover.jpg",
            },
          },
          {
            ...suspiciousReview,
            id: 84,
            business: {
              ...suspiciousReview.business,
              cover_photo_url: null,
            },
          },
        ],
        pagination: { page: 1, total_pages: 1 },
      },
    },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];

  assert.match(queue, /src="https:\/\/example.com\/queue-cover.jpg"/);
  assert.match(queue, /lucide-store/);
});

test("Suspicious related activity gives repeated records one target per signal", () => {
  const related = {
    id: 41,
    status: "published",
    text: "Related review",
    author: suspiciousReview.author,
    business: suspiciousReview.business,
  };
  const html = renderToString(React.createElement(
    MemoryRouter,
    null,
    React.createElement(SuspiciousCurrentActivity, {
      review: {
        reasons: ["duplicate_content", "rapid_submission"],
        current_related_activity: {
          referenced_reviews: [related],
          duplicate_content: { reviews: [related, related] },
          rapid_submission: { reviews: [related, related] },
        },
      },
    }),
  ));

  assert.equal((html.match(/id="related-review-duplicate_content-41"/g) ?? []).length, 1);
  assert.equal((html.match(/id="related-review-rapid_submission-41"/g) ?? []).length, 1);
  assert.equal((html.match(/tabindex="-1"/g) ?? []).length, 2);
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
            observed_at: "2026-10-10T09:00:00Z",
            prior_match_count: 2,
            basis: "same_user",
            matched_reviews: [
              { id: 41, available: true },
              { id: 47, available: false },
            ],
          },
          rapid_submission: {
            observed_at: "2026-10-10T09:00:00Z",
            review_count: 11,
            window_hours: 24,
          },
        },
        current_related_activity: {
          duplicate_content: { review_count: 0, reviews: [] },
          rapid_submission: { review_count: 0, reviews: [] },
          referenced_reviews: [{
            id: 41,
            author: suspiciousReview.author,
            business: suspiciousReview.business,
            status: "published",
            text: "Original matching review",
            submitted_at: "2026-10-09T09:00:00Z",
          }],
        },
      },
    },
  );
  assert.match(html, /Suspicious Activity Signals/);
  assert.match(html, /Reliability Check: <!-- -->Completed/);
  assert.match(html, /Why This Review Was Flagged/);
  assert.match(html, /Stored evidence from when each suspicious activity signal was detected/);
  assert.equal((html.match(/Detected during review submission/g) ?? []).length, 2);
  assert.match(html, /The same normalized review text was detected in previous reviews/);
  assert.match(html, /Prior matches/);
  assert.match(html, /Reviews detected/);
  assert.match(html, /Time window/);
  assert.match(html, /Detection-time matching reviews/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Current Related Activity/);
  assert.match(html, /Live records available now/);
  assert.match(html, /Original matching review/);
  assert.match(html, /data-suspicious-investigation-scroll="true"/);
  assert.match(html, /id="related-review-duplicate_content-41" tabindex="-1"/);
  assert.match(html, /focus:outline-info\/40/);
  assert.match(html, /Present at detection · No longer related/);
  assert.match(html, /No related records are currently available/);
  assert.doesNotMatch(html, /Merchant Response/);
  assert.doesNotMatch(html, /Highly similar content|private-installation/);
});

test("Suspicious detail distinguishes unavailable and historical reliability checks", () => {
  for (const [outcome, label] of [
    ["unavailable", "Unavailable"],
    ["unknown", "Historical outcome unknown"],
  ]) {
    const html = renderPage(
      "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
      {
        suspiciousDetail: {
          ...suspiciousReview,
          reliability_check_outcome: outcome,
          text: "Review with a historical reliability signal",
          status: "published",
          photos: [],
          detection_evidence: {},
          current_related_activity: {},
        },
      },
    );

    assert.match(html.replaceAll("<!-- -->", ""), new RegExp(`Reliability Check: ${label}`));
    assert.match(html, /Suspicious Activity Signals/);
    assert.doesNotMatch(html, /Reject Review|Approve &amp; Publish/);
  }
});

test("Suspicious edit duplicate uses stored detection context, not latest edit time", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousDetail: {
        ...suspiciousReview,
        reasons: ["duplicate_content"],
        text: "Exact repeated review text",
        status: "published",
        photos: [],
        is_edited: true,
        edited_at: "2026-10-12T09:00:00Z",
        detection_evidence: {
          duplicate_content: {
            observed_at: "2026-10-11T09:00:00Z",
            detected_during: "edit",
            prior_match_count: 2,
            basis: "same_user",
          },
        },
        current_related_activity: {
          duplicate_content: { review_count: 0, reviews: [] },
        },
      },
    },
  );

  assert.match(html, /Detected during review edit/);
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /Observed\s*<time[^>]*>Oct 11, 2026/,
  );
  assert.doesNotMatch(html, /Detection-time evidence recorded when the review was submitted/);
});

test("Suspicious legacy evidence does not claim an unknown detection stage or window", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousDetail: {
        ...suspiciousReview,
        reasons: ["duplicate_content"],
        text: "Exact repeated review text",
        status: "published",
        photos: [],
        detection_evidence: {
          duplicate_content: {
            prior_match_count: 2,
            basis: "same_user",
          },
        },
        current_related_activity: {
          duplicate_content: {
            review_count: 0,
            reviews: [],
            window_unavailable: true,
          },
        },
      },
    },
  );

  assert.match(html, /Detection stage not recorded/);
  assert.match(html, /Current matches cannot be scoped to the original detection window/);
  assert.doesNotMatch(html, /Detected during review submission|No related records currently available/);
});

test("Suspicious detail identifies missing historical evidence", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousDetail: {
        ...suspiciousReview,
        text: "Review with legacy signals",
        status: "published",
        photos: [],
        detection_evidence: {},
        current_related_activity: {},
      },
    },
  );

  assert.match(html, /Detection-time details were not recorded for this historical review/);
  assert.doesNotMatch(html, /Detected during review submission|Merchant Response/);
});

test("Suspicious detail shares the compact blurred review header", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousDetail: {
        ...suspiciousReview,
        text: "Exact repeated review text",
        status: "published",
        photos: [],
        detection_evidence: {},
        current_related_activity: {},
      },
    },
  );
  const stickyBar = html.match(/pointer-events-none sticky top-0 z-30 h-0(.*?)<\/div><\/div>/s)?.[0];

  assert.ok(stickyBar);
  assert.match(stickyBar, /bg-background\/80/);
  assert.match(stickyBar, /backdrop-blur-md/);
  assert.match(stickyBar, /Review #<!-- -->83/);
  assert.match(stickyBar, /Ana Cruz · Cebu Cafe/);
  assert.match(stickyBar, /Published/);
  assert.match(stickyBar, /aria-hidden="true"/);
});

test("Suspicious detail uses linked review identity and content context", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=suspicious&suspicious_id=83",
    {
      suspiciousDetail: {
        ...suspiciousReview,
        author: {
          ...suspiciousReview.author,
          avatar_url: "https://example.com/avatar.jpg",
        },
        business: {
          ...suspiciousReview.business,
          cover_photo_url: "https://example.com/cover.jpg",
          cluster_name: "Food and Dining",
          category_name: "Restaurants",
        },
        text: "Full review text",
        status: "published",
        photos: [{ id: 1, photo_url: "https://example.com/photo.jpg" }],
        like_count: 4,
        is_edited: true,
        edited_at: "2026-10-11T01:42:00Z",
        reply: {
          text: "Thank you for the feedback.",
          created_at: "2026-10-11T02:15:00Z",
        },
        detection_evidence: {},
        current_related_activity: {},
      },
      clusters: [{ name: "Food and Dining", icon: "utensils" }],
    },
  );
  const header = html.match(/<header[^>]*>(.*?)<\/header>/s)?.[1];

  assert.ok(header);
  assert.match(header, /Review #<!-- -->83/);
  assert.match(header, /flex flex-wrap items-start justify-between/);
  assert.match(header, /Published/);
  assert.match(header, /src="https:\/\/example.com\/avatar.jpg"/);
  assert.match(header, /src="https:\/\/example.com\/cover.jpg"/);
  assert.match(header, /href="\/admin-panel\/users\/7"/);
  assert.match(header, /href="\/admin-panel\/businesses\/9"/);
  assert.equal((header.match(/lucide-external-link/g) ?? []).length, 2);
  assert.match(header, /lucide-utensils/);
  assert.match(header, /Restaurants/);
  assert.match(header, /Oct 10, 2026 ·/);
  assert.match(html, /Full review text/);
  assert.match(html, /Review photos \(<!-- -->1<!-- -->\)/);
  assert.match(html, /View review photo 1/);
  assert.match(html, /lucide-thumbs-up/);
  assert.match(html.replaceAll("<!-- -->", ""), /4 found this helpful/);
  assert.match(html, /Edited Oct 11, 2026 ·/);
  assert.match(html, /Merchant Response/);
  assert.match(html, /Thank you for the feedback/);
  assert.match(html, /Why This Review Was Flagged/);
  assert.match(html, /Current Related Activity/);
  assert.doesNotMatch(html, /User \/ Business Context/);
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
  assert.match(html, /Distinct accounts<\/dt>\s*<dd[^>]*>4<\/dd>/);
  assert.match(
    html.replaceAll("<!-- -->", ""),
    /2<\/span>\s*accounts currently retained/,
  );
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

const reportedReview = {
  id: 91,
  author: { id: 7, first_name: "Ana", last_name: "Cruz" },
  business: { id: 9, name: "Cebu Cafe" },
  text_preview: "Reported content preview",
  first_photo_url: "https://example.com/review.jpg",
  photo_count: 2,
  submitted_at: "2026-10-10T09:00:00Z",
  status: "published",
  pending_report_count: 3,
  reason_counts: { spam: 1, abuse: 2, misinformation: 0, other: 0 },
  first_pending_at: "2026-10-11T09:00:00Z",
  latest_pending_at: "2026-10-12T09:00:00Z",
  needs_attention: true,
};

const reportedList = {
  items: [reportedReview],
  pagination: {
    page: 1,
    total_items: 1,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  },
};

test("Reported tab renders one review group, counts, reasons, and filters", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported",
    { reportedList },
  );

  assert.equal((html.match(/Reported content preview/g) ?? []).length, 1);
  assert.match(html, /3<!-- --> pending <!-- -->reports/);
  assert.doesNotMatch(html, /Needs Attention/);
  assert.match(html, /Abuse/);
  assert.match(html, /Spam/);
  assert.match(html, />Filter</);
  assert.match(html, /Most Reported/);
  assert.match(html, /aria-label="Sort reported reviews: Most Reported"/);
  assert.match(html, /aria-haspopup="menu" aria-expanded="false"/);
  assert.match(html, /Search reported reviews/);
  assert.match(html, /Select a reported review/);
});

test("a Reported deep link selects the review's investigation", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: { ...reportedReview, text: "Full reported review", photos: [], reports: [] } },
  );

  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Full reported review/);
});

test("a resolved Reported deep link does not invent an actionable case", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList: { ...reportedList, items: [] }, reportedGone: 91 },
  );

  assert.match(html, /No pending reports for this review/);
  assert.match(html, /Back to reported reviews/);
  assert.doesNotMatch(html, /Admin Decision/);
});

test("Reported queue reuses filter chips for reason and review status", () => {
  const html = renderToString(React.createElement(ReportedQueueFilters, {
    search: "Cebu Cafe",
    reason: "off_topic",
    status: "rejected",
    ordering: "newest",
    onSearchChange: () => {},
    onReasonChange: () => {},
    onStatusChange: () => {},
    onOrderingChange: () => {},
  })).replaceAll("<!-- -->", "");

  assert.match(html, /Report reason: Off-topic or Irrelevant/);
  assert.match(html, /Review status: Rejected/);
  assert.match(html, /Remove Report reason filter/);
  assert.match(html, /Remove Review status filter/);
  assert.match(html, /aria-label="Sort reported reviews: Newest Report"/);
  assert.doesNotMatch(html, /<select[^>]*aria-label="Sort reported reviews"/);
  assert.match(html, /value="Cebu Cafe"/);
});

test("Reported queue keeps report priority and neutral review context", () => {
  const review = {
    ...reportedReview,
    has_reply: true,
    is_edited: true,
    like_count: 8,
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    {
      reportedList: { ...reportedList, items: [review] },
      reportedBusinessDetails: [{ id: review.business.id, cover_photo_url: "https://example.com/business-cover.jpg" }],
    },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];

  assert.ok(queue);
  assert.match(queue, /border-l-info bg-info\/5/);
  assert.match(queue, /focus-visible:outline-info/);
  assert.doesNotMatch(queue, /Review photo thumbnail/);
  assert.match(queue, /3<!-- --> pending <!-- -->reports/);
  assert.doesNotMatch(queue, /Needs Attention|lucide-circle-alert/);
  assert.match(queue, /text-amber-700[^>]*>.*?lucide-flag/s);
  assert.match(queue, /class="mt-2 line-clamp-2 text-sm leading-5 text-text-primary"/);
  assert.doesNotMatch(queue, /bg-surface-secondary px-2\.5 py-2/);
  assert.match(queue, /rounded-md border border-stroke bg-surface-muted/);
  assert.match(queue, /Latest report: Oct 12, 2026/);
  assert.match(queue, /Reported \d+[dhm] ago/);
  assert.match(queue, /src="https:\/\/example.com\/business-cover.jpg"/);
  assert.match(queue, /Review #<!-- -->91/);
  assert.doesNotMatch(queue, /Published/);
  assert.match(queue, /Abuse/);
  assert.match(queue, /Spam/);
  assert.match(queue.replaceAll("<!-- -->", ""), /2 photos/);
  assert.match(queue, /Merchant replied/);
  assert.match(queue, /Edited/);
  assert.doesNotMatch(queue, /8 likes/);
});

test("Reported queue keeps short and long excerpts compact across selected states", () => {
  const longReview = {
    ...reportedReview,
    text_preview: "A long report preview ".repeat(15),
    reason_counts: { spam: 1, abuse: 2, misinformation: 1, other: 1 },
    pending_report_count: 5,
  };
  const shortReview = {
    ...reportedReview,
    id: 92,
    text_preview: "Short review",
    first_photo_url: null,
    photo_count: 0,
    reason_counts: { spam: 1, abuse: 0, misinformation: 0, other: 0 },
    pending_report_count: 1,
    needs_attention: false,
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList: { ...reportedList, items: [longReview, shortReview] } },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];

  assert.ok(queue);
  assert.equal((queue.match(/class="mt-2 line-clamp-2 text-sm leading-5 text-text-primary"/g) ?? []).length, 2);
  assert.equal((queue.match(/line-clamp-2/g) ?? []).length, 2);
  assert.match(queue, /border-l-info bg-info\/5/);
  assert.match(queue, /border-l-transparent bg-background/);
  assert.match(queue, /Short review/);
  assert.match(queue, /\+<!-- -->2<!-- --> more/);
  assert.match(queue, /5<!-- --> pending <!-- -->reports/);
  assert.match(queue, /1<!-- --> pending <!-- -->report/);
  assert.doesNotMatch(queue, /Needs Attention|border-warning\/30 bg-warning\/10/);
});

test("Reported queue keeps identity and report evidence readable with missing images", () => {
  const review = {
    ...reportedReview,
    author: {
      id: 7,
      first_name: "A very long reviewer name that should truncate",
      last_name: "Cruz",
    },
    business: {
      id: 9,
      name: "A very long business name that should truncate cleanly",
    },
    status: "rejected",
    first_photo_url: null,
    photo_count: 0,
    has_reply: false,
    is_edited: false,
    reason_counts: { spam: 1, abuse: 2, misinformation: 1, other: 1 },
    pending_report_count: 5,
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported",
    { reportedList: { ...reportedList, items: [review] } },
  );
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];
  const queueItem = queue?.match(/<button[^>]*aria-pressed="false"[^>]*>.*?<\/button>/s)?.[0];

  assert.ok(queueItem);
  assert.match(queueItem, /h-8 w-8[^>]*rounded-full/);
  assert.match(queueItem, /h-6 w-6[^>]*rounded-md/);
  assert.match(queueItem, /lucide-store/);
  assert.match(queueItem, /Review #<!-- -->91/);
  assert.match(queueItem, /· Rejected/);
  assert.match(queueItem, /truncate text-sm font-semibold/);
  assert.match(queueItem, /min-w-0 truncate/);
  assert.match(queueItem, /\+<!-- -->2<!-- --> more/);
  assert.ok(queueItem.indexOf("Abuse or Harassment") < queueItem.indexOf("Spam"));
  assert.doesNotMatch(queueItem, /Merchant replied|Edited|Published|Review photo thumbnail/);
  assert.doesNotMatch(queueItem, /bg-surface-secondary px-2\.5 py-2/);
});

test("Reported detail shows report evidence and one review-level decision", () => {
  const detail = {
    ...reportedReview,
    text: "Full review content under investigation",
    photos: [{ id: 1, photo_url: "https://example.com/review.jpg" }],
    reports: [
      { id: 11, type: "abuse", status: "pending", created_at: "2026-10-11T09:00:00Z", explanation: "A private phone number\nwas posted.", admin_notes: null },
      { id: 12, type: "spam", status: "pending", created_at: "2026-10-12T09:00:00Z", admin_notes: null },
      { id: 13, type: "abuse", status: "rejected", created_at: "2026-10-11T10:00:00Z", admin_notes: "Not supported by the review content." },
    ],
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: detail },
  );
  const normalizedHtml = html.replaceAll("<!-- -->", "");

  assert.match(html, /Full review content under investigation/);
  assert.match(html, /View review photo 1/);
  assert.doesNotMatch(html, /<a[^>]+href="https:\/\/example.com\/review.jpg"/);
  assert.match(html, /Community Reports/);
  assert.match(html, /Individual Reports/);
  assert.match(normalizedHtml, /3 reports/);
  assert.match(html, /Community reports submitted about this review/);
  assert.match(html, /divide-y divide-stroke overflow-hidden rounded-lg border border-stroke bg-background/);
  assert.match(html, /Reporter&#x27;s explanation/);
  assert.match(html, /A private phone number\nwas posted\./);
  assert.equal((html.match(/Reporter&#x27;s explanation/g) ?? []).length, 1);
  assert.match(html, /report-explanation-11/);
  assert.match(normalizedHtml, /#11/);
  assert.match(normalizedHtml, /#12/);
  assert.match(html, /line-clamp-3/);
  assert.doesNotMatch(html, /rounded-lg border border-stroke bg-background p-4/);
  assert.doesNotMatch(html, /Reporter name|Reporter avatar/);
  assert.match(html, /Previous Decisions/);
  assert.match(html, /Admin Decision/);
  assert.match(normalizedHtml, /All 3 pending reports will be resolved together/);
  assert.match(html, /sm:justify-end/);
  assert.equal((html.match(/Keep Review/g) ?? []).length, 1);
  assert.equal((html.match(/Reject Review/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Dismiss Report|Confirm Report/);
});

test("Reported evidence keeps long explanations as safe text and omits empty explanations", () => {
  const longExplanation = `${"Details about the reported content. ".repeat(10)}<script>alert(1)</script>`;
  const detail = {
    ...reportedReview,
    text: "Reported review content",
    photos: [],
    reports: [
      { id: 21, type: "other", status: "pending", created_at: "2026-10-11T09:00:00Z", explanation: longExplanation },
      { id: 22, type: "spam", status: "pending", created_at: "2026-10-12T09:00:00Z", explanation: null },
    ],
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: detail },
  );
  const reports = html.match(/<section aria-label="Individual reports"[^>]*>(.*?)<\/section>/s)?.[1];

  assert.ok(reports);
  assert.match(reports, /divide-y divide-stroke/);
  assert.match(reports, /report-explanation-21/);
  assert.doesNotMatch(reports, /report-explanation-22/);
  assert.match(reports, /line-clamp-3/);
  assert.match(reports, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(reports, /<script>/);
  assert.doesNotMatch(reports, /Dismiss Report|Confirm Report/);
});

test("Reported detail shares the compact blurred review header", () => {
  const detail = {
    ...reportedReview,
    text: "Reported review content",
    photos: [],
    reports: [],
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: detail },
  );
  const stickyBar = html.match(/pointer-events-none sticky top-0 z-30 h-0(.*?)<\/div><\/div>/s)?.[0];

  assert.ok(stickyBar);
  assert.match(stickyBar, /bg-background\/80/);
  assert.match(stickyBar, /backdrop-blur-md/);
  assert.match(stickyBar, /Review #<!-- -->91/);
  assert.match(stickyBar, /Ana Cruz · Cebu Cafe/);
  assert.match(stickyBar, /Published/);
  assert.match(stickyBar, /aria-hidden="true"/);
});

test("Reported summary retains its soft attention badge without a queue badge", () => {
  const detail = {
    ...reportedReview,
    text: "Reported review content",
    photos: [],
    reports: [],
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: detail },
  );

  assert.equal((html.match(/border-amber-200\/70 bg-amber-50/g) ?? []).length, 1);
  assert.equal((html.match(/lucide-circle-alert/g) ?? []).length, 1);
});

test("Reported detail uses linked review identity and full content context", () => {
  const detail = {
    ...reportedReview,
    author: {
      ...reportedReview.author,
      avatar_url: "https://example.com/avatar.jpg",
    },
    business: {
      ...reportedReview.business,
      cover_photo_url: "https://example.com/cover.jpg",
      cluster_name: "Food and Dining",
      category_name: "Restaurants",
    },
    text: "Full reported review text",
    photos: [{ id: 1, photo_url: "https://example.com/review.jpg" }],
    like_count: 6,
    is_edited: true,
    edited_at: "2026-10-11T01:42:00Z",
    reply: {
      text: "We will follow up with the guest.",
      created_at: "2026-10-11T02:15:00Z",
    },
    reports: [{
      id: 11,
      type: "abuse",
      status: "pending",
      created_at: "2026-10-11T09:00:00Z",
      admin_notes: null,
    }],
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    {
      reportedList,
      reportedDetail: detail,
      clusters: [{ name: "Food and Dining", icon: "utensils" }],
    },
  );
  const header = html.match(/<header[^>]*>(.*?)<\/header>/s)?.[1];

  assert.ok(header);
  assert.match(header, /Review #<!-- -->91/);
  assert.match(header, /flex flex-wrap items-start justify-between/);
  assert.match(header, /Published/);
  assert.match(header, /border-success\/25 bg-success\/10 text-success/);
  assert.match(header, /src="https:\/\/example.com\/avatar.jpg"/);
  assert.match(header, /src="https:\/\/example.com\/cover.jpg"/);
  assert.match(header, /href="\/admin-panel\/users\/7"/);
  assert.match(header, /href="\/admin-panel\/businesses\/9"/);
  assert.equal((header.match(/lucide-external-link/g) ?? []).length, 2);
  assert.match(header, /lucide-utensils/);
  assert.match(header, /Restaurants/);
  assert.match(header, /Oct 10, 2026 ·/);
  assert.doesNotMatch(html, /lucide-quote|REVIEW CONTENT/);
  assert.match(html, /lucide-thumbs-up/);
  assert.match(html.replaceAll("<!-- -->", ""), /6 found this helpful/);
  assert.match(html, /Edited Oct 11, 2026 ·/);
  assert.match(html, /Merchant Response/);
  assert.match(html, /We will follow up with the guest/);
  assert.match(html, /Community Reports/);
  assert.match(html, /Individual Reports/);
  assert.match(html, /Keep Review/);
  assert.match(html, /Reject Review/);
  assert.doesNotMatch(html, /Dismiss Report|Confirm Report/);
  assert.doesNotMatch(html, />Report Review #|>Author<br|>Business<br|>Submitted<br/);
});

test("Community Reports shows only pending reasons and avoids duplicate timestamps", () => {
  const single = {
    ...reportedReview,
    pending_report_count: 1,
    reason_counts: { spam: 1, abuse: 0, misinformation: 0, other: 0 },
    first_pending_at: "2026-10-12T09:00:00Z",
    latest_pending_at: "2026-10-12T09:00:00Z",
    needs_attention: false,
  };
  const renderSummary = (review) => {
    const html = renderPage(
      "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
      { reportedList, reportedDetail: review },
    );
    return html.match(/<section aria-label="Community report summary"[^>]*>(.*?)<\/section>/s)?.[1]
      ?.replaceAll("<!-- -->", "");
  };

  const singleSummary = renderSummary(single);
  assert.ok(singleSummary);
  assert.match(singleSummary, /1 pending report/);
  assert.match(singleSummary, /Spam/);
  assert.doesNotMatch(singleSummary, /Abuse or Harassment|False or Misleading Information|Off-topic or Irrelevant|Personal or Private Information|Other/);
  assert.match(singleSummary, /Reported Oct 12, 2026/);
  assert.doesNotMatch(singleSummary, /First report:|Latest report:/);

  const multipleSummary = renderSummary(reportedReview);
  assert.match(multipleSummary, /First report: Oct 11, 2026/);
  assert.match(multipleSummary, /Latest report: Oct 12, 2026/);
  assert.doesNotMatch(multipleSummary, /False or Misleading Information/);

  const sameTimeSummary = renderSummary({
    ...reportedReview,
    latest_pending_at: reportedReview.first_pending_at,
  });
  assert.match(sameTimeSummary, /Reported Oct 11, 2026/);
  assert.doesNotMatch(sameTimeSummary, /First report:|Latest report:/);
});

test("Reported decision stays inside the detail scroll panel with existing actions", () => {
  const published = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: reportedReview },
  );
  assert.match(published, /overflow-y-auto lg:max-h-\[calc\(100vh-260px\)\]/);
  assert.match(published, /<\/article><section aria-label="Admin decision" class="sticky bottom-0 z-20 border-t border-stroke bg-background/);
  assert.match(published, /Keep Review/);
  assert.match(published, /Reject Review/);

  const rejected = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList, reportedDetail: { ...reportedReview, status: "rejected", pending_report_count: 1 } },
  );
  assert.match(rejected, /Dismiss Reports/);
  assert.match(rejected, /Confirm Reports/);
  assert.match(rejected, /1 remaining pending report should be confirmed or dismissed/);
  assert.doesNotMatch(rejected, /Keep Review|Reject Review/);
});

test("Rejected reviews with pending sibling reports stay inspectable", () => {
  const rejected = {
    ...reportedReview,
    status: "rejected",
    pending_report_count: 1,
    reason_counts: { spam: 1, abuse: 0, misinformation: 0, other: 0 },
    needs_attention: false,
    text: "Previously rejected review",
    photos: [],
    reports: [{ id: 14, type: "spam", status: "pending", created_at: "2026-10-12T09:00:00Z", admin_notes: null }],
  };
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedList: { ...reportedList, items: [rejected] }, reportedDetail: rejected },
  );

  assert.match(html, /Rejected/);
  const header = html.match(/<header[^>]*>(.*?)<\/header>/s)?.[1];
  assert.ok(header);
  assert.match(header, /border border-danger\/25 bg-danger\/10 text-red-700/);
  assert.doesNotMatch(header, /bg-slate-200 text-slate-700/);
  const queue = html.match(/<aside[^>]*>(.*?)<\/aside>/s)?.[1];
  assert.ok(queue);
  assert.match(queue, /Review #<!-- -->91/);
  assert.match(queue, /· Rejected/);
  assert.match(queue, /lucide-store/);
  assert.doesNotMatch(queue, /bg-emerald-500|Published/);
  assert.match(html, /pointer-events-none sticky top-0 z-30 h-0/);
  assert.match(html, /aria-hidden="true" class="flex h-14[^"]*backdrop-blur-md/);
  assert.match(html, /Previously rejected review/);
  assert.match(html, /lucide-store/);
  assert.match(html, /rounded-full border border-stroke object-cover/);
  assert.match(html, /Confirm Reports/);
  assert.match(html, /Dismiss Reports/);
  assert.doesNotMatch(html, /Keep Review|Reject Review/);
  assert.match(html, /bg-primary text-white/);
  assert.doesNotMatch(html, /Needs Attention/);
});

test("review-level dialogs explain both decisions and require notes", () => {
  const baseProps = {
    target: {
      reviewId: 91,
      reviewStatus: "published",
      decision: "reject",
    },
    notes: "Too short",
    onNotesChange: () => {},
    onClose: () => {},
    onConfirm: () => {},
    pending: false,
    error: null,
  };
  const published = renderToString(React.createElement(DecisionDialog, baseProps));
  assert.match(published, /Reject this review\?/);
  assert.match(published, /all pending community reports/);
  assert.match(published, /no longer remain published/);
  assert.match(published, /at least 20 characters/);
  assert.match(published, /disabled=""/);

  const rejected = renderToString(React.createElement(DecisionDialog, {
    ...baseProps,
    target: { ...baseProps.target, reviewStatus: "rejected", decision: "confirm" },
    notes: "Confirmed after reviewing content.",
  }));
  assert.match(rejected, /Confirm these reports\?/);
  assert.match(rejected, /review will remain rejected/);
  assert.match(rejected, /Confirm Reports/);
  assert.doesNotMatch(rejected, /Reject Review|bg-red-600/);

  const dismissed = renderToString(React.createElement(DecisionDialog, {
    ...baseProps,
    target: { ...baseProps.target, reviewStatus: "rejected", decision: "dismiss" },
    notes: "Reports dismissed after content inspection.",
  }));
  assert.match(dismissed, /Dismiss these reports\?/);
  assert.match(dismissed, /review will remain rejected/);
  assert.match(dismissed, /Dismiss Reports/);
  assert.doesNotMatch(dismissed, /Keep Review|Reject Review/);

  const kept = renderToString(React.createElement(DecisionDialog, {
    ...baseProps,
    target: { ...baseProps.target, decision: "keep" },
    notes: "No violation after reviewing content.",
  }));
  assert.match(kept, /Keep this review\?/);
  assert.match(kept, /remain published/);
  assert.match(kept, /all pending community reports/);
});

test("review decision dialog blocks duplicate submission and preserves retry context", () => {
  const props = {
    target: { reviewId: 91, reviewStatus: "published", decision: "reject" },
    notes: "Confirmed after reviewing all reports.",
    onNotesChange: () => {},
    onClose: () => {},
    onConfirm: () => {},
    pending: true,
    error: null,
  };
  const pending = renderToString(React.createElement(DecisionDialog, props));
  assert.match(pending, /textarea[^>]*disabled=""/);
  assert.match(pending, /Reject Review/);
  assert.equal((pending.match(/disabled=""/g) ?? []).length >= 3, true);

  const failed = renderToString(React.createElement(DecisionDialog, {
    ...props,
    pending: false,
    error: { response: { data: { message: "Decision could not be saved." } } },
  }));
  assert.match(failed, /Decision could not be saved/);
  assert.match(failed, /Review #91/);
  assert.doesNotMatch(failed, /textarea[^>]*disabled=""/);
});

test("Reported loading, empty, list error, and detail error states render", () => {
  assert.match(renderPage("/admin-panel/moderation-integrity?tab=reported"), /Loading reported reviews/);
  assert.match(renderPage(
    "/admin-panel/moderation-integrity?tab=reported",
    { reportedList: { ...reportedList, items: [] } },
  ), /No reported reviews currently need attention/);
  assert.match(renderPage(
    "/admin-panel/moderation-integrity?tab=reported",
    { reportedError: true },
  ), /Unable to load reported reviews/);
  assert.match(renderPage(
    "/admin-panel/moderation-integrity?tab=reported&reported_id=91",
    { reportedDetailError: 91 },
  ), /Unable to load this reported review/);
});

test("Disputes tab renders the moderation queue workspace", () => {
  const html = renderPage(
    "/admin-panel/moderation-integrity?tab=disputes",
  );

  assert.ok(html.includes("Search review disputes"));
  assert.ok(html.includes("Dispute Queue"));
  assert.ok(html.includes("Select a dispute"));
  assert.ok(!html.includes("data-table"));
  assert.ok(html.includes('aria-busy="true"'));
  assert.ok(html.includes("rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2"));
  assert.ok(html.indexOf("Review Moderation") < html.indexOf("Search review disputes"));
  assert.ok(html.includes("Status"));
  assert.ok(html.includes("Filter"));
  assert.ok(!html.includes("management is coming next"));
});
test("moderation status keeps pending actions and completed audit details", () => {
  const reviewStatuses = {
    pending: "under_review",
    approved: "published",
    rejected: "rejected",
  };
  for (const status of ["pending", "approved", "rejected"]) {
    const detail = {
      ...heldReview,
      status: reviewStatuses[status],
      decision_status: status,
      text: "Previously moderated content",
      photos: [],
      moderation: { text_checked: true, text_flagged_categories: [] },
      decision: {
        status,
        reviewed_by: { id: 3, first_name: "Queue", last_name: "Admin" },
        reviewed_at: "2026-10-27T09:30:00Z",
        notes: status === "rejected" ? "Original moderation decision notes." : null,
      },
    };
    const html = renderPage(
      "/admin-panel/moderation-integrity?tab=under-review&under_review_id=42",
      { list: { ...heldList, items: [detail] }, detail },
    );
    const visible = html.replaceAll("<!-- -->", "");
    if (status === "pending") {
      assert.match(html, /Reject Review/);
      assert.match(html, /Approve &amp; Publish/);
      assert.doesNotMatch(html, /Moderation Decision/);
      continue;
    }
    assert.match(visible, /Moderation Decision/);
    assert.match(visible, /by Queue Admin/);
    assert.match(visible, /dateTime="2026-10-27T09:30:00Z"/);
    assert.match(visible, status === "rejected"
      ? /Original moderation decision notes/
      : /No notes recorded/);
    assert.doesNotMatch(html, /Reject Review|Approve &amp; Publish/);
    const filters = renderToString(React.createElement(UnderReviewQueueFilters, {
      filters: { search: "", status, reason: "", content: "", ordering: "newest" },
      onChange: () => {},
    }));
    assert.match(
      filters.replaceAll("<!-- -->", ""),
      new RegExp(`Status: ${status === "approved" ? "Approved" : "Rejected"}`),
    );
  }
});
