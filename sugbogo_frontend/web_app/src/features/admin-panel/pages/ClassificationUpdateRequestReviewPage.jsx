import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import StatusBadge from "@/shared/components/StatusBadge";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";
import { formatDateTime } from "@/shared/utils/dateUtils";

import ApproveClassificationRequestModal from "../business-update-requests/components/ApproveClassificationRequestModal";
import ClassificationSnapshotCard from "../business-update-requests/components/ClassificationSnapshotCard";
import ClassificationSpecialtyDiff from "../business-update-requests/components/ClassificationSpecialtyDiff";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import { UPDATE_REQUEST_STATUS_VARIANTS } from "../business-update-requests/constants/businessUpdateRequestStatus";
import useClassificationUpdateRequestDecisions from "../business-update-requests/hooks/useClassificationUpdateRequestDecisions";
import useClassificationUpdateRequestDetail from "../business-update-requests/hooks/useClassificationUpdateRequestDetail";

function specialtyIds(classification) {
  return new Set(
    (classification?.specialty_tags ?? []).map((tag) => Number(tag.id)),
  );
}

function classificationMatches(first, second) {
  if (
    first?.category?.id !== second?.category?.id ||
    first?.cluster?.id !== second?.cluster?.id
  ) {
    return false;
  }
  const firstIds = specialtyIds(first);
  const secondIds = specialtyIds(second);
  return (
    firstIds.size === secondIds.size &&
    [...firstIds].every((id) => secondIds.has(id))
  );
}

/** Reviews current, submitted, and requested classification before an Admin decision. */
export default function ClassificationUpdateRequestReviewPage() {
  const { requestId } = useParams();
  const handleBack = useNavigateBack(
    "/admin-panel/businesses/update-requests?type=classification&status=pending",
  );
  const decisionInFlight = useRef(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const { request, isLoading, error, refetch } =
    useClassificationUpdateRequestDetail(requestId);
  const decisions = useClassificationUpdateRequestDecisions();

  useDocumentTitle("Review Classification Request | SugboGo Admin");
  useApiErrorNotification(error, {
    toastId: "admin-classification-request-detail-error",
    fallbackMessage: "Unable to load this classification request.",
  });

  function closeDialog() {
    if (!decisions.isApproving && !decisions.isRejecting) {
      setActiveDialog(null);
      setReasonError("");
    }
  }

  async function approve() {
    if (
      decisionInFlight.current ||
      decisions.isApproving ||
      request?.status !== "pending"
    ) {
      return;
    }
    decisionInFlight.current = true;
    try {
      await decisions.approve(request.id);
      setDecisionError("");
      setActiveDialog(null);
      toast.success("Classification change approved.");
    } catch (mutationError) {
      const message =
        mutationError.response?.data?.message || "Unable to approve request.";
      setDecisionError(message);
      toast.error(message);
      const normalizedMessage = message.toLowerCase();
      if (
        normalizedMessage.includes("outdated") ||
        normalizedMessage.includes("taxonomy has changed")
      ) {
        setActiveDialog(null);
        await refetch();
      }
    } finally {
      decisionInFlight.current = false;
    }
  }

  async function reject() {
    if (
      decisionInFlight.current ||
      decisions.isRejecting ||
      request?.status !== "pending"
    ) {
      return;
    }
    const reason = rejectionReason.trim();
    if (!reason) {
      setReasonError("A rejection reason is required.");
      return;
    }
    decisionInFlight.current = true;
    try {
      await decisions.reject({
        requestId: request.id,
        rejectionReason: reason,
      });
      setDecisionError("");
      setActiveDialog(null);
      setRejectionReason("");
      toast.success("Classification change rejected.");
    } catch (mutationError) {
      const fieldError = mutationError.response?.data?.errors?.rejection_reason;
      if (fieldError) {
        setReasonError(Array.isArray(fieldError) ? fieldError[0] : fieldError);
      } else {
        const message =
          mutationError.response?.data?.message || "Unable to reject request.";
        setDecisionError(message);
        toast.error(message);
        await refetch();
      }
    } finally {
      decisionInFlight.current = false;
    }
  }

  const isStale =
    request && !classificationMatches(request.current, request.previous);

  return (
    <>
      <DetailPageLayout
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Management" },
          {
            label: "Update Requests",
            href: "/admin-panel/businesses/update-requests?type=classification&status=pending",
          },
          { label: request ? `Request #${request.id}` : "Review Request" },
        ]}
        title="Classification & Specialty Change Request"
        backLabel="Back to Update Requests"
        onBack={handleBack}
        isLoading={isLoading && !request}
        error={request ? null : error}
        hasData={Boolean(request)}
        onRetry={refetch}
        loadingContent={
          <div className="h-80 animate-pulse rounded-xl bg-surface-muted" />
        }
        errorTitle="Request unavailable"
        errorMessage="The classification request could not be loaded. Please try again."
      >
        {request && (
          <div className="max-w-6xl space-y-6 pb-12">
            {/* Request context */}
            <section className="rounded-xl border border-stroke bg-background p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Classification & Specialties
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Request #{request.id}
                  </p>
                </div>
                <StatusBadge
                  variant={UPDATE_REQUEST_STATUS_VARIANTS[request.status]}
                >
                  {request.status.charAt(0).toUpperCase() +
                    request.status.slice(1)}
                </StatusBadge>
              </div>
              <dl className="mt-6 grid gap-5 border-t border-stroke pt-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-text-secondary">Business</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">
                    {request.current_business_name}
                  </dd>
                  <dd className="text-xs text-text-secondary">
                    Business #{request.business_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Requested By</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">
                    {request.merchant?.name || request.merchant?.email || "—"}
                  </dd>
                  <dd className="text-xs text-text-secondary">
                    {request.merchant?.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Submitted</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">
                    {formatDateTime(request.submitted_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">Resolved</dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">
                    {formatDateTime(request.resolved_at)}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Current, captured, and requested comparison */}
            <section className="rounded-xl border border-stroke bg-background p-5">
              <h2 className="text-base font-semibold text-text-primary">
                Classification Comparison
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Compare the live classification with the immutable submission
                snapshots before deciding.
              </p>
              <div className="mt-5 grid gap-4 xl:grid-cols-3">
                <ClassificationSnapshotCard
                  title="Current Live Classification"
                  classification={request.current}
                  tone="live"
                />
                <ClassificationSnapshotCard
                  title="Classification When Submitted"
                  classification={request.previous}
                />
                <ClassificationSnapshotCard
                  title="Requested Classification"
                  classification={request.proposed}
                  tone="proposed"
                />
              </div>
              {isStale && request.status === "pending" && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  The live classification differs from the values captured at
                  submission. Approval will be blocked until this request is
                  resolved.
                </p>
              )}
            </section>

            <ClassificationSpecialtyDiff
              previous={request.previous}
              proposed={request.proposed}
            />

            {/* Resolution and review controls */}
            {request.status === "approved" && (
              <section className="rounded-xl border border-stroke bg-background p-5 text-sm text-text-secondary">
                Approved by{" "}
                {request.reviewer?.name || request.reviewer?.email || "Admin"}{" "}
                on {formatDateTime(request.resolved_at)}. The requested category
                and specialty set were applied to the live business.
              </section>
            )}
            {request.status === "rejected" && (
              <section className="rounded-xl border border-stroke bg-background p-5">
                <h2 className="text-sm font-semibold text-text-primary">
                  Rejection Reason
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                  {request.rejection_reason}
                </p>
                <p className="mt-4 text-xs text-text-secondary">
                  Rejected by{" "}
                  {request.reviewer?.name || request.reviewer?.email || "Admin"}{" "}
                  on {formatDateTime(request.resolved_at)}.
                </p>
              </section>
            )}
            {request.status === "withdrawn" && (
              <section className="rounded-xl border border-stroke bg-background p-5 text-sm text-text-secondary">
                The merchant withdrew this request on{" "}
                {formatDateTime(request.resolved_at)}. No Admin action is
                required.
              </section>
            )}
            {decisionError && (
              <p role="alert" className="text-sm text-red-600">
                {decisionError}
              </p>
            )}
            {request.status === "pending" && (
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="danger"
                  onClick={() => setActiveDialog("reject")}
                >
                  Reject Request
                </Button>
                <Button
                  variant="success"
                  onClick={() => setActiveDialog("approve")}
                >
                  Approve Request
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailPageLayout>

      <ApproveClassificationRequestModal
        isOpen={activeDialog === "approve" && request?.status === "pending"}
        request={request}
        loading={decisions.isApproving}
        onClose={closeDialog}
        onConfirm={approve}
      />
      <RejectUpdateRequestModal
        isOpen={activeDialog === "reject" && request?.status === "pending"}
        title="Reject classification change"
        description="This reason will be shown to the merchant."
        reason={rejectionReason}
        error={reasonError}
        loading={decisions.isRejecting}
        onReasonChange={(value) => {
          setRejectionReason(value);
          setReasonError("");
        }}
        onClose={closeDialog}
        onConfirm={reject}
      />
    </>
  );
}
