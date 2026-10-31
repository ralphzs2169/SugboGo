import { geographicAreaRows, geographicExclusionLabel } from "./geographicPresentation.js";

const valueAt = (row, path) => path.split(".").reduce((value, key) => value?.[key], row);

/** Quotes CSV cells and neutralizes spreadsheet formulas without rounding numeric values. */
export function csvCell(value) {
  let text = value == null ? "Unavailable" : String(value);
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Whitelists complete tabular datasets; bounded rankings never masquerade as full exports. */
export function reportRecords(title, report, series = []) {
  if (!report || report.meta?.availability === "unavailable") return [];
  const records = [];
  function add(dataset, rows, columns, identity = "label") {
    for (const [index, row] of (Array.isArray(rows) ? rows : []).entries()) {
      for (const [path, label] of columns) {
        const value = valueAt(row, path);
        if (value !== undefined) records.push([dataset, row[identity] ?? index + 1, label, value]);
      }
    }
  }
  if (title === "Businesses Needing Attention") {
    add("Filtered businesses", report.items, [["business_id", "Business ID"], ["business_name", "Business"], ["category_name", "Category"], ["cluster_name", "Cluster"], ["profile_visits", "Profile visits"], ["saves", "Saves"], ["distinct_savers", "Distinct savers"], ["valid_vouches", "Valid vouches"], ["distinct_supporters", "Supporters"], ["attention_reason", "Reason"]], "business_id");
  } else if (title === "Business Coverage") {
    const columns = [["eligible_businesses", "Eligible businesses"], ["visited_businesses", "Businesses with recorded visits"], ["zero_recorded_visit_businesses", "Businesses without recorded visits"], ["coverage_percentage", "Coverage (%)"]];
    add("Overall", [report.overall], columns);
    add("Categories", report.categories, columns, "name");
    add("Clusters", report.clusters, columns, "name");
  } else if (title === "Discovery Score Health") {
    add("Current score health", [report.coverage], ["active_businesses", "fresh", "stale", "pending", "failed", "missing", "provisional"].map((key) => [key, key.replaceAll("_", " ") ]));
  } else if (title === "Geographic Distribution") {
    add("Geographic areas", geographicAreaRows(report.cells ?? []), [["eligible_businesses", "Current businesses"], ["profile_visits", "Recorded profile visits"]], "area_label");
    add("Excluded locations", Object.entries(report.reconciliation?.excluded_by_reason ?? {}).map(([reason, values]) => ({ reason: geographicExclusionLabel(reason), ...values })), [["businesses", "Businesses"], ["profile_visits", "Recorded visits"]], "reason");
  } else if (title === "Transportation Planning") {
    add("Planning method composition", report.methods, [["count", "Recorded requests"], ["share_percent", "Share (%)"]]);
    add("Planning time buckets", report.series, [["road_route", "Road routes"], ["jeepney", "Jeepney guidance"], ["other", "Other methods"]], "date");
  } else if (title === "Discovery Sources") {
    add("Recorded visit sources", report.sources, [["count", "Recorded visits"], ["share_percent", "Share (%)"]]);
  } else if (title === "Specialty Support" && Array.isArray(report.specialties)) {
    add("Complete specialty support", report.specialties, [["valid_vouches", "Valid vouches"], ["distinct_supporters", "Distinct supporters"], ["supported_businesses", "Supported businesses"]], "name");
  } else if (title === "Business Acquisition" && Array.isArray(report.hierarchy)) {
    add("Cluster subtotals", report.hierarchy, [["created", "New businesses"]], "name");
    for (const cluster of report.hierarchy) add(`Categories in ${cluster.name}`, cluster.categories, [["created", "New businesses"]], "name");
  } else if (title === "Reports & disputes") {
    const columns = [["total", "Pending"], ["under_1_day", "Under 24 hours"], ["days_1_to_2", "24 to under 72 hours"], ["days_3_plus", "72 hours or more"], ["unknown_age", "Unknown age"]];
    add("Current queues", [{ label: "Review reports", ...report.open_reports }, { label: "Disputes", ...report.open_disputes }], columns);
    add("Dispute resolution", [report.completed_dispute_turnaround], [["median_hours", "Median resolution hours"], ["sample_count", "Valid decisions"], ["excluded_invalid_duration_count", "Excluded durations"], ["missing_resolution_timestamp_count", "Missing resolution dates (all time)"]]);
  } else if (title === "Merchant Onboarding" || title === "Onboarding rejection breakdown") {
    add("Weekly workload", report.series, series.map((item) => [item.key, item.label]), "date");
    add("Rejected sections", report.rejection_insights?.sections, [["rejection_decisions", "Rejected decisions"], ["distinct_applications", "Distinct applications"], ["decision_share_percentage", "Share of decisions (%)"]]);
    add("Current pending age", [report.pending_aging], [["on_time", "On time"], ["approaching", "Approaching SLA"], ["overdue", "Overdue"], ["unknown_age", "Unknown age"]]);
    add("Review resolution", [report.review_turnaround], [["median_hours", "Median hours"], ["mean_hours", "Mean hours"], ["sample_count", "Valid decisions"], ["excluded_count", "Excluded records"], ["missing_timestamp_count", "Missing dates"], ["invalid_chronology_count", "Invalid date order"], ["unrelated_record_count", "Unrelated records"]]);
  } else if (title === "Merchant change requests") {
    add("Request processing", [{ ...report, label: "All requests" }, ...(report.types ?? [])], [["backlog.total", "Pending"], ["backlog.under_1_day", "Pending under 24 hours"], ["backlog.days_1_to_2", "Pending 24 to under 72 hours"], ["backlog.days_3_plus", "Pending 72 hours or more"], ["backlog.unknown_age", "Pending with unknown age"], ["period_outcomes.approved", "Approved"], ["period_outcomes.rejected", "Rejected"], ["period_outcomes.withdrawn", "Withdrawn"], ["turnaround.median_hours", "Median resolution hours"], ["turnaround.mean_hours", "Mean resolution hours"], ["turnaround.sample_count", "Valid decisions"], ["turnaround.excluded_count", "Excluded durations"], ["missing_resolution_timestamp_count", "Missing resolution dates (all time)"]]);
  } else if (series.length && Array.isArray(report.series)) {
    add("Reporting buckets", report.series, series.map((item) => [item.key, item.label]), "date");
    if (title === "Platform Growth") {
      for (const item of series) add("Period comparisons", [{ label: item.label, ...report.activity?.[item.key] }], [["value", "Current period"], ["previous_value", "Previous period"], ["change.value", "Change"]]);
    }
    if (title === "Community Health") {
      add("Review totals", [report.current], [["published_review_count", "Published reviews"], ["classified_review_count", "Classified reviews"], ["unclassified_review_count", "Unclassified reviews"]]);
      for (const sentiment of ["positive", "neutral", "negative"]) add("Sentiment", [{ label: sentiment, ...report.current?.sentiment?.[sentiment] }], [["count", "Reviews"], ["percentage", "Share (%)"]]);
    }
  }
  return records;
}

/** Fetches every filtered page through the existing endpoint, rejecting incomplete/changing totals. */
export async function collectAttentionPages(fetchPage, params, signal) {
  const rows = [];
  let expected;
  const ids = new Set();
  for (let page = 1; ; page += 1) {
    if (signal?.aborted) throw new Error("Export cancelled.");
    const report = await fetchPage({ ...params, page, page_size: 100 }, { signal });
    if (signal?.aborted) throw new Error("Export cancelled.");
    if (!Array.isArray(report.items) || !report.pagination || report.meta?.availability === "unavailable") throw new Error("Complete observations are unavailable. Try exporting again.");
    const pagination = report.pagination;
    expected ??= pagination.total_items;
    if (expected !== pagination.total_items || page > pagination.total_pages + 1) throw new Error("The report changed during export. Try again.");
    for (const row of report.items) {
      if (ids.has(row.business_id)) throw new Error("The report changed during export. Try again.");
      ids.add(row.business_id);
      rows.push(row);
    }
    if (!pagination.has_next) {
      if (rows.length !== expected) throw new Error("The complete report could not be retrieved.");
      return { ...report, items: rows };
    }
    if (!report.items.length) throw new Error("The complete report could not be retrieved.");
  }
}

/** Adds readable context to every CSV row, preserving source precision and null observations. */
export function reportCsv(title, report, records, context = {}) {
  const period = report.meta?.period;
  const headers = ["Report", "Period from", "Period through", "Reporting timezone", "Prepared at", "Coverage", ...Object.keys(context), "Dataset", "Item", "Measure", "Value", "Observation scope"];
  const coverage = report.meta?.coverage_verified === true ? "Verified" : report.meta?.coverage_verified === false ? "Unverified" : "Not confirmed";
  const prefix = [title, period?.start_date ?? "Current snapshot", period?.end_date ?? "Current snapshot", "Philippine time", report.meta?.generated_at ?? report.coverage?.snapshot_at ?? report.as_of ?? "Not available", coverage, ...Object.values(context)];
  function scope(row) {
    if (row[2].includes("(all time)")) return "All retained records; selected dates do not filter these counts";
    if (row[2].startsWith("Pending")) return "Current pending requests; selected dates do not filter these counts";
    if (title === "Business Acquisition") return "Selected period; cluster counts are category subtotals and must not be added to them";
    if (row[0].startsWith("Current") || ["Discovery Score Health", "Specialty Support"].includes(title)) return "Current snapshot; selected dates do not filter these counts";
    if (["Business Coverage", "Geographic Distribution", "Businesses Needing Attention"].includes(title)) return "Current business inventory and support; visits and saves use the selected period";
    return "Selected reporting period";
  }
  return "\uFEFF" + [headers, ...records.map((row) => [...prefix, ...row, scope(row)])].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Downloads one UTF-8 CSV and releases its object URL after the browser starts the download. */
export function downloadReport(title, report, records, context) {
  const url = URL.createObjectURL(new Blob([reportCsv(title, report, records, context)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  const period = report.meta?.period;
  anchor.href = url;
  anchor.download = `${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}_${period?.start_date ?? "snapshot"}_to_${period?.end_date ?? "current"}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
