import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let BusinessReviewsPreview;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: BusinessReviewsPreview } = await server.ssrLoadModule(
    "/src/features/admin-panel/businesses/components/business-detail/review-preview-section/BusinessReviewsPreview.jsx",
  ));
});

after(async () => {
  await server?.close();
});

function renderReview(outcome) {
  const review = {
    id: 74,
    author: { first_name: "Ana", last_name: "Cruz" },
    text: "A review for Admin context.",
    photos: [],
    like_count: 0,
    report_count: 0,
    created_at: "2026-10-11T00:00:00Z",
    reliability_check_outcome: outcome,
  };

  return renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(BusinessReviewsPreview, {
        reviews: [review],
        reviewCount: 1,
        businessId: 9,
      }),
    ),
  );
}

test("Admin recent reviews show failed and unknown reliability outcomes neutrally", () => {
  assert.match(renderReview("unavailable"), /Latest reliability check unavailable/);
  assert.match(renderReview("unknown"), /Latest reliability check outcome unknown/);
  assert.doesNotMatch(renderReview("checked"), /Latest reliability check/);
});
