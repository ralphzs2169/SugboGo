import { reportExplanations } from "../utils/reportClarity";
import { formatTimestamp } from "../utils/presentation";

/** Leads report details with essential interpretation before advanced methodology. */
export default function AnalyticsReportExplanation({ title, report }) {
  const copy = reportExplanations[title];
  if (!copy) return null;
  return (
    <div className="space-y-4 text-sm text-text-secondary">
      {/* Short explanations retain the report's important counting limitations. */}
      {["What this report shows", "How the numbers are calculated", "Important limitations"].map((heading, index) => <div key={heading}><h3 className="mb-1 font-semibold text-text-primary">{heading}</h3><p>{copy[index]}</p></div>)}
      {title === "Transportation Planning" && <p>Recording began: {formatTimestamp(report?.tracking_started_at)} Philippine time.</p>}
    </div>
  );
}
