import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let ReviewDisputeReview;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: ReviewDisputeReview } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/review-dispute-detail/ReviewDisputeReview.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function renderReview(status, disputeOverrides = {}) {
  const review = {
    id: 72,
    exists: true,
    status,
    author: { id: 42, first_name: "Sample", last_name: "Explorer" },
    text: "Review content",
    photos: [],
    like_count: 2,
  };
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReviewDisputeReview, {
        dispute: {
          review_at_filing: {
            available: true,
            review_id: 72,
            author_id: 42,
            text: "Review content",
            status,
            submitted_at: "2026-10-11T02:00:00Z",
            edited_at: null,
            photos: [],
          },
          current_review: review,
          material_content_changed: false,
          filing_snapshot_unavailable: false,
          ...disputeOverrides,
        },
      }),
    ),
  );
}

test("dispute detail displays the published review status beside its heading", () => {
  const markup = renderReview("published");

  assert.match(markup, /Original Review/);
  assert.match(markup, /Sample Explorer/);
  assert.match(markup, /Submitted Oct 11, 2026/);
  assert.equal((markup.match(/aria-label="Review content"/g) ?? []).length, 1);
  assert.doesNotMatch(markup, /Current Review|found this helpful/);
  assert.match(markup, /Published/);
  assert.match(markup, /border-success\/25 bg-success\/10 text-success/);
});

test("dispute detail displays a rejected review with the shared danger style", () => {
  const markup = renderReview("rejected");

  assert.match(markup, /Original Review/);
  assert.match(markup, /Rejected/);
  assert.match(markup, /bg-danger\/10/);
});

test("a current status change stays visible without duplicating unchanged filing content", () => {
  const markup = renderReview("published", {
    current_review: { exists: true, text: "Review content", status: "rejected", photos: [] },
  });

  assert.match(markup, /Current review status: Rejected/);
  assert.match(markup, /Published/);
  assert.equal((markup.match(/aria-label="Review content"/g) ?? []).length, 1);
});

test("filing edit information comes from its own snapshot timestamp", () => {
  const markup = renderReview("published", {
    review_at_filing: {
      available: true,
      status: "published",
      text: "Previously edited filing content",
      edited_at: "2026-10-11T03:00:00Z",
      photos: [],
    },
  });

  assert.match(markup, /Edited Oct 11, 2026/);
});

test("changed review shows distinct historical and current text and photos", () => {
  const markup = renderReview("published", {
    material_content_changed: true,
    review_at_filing: {
      available: true,
      author_id: 42,
      text: "Filing-time allegation",
      status: "published",
      photos: [
        { id: 2, url: "https://example.com/second-filing.jpg", display_order: 1 },
        { id: 1, url: "https://example.com/first-filing.jpg", display_order: 0 },
      ],
    },
    current_review: {
      exists: true,
      status: "published",
      text: "Revised current content",
      photos: [{ id: 3, photo_url: "https://example.com/current.jpg" }],
    },
  });

  assert.match(markup, /Review at Filing/);
  assert.match(markup, /Current Review/);
  assert.match(markup, /changed after this dispute was filed/);
  assert.match(markup, /Filing-time allegation/);
  assert.match(markup, /Revised current content/);
  assert.equal((markup.match(/aria-label="Review content"/g) ?? []).length, 2);
  assert.match(markup, /src="https:\/\/example.com\/first-filing.jpg"/);
  assert.match(markup, /src="https:\/\/example.com\/current.jpg"/);
  assert.ok(markup.indexOf('src="https://example.com/first-filing.jpg"')
    < markup.indexOf('src="https://example.com/second-filing.jpg"'));
});

test("deleted review retains its filing card and explicit author closure", () => {
  const markup = renderReview("published", {
    current_review: { exists: false },
    material_content_changed: null,
    closure_reason: "content_removed_by_author",
  });

  assert.match(markup, /original review has been deleted/);
  assert.match(markup, /Closed without an Admin decision because the author deleted/);
  assert.match(markup, /Review at Filing/);
  assert.match(markup, /Review content/);
  assert.match(markup, /Explorer #42/);
  assert.doesNotMatch(markup, /Current Review|Unknown explorer/);
  assert.equal((markup.match(/aria-label="Review content"/g) ?? []).length, 1);
});

test("legacy content is labeled current and never substituted for filing evidence", () => {
  const markup = renderReview("published", {
    review_at_filing: { available: false, message: "Filing-time snapshot unavailable" },
    filing_snapshot_unavailable: true,
    material_content_changed: null,
  });

  assert.match(markup, /Filing-time snapshot unavailable/);
  assert.match(markup, /Current Review/);
  assert.doesNotMatch(markup, />Review at Filing<|>Original Review</);
  assert.equal((markup.match(/aria-label="Review content"/g) ?? []).length, 1);
});

test("deleted legacy review renders no fabricated review card", () => {
  const markup = renderReview("published", {
    review_at_filing: { available: false },
    current_review: { exists: false },
    material_content_changed: null,
    closure_reason: "original_review_removed",
  });

  assert.match(markup, /Filing-time snapshot unavailable/);
  assert.match(markup, /original review has been deleted/);
  assert.match(markup, /original review was removed/);
  assert.doesNotMatch(markup, /aria-label="Review content"|No written review/);
});
