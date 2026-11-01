import {
  ChevronRight,
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

/** Keep server priority order in compact, accessible workflow rows with one section-level timezone. */
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
        const overdue =
          item.type === "merchant_application" &&
          item.application_aging?.status === "overdue";
        const hasTimestamp =
          item.timestamp && Number.isFinite(Date.parse(item.timestamp));
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
              <p className="text-sm font-medium leading-5 text-text-primary">
                {item.entity?.label || item.title || "Entity unavailable"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs font-normal leading-5 text-text-secondary">
                <span>{label}</span>
                <span aria-hidden="true">·</span>
                {hasTimestamp ? (
                  <time dateTime={item.timestamp}>
                    {formatTimestamp(item.timestamp)}
                  </time>
                ) : (
                  "Queue time unavailable"
                )}
                {item.pending_report_count != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatCount(item.pending_report_count)} pending{" "}
                      {item.pending_report_count === 1 ? "report" : "reports"}
                    </span>
                  </>
                )}
              </p>
            </div>
            <span
              className={`flex max-w-28 shrink-0 items-center gap-1.5 text-xs leading-5 ${overdue ? "font-semibold text-danger" : "font-medium text-text-primary"}`}
            >
              <span
                aria-hidden="true"
                className={"h-1.5 w-1.5 shrink-0 rounded-full " + marker}
              />
              {status}
            </span>
            {destination && (
              <ChevronRight
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary group-hover:text-text-primary"
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
                  " group flex items-start gap-2.5 py-2.5 hover:bg-surface-hover"
                }
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-start gap-2.5 py-2.5">
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
