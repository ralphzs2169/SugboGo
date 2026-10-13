import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import ApproveUpdateRequestModal from "../business-update-requests/components/ApproveUpdateRequestModal";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import BusinessNameReviewCase from "../business-update-requests/components/BusinessNameReviewCase";

import useBusinessUpdateRequestDecisions from "../business-update-requests/hooks/useBusinessUpdateRequestDecisions";
import useBusinessUpdateRequestDetail from "../business-update-requests/hooks/useBusinessUpdateRequestDetail";

/**
 * Displays the administrator's business name change review workspace.
 *
 * Presents captured changes and supporting context in a case layout,
 * with fixed decision actions for pending requests and existing
 * confirmation modals for approval and rejection.
 */
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

  const isDecisionPending = decisions.isApproving || decisions.isRejecting;

  const isPending = request?.status === "pending";

  useDocumentTitle(
    request
      ? `Request #${request.id} | SugboGo Admin`
      : "Review Update Request | SugboGo Admin",
  );

  useApiErrorNotification(error, {
    toastId: "admin-update-request-detail-error",
    fallbackMessage: "Unable to load this update request. Please try again.",
  });

  function openDialog(decision) {
    setDecisionError("");
    setReasonError("");
    setActiveDialog(decision);
  }

  function closeDialog() {
    if (isDecisionPending || decisionInFlight.current) {
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

      toast.success("Business name change approved.");

      // Refresh the detail so the decision outcome replaces
      // the pending actions without navigating away.
      void refetch();
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

      toast.success("Business name change rejected.");

      // Refresh the detail to display the recorded decision.
      void refetch();
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
      href: "/admin-panel/businesses/update-requests",
    },
    {
      label: request ? `Request #${request.id}` : "Review Request",
    },
  ];

  return (
    <>
      {/* Business name change review content */}
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
        errorMessage="The update request could not be loaded. Please try again."
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

            {/* Business name comparison and case information */}
            <BusinessNameReviewCase request={request} />
          </div>
        )}
      </DetailPageLayout>

      {/* Fixed decision footer for pending requests */}
      {isPending && (
        <section
          aria-label="Business name change review actions"
          className="
            fixed bottom-0 left-0 right-0 z-30
            border-t border-stroke
            bg-background/95
            px-6 py-4
            backdrop-blur
            lg:left-[var(--admin-sidebar-width)]
          "
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Decision context and inline error */}
            <div className="min-w-0 flex-1">
              <h2 className="hidden text-sm font-semibold text-text-primary sm:block">
                Review Decision
              </h2>

              <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
                Review the proposed business name before deciding.
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

            {/* Decision actions */}
            <div className="flex w-full gap-3 sm:w-auto">
              <Button
                type="button"
                variant="danger-outline"
                className="flex-1 cursor-pointer sm:flex-none"
                onClick={() => openDialog("reject")}
                disabled={isDecisionPending}
              >
                Reject Request
              </Button>

              <Button
                type="button"
                variant="success"
                className="flex-1 cursor-pointer sm:flex-none"
                onClick={() => openDialog("approve")}
                disabled={isDecisionPending}
              >
                Approve Request
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Approval confirmation */}
      <ApproveUpdateRequestModal
        isOpen={activeDialog === "approve" && request?.status === "pending"}
        request={request}
        loading={decisions.isApproving}
        onClose={closeDialog}
        onConfirm={approve}
      />

      {/* Rejection confirmation */}
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
