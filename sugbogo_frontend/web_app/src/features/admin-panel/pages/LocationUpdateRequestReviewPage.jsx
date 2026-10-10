import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

import DetailPageLayout from "@/shared/components/layout/DetailPageLayout";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useNavigateBack from "@/shared/hooks/useNavigateBack";

import ApproveLocationRequestModal from "../business-update-requests/components/ApproveLocationRequestModal";
import LocationComparisonMap, {
  LocationMapBoundary,
} from "../business-update-requests/components/LocationComparisonMap";
import LocationLandmarkDiff from "../business-update-requests/components/LocationLandmarkDiff";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import RequestReviewWorkspace from "../business-update-requests/components/RequestReviewWorkspace";
import ReviewComparison from "../business-update-requests/components/ReviewComparison";
import useLocationUpdateRequestDecisions from "../business-update-requests/hooks/useLocationUpdateRequestDecisions";
import useLocationUpdateRequestDetail from "../business-update-requests/hooks/useLocationUpdateRequestDetail";
import {
  getLocationFieldChanges,
  locationBaselineMatches,
} from "../business-update-requests/utils/locationDiff";

const FIELD_LABELS = {
  address: "Address",
  city: "City",
  province: "Province",
  postal_code: "Postal code",
};

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

  useDocumentTitle("Review Location Request | SugboGo Admin");
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
  const allFieldChanges = getLocationFieldChanges(
    request?.previous?.location,
    request?.proposed?.location,
  );
  const fieldChanges = allFieldChanges.filter(
    (change) => change.field !== "latitude" && change.field !== "longitude",
  );
  const pinChanged = allFieldChanges.some(
    (change) => change.field === "latitude" || change.field === "longitude",
  );
  const mapStates = request
    ? [
        {
          id: "previous",
          label: "At submission",
          location: request.previous?.location,
        },
        ...(stale
          ? [
              {
                id: "current",
                label: "Current live",
                location: request.current?.location,
              },
            ]
          : []),
        {
          id: "proposed",
          label: request.status === "approved" ? "Approved" : "Requested",
          location: request.proposed?.location,
        },
      ]
    : [];

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
        title="Location & Landmark Change Request"
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
          <RequestReviewWorkspace
            request={request}
            type="Location & landmark change"
            error={error}
            onRetry={refetch}
            decisionError={decisionError}
            onApprove={() => setActiveDialog("approve")}
            onReject={() => setActiveDialog("reject")}
            decisionPending={decisions.isApproving || decisions.isRejecting}
          >
            {stale && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                The live business location or landmarks changed after
                submission. The backend will check the baseline again if you
                approve.
              </p>
            )}
            {fieldChanges.length > 0 && (
              <section className="rounded-xl border border-stroke bg-background p-5">
                <h2 className="text-base font-semibold text-text-primary">
                  Address changes
                </h2>
                <div className="mt-5">
                  {fieldChanges.map((change) => (
                    <ReviewComparison
                      key={change.field}
                      title={FIELD_LABELS[change.field]}
                      previous={change.previous}
                      proposed={change.proposed}
                      status={request.status}
                    />
                  ))}
                </div>
              </section>
            )}
            {pinChanged && (
              <section className="rounded-xl border border-stroke bg-background p-5">
                <h2 className="text-base font-semibold text-text-primary">
                  Business pin
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Compare the exact positions captured in this request.
                </p>
                <div className="mt-4">
                  <LocationMapBoundary key={request.id} states={mapStates}>
                    <LocationComparisonMap states={mapStates} />
                  </LocationMapBoundary>
                </div>
                <ReviewComparison
                  title="Coordinates"
                  previous={
                    <span className="font-mono text-xs tabular-nums">
                      {request.previous?.location?.latitude ?? "—"},{" "}
                      {request.previous?.location?.longitude ?? "—"}
                    </span>
                  }
                  proposed={
                    <span className="font-mono text-xs tabular-nums">
                      {request.proposed?.location?.latitude ?? "—"},{" "}
                      {request.proposed?.location?.longitude ?? "—"}
                    </span>
                  }
                  status={request.status}
                />
                {stale && (
                  <p className="mt-2 text-xs text-text-secondary">
                    Current live position:{" "}
                    {request.current?.location?.latitude ?? "—"},{" "}
                    {request.current?.location?.longitude ?? "—"}
                  </p>
                )}
              </section>
            )}
            <LocationLandmarkDiff
              previous={request.previous?.landmarks}
              proposed={request.proposed?.landmarks}
              status={request.status}
            />
          </RequestReviewWorkspace>
        )}
      </DetailPageLayout>
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
