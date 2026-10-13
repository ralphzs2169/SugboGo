import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import ApproveLocationRequestModal from "../business-update-requests/components/ApproveLocationRequestModal";
import LocationReviewCase from "../business-update-requests/components/LocationReviewCase";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import useLocationUpdateRequestDecisions from "../business-update-requests/hooks/useLocationUpdateRequestDecisions";
import useLocationUpdateRequestDetail from "../business-update-requests/hooks/useLocationUpdateRequestDetail";
import { locationBaselineMatches } from "../business-update-requests/utils/locationDiff";

function decisionMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

/** Reviews a frozen location proposal, expanding to three snapshots when live state changed. */
export default function LocationUpdateRequestReviewPage() {
  const { requestId } = useParams();
  const handleBack = useNavigateBack(
    "/admin-panel/businesses/update-requests?type=location&status=pending",
  );
  const decisionInFlight = useRef(false);
  const [activeDialog, setActiveDialog] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const { request, isLoading, error, refetch } =
    useLocationUpdateRequestDetail(requestId);
  const decisions = useLocationUpdateRequestDecisions();

  useDocumentTitle(
    request
      ? `Request #${request.id} | SugboGo Admin`
      : "Review Location Request | SugboGo Admin",
  );
  useApiErrorNotification(error, {
    toastId: "admin-location-request-detail-error",
    fallbackMessage: "Unable to load this location request.",
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
      setActiveDialog(null);
      setDecisionError("");
      toast.success("Location change approved.");
    } catch (mutationError) {
      setDecisionError(
        decisionMessage(mutationError, "Unable to approve request."),
      );
      setActiveDialog(null);
      await refetch();
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
      setActiveDialog(null);
      setRejectionReason("");
      setDecisionError("");
      toast.success("Location change rejected.");
    } catch (mutationError) {
      const fieldError = mutationError.response?.data?.errors?.rejection_reason;
      if (fieldError) {
        setReasonError(Array.isArray(fieldError) ? fieldError[0] : fieldError);
      } else {
        setDecisionError(
          decisionMessage(mutationError, "Unable to reject request."),
        );
        setActiveDialog(null);
        await refetch();
      }
    } finally {
      decisionInFlight.current = false;
    }
  }

  const stale =
    request?.status === "pending" &&
    !locationBaselineMatches(request.current, request.previous);
  return (
    <>
      <DetailPageLayout
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Management" },
          {
            label: "Update Requests",
            href: "/admin-panel/businesses/update-requests?type=location&status=pending",
          },
          { label: request ? `Request #${request.id}` : "Review Request" },
        ]}
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
        errorMessage="The location request could not be loaded. Please try again."
      >
        {request && (
          <div
            className={`w-full min-w-0 space-y-6 ${
              request.status === "pending" ? "pb-36 sm:pb-28" : "pb-12"
            }`}
          >
            {/* Keep cached content visible when a background refetch fails. */}
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

            <LocationReviewCase
              request={request}
              isStalePendingRequest={stale}
            />
          </div>
        )}
      </DetailPageLayout>
      {/* Fixed decision footer for pending requests */}
      {request?.status === "pending" && (
        <section
          aria-label="Location change review actions"
          className="
            fixed bottom-0 left-0 right-0 z-30
            border-t border-stroke
            bg-background/95 px-6 py-4 backdrop-blur
            lg:left-[var(--admin-sidebar-width)]
          "
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="hidden text-sm font-semibold text-text-primary sm:block">
                Review Decision
              </h2>
              <p className="mt-0.5 hidden text-xs text-text-secondary sm:block">
                Review the proposed location before deciding.
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

            <div className="flex w-full gap-3 sm:w-auto">
              <Button
                type="button"
                variant="danger-outline"
                className="flex-1 cursor-pointer sm:flex-none"
                disabled={decisions.isApproving || decisions.isRejecting}
                onClick={() => setActiveDialog("reject")}
              >
                Reject Request
              </Button>
              <Button
                type="button"
                variant="success"
                className="flex-1 cursor-pointer sm:flex-none"
                disabled={decisions.isApproving || decisions.isRejecting}
                onClick={() => setActiveDialog("approve")}
              >
                Approve Request
              </Button>
            </div>
          </div>
        </section>
      )}
      <ApproveLocationRequestModal
        isOpen={activeDialog === "approve" && request?.status === "pending"}
        request={request}
        loading={decisions.isApproving}
        onClose={closeDialog}
        onConfirm={approve}
      />
      <RejectUpdateRequestModal
        isOpen={activeDialog === "reject" && request?.status === "pending"}
        title="Reject location change"
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
