import {
  ArrowUpRight,
  ClipboardList,
  FilePenLine,
  Flag,
  Gavel,
  MapPin,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  formatCount,
  formatTimestamp,
} from "../../analytics/utils/presentation";
import {
  dashboardLinkClass,
  workItemDestination,
  workItemLabels,
  workItemStatus,
} from "../utils/dashboardPresentation";

const icons = {
  merchant_application: ClipboardList,
  business_name_change: FilePenLine,
  classification_change: Tags,
  location_change: MapPin,
  under_review: ShieldCheck,
  reported_review: Flag,
  review_dispute: Gavel,
};

/** Keep the server's mixed-workflow priority order in compact rows with verified semantic links. */
export default function PriorityWorklist({ items }) {
  if (!items)
    return (
      <p className="py-4 text-sm text-text-secondary">
        Worklist data is unavailable.
      </p>
    );
  if (items.length === 0)
    return (
      <p className="py-6 text-sm text-text-secondary">
        No pending work. Your queues are clear.
      </p>
    );
  return (
    <ul className="divide-y divide-stroke">
      {/* Whole-row links use only known workflow types and valid identifiers */}
      {items.slice(0, 5).map((item) => {
        const label = workItemLabels[item.type] ?? "Pending work";
        const destination = workItemDestination(item.type, item.entity?.id);
        const Icon = icons[item.type] ?? ClipboardList;
        const status = workItemStatus(item);
        const marker =
          item.application_aging?.status === "overdue"
            ? "bg-danger"
            : item.application_aging?.status === "approaching"
              ? "bg-warning"
              : "bg-neutral";
        const content = (
          <>
            <Icon
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
            />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <p className="text-sm font-medium text-text-primary">
                {item.entity?.label ?? item.title}
              </p>
              <p className="mt-1 text-xs text-text-secondary">{label}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {item.timestamp ? (
                  <time dateTime={item.timestamp}>
                    {formatTimestamp(item.timestamp)} · Manila
                  </time>
                ) : (
                  "Queue time unavailable"
                )}
              </p>
              {item.pending_report_count != null && (
                <p className="mt-1 text-xs text-text-secondary">
                  {formatCount(item.pending_report_count)} pending{" "}
                  {item.pending_report_count === 1 ? "report" : "reports"}
                </p>
              )}
            </div>
            <span className="flex max-w-32 items-center gap-1.5 text-xs text-text-primary">
              <span
                aria-hidden="true"
                className={"h-1.5 w-1.5 shrink-0 rounded-full " + marker}
              />
              {status}
            </span>
            {destination && (
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-text-secondary"
              />
            )}
          </>
        );
        return (
          <li key={item.id}>
            {destination ? (
              <Link
                to={destination}
                aria-label={
                  "Review " +
                  label.toLowerCase() +
                  ": " +
                  (item.entity?.label ?? item.title)
                }
                className={
                  dashboardLinkClass +
                  " flex items-start gap-3 py-3 hover:bg-surface-hover"
                }
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-3 py-3">
                {content}
                <span className="sr-only">Destination unavailable</span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
