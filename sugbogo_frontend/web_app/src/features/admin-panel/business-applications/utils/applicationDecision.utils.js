/** Only saved, current assessments can qualify a duplicate rejection. */
export function hasConfirmedDuplicate(query, submissionId) {
  return (
    !!submissionId &&
    !!query?.data &&
    !query.isFetching &&
    !query.isError &&
    query.data.submission_id === submissionId &&
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
    if (!explanation.trim())
      errors.explanation = "Enter an explanation for the merchant.";
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
