import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRejectionPayload,
  validateRejection,
  hasConfirmedDuplicate,
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
