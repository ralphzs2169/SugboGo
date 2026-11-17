const date = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });

/** Formats inclusive reporting dates without exposing storage timestamps. */
export function readablePeriod(period) {
  if (!period?.start_date || !period?.end_date) return "Reporting dates unavailable";
  return date.formatRange(new Date(`${period.start_date}T00:00:00+08:00`), new Date(`${period.end_date}T00:00:00+08:00`));
}

export const reportExplanations = {
  "Geographic Distribution": [
    "Current eligible businesses and recorded profile visits grouped by the current business locations in the approved Cebu City grid.",
    "Business counts reflect current eligible inventory, grouped into fixed square cells of 1 km² projected area. Recorded visits use the selected Philippine reporting period and existing daily recording rules. Cluster and category filters apply to both values. Empty cells, zero observations and unavailable visits remain distinct.",
    "This is not explorer location, foot traffic, physical visits or movement. Current location changes can move earlier recorded activity between cells. Missing, invalid or out-of-scope business locations are excluded and listed in View data.",
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
  "First Profile Visit Source": [
    "The first recorded source of a business profile visit for each Explorer or Merchant account, per business and UTC calendar day.",
    "Later visits from the same account to the same business on that UTC day are deduplicated, even if the entry point changes. The first recorded source is kept. A new UTC day starts at 8 AM Philippine time.",
    "The recorded entry point can differ from where the visitor originally discovered the business. Shares include visits with unknown sources.",
  ],
  "Transportation Planning": [
    "How often explorers request road-route or Jeepney travel guidance for businesses.",
    "At most one request is recorded per account, business and transportation method each day. Account totals count each identifiable account once across the whole period.",
    "These are recorded requests, not completed journeys or physical visits. Activity before recording began cannot be measured. Other methods are counted separately. Requests that cannot be linked to an account stay in request totals but are excluded from distinct account counts. For these daily limits, a new counting day begins at 8 AM Philippine time.",
  ],
  "Platform Growth": [
    "New accounts and businesses joining SugboGo during the selected period.",
    "Each measure follows its own creation date. Account counts use current consumer roles; businesses can be active or suspended.",
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
};
