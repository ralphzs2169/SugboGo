const date = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** Formats inclusive reporting dates without exposing storage timestamps. */
export function readablePeriod(period) {
  if (!period?.start_date || !period?.end_date) return "Reporting dates unavailable";
  return date.formatRange(new Date(`${period.start_date}T00:00:00+08:00`), new Date(`${period.end_date}T00:00:00+08:00`));
}

export const reportExplanations = {
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
    "Application submissions, review decisions, processing time and rejection patterns.",
    "Processing time links each decision to the submission it reviewed. Rejection sections can overlap. Pending applications show the current queue, regardless of the selected dates.",
    "Processing time uses the selected decision period. Overall SLA compliance uses classified outcomes across all recorded reviews. Recovery counts applications that submitted again strictly after rejection, across all time. Missing or inconsistent dates are excluded from time calculations.",
  ],
};
