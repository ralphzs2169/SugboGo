import {
  ChevronRight,
  ClipboardList,
  FilePenLine,
  Flag,
  Gavel,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatCount } from "../../analytics/utils/presentation";
import {
  dashboardLinkClass,
  dashboardQueues,
} from "../utils/dashboardPresentation";

const ICON_TONES = {
  applications: "bg-primary/15 text-primary",
  changes: "bg-info/15 text-info",
  moderation: "bg-neutral/15 text-neutral",
  reports: "bg-danger/15 text-danger",
  disputes: "bg-neutral/15 text-text-secondary",
};

const CHANGE_TYPES = [
  ["business_name", "Name"],
  ["classification", "Classification"],
  ["location", "Location"],
];

/** Present compact queue inventories with verified navigation and data-driven overdue emphasis. */
export default function NeedsAttention({ summary }) {
  const aging = summary.applications?.aging;
  const changes = summary.change_requests?.by_type;
  const hasOverdue = aging?.overdue > 0;
  const changeBreakdownAvailable = CHANGE_TYPES.every(
    ([type]) => Number.isInteger(changes?.[type]) && changes[type] >= 0,
  );
  const nonzeroChanges = CHANGE_TYPES.filter(([type]) => changes?.[type] > 0);

  const cards = [
    {
      key: "applications",
      label: "Applications",
      description: "Awaiting review",
      value: summary.applications?.pending_review,
      to: dashboardQueues.applications,
      icon: ClipboardList,
      urgent: hasOverdue,
      ariaDetail: hasOverdue ? `, ${formatCount(aging.overdue)} overdue` : "",
      footer: (
        <>
          {hasOverdue ? (
            <Link
              to={`${dashboardQueues.applications}&queue_status=overdue`}
              aria-label={`${formatCount(aging.overdue)} overdue applications`}
              className={`${dashboardLinkClass} relative z-10 inline-flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 text-xs text-text-primary`}
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-danger"
              />
              {formatCount(aging.overdue)} overdue
            </Link>
          ) : aging?.approaching > 0 ? (
            <Link
              to={`${dashboardQueues.applications}&queue_status=approaching`}
              aria-label={`${formatCount(aging.approaching)} applications approaching deadline`}
              className={`${dashboardLinkClass} relative z-10 text-xs`}
            >
              {formatCount(aging.approaching)} approaching
            </Link>
          ) : aging?.unknown_age > 0 ? null : (
            <span>
              {aging?.overdue === 0
                ? summary.applications?.pending_review === 0
                  ? "No pending applications"
                  : "No overdue applications"
                : "Aging unavailable"}
            </span>
          )}
          {aging?.unknown_age > 0 && (
            <span>
              {hasOverdue || aging.approaching > 0 ? " · " : ""}
              {formatCount(aging.unknown_age)} age unavailable
            </span>
          )}
        </>
      ),
    },
    {
      key: "changes",
      label: "Changes",
      description: "Pending requests",
      value: summary.change_requests?.pending_total,
      to: dashboardQueues.changes,
      icon: FilePenLine,
      footer: !changeBreakdownAvailable
        ? "Breakdown unavailable"
        : nonzeroChanges.length === 0
          ? "No pending changes"
          : nonzeroChanges.map(([type, name], index) => (
              <span key={type}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                <Link
                  to={`/admin-panel/businesses/update-requests?type=${type}&status=pending`}
                  aria-label={`${name} change requests: ${formatCount(changes[type])}`}
                  className={`${dashboardLinkClass} relative z-10 whitespace-nowrap text-xs`}
                >
                  {formatCount(changes[type])} {name.toLowerCase()}
                </Link>
              </span>
            )),
    },
    {
      key: "moderation",
      label: "Review moderation",
      description: "Under review",
      value: summary.reviews_under_review,
      to: dashboardQueues.underReview,
      icon: ShieldCheck,
      footer: <span>Includes automated processing</span>,
    },
    {
      key: "reports",
      label: "Reported reviews",
      description: "Pending cases",
      value: summary.reported_review_cases,
      to: dashboardQueues.reports,
      icon: Flag,
      footer: <span>Distinct reviews with pending reports</span>,
    },
    {
      key: "disputes",
      label: "Disputes",
      description: "Pending disputes",
      value: summary.pending_disputes,
      to: dashboardQueues.disputes,
      icon: Gavel,
      footer: <span>Awaiting resolution</span>,
    },
  ];

  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {/* Current queue inventories stay distinct, including overlapping review workflows */}
      {cards.map(
        ({
          key,
          label,
          description,
          value,
          to,
          icon: Icon,
          urgent,
          ariaDetail = "",
          footer,
        }) => (
          <article
            key={key}
            className={`group relative flex min-w-0 cursor-pointer flex-col rounded-xl border bg-background p-3 transition-colors hover:bg-surface-hover active:bg-surface-muted ${urgent ? "border-danger/40 hover:border-danger/60" : "border-stroke hover:border-stroke-strong"}`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_TONES[key]}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <h3 className="min-w-0 flex-1 break-words text-sm font-medium text-text-primary">
                <Link
                  to={to}
                  className="cursor-pointer after:absolute after:inset-0 after:rounded-xl hover:text-primary focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-info"
                  aria-label={`${label}: ${formatCount(value)}${ariaDetail}. Open queue`}
                >
                  {label}
                </Link>
              </h3>
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
              {formatCount(value)}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">{description}</p>

            {/* Queue details stay separate links rather than nested card actions */}
            <div className="mt-2 break-words text-xs leading-relaxed text-text-secondary">
              {footer}
            </div>
          </article>
        ),
      )}
    </div>
  );
}
