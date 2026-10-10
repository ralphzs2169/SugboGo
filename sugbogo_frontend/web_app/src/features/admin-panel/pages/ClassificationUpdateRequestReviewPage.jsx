import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import ApproveClassificationRequestModal from "../business-update-requests/components/ApproveClassificationRequestModal";
import ClassificationReviewCase from "../business-update-requests/components/ClassificationReviewCase";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";

import useClassificationUpdateRequestDecisions from "../business-update-requests/hooks/useClassificationUpdateRequestDecisions";
import useClassificationUpdateRequestDetail from "../business-update-requests/hooks/useClassificationUpdateRequestDetail";
import useClassificationClusterDisplay from "../business-update-requests/hooks/useClassificationClusterDisplay";
import useClassificationSpecialtyDisplay from "../business-update-requests/hooks/useClassificationSpecialtyDisplay";
import { hasStalePendingBaseline } from "../business-update-requests/utils/classificationDiff";

/**
 * Displays the Admin classification change review workspace.
 *
 * Presents captured differences and request context in one review card,
 * with fixed decision actions for pending requests and confirmation
 * dialogs that preserve the existing approval and rejection flows.
 */
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
  const clusterDisplay = useClassificationClusterDisplay(request);
  const specialtyDisplay = useClassificationSpecialtyDisplay(request);

  const decisions = useClassificationUpdateRequestDecisions();

  const isDecisionPending = decisions.isApproving || decisions.isRejecting;

  const isPending = request?.status === "pending";

  const isStalePendingRequest = hasStalePendingBaseline(request);

  useDocumentTitle(
    request
      ? `Request #${request.id} | SugboGo Admin`
      : "Review Classification Request | SugboGo Admin",
  );

  useApiErrorNotification(error, {
    toastId: "admin-classification-request-detail-error",
    fallbackMessage: "Unable to load this classification request.",
  });

  function openDialog(decision) {
    setDecisionError("");
    setReasonError("");
    setActiveDialog(decision);
  }

  function closeDialog() {
    if (decisionInFlight.current || isDecisionPending) {
      return;
    }

    setActiveDialog(null);
    setReasonError("");
  }

  async function approve() {
    if (
      decisionInFlight.current ||
      isDecisionPending ||
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

      // Refresh the resolved request and its historical decision.
      await refetch();
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
      isDecisionPending ||
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

      // Refresh the resolved request and its historical decision.
      await refetch();
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

  const breadcrumbs = [
    {
      label: "SugboGo Admin",
      href: "/admin-panel/dashboard",
    },
    {
      label: "Management",
    },
    {
      label: "Update Requests",
      href: "/admin-panel/businesses/update-requests?type=classification&status=pending",
    },
    {
      label: request ? `Request #${request.id}` : "Review Request",
    },
  ];

  return (
    <>
      {/* Classification review content */}
      <DetailPageLayout
        breadcrumbs={breadcrumbs}
        title={request ? `Request #${request.id}` : "Review Request"}
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
          <div
            className={`w-full min-w-0 space-y-6 ${
              isPending ? "pb-36 sm:pb-28" : "pb-12"
            }`}
          >
            {/* Error while refreshing cached request details */}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                The latest request details could not be loaded.
                <button
                  type="button"
                  className="ml-2 cursor-pointer font-semibold underline"
                  onClick={() => void refetch()}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Unified classification review case */}
            <ClassificationReviewCase
              request={request}
              isStalePendingRequest={isStalePendingRequest}
              clusterDisplay={clusterDisplay}
              specialtyDisplay={specialtyDisplay}
            />
          </div>
        )}
      </DetailPageLayout>

      {/* Fixed decision footer for pending requests */}
      {isPending && (
        <section
          aria-label="Classification change review actions"
          className="
            fixed bottom-0 left-0 right-0 z-30
            border-t border-stroke
            bg-background/95 px-6 py-4 backdrop-blur
            lg:left-[var(--admin-sidebar-width)]
          "
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Decision context and errors */}
            <div className="min-w-0 flex-1">
              <h2 className="hidden text-sm font-semibold text-text-primary sm:block">
                Review Decision
              </h2>

              <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
                Review the proposed classification before deciding.
              </p>

              {decisionError && (
                <p
                  role="alert"
                  className="mt-2 text-xs font-medium text-red-600"
                >
                  {decisionError}
                </p>
              )}
            </div>

            {/* Approval and rejection actions */}
            <div className="flex w-full gap-3 sm:w-auto">
              <Button
                type="button"
                variant="danger-outline"
                className="flex-1 cursor-pointer sm:flex-none"
                disabled={isDecisionPending}
                onClick={() => openDialog("reject")}
              >
                Reject Request
              </Button>

              <Button
                type="button"
                variant="success"
                className="flex-1 cursor-pointer sm:flex-none"
                disabled={isDecisionPending}
                onClick={() => openDialog("approve")}
              >
                Approve Request
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Approval confirmation */}
      <ApproveClassificationRequestModal
        isOpen={activeDialog === "approve" && request?.status === "pending"}
        request={request}
        clusterDisplay={clusterDisplay}
        specialtyDisplay={specialtyDisplay}
        loading={decisions.isApproving}
        onClose={closeDialog}
        onConfirm={approve}
      />

      {/* Rejection confirmation */}
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
