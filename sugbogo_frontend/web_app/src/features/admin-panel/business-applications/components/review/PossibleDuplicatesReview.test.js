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
  queryOverrides = {},
} = {}) {
  return renderToString(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(Review, {
        application: { id: 1, status, latest_submission_id: 3 },
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
          ...queryOverrides,
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
  assert.match(html, /Approval blocked until outstanding matches are resolved/);
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

test("successful empty checks hide the large section", () => {
  assert.equal(render({ candidates: [] }), "");
});
test("empty current matches do not hide recorded rejection history", () => {
  const html = render({
    candidates: [],
    disposition: {
      explanation: "Previous duplicate rejection",
      reconsidered: true,
      reconsideration_explanation: "Historical clearance",
    },
  });
  assert.doesNotMatch(html, /Possible Duplicates|Save Assessment/);
  assert.match(html, /<details/);
  assert.match(html, /Previous duplicate rejection|Historical clearance/);
});
test("loading, failed cached checks and outdated submissions cannot show clearance or editable matches", () => {
  for (const queryOverrides of [
    { isPending: true },
    { isFetching: true },
    { isError: true },
    { data: { submission_id: 99, candidates: [], approval_blocked: false } },
  ]) {
    const html = render({ candidates: [], queryOverrides });
    assert.doesNotMatch(
      html,
      /No possible duplicates detected|Possible Duplicates|Save Assessment/,
    );
    assert.match(html, /Checking|failed|Submission changed/);
  }
});
test("saved legitimate matches remain visible and distinct from no matches", () => {
  const html = render({
    candidates: [
      candidate({
        resolved: true,
        assessment: { decision: "legitimate", explanation: "Separate branch" },
      }),
    ],
  });
  assert.match(html, /Duplicate Review/);
  assert.match(
    html,
    /All current matches have valid legitimate-business assessments/,
  );
  assert.doesNotMatch(html, /No possible duplicates detected/);
});
test("stale saved decisions are visibly stale rather than clearance", () => {
  const html = render({
    candidates: [
      candidate({
        stale: true,
        assessment: {
          decision: "confirmed_duplicate",
          explanation: "Old evidence",
        },
      }),
    ],
  });
  assert.match(html, /Stale evidence/);
  assert.match(html, /Evidence changed/);
});

test("multiple candidates start compact while retaining independent assessment controls", () => {
  const html = render({
    candidates: [
      candidate(),
      candidate({
        key: "application:4",
        record_id: 4,
        business_name: "Second business",
      }),
    ],
  });
  assert.equal((html.match(/<details/g) || []).length, 2);
  assert.equal((html.match(/<details open=""/g) || []).length, 1);
  assert.match(html, /name="duplicate-application-2"/);
  assert.match(html, /name="duplicate-application-4"/);
  assert.match(html, /2 needs review/);
  assert.equal(
    (
      html.match(/Approval blocked until outstanding matches are resolved/g) ||
      []
    ).length,
    1,
  );
});
test("refreshing current matches preserves mounted forms but prevents editing and clearance", () => {
  for (const queryOverrides of [{ isFetching: true }, { isError: true }]) {
    const html = render({ queryOverrides });
    assert.match(html, /Duplicate Review/);
    assert.match(html, /name="duplicate-application-2"/);
    assert.match(html, /<fieldset disabled=""/);
    assert.doesNotMatch(
      html,
      /No possible duplicates detected|All current matches have valid/,
    );
  }
});
test("saved decisions, internal-only explanation and labels remain readable", () => {
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
  assert.match(html, /Saved assessment/);
  assert.match(html, /Internal explanation/);
  assert.match(html, /this does not reject the application/);
  assert.doesNotMatch(html, /\uFFFD/);
});

test("candidate cover and classification are displayed with neutral missing-data fallbacks", () => {
  const html = render({
    candidates: [
      candidate({
        cover_photo_url: "https://example.com/cover.jpg",
        cluster_name: "Accommodation",
        cluster_icon: "hotel",
        category_name: "Resort",
      }),
    ],
  });
  assert.match(html, /src="https:\/\/example.com\/cover.jpg"/);
  assert.match(html, /Resort/);
  assert.doesNotMatch(html, /Accommodation/);
  assert.match(render(), /No cover photo available/);
});
test("unassessed and previously unresolved candidates need a conclusion before saving", () => {
  for (const candidates of [
    [candidate()],
    [
      candidate({
        assessment: { decision: "unresolved", explanation: "Investigate" },
      }),
    ],
  ]) {
    const html = render({ candidates });
    assert.match(html, /Needs Review/);
    assert.doesNotMatch(html, /value="unresolved"/);
    assert.doesNotMatch(html, /type="radio"[^>]* checked=""/);
  }
});
test("saved conclusions remain selected and editable with conclusion-specific quick notes", () => {
  const candidates = [
    candidate({
      assessment: { decision: "legitimate", explanation: "Verified branch" },
    }),
  ];
  const html = render({ candidates });
  assert.match(html, /checked="" value="legitimate"/);
  assert.match(html, /Quick assessment notes/);
  assert.match(html, /Separate branch/);
  assert.doesNotMatch(
    render({ candidates, status: "rejected" }),
    /Quick assessment notes/,
  );
});
