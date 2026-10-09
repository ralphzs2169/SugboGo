import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import ApproveUpdateRequestModal from "../business-update-requests/components/ApproveUpdateRequestModal";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import RequestReviewWorkspace from "../business-update-requests/components/RequestReviewWorkspace";
import ReviewComparison from "../business-update-requests/components/ReviewComparison";
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
          <RequestReviewWorkspace
            request={request}
            type="Business name change"
            error={error}
            onRetry={refetch}
            decisionError={decisionError}
            onApprove={() => setActiveDialog("approve")}
            onReject={() => setActiveDialog("reject")}
            decisionPending={decisions.isApproving || decisions.isRejecting}
          >
            <section className="rounded-xl border border-stroke bg-background p-5">
              <h2 className="text-base font-semibold text-text-primary">
                Requested changes
              </h2>
              <div className="mt-5">
                <ReviewComparison
                  title="Business name"
                  previous={request.previous_business_name}
                  proposed={request.proposed_business_name}
                  status={request.status}
                />
              </div>
              {isStale && request.status === "pending" && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>
                    The live name is now {request.current_business_name}. It
                    differs from the name captured at submission, so approval
                    will be blocked.
                  </p>
                </div>
              )}
            </section>
          </RequestReviewWorkspace>
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
