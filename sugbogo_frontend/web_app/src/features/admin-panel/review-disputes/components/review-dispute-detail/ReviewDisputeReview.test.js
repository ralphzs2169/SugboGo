import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
let ReviewDisputeReview;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: ReviewDisputeReview } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/review-dispute-detail/ReviewDisputeReview.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function renderReview(status) {
  return renderToStaticMarkup(
    React.createElement(ReviewDisputeReview, {
      review: {
        status,
        author: { first_name: "Sample", last_name: "Explorer" },
        text: "Review content",
        photos: [],
        report_count: 0,
      },
    }),
  );
}

test("dispute detail displays the published review status beside its heading", () => {
  const markup = renderReview("published");

  assert.match(markup, /Original Review/);
  assert.match(markup, /Published/);
  assert.match(markup, /bg-emerald-500/);
});

test("dispute detail displays a rejected review with the shared danger style", () => {
  const markup = renderReview("rejected");

  assert.match(markup, /Original Review/);
  assert.match(markup, /Rejected/);
  assert.match(markup, /bg-danger\/10/);
});
