import { reportExplanations } from "../utils/reportClarity";
import { formatTimestamp } from "../utils/presentation";
import { AlertTriangle, Calculator, Info } from "lucide-react";

const SECTIONS = [
  { heading: "What this report shows", icon: Info },
  { heading: "How the numbers are calculated", icon: Calculator },
  { heading: "Important limitations", icon: AlertTriangle },
];

/** Leads report details with essential interpretation before advanced methodology. */
export default function AnalyticsReportExplanation({ title, report }) {
  const copy = reportExplanations[title];
  if (!copy) return null;
  return (
    <div className="space-y-4 text-sm text-text-secondary">
      {/* Short explanations retain the report's important counting limitations. */}
      {SECTIONS.map(({ heading, icon: Icon }, index) => copy[index] && <div key={heading}><h3 className="mb-1 flex items-center gap-2 font-semibold text-text-primary"><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />{heading}</h3><p>{copy[index]}</p></div>)}
      {title === "Transportation Planning" && <p>Recording began: {formatTimestamp(report?.tracking_started_at)} Philippine time.</p>}
    </div>
  );
}
