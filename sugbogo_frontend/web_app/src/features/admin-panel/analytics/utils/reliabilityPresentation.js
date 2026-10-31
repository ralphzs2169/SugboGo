/** Translates reporting flags into administrator-facing status without exposing internal keys. */
export function reliabilityMessages(meta, title) {
  if (!meta) return ["Reliability information is not available."];
  const messages = [];
  if (meta.availability === "unavailable") {
    messages.push("The data source is unavailable. This does not mean there was no activity.");
  } else if (meta.availability === "partial") {
    messages.push("Some observations may be missing or limited.");
  }
  if (meta.coverage_verified === false) {
    messages.push(title === "Transportation Planning"
      ? "Transportation-planning recording completeness and freshness are unverified. Counts reflect recorded requests; some planning attempts may not have been captured."
      : title === "Business Coverage" || title === "Geographic Distribution"
        ? "Profile-visit recording coverage is unverified. This status applies to visit observations."
        : "Coverage is not fully verified.");
  } else if (meta.coverage_verified === true) {
    messages.push("Coverage is verified for this report.");
  }
  const reasons = {
    best_effort_delivery: "Some activity may not have been recorded.",
    current_day_incomplete: "Today's reporting period is still in progress.",
    tracking_started_during_period: "Recording began during this reporting period.",
    tracking_not_started_in_period: "Recording had not begun during the selected period.",
    data_lag: "Confirmed data does not yet cover the end of the reporting period.",
    freshness_unverified: "The latest fully captured date has not been confirmed.",
    coverage_unverified: "Coverage is not fully verified.",
    current_role_and_retained_rows: "Past counts can change when account roles change or records are removed.",
    recorded_approval_history_only: "Earlier approval records may be incomplete.",
    current_request_state: "Counts reflect current request states, not a historical queue snapshot.",
    recorded_resolution_timestamps_only: "Only requests with recorded resolution dates can be assigned to a reporting period.",
  };
  for (const reason of meta.partial_reasons ?? []) {
    if (title === "Platform Growth" && reason === "recorded_approval_history_only") continue;
    if (reason === "coverage_unverified" && meta.coverage_verified === false) continue;
    if (reasons[reason]) messages.push(reasons[reason]);
  }
  if (!messages.length) {
    messages.push(meta.is_partial ? "Some reporting coverage is limited." : "No additional coverage limitations were reported.");
  }
  return [...new Set(messages)];
}

/** Keeps the footer brief; fuller reliability notes remain in the About drawer. */
export function reliabilitySummary(meta, title) {
  if (title === "Discovery Score Health") return "Score freshness reflects the current snapshot. Fresh scores do not confirm complete discovery-activity recording.";
  const messages = reliabilityMessages(meta, title);
  if (meta?.availability === "unavailable") return messages[0];
  const coverage = messages.find((message) => /coverage|completeness/i.test(message)) ?? messages[0];
  const current = meta?.partial_reasons?.includes("current_day_incomplete") ? " Today's reporting period is still in progress." : "";
  return coverage + (coverage.includes("still in progress") ? "" : current);
}
