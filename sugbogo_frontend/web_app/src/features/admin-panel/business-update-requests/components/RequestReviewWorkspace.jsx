import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/utils/dateUtils";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";
import MerchantChangeReason from "./MerchantChangeReason";

/** Shared review frame; the comparison stays first in reading and tab order. */
export default function RequestReviewWorkspace({
  request,
  type,
  error,
  onRetry,
  decisionError,
  onApprove,
  onReject,
  decisionPending,
  children,
}) {
  const reviewer = request.reviewer?.name || request.reviewer?.email || "Admin";

  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          The latest request details could not be loaded.
          <button
            type="button"
            className="ml-2 cursor-pointer font-semibold underline"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}

      <section className="rounded-xl border border-stroke bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Request overview
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {type} · Request #{request.id}
            </p>
          </div>
          <StatusBadge variant={UPDATE_REQUEST_STATUS_VARIANTS[request.status]}>
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </StatusBadge>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-stroke pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-text-secondary">Request ID</dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              #{request.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Business</dt>
            <dd className="mt-1 break-words text-sm font-medium text-text-primary">
              {request.current_business_name || "—"}
            </dd>
            <dd className="text-xs text-text-secondary">
              Business #{request.business_id}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Requested by</dt>
            <dd className="mt-1 break-words text-sm font-medium text-text-primary">
              {request.merchant?.name || request.merchant?.email || "—"}
            </dd>
            {request.merchant?.email && request.merchant?.name && (
              <dd className="break-all text-xs text-text-secondary">
                {request.merchant.email}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Submitted</dt>
            <dd className="mt-1 text-sm font-medium text-text-primary">
              {formatDateTime(request.submitted_at)}
            </dd>
          </div>
          {request.resolved_at && (
            <div>
              <dt className="text-xs text-text-secondary">Resolved</dt>
              <dd className="mt-1 text-sm font-medium text-text-primary">
                {formatDateTime(request.resolved_at)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(19rem,1fr)]">
        <div className="min-w-0 space-y-6">{children}</div>
        <aside className="min-w-0 space-y-6">
          <MerchantChangeReason reason={request.reason} />
          <section className="rounded-xl border border-stroke bg-background p-5">
            <h2 className="text-base font-semibold text-text-primary">
              Review decision
            </h2>
            {request.status === "approved" && (
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Approved by {reviewer} on {formatDateTime(request.resolved_at)}.
              </p>
            )}
            {request.status === "rejected" && (
              <>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
                  {request.rejection_reason || "No feedback recorded."}
                </p>
                <p className="mt-3 text-xs text-text-secondary">
                  Rejected by {reviewer} on{" "}
                  {formatDateTime(request.resolved_at)}.
                </p>
              </>
            )}
            {request.status === "withdrawn" && (
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Withdrawn by the merchant on{" "}
                {formatDateTime(request.resolved_at)}. No review action is
                required.
              </p>
            )}
            {request.status === "pending" && (
              <>
                <p className="mt-2 text-sm text-text-secondary">
                  Review the captured changes before making a decision.
                </p>
                {decisionError && (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {decisionError}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    variant="danger"
                    disabled={decisionPending}
                    onClick={onReject}
                  >
                    Reject Request
                  </Button>
                  <Button
                    variant="success"
                    disabled={decisionPending}
                    onClick={onApprove}
                  >
                    Approve Request
                  </Button>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
