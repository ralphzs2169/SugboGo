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

function renderReview(status, reviewOverrides = {}) {
  return renderToStaticMarkup(
    React.createElement(ReviewDisputeReview, {
      review: {
        status,
        author: { first_name: "Sample", last_name: "Explorer" },
        text: "Review content",
        photos: [],
        like_count: 2,
        report_count: 0,
        ...reviewOverrides,
      },
    }),
  );
}

test("dispute detail displays the published review status beside its heading", () => {
  const markup = renderReview("published");

  assert.match(markup, /Original Review/);
  assert.match(markup, /Sample Explorer/);
  assert.match(markup.replaceAll("<!-- -->", ""), /2 found this helpful/);
  assert.match(markup, /Published/);
  assert.match(markup, /border-success\/25 bg-success\/10 text-success/);
});

test("dispute detail displays a rejected review with the shared danger style", () => {
  const markup = renderReview("rejected");

  assert.match(markup, /Original Review/);
  assert.match(markup, /Rejected/);
  assert.match(markup, /bg-danger\/10/);
});

test("dispute review preserves an edited flag when no edit timestamp is available", () => {
  const markup = renderReview("published", { is_edited: true });

  assert.match(markup, />Edited</);
  assert.doesNotMatch(markup, /Edited Oct/);
});
