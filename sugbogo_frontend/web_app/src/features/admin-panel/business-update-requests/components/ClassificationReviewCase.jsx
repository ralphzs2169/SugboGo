import {
  AlertTriangle,
  Info,
  Quote,
  Shapes,
  Store,
  UserRound,
} from "lucide-react";

import StatusBadge from "@/shared/components/StatusBadge";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { formatLabel } from "@/shared/utils/stringUtils";

import { UPDATE_REQUEST_STATUS_VARIANTS } from "../constants/businessUpdateRequestStatus";
import ClassificationRequestedChanges from "./ClassificationRequestedChanges";
import ClassificationSnapshotCard from "./ClassificationSnapshotCard";
import UpdateRequestReason from "./UpdateRequestReason";

/**
 * Displays a classification change request as a unified Admin review case.
 *
 * Combines captured classification differences, merchant justification,
 * request identities, and resolved decision history while highlighting
 * stale pending baselines that cannot be approved.
 */
export default function ClassificationReviewCase({
  request,
  isStalePendingRequest,
}) {
  const isPending = request.status === "pending";

  const reviewer = request.reviewer?.name || request.reviewer?.email || "Admin";

  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Unified case header */}
      <div className="flex items-center justify-between gap-3 border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Classification Change
        </h2>

        <StatusBadge
          variant={UPDATE_REQUEST_STATUS_VARIANTS[request.status] || "neutral"}
        >
          {formatLabel(request.status)}
        </StatusBadge>
      </div>

      {/* Review content and supporting information */}
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Left: Captured changes and merchant explanation */}
        <div className="min-w-0 p-5 sm:p-6 lg:col-span-3 lg:border-r lg:border-stroke">
          {/* Requested classification changes */}
          <div className="flex items-center gap-2 text-text-secondary">
            <Shapes size={16} aria-hidden="true" />

            <h3 className="text-xs font-bold uppercase tracking-wider">
              Requested Changes
            </h3>
          </div>

          <div className="mt-5">
            <ClassificationRequestedChanges
              previous={request.previous}
              proposed={request.proposed}
              status={request.status}
            />
          </div>

          {/* Stale classification warning */}
          {isStalePendingRequest && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex items-start gap-3 text-amber-900">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Classification information has changed
                  </p>

                  <p className="mt-1 text-sm leading-6">
                    The live classification no longer matches the values
                    captured when this request was submitted. Approval will be
                    blocked.
                  </p>
                </div>
              </div>

              {/* Current live classification snapshot */}
              <div className="mt-4">
                <ClassificationSnapshotCard
                  title="Current live classification"
                  classification={request.current}
                  tone="live"
                />
              </div>
            </div>
          )}

          {/* Change justification separator */}
          <div className="my-7 flex items-center gap-3 text-xs font-medium text-text-secondary">
            <div className="h-px flex-1 bg-stroke" />

            <span>↓ requested because</span>

            <div className="h-px flex-1 bg-stroke" />
          </div>

          {/* Merchant's submitted explanation */}
          <UpdateRequestReason reason={request.reason} />
        </div>

        {/* Right: Request context */}
        <aside className="min-w-0 border-t border-stroke lg:col-span-2 lg:border-t-0">
          {/* Request identity and metadata */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-text-secondary">
              <Info size={16} aria-hidden="true" />

              <h3 className="text-xs font-bold uppercase tracking-wider">
                Request Info
              </h3>
            </div>

            {/* Business identity with static image placeholder */}
            <div className="mt-5 flex min-w-0 items-center gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-text-secondary"
                aria-hidden="true"
              >
                <Store size={24} />
              </div>

              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-text-primary">
                  {request.current_business_name || "Unnamed business"}
                </p>

                <p className="mt-1 text-xs text-text-secondary">
                  Business #{request.business_id}
                </p>
              </div>
            </div>

            {/* Merchant identity with static avatar */}
            <div className="mt-5 border-t border-stroke/70 pt-5">
              <p className="mb-2 text-xs font-medium text-text-secondary">
                Requested by
              </p>

              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary"
                  aria-hidden="true"
                >
                  <UserRound size={18} />
                </div>

                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-text-primary">
                    {request.merchant?.name || request.merchant?.email || "—"}
                  </p>

                  {request.merchant?.name && request.merchant?.email && (
                    <p className="mt-0.5 break-all text-xs text-text-secondary">
                      {request.merchant.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Request metadata */}
            <dl className="mt-6 space-y-4">
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <dt className="text-sm text-text-secondary">Request</dt>

                <dd className="text-sm font-medium text-text-primary">
                  #{request.id}
                </dd>
              </div>

              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <dt className="text-sm text-text-secondary">Submitted</dt>

                <dd className="text-sm font-medium text-text-primary">
                  {formatDateTime(request.submitted_at)}
                </dd>
              </div>

              {request.resolved_at && (
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                  <dt className="text-sm text-text-secondary">Resolved</dt>

                  <dd className="text-sm font-medium text-text-primary">
                    {formatDateTime(request.resolved_at)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Historical review decision */}
          {!isPending && (
            <div className="border-t border-stroke p-5 sm:p-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Review Decision
              </h3>

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

                  <div className="mt-2 rounded-lg bg-surface px-4 py-3">
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
                  . No administrative action is required.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
