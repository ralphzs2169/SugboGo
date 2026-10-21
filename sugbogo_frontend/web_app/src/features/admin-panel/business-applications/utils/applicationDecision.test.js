import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRejectionPayload,
  validateRejection,
  hasConfirmedDuplicate,
  initialRejectionFlow,
  duplicateDecisionSignature,
  selectedAssessmentDecision,
  assessmentDecisions,
  getDuplicateReviewStatus,
} from "./applicationDecision.utils.js";
const base = {
  rejectionType: "duplicate",
  explanation: "Same establishment",
  showCorrections: false,
  selectedSections: [],
  feedback: {},
  confirmedDuplicate: true,
  minFeedbackLength: 10,
  expectedSubmissionId: 7,
};
test("duplicate-only rejection needs confirmation and explanation but no corrections", () => {
  assert.deepEqual(validateRejection(base), {});
  assert.ok(validateRejection({ ...base, confirmedDuplicate: false }).general);
  assert.ok(validateRejection({ ...base, explanation: " " }).explanation);
  assert.deepEqual(buildRejectionPayload(base), {
    disposition: "duplicate",
    explanation: "Same establishment",
    feedback: [],
    expected_submission_id: 7,
  });
});
test("ordinary and combined rejection validate each selected section", () => {
  const corrections = {
    ...base,
    showCorrections: true,
    selectedSections: ["identity"],
    feedback: { identity: "Too short" },
  };
  assert.ok(validateRejection(corrections).identity);
  const complete = {
    ...corrections,
    feedback: { identity: "Correct contact information." },
  };
  assert.deepEqual(validateRejection(complete), {});
  assert.equal(buildRejectionPayload(complete).feedback.length, 1);
  assert.ok(
    validateRejection({
      ...base,
      rejectionType: "corrections",
      showCorrections: true,
    }).general,
  );
});
test("stale, failed, fetching and different-submission assessments cannot qualify rejection", () => {
  const query = {
    data: {
      submission_id: 7,
      candidates: [
        { assessment: { decision: "confirmed_duplicate" }, stale: false },
      ],
    },
  };
  assert.equal(hasConfirmedDuplicate(query, 7), true);
  for (const state of [
    { ...query, isError: true },
    { ...query, isFetching: true },
    { data: { ...query.data, submission_id: 8 } },
    {
      data: {
        ...query.data,
        candidates: [{ ...query.data.candidates[0], stale: true }],
      },
    },
  ]) {
    assert.equal(hasConfirmedDuplicate(state, 7), false);
  }
});

test("the rejection flow is automatic and uses only current saved confirmed assessments", () => {
  const confirmed = {
    key: "business:1",
    fingerprint: "current",
    assessment: { decision: "confirmed_duplicate" },
    stale: false,
  };
  const query = { data: { submission_id: 7, candidates: [confirmed] } };
  assert.equal(initialRejectionFlow(query, 7), "duplicate");
  for (const state of [
    {},
    { ...query, isPending: true },
    { ...query, isFetching: true },
    { ...query, isError: true },
    { data: { ...query.data, candidates: [] } },
    { data: { ...query.data, candidates: [{ ...confirmed, stale: true }] } },
  ]) {
    assert.equal(initialRejectionFlow(state, 7), "corrections");
  }
  for (const decision of ["legitimate", "ownership_conflict", "unresolved"]) {
    assert.equal(
      initialRejectionFlow(
        {
          data: {
            ...query.data,
            candidates: [{ ...confirmed, assessment: { decision } }],
          },
        },
        7,
      ),
      "corrections",
    );
  }
  assert.equal(
    initialRejectionFlow(
      {
        data: {
          ...query.data,
          candidates: [
            confirmed,
            {
              ...confirmed,
              key: "business:2",
              assessment: { decision: "ownership_conflict" },
            },
          ],
        },
      },
      7,
    ),
    "duplicate",
  );
});
test("unresolved and unassessed candidates have no selectable conclusion", () => {
  assert.equal(selectedAssessmentDecision(null), "");
  assert.equal(selectedAssessmentDecision("unresolved"), "");
  assert.equal(selectedAssessmentDecision("legitimate"), "legitimate");
  assert.equal(assessmentDecisions.length, 3);
});
test("saved assessment changes invalidate the open decision snapshot", () => {
  const record = {
    key: "business:1",
    fingerprint: "one",
    stale: false,
    assessment: { decision: "confirmed_duplicate", reviewed_at: "one" },
  };
  const query = { data: { submission_id: 7, candidates: [record] } };
  const snapshot = duplicateDecisionSignature(query, 7);
  assert.notEqual(
    duplicateDecisionSignature({ ...query, isFetching: true }, 7),
    snapshot,
  );
  assert.notEqual(
    duplicateDecisionSignature(
      {
        data: {
          ...query.data,
          candidates: [{ ...record, assessment: { decision: "legitimate" } }],
        },
      },
      7,
    ),
    snapshot,
  );
  assert.notEqual(duplicateDecisionSignature(query, 8), snapshot);
  assert.equal(
    duplicateDecisionSignature(
      { ...query, unsavedFormDecision: "ownership_conflict" },
      7,
    ),
    snapshot,
  );
});

test("empty, loading, failed, unavailable and stale-submission checks stay distinct", () => {
  const query = {
    data: { submission_id: 7, candidates: [], approval_blocked: false },
  };
  assert.deepEqual(getDuplicateReviewStatus(query, 7), {
    state: "empty",
    message: "No possible duplicates detected",
  });
  assert.equal(
    getDuplicateReviewStatus({ ...query, isFetching: true }, 7).state,
    "loading",
  );
  assert.equal(
    getDuplicateReviewStatus({ ...query, isError: true }, 7).state,
    "error",
  );
  assert.equal(getDuplicateReviewStatus({}, 7).state, "unavailable");
  assert.equal(getDuplicateReviewStatus(query, 8).state, "stale_submission");
});
test("summaries distinguish unresolved, legitimate, confirmed, ownership and stale evidence", () => {
  const candidates = [
    { assessment: null },
    { assessment: { decision: "legitimate" }, resolved: true },
    { assessment: { decision: "confirmed_duplicate" } },
    { assessment: { decision: "ownership_conflict" } },
    { assessment: { decision: "legitimate" }, stale: true },
  ];
  const summary = getDuplicateReviewStatus(
    { data: { submission_id: 7, candidates, approval_blocked: true } },
    7,
  );
  for (const label of [
    "unresolved possible duplicate",
    "saved legitimate business",
    "saved confirmed duplicate",
    "ownership conflict",
    "stale assessment evidence",
  ])
    assert.ok(summary.message.includes(label));
});
