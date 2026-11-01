import { ClipboardList, FilePenLine, Flag, Gavel, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount } from "../../analytics/utils/presentation";
import { dashboardLinkClass, dashboardQueues } from "../utils/dashboardPresentation";

/** Surface current actionable queues with explicit application ages and request-type breakdowns. */
export default function NeedsAttention({ summary }) {
  const aging = summary.applications?.aging;
  const changes = summary.change_requests?.by_type;
  const cards = [
    { label: "Applications", value: summary.applications?.pending_review, to: dashboardQueues.applications, icon: ClipboardList },
    { label: "Changes", value: summary.change_requests?.pending_total, to: dashboardQueues.changes, icon: FilePenLine },
    { label: "Reviews under review", value: summary.reviews_under_review, to: dashboardQueues.underReview, icon: ShieldCheck },
    { label: "Reports", value: summary.reported_review_cases, to: dashboardQueues.reports, icon: Flag },
    { label: "Disputes", value: summary.pending_disputes, to: dashboardQueues.disputes, icon: Gavel },
  ];

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {/* Current queue inventories stay distinct, including overlapping review workflows */}
      {cards.map(({ label, value, to, icon: Icon }) => (
        <article key={label} className="min-w-0 rounded-xl border border-stroke bg-background p-4">
          <Link to={to} className={`block ${dashboardLinkClass}`} aria-label={`${label}: ${formatCount(value)}. Open queue`}>
            <Icon aria-hidden="true" className="mb-3 h-4 w-4 text-text-secondary" />
            <span className="block text-2xl font-semibold tabular-nums tracking-tight">{formatCount(value)}</span>
            <h3 className="mt-1 text-sm font-medium">{label}</h3>
          </Link>
          {label === "Applications" && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link className={`${dashboardLinkClass} text-xs`} to={`${to}&queue_status=approaching`}>
                {formatCount(aging?.approaching)} approaching
              </Link>
              <Link className={`${dashboardLinkClass} text-xs`} to={`${to}&queue_status=overdue`}>
                {formatCount(aging?.overdue)} overdue
              </Link>
              {aging?.unknown_age > 0 && <span className="text-text-secondary">{formatCount(aging.unknown_age)} age unavailable</span>}
            </div>
          )}
          {label === "Changes" && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {[
                ["business_name", "Name"],
                ["classification", "Classification"],
                ["location", "Location"],
              ].map(([type, name]) => (
                <Link key={type} className={`${dashboardLinkClass} text-xs`} to={`/admin-panel/businesses/update-requests?type=${type}&status=pending`}>
                  {name} {formatCount(changes?.[type])}
                </Link>
              ))}
            </div>
          )}
          {label === "Reviews under review" && <p className="mt-3 text-xs leading-relaxed text-text-secondary">Includes moderation processing.</p>}
          {label === "Reports" && <p className="mt-3 text-xs text-text-secondary">Distinct review cases</p>}
          {label === "Disputes" && <p className="mt-3 text-xs text-text-secondary">Awaiting resolution</p>}
        </article>
      ))}
    </div>
  );
}
