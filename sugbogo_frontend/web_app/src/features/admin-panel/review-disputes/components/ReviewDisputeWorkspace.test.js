import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let ReviewDisputeWorkspace;
let DisputeDecisionModal;
let appendDisputeTemplate;
let DisputeInvestigation;
let nextDisputeSelection;
let ReviewDisputeDetailContextBar;
let ReviewDisputeReports;

const dispute = {
  id: 16,
  reason: "fake_review",
  status: "pending",
  created_at: "2026-10-12T04:26:00Z",
  business_name: "Savor Kitchen",
  business_cover_photo_url: "https://example.com/cover.jpg",
  review_id: 72,
  review_text_preview: "The food was cold.",
  review_photo_count: 0,
  attempt_number: 2,
  merchant: { name: "Maria Santos", avatar_url: null, avatar_key: null },
};

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: ReviewDisputeWorkspace } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/ReviewDisputeWorkspace.jsx",
  ));
  ({ default: DisputeDecisionModal } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/DisputeDecisionModal.jsx",
  ));
  ({ appendDisputeTemplate } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/config/reviewDisputeDecisionConfig.js",
  ));
  ({ default: DisputeInvestigation } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/DisputeInvestigation.jsx",
  ));
  ({ nextDisputeSelection } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/utils/disputeQueueSelection.js",
  ));
  ({ default: ReviewDisputeDetailContextBar } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/review-dispute-detail/ReviewDisputeDetailContextBar.jsx",
  ));
  ({ default: ReviewDisputeReports } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/review-dispute-detail/ReviewDisputeReports.jsx",
  ));
});

after(async () => {
  await server?.close();
  delete globalThis.window;
});

function renderWorkspace(url, items = [dispute]) {
  globalThis.window = {
    location: { search: new URL(url, "http://localhost").search },
  };
  const queryClient = new QueryClient();
  const status = new URL(url, "http://localhost").searchParams.get("status");
  queryClient.setQueryData(
    ["admin", "review-disputes", {
      page: 1,
      page_size: 10,
      search: undefined,
      status: status && status !== "all" ? status : status === "all" ? undefined : "pending",
      reason: undefined,
      ordering: "-created_at",
    }],
    {
      items,
      pagination: { total_items: items.length, total_pages: 1 },
    },
  );

  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [url] },
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(ReviewDisputeWorkspace),
      ),
    ),
  );
}

function renderInvestigation(status, editedAt = null) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    ["admin", "review-dispute", "16"],
    {
      ...dispute,
      status,
      merchant_id: 9,
      description: "The review did not describe a real visit.",
      business: {
        id: 17,
        name: "Savor Kitchen",
        cover_photo_url: "https://example.com/cover.jpg",
        cluster_name: "Culinary",
        category_name: "Restaurant",
        cluster_icon: "utensils",
        specialty_tags: [],
      },
      review: {
        id: 72,
        status: "published",
        text: "The food was cold.",
        created_at: "2026-10-11T02:00:00Z",
        edited_at: editedAt,
        like_count: 2,
        report_count: 0,
        report_summary: [],
        photos: [],
        author: { id: 42, first_name: "Ana", last_name: "Reyes" },
      },
      evidence: [],
      previous_disputes: [{
        id: 8,
        status: "dismissed",
        reason: "fake_review",
        created_at: "2026-09-10T04:26:00Z",
      }],
    },
  );

  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(DisputeInvestigation, {
          disputeId: "16",
          onDecision: () => {},
          decisionPending: false,
        }),
      ),
    ),
  );
}

test("pending dispute queue renders selectable case identity and blue selection", () => {
  const html = renderWorkspace(
    "/admin-panel/moderation-integrity?tab=disputes&dispute_id=16",
  );

  assert.match(html, /Dispute Queue/);
  assert.match(html, /Search disputes, merchants, businesses/);
  assert.match(html, /Maria Santos/);
  assert.match(html, /Savor Kitchen/);
  assert.match(html, /Review #72/);
  assert.match(html, /The food was cold\./);
  assert.match(html, /Attempt #2/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /border-l-info bg-info\/5/);
});

test("queue distinguishes written, photo-only, and empty reviews", () => {
  const html = renderWorkspace(
    "/admin-panel/moderation-integrity?tab=disputes",
    [
      { ...dispute, id: 16, review_text_preview: "  Written review  ", review_photo_count: 2 },
      { ...dispute, id: 17, review_text_preview: "  ", review_photo_count: 1 },
      { ...dispute, id: 18, review_text_preview: "", review_photo_count: 0 },
      { ...dispute, id: 19, review_text_preview: undefined, review_photo_count: 0 },
    ],
  );

  assert.match(html, /Written review/);
  assert.match(html, /Photo review/);
  assert.match(html, /No written review/);
  assert.equal((html.match(/Photo review/g) ?? []).length, 1);
  assert.equal((html.match(/No written review/g) ?? []).length, 2);
});

test("resolved dispute remains in filtered history with read-only queue status", () => {
  const html = renderWorkspace(
    "/admin-panel/moderation-integrity?tab=disputes&status=upheld",
    [{ ...dispute, status: "upheld" }],
  );

  assert.match(html, /Upheld/);
  assert.doesNotMatch(html, /No pending disputes/);
});

test("queue keeps neutral image fallback and unselected styling", () => {
  const html = renderWorkspace(
    "/admin-panel/moderation-integrity?tab=disputes",
    [{ ...dispute, business_cover_photo_url: null }],
  );

  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /border-l-transparent bg-background/);
  assert.match(html, /lucide-store/);
});

test("empty pending queue shows the moderation empty state", () => {
  const html = renderWorkspace(
    "/admin-panel/moderation-integrity?tab=disputes",
    [],
  );

  assert.match(html, /No pending disputes/);
  assert.match(html, /Select a dispute/);
});

test("decision modal uses one confirmation step and requires notes", () => {
  const props = {
    decision: "uphold",
    disputeId: 16,
    notes: "Too short",
    pending: false,
    onNotesChange: () => {},
    onClose: () => {},
    onConfirm: () => {},
  };
  const shortHtml = renderToStaticMarkup(
    React.createElement(DisputeDecisionModal, props),
  );
  const validHtml = renderToStaticMarkup(
    React.createElement(DisputeDecisionModal, {
      ...props,
      decision: "dismiss",
      notes: "The submitted evidence does not support removal.",
    }),
  );

  assert.match(shortHtml, /Uphold this dispute\?/);
  assert.match(shortHtml, /Fake or non-genuine review/);
  assert.match(shortHtml, /Moderation Notes/);
  assert.match(shortHtml, /type="submit" disabled=""/);
  assert.match(validHtml, /Dismiss this dispute\?/);
  assert.match(validHtml, /Insufficient evidence/);
  assert.doesNotMatch(validHtml, /type="submit" disabled=""/);

  const errorHtml = renderToStaticMarkup(
    React.createElement(DisputeDecisionModal, {
      ...props,
      error: "Unable to resolve this dispute.",
    }),
  );
  assert.match(errorHtml, /Unable to resolve this dispute/);
});

test("quick templates insert editable notes without discarding existing context", () => {
  assert.equal(
    appendDisputeTemplate("", "The evidence supports dismissal."),
    "The evidence supports dismissal.",
  );
  assert.equal(
    appendDisputeTemplate("Case reviewed.  ", "No violation found."),
    "Case reviewed.\nNo violation found.",
  );
});

test("resolved queue selection advances to the adjacent pending dispute", () => {
  const previous = [{ id: 11 }, { id: 16 }, { id: 21 }];

  assert.equal(
    nextDisputeSelection(previous, [{ id: 11 }, { id: 21 }], 16),
    21,
  );
  assert.equal(
    nextDisputeSelection(previous, [{ id: 11 }, { id: 16 }], 21),
    16,
  );
  assert.equal(nextDisputeSelection([{ id: 16 }], [], 16), null);
});

test("pending investigation retains evidence, history, and a local sticky decision footer", () => {
  const html = renderInvestigation("pending");

  assert.match(html, /Dispute #16/);
  assert.match(html, /Merchant/);
  assert.match(html, /Business/);
  assert.match(html, /Review #72/);
  assert.match(html, /lucide-utensils/);
  assert.match(html, /\/admin-panel\/users\/9/);
  assert.match(html, /\/admin-panel\/businesses\/17/);
  assert.match(html, /Attempt #2/);
  assert.match(html, /Filed Oct 12, 2026/);
  assert.match(html, /backdrop-blur-md/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /The food was cold/);
  assert.match(html, /The review did not describe a real visit/);
  assert.match(html, /No evidence submitted/);
  assert.match(html, /Previous Disputes/);
  assert.match(html, /Community Reports/);
  assert.doesNotMatch(html, /Case Information/);
  assert.match(html, /border-t border-stroke pt-5/);
  assert.doesNotMatch(html, /rounded-xl border border-stroke bg-background/);
  assert.match(html, /sticky bottom-0/);
  assert.match(html, /Uphold Dispute/);
});

test("original review shows edit context only when an edit timestamp exists", () => {
  assert.doesNotMatch(renderInvestigation("pending"), /Edited Oct/);
  assert.match(
    renderInvestigation("pending", "2026-10-11T03:00:00Z"),
    /Edited Oct 11, 2026/,
  );
});

test("community reports stay compact and link to the same Reported review", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReviewDisputeReports, {
        review: {
          id: 72,
          report_count: 4,
          report_summary: [
            { reason: "spam", count: 2 },
            { reason: "misinformation", count: 1 },
            { reason: "off_topic", count: 1 },
          ],
        },
      }),
    ),
  ).replaceAll("<!-- -->", "");

  assert.match(html, /Community Reports/);
  assert.match(html, /4 reports submitted for this review/);
  assert.match(html, /Spam[\s\S]*?>2<\/span>/);
  assert.match(html, /False or Misleading Information[\s\S]*?>1<\/span>/);
  assert.match(html, /Off-topic or Irrelevant/);
  assert.match(html, /href="\/admin-panel\/moderation-integrity\?tab=reported&amp;reported_id=72"/);
  assert.doesNotMatch(html, /Total Reports|Report Reasons|Confirm Reports|Dismiss Reports|reporter/i);
});

test("a single community report uses total wording without a dashboard card", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReviewDisputeReports, {
        review: { id: 72, report_count: 1, report_summary: [{ reason: "spam", count: 1 }] },
      }),
    ),
  ).replaceAll("<!-- -->", "");

  assert.match(html, /1 report submitted for this review/);
  assert.doesNotMatch(html, /text-2xl|Total Reports/);
});

test("compact dispute context retains identity after the full header scrolls away", () => {
  const html = renderToStaticMarkup(
    React.createElement(ReviewDisputeDetailContextBar, {
      dispute: {
        ...dispute,
        business: { name: "Savor Kitchen" },
        review: { id: 72 },
      },
      visible: true,
    }),
  );

  assert.match(html, /aria-hidden="false"/);
  assert.match(html, /sticky top-0/);
  assert.match(html, /backdrop-blur-md/);
  assert.match(html, /Maria Santos/);
  assert.match(html, /Savor Kitchen/);
  assert.match(html, /Review #72/);
});

test("investigation uses the shared loading and error states", () => {
  const queryClient = new QueryClient();
  const render = () => renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(DisputeInvestigation, {
          disputeId: "16",
          onDecision: () => {},
          decisionPending: false,
        }),
      ),
    ),
  );

  assert.match(render(), /Loading dispute investigation/);

  const query = queryClient.getQueryCache().find({
    queryKey: ["admin", "review-dispute", "16"],
  });
  query.setState({
    status: "error",
    fetchStatus: "idle",
    error: new Error("Unavailable"),
  });

  assert.match(render(), /Unable to load this dispute/);
});

test("resolved investigation shows case history without decision buttons", () => {
  const html = renderInvestigation("dismissed");

  assert.match(html, /Dismissed/);
  assert.match(html, /Previous Disputes/);
  assert.doesNotMatch(html, /aria-label="Review decision"/);
});
