const date = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** Formats inclusive reporting dates without exposing storage timestamps. */
export function readablePeriod(period) {
  if (!period?.start_date || !period?.end_date) return "Reporting dates unavailable";
  return date.formatRange(new Date(`${period.start_date}T00:00:00+08:00`), new Date(`${period.end_date}T00:00:00+08:00`));
}

export const reportExplanations = {
  "Reports & disputes": [
    "Current pending review reports and disputes, plus the time taken to resolve eligible disputes during the selected period.",
    "Queue counts include all currently pending items, regardless of selected dates. Overdue means pending for at least 72 elapsed hours. Median resolution time uses upheld or dismissed disputes resolved during the selected period, measured from creation; withdrawals are excluded.",
    "Current queues cannot reconstruct historical backlog. Missing or future creation dates have unknown age. Missing or inconsistent timestamps are excluded from resolution durations; missing resolution dates across all completed disputes cannot be assigned to a selected period.",
  ],
  "Community Health": [
    "Reviews written during the selected period that are still published today, alongside their recorded sentiment.",
    "Activity counts reviews by their creation dates in Philippine daily or weekly buckets. Sentiment shares use classified reviews only; unclassified reviews remain separate and are excluded from the denominator.",
    "Later removal or sentiment changes can revise earlier counts. This is not a history of publication changes. Reviews do not include star ratings, and no sentiment is inferred for unclassified reviews.",
  ],
  "Specialty Support": [
    "Current valid specialty endorsements, distinct supporters and supported businesses. Selected dates do not filter this snapshot.",
    "Each valid, non-withdrawn endorsement on an active business-specialty assignment counts separately. Overall supporters and businesses are counted distinctly across all specialties.",
    "One person or business can appear under several specialties, so row-level distinct counts must not be added together. Only specialties with valid support are listed. Current assignments and evidence can change these counts; this report does not reconstruct historical support.",
  ],
  "Discovery Sources": [
    "Where recorded business profile visits originated across SugboGo.",
    "Each account can contribute at most one recorded visit per business each day. If the same business is opened from different areas that day, the first recorded source is kept.",
    "Not every opening is counted. Unknown sources remain included. Shares describe recorded visits, not conversion. For these daily limits, a new counting day begins at 8 AM Philippine time.",
  ],
  "Transportation Planning": [
    "How often explorers request road-route or Jeepney travel guidance for businesses.",
    "At most one request is recorded per account, business and transportation method each day. Account totals count each identifiable account once across the whole period.",
    "Planning a route does not mean the journey happened. Activity before recording began cannot be measured. Other methods are counted separately. Requests that cannot be linked to an account stay in request totals but are excluded from distinct account counts. For these daily limits, a new counting day begins at 8 AM Philippine time.",
  ],
  "Business Acquisition": [
    "New businesses during the selected period, grouped by their current cluster and category.",
    "Each business is counted once using its creation date. Category counts break down each cluster subtotal; do not add parent and child rows together.",
    "Current classifications can differ from when a business joined. Removed records can revise earlier counts. Missing classifications remain Unclassified. First approvals are reported separately in Platform Growth and Merchant Onboarding.",
  ],
  "Platform Growth": [
    "New accounts, new businesses and first recorded business approvals during the selected period.",
    "Each measure follows its own creation or approval date. Account counts use current consumer roles; businesses can be active or suspended.",
    "These are separate events, not a conversion funnel. Later role changes or removed records can revise earlier counts. Comparisons use the previous period of the same elapsed length.",
  ],
  "Discovery Activity": [
    "Recorded business impressions, profile visits, saves and discovery-active accounts.",
    "Activity follows the existing daily recording rules. Account counts include people using Explorer or Merchant roles with recorded discovery activity.",
    "Account counts are distinct within each day or week and must never be summed into a period total. These are not general active-user or retention measures. Missing observations remain gaps, not zeros. Previous-period comparisons are hidden while recording coverage is not fully verified.",
  ],
  "Merchant Onboarding": [
    "Applications submitted, review decisions, processing time and rejection patterns.",
    "Applications submitted include resubmissions; review decisions include approvals and rejections. These are independent weekly workloads: a decision may concern an earlier application, and a new application may be reviewed later. Their difference does not measure backlog change or conversion.",
    "Pending applications show the current queue. Processing time links each decision to its submission and uses the selected decision period. Overall SLA compliance uses classified outcomes across all recorded reviews. Recovery counts applications that submitted again after rejection, across all time. Rejection sections can overlap. Missing or inconsistent dates are excluded from time calculations.",
  ],
  "Merchant change requests": [
    "Current pending business changes and how each request type was processed during the selected period.",
    "Pending and overdue counts show the current queue, regardless of selected dates. Approved, rejected and withdrawn counts use resolution dates in the selected period. Resolution time measures submission to approval or rejection; merchant withdrawals stay separate.",
    "The overall median uses individual valid decisions, not an average of request-type medians. Missing or inconsistent dates are excluded from resolution times. Requests without resolution dates cannot be assigned to a reporting period. Current request states cannot reconstruct past queue sizes. Detailed aging and excluded samples remain available in View data.",
  ],
};
