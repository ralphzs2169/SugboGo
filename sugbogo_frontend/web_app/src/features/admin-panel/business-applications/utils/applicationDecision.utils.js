/** Only saved, current assessments can qualify a duplicate rejection. */
export function hasConfirmedDuplicate(query, submissionId) {
  return (
    !!submissionId &&
    !!query?.data &&
    !query.isPending &&
    !query.isFetching &&
    !query.isError &&
    query.data.submission_id === submissionId &&
    Array.isArray(query.data.candidates) &&
    query.data.candidates.some(
      (candidate) =>
        !candidate.stale &&
        candidate.assessment?.decision === "confirmed_duplicate",
    )
  );
}

/** Validate ordinary corrections separately from the duplicate disposition. */
export function validateRejection({
  rejectionType,
  explanation,
  showCorrections,
  selectedSections,
  feedback,
  confirmedDuplicate,
  minFeedbackLength,
}) {
  const errors = {};
  if (rejectionType === "duplicate") {
    if (!confirmedDuplicate)
      errors.general =
        "Save a current confirmed-duplicate assessment before rejecting.";
    if (explanation.trim().length < minFeedbackLength) {
      errors.explanation =
        `Please provide at least ${minFeedbackLength} characters so the applicant has enough detail.`;
    }
  }
  if (showCorrections) {
    if (!selectedSections.length)
      errors.general = "Select at least one section that requires changes.";
    for (const section of selectedSections) {
      if ((feedback[section] || "").trim().length < minFeedbackLength) {
        errors[section] =
          `Please provide at least ${minFeedbackLength} characters so the applicant has enough detail.`;
      }
    }
  }
  return errors;
}

/** Build one request for ordinary, duplicate-only, or combined rejection. */
export function buildRejectionPayload({
  rejectionType,
  explanation,
  showCorrections,
  selectedSections,
  feedback,
  expectedSubmissionId,
}) {
  return {
    disposition: rejectionType,
    expected_submission_id: expectedSubmissionId,
    ...(rejectionType === "duplicate"
      ? { explanation: explanation.trim() }
      : {}),
    feedback: showCorrections
      ? selectedSections.map((section) => ({
          section,
          message: feedback[section].trim(),
        }))
      : [],
  };
}

/** Summarize current duplicate evidence without interpreting missing or failed checks as clearance. */
export function getDuplicateReviewStatus(query, submissionId) {
  if (query.isPending || query.isFetching) {
    return { state: "loading", message: "Checking possible duplicates�" };
  }
  if (query.isError) {
    return {
      state: "error",
      message: "Duplicate check failed. Retry before approval.",
    };
  }
  const data = query.data;
  if (
    !data ||
    !Array.isArray(data.candidates) ||
    typeof data.approval_blocked !== "boolean"
  ) {
    return {
      state: "unavailable",
      message: "Duplicate check unavailable. Retry before approval.",
    };
  }
  if (!submissionId || data.submission_id !== submissionId) {
    return {
      state: "stale_submission",
      message: "Submission changed. Refresh the application before deciding.",
    };
  }
  if (!data.candidates.length) {
    return data.approval_blocked
      ? {
          state: "unavailable",
          message: "Duplicate review is unavailable. Retry before approval.",
        }
      : { state: "empty", message: "No possible duplicates detected" };
  }
  const counts = {
    stale: 0,
    confirmed_duplicate: 0,
    legitimate: 0,
    ownership_conflict: 0,
    unresolved: 0,
  };
  for (const candidate of data.candidates) {
    if (candidate.stale) counts.stale += 1;
    else if (Object.hasOwn(counts, candidate.assessment?.decision))
      counts[candidate.assessment.decision] += 1;
    else counts.unresolved += 1;
  }
  const labels = {
    stale: "stale assessment evidence",
    confirmed_duplicate: "saved confirmed duplicate",
    legitimate: "saved legitimate business",
    ownership_conflict: "ownership conflict",
    unresolved: "unresolved possible duplicate",
  };
  return {
    state: "matches",
    message: Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${count} ${labels[key]}`)
      .join(" � "),
  };
}

/** Only completed assessment conclusions are selectable; unresolved remains a backend state. */
export const assessmentDecisions = [
  ["confirmed_duplicate", "Confirmed Duplicate"],
  ["legitimate", "Legitimate Separate Business / Branch"],
  ["ownership_conflict", "Ownership Conflict"],
];

export function selectedAssessmentDecision(value) {
  return assessmentDecisions.some(([decision]) => decision === value)
    ? value
    : "";
}

/** Snapshot saved assessment evidence, never unsaved form selections, for an open decision. */
export function duplicateDecisionSignature(query, submissionId) {
  if (
    !query?.data ||
    query.isPending ||
    query.isFetching ||
    query.isError ||
    query.data.submission_id !== submissionId ||
    !Array.isArray(query.data.candidates)
  )
    return null;
  return JSON.stringify(
    query.data.candidates
      .map((candidate) => ({
        key: candidate.key,
        fingerprint: candidate.fingerprint,
        stale: candidate.stale,
        assessment: candidate.assessment,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  );
}

/** Automatically choose a rejection flow using only valid saved conclusions. */
export function initialRejectionFlow(query, submissionId) {
  return hasConfirmedDuplicate(query, submissionId)
    ? "duplicate"
    : "corrections";
}
