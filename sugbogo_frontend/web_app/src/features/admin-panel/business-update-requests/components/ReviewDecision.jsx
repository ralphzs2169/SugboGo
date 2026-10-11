import { CircleCheck } from "lucide-react";

import { formatDateTime } from "@/shared/utils/dateUtils";

/** Displays the immutable outcome and feedback of a resolved request. */
export default function ReviewDecision({ request }) {
  const reviewer = request.reviewer?.name || request.reviewer?.email || "Admin";

  return (
    <section className="border-t border-stroke p-5 sm:p-6">
      <div className="flex items-center gap-2 text-text-secondary">
        <CircleCheck size={16} aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Review Decision
        </h3>
      </div>

      {request.status === "approved" && (
        <p className="mt-4 text-sm leading-6 text-text-primary">
          Approved by <span className="font-semibold">{reviewer}</span>
          {request.resolved_at
            ? ` on ${formatDateTime(request.resolved_at)}`
            : ""}
          .
        </p>
      )}

      {request.status === "rejected" && (
        <>
          <p className="mt-4 text-xs font-medium text-text-secondary">
            Administrator's feedback
          </p>
          <div className="mt-2 rounded-lg bg-surface p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
              {request.rejection_reason || "No feedback recorded."}
            </p>
          </div>
          <p className="mt-4 text-xs text-text-secondary">
            Rejected by {reviewer}
            {request.resolved_at
              ? ` on ${formatDateTime(request.resolved_at)}`
              : ""}
            .
          </p>
        </>
      )}

      {request.status === "withdrawn" && (
        <p className="mt-4 text-sm leading-6 text-text-secondary">
          Withdrawn by the merchant
          {request.resolved_at
            ? ` on ${formatDateTime(request.resolved_at)}`
            : ""}
          . No further review is required.
        </p>
      )}
    </section>
  );
}
