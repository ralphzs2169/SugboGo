import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

let server;
let Review;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: Review } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-applications/components/review/PossibleDuplicatesReview.jsx",
  ));
});
after(async () => {
  await server?.close();
});

function candidate(overrides = {}) {
  return {
    key: "application:2",
    record_type: "business",
    record_id: 8,
    business_name: "Juan's Coffee Shop",
    address: "Unit 4B, Cebu City",
    status: "active",
    distance_metres: 18,
    reasons: ["exact_name_and_nearby_location"],
    fingerprint: "evidence",
    assessment: null,
    stale: false,
    resolved: false,
    ...overrides,
  };
}

function render({
  candidates = [candidate()],
  disposition = null,
  status = "submitted",
  error = false,
} = {}) {
  return renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(Review, {
        application: { id: 1, status },
        query: {
          data: error
            ? undefined
            : {
                submission_id: 3,
                candidates,
                disposition,
                approval_blocked: candidates.some((item) => !item.resolved),
              },
          isPending: false,
          isError: error,
          refetch() {},
        },
        mutation: { isPending: false, mutate() {} },
      }),
    ),
  );
}

test("each candidate has its own assessment and links to the correct record type", () => {
  const html = render({
    candidates: [
      candidate(),
      candidate({
        key: "application:4",
        record_type: "application",
        record_id: 4,
      }),
    ],
  });
  assert.match(html, /href="\/admin-panel\/businesses\/8"/);
  assert.match(html, /href="\/admin-panel\/business\/application\/4"/);
  assert.match(html, /name="duplicate-application-2"/);
  assert.match(html, /name="duplicate-application-4"/);
});

test("ownership conflict remains blocked and cannot trigger confirmed-duplicate rejection", () => {
  const html = render({
    candidates: [
      candidate({
        assessment: {
          decision: "ownership_conflict",
          explanation: "Investigate ownership",
        },
      }),
    ],
  });
  assert.match(html, /approval blocked until resolved/);
  assert.doesNotMatch(html, /Reject Confirmed Duplicate/);
});

test("confirmed assessments never expose a competing final rejection", () => {
  const html = render({
    candidates: [
      candidate({
        assessment: {
          decision: "confirmed_duplicate",
          explanation: "Same establishment",
        },
      }),
    ],
  });
  assert.doesNotMatch(html, /Reject Confirmed Duplicate|Reject Duplicate/);
  assert.match(html, /Save Assessment/);
});

test("rejected applications retain historical reconsideration without active controls", () => {
  const html = render({
    status: "rejected",
    disposition: {
      review_id: 9,
      explanation: "Same business",
      reconsidered: true,
      reconsideration_explanation: "Legacy clearance",
    },
  });
  assert.match(html, /Legacy clearance/);
  assert.doesNotMatch(
    html,
    /Clear Duplicate Rejection for Resubmission|Save Assessment|Reconsideration explanation/,
  );
});

test("failed detection exposes recovery without claiming a clean result", () => {
  const html = render({ error: true });
  assert.match(html, /Try Again/);
  assert.doesNotMatch(html, /No unresolved current duplicate matches/);
});
