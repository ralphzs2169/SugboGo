import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import StatusBadge from "@/shared/components/StatusBadge";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";
import { formatDateTime } from "@/shared/utils/dateUtils";

import ApproveUpdateRequestModal from "../business-update-requests/components/ApproveUpdateRequestModal";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import { UPDATE_REQUEST_STATUS_VARIANTS } from "../business-update-requests/constants/businessUpdateRequestStatus";
import useBusinessUpdateRequestDecisions from "../business-update-requests/hooks/useBusinessUpdateRequestDecisions";
import useBusinessUpdateRequestDetail from "../business-update-requests/hooks/useBusinessUpdateRequestDetail";

/** Reviews one name proposal against the live business and records an Admin decision. */
export default function UpdateRequestReviewPage() {
  const { requestId } = useParams();
  const handleBack = useNavigateBack("/admin-panel/businesses/update-requests");
  const decisionInFlight = useRef(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const { request, isLoading, error, refetch } =
    useBusinessUpdateRequestDetail(requestId);
  const decisions = useBusinessUpdateRequestDecisions();

  useDocumentTitle("Review Update Request | SugboGo Admin");
  useApiErrorNotification(error, {
    toastId: "admin-update-request-detail-error",
    fallbackMessage: "Unable to load this update request. Please try again.",
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
      toast.success("Business name change approved.");
    } catch (mutationError) {
      const message =
        mutationError.response?.data?.message || "Unable to approve request.";
      setDecisionError(message);
      toast.error(message);
      if (message.includes("outdated business information")) {
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
      toast.success("Business name change rejected.");
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
    request && request.current_business_name !== request.previous_business_name;

  return (
    <>
      <DetailPageLayout
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Management" },
          {
            label: "Update Requests",
            href: "/admin-panel/businesses/update-requests",
          },
          { label: request ? `Request #${request.id}` : "Review Request" },
        ]}
        title="Business Name Change Request"
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
        errorMessage="The update request could not be loaded. Please try again."
      >
        {request && (
          <div className="max-w-5xl space-y-6 pb-12">
            {/* Context and decision state */}
            <section className="rounded-xl border border-stroke bg-background p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Business Name Change
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

            {/* Captured baseline and proposal */}
            <section className="rounded-xl border border-stroke bg-background p-5">
              <h2 className="text-base font-semibold text-text-primary">
                Proposed Change
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="rounded-lg border border-stroke bg-surface p-4">
                  <p className="text-xs font-medium text-text-secondary">
                    Name When Submitted
                  </p>
                  <p className="mt-2 text-base font-semibold text-text-primary">
                    {request.previous_business_name}
                  </p>
                </div>
                <ArrowRight
                  className="hidden h-5 w-5 text-text-secondary md:block"
                  aria-hidden="true"
                />
                <div className="rounded-lg border border-stroke bg-surface p-4">
                  <p className="text-xs font-medium text-text-secondary">
                    Requested Name
                  </p>
                  <p className="mt-2 text-base font-semibold text-text-primary">
                    {request.proposed_business_name}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-stroke bg-background p-4">
                <p className="text-xs font-medium text-text-secondary">
                  Current Live Name
                </p>
                <p className="mt-2 text-base font-semibold text-text-primary">
                  {request.current_business_name}
                </p>
              </div>
              {isStale && request.status === "pending" && (
                <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  The live name differs from the name captured at submission.
                  Approval will be blocked until this request is resolved.
                </p>
              )}
            </section>

            {/* Resolution and review controls */}
            {request.status === "approved" && (
              <section className="rounded-xl border border-stroke bg-background p-5 text-sm text-text-secondary">
                Approved by{" "}
                {request.reviewer?.name || request.reviewer?.email || "Admin"}{" "}
                on {formatDateTime(request.resolved_at)}. The requested name was
                applied to the live business.
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

      <ApproveUpdateRequestModal
        isOpen={activeDialog === "approve" && request?.status === "pending"}
        request={request}
        loading={decisions.isApproving}
        onClose={closeDialog}
        onConfirm={approve}
      />
      <RejectUpdateRequestModal
        isOpen={activeDialog === "reject" && request?.status === "pending"}
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
