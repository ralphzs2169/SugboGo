import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import ApproveClassificationRequestModal from "../business-update-requests/components/ApproveClassificationRequestModal";
import ClassificationRequestedChanges from "../business-update-requests/components/ClassificationRequestedChanges";
import ClassificationSnapshotCard from "../business-update-requests/components/ClassificationSnapshotCard";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import RequestReviewWorkspace from "../business-update-requests/components/RequestReviewWorkspace";
import useClassificationUpdateRequestDecisions from "../business-update-requests/hooks/useClassificationUpdateRequestDecisions";
import useClassificationUpdateRequestDetail from "../business-update-requests/hooks/useClassificationUpdateRequestDetail";
import { hasStalePendingBaseline } from "../business-update-requests/utils/classificationDiff";

/** Reviews a concise requested diff, expanding to full snapshots for a stale pending request. */
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

  const isStalePendingRequest = hasStalePendingBaseline(request);

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
          <RequestReviewWorkspace
            request={request}
            type="Classification change"
            error={error}
            onRetry={refetch}
            decisionError={decisionError}
            onApprove={() => setActiveDialog("approve")}
            onReject={() => setActiveDialog("reject")}
            decisionPending={decisions.isApproving || decisions.isRejecting}
          >
            {isStalePendingRequest && (
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p
                  role="alert"
                  className="flex items-start gap-2 text-sm text-amber-900"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  The live classification changed since submission. Approval is
                  blocked until this request is resolved.
                </p>
                <div className="mt-4">
                  <ClassificationSnapshotCard
                    title="Current live classification"
                    classification={request.current}
                    tone="live"
                  />
                </div>
              </section>
            )}
            <ClassificationRequestedChanges
              previous={request.previous}
              proposed={request.proposed}
              status={request.status}
            />
          </RequestReviewWorkspace>
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
