import { ChevronRight, History } from "lucide-react";
import { Link } from "react-router-dom";
import { formatTimestamp } from "../../analytics/utils/presentation";
import {
  dashboardLinkClass,
  decisionDestination,
} from "../utils/dashboardPresentation";

/** Preserve recorded decision order and actor attribution, with safe labels and one section-level timezone. */
export default function RecentDecisions({ items }) {
  if (!items) {
    return (
      <p className="py-4 text-sm text-text-secondary">
        Recent decisions are unavailable.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-text-secondary">
        No recorded administrative decisions yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stroke">
      {/* Backend order and safe normalized fields remain the source of truth */}
      {items.map((event) => {
        const destination = decisionDestination(event);
        const entityLabel = event.entity?.label || "Entity unavailable";
        const actor = event.administrator_name || "Administrator unavailable";
        const hasTimestamp =
          event.timestamp && Number.isFinite(Date.parse(event.timestamp));
        return (
          <li
            key={event.id}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4 first:pt-1 last:pb-1"
          >
            <div className="flex min-w-0 flex-1 basis-52 items-start gap-3">
              <History
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
              />
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p className="text-sm font-medium text-text-primary">
                  {event.action_label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {destination ? (
                    <Link
                      className={`${dashboardLinkClass} inline-flex max-w-full items-center gap-1 text-xs`}
                      to={destination}
                      aria-label={`${event.action_label}: ${entityLabel}`}
                    >
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        {entityLabel}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0"
                      />
                    </Link>
                  ) : (
                    entityLabel
                  )}
                  <span className="mx-1.5" aria-hidden="true">
                    ·
                  </span>
                  <span>{actor}</span>
                </p>
              </div>
            </div>
            {hasTimestamp ? (
              <time
                dateTime={event.timestamp}
                className="ml-7 text-xs leading-relaxed text-text-secondary sm:ml-0"
              >
                {formatTimestamp(event.timestamp)}
              </time>
            ) : (
              <span className="ml-7 text-xs text-text-secondary sm:ml-0">
                Decision time unavailable
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
