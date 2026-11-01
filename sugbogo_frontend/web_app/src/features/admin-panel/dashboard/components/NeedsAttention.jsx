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

const CHIP_TONES = {
  danger: "bg-danger/15 text-text-primary",
  warning: "bg-warning/15 text-text-primary",
  neutral: "bg-neutral/10 text-text-secondary",
};

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

/** Link to a queue breakdown, with neutral zero values and readable semantic status indicators. */
function QueueChip({
  to,
  count,
  tone = "neutral",
  dot = false,
  label,
  children,
}) {
  const activeTone = count > 0 ? tone : "neutral";

  return (
    <Link
      to={to}
      aria-label={label}
      className={`${dashboardLinkClass} relative z-10 inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 py-1 text-xs tabular-nums [@media(pointer:coarse)]:min-h-11 ${CHIP_TONES[activeTone]}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${activeTone === "danger" ? "bg-danger" : activeTone === "warning" ? "bg-warning" : "bg-neutral"}`}
        />
      )}
      <span className="font-medium">{formatCount(count)}</span>
      {children}
    </Link>
  );
}

/** Present open review workflows with accessible queue links and distinct application aging states. */
export default function NeedsAttention({ summary }) {
  const aging = summary.applications?.aging;
  const changes = summary.change_requests?.by_type;
  const hasOverdue = aging?.overdue > 0;

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
          <QueueChip
            to={`${dashboardQueues.applications}&queue_status=overdue`}
            count={aging?.overdue}
            tone="danger"
            dot
            label={`${formatCount(aging?.overdue)} overdue applications`}
          >
            overdue
          </QueueChip>
          <QueueChip
            to={`${dashboardQueues.applications}&queue_status=approaching`}
            count={aging?.approaching}
            tone="warning"
            dot
            label={`${formatCount(aging?.approaching)} applications approaching deadline`}
          >
            approaching
          </QueueChip>
          {aging?.unknown_age > 0 && (
            <span>{formatCount(aging.unknown_age)} age unavailable</span>
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
      footer: CHANGE_TYPES.map(([type, name]) => (
        <QueueChip
          key={type}
          to={`/admin-panel/businesses/update-requests?type=${type}&status=pending`}
          count={changes?.[type]}
          label={`${name} change requests: ${formatCount(changes?.[type])}`}
        >
          {name}
        </QueueChip>
      )),
    },
    {
      key: "moderation",
      label: "Review moderation",
      description: "Being evaluated",
      value: summary.reviews_under_review,
      to: dashboardQueues.underReview,
      icon: ShieldCheck,
      footer: <span>Includes automated processing</span>,
    },
    {
      key: "reports",
      label: "Reported reviews",
      description: "Distinct reviews",
      value: summary.reported_review_cases,
      to: dashboardQueues.reports,
      icon: Flag,
      footer: <span>With pending reports</span>,
    },
    {
      key: "disputes",
      label: "Disputes",
      description: "Pending merchant disputes",
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
            className={`group relative flex min-w-0 cursor-pointer flex-col rounded-xl border bg-background p-3 transition-colors hover:border-stroke-strong hover:bg-surface-hover active:bg-surface-muted ${urgent ? "border-danger/40" : "border-stroke"}`}
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

            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
              {formatCount(value)}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">{description}</p>

            {/* Queue details stay separate links rather than nested card actions */}
            <div className="mt-3 flex min-h-7 flex-wrap items-center gap-1.5 border-t border-stroke pt-3 text-xs text-text-secondary">
              {footer}
            </div>
          </article>
        ),
      )}
    </div>
  );
}
