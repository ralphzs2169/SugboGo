import { CalendarCheck2, CalendarDays, Info } from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";

/** Shows the captured request ID and submission and resolution dates. */
export default function ReviewRequestInformation({ request }) {
  return (
    <section className="p-5 sm:p-6">
      <div className="flex items-center gap-2 text-text-secondary">
        <Info size={16} aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Request Information
        </h3>
      </div>

      <dl className="mt-5 space-y-4">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
          <dt className="text-sm text-text-secondary">Request</dt>
          <dd className="text-sm font-semibold text-text-primary">
            #{request.id}
          </dd>
        </div>

        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
          <dt className="text-sm text-text-secondary">Submitted</dt>
          <dd className="flex min-w-0 items-start gap-2 text-sm font-medium text-text-primary">
            <CalendarDays
              size={15}
              className="mt-0.5 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <span>{formatDateTime(request.submitted_at)}</span>
          </dd>
        </div>

        {request.resolved_at && (
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-sm text-text-secondary">Resolved</dt>
            <dd className="flex min-w-0 items-start gap-2 text-sm font-medium text-text-primary">
              <CalendarCheck2
                size={15}
                className="mt-0.5 shrink-0 text-text-secondary"
                aria-hidden="true"
              />
              <span>{formatDateTime(request.resolved_at)}</span>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
