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

import ApproveLocationRequestModal from "../business-update-requests/components/ApproveLocationRequestModal";
import LocationComparisonMap, {
  LocationMapBoundary,
} from "../business-update-requests/components/LocationComparisonMap";
import LocationLandmarkDiff from "../business-update-requests/components/LocationLandmarkDiff";
import LocationStateCard from "../business-update-requests/components/LocationStateCard";
import RejectUpdateRequestModal from "../business-update-requests/components/RejectUpdateRequestModal";
import { UPDATE_REQUEST_STATUS_VARIANTS } from "../business-update-requests/constants/businessUpdateRequestStatus";
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
  latitude: "Latitude",
  longitude: "Longitude",
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
  const fieldChanges = getLocationFieldChanges(
    request?.previous?.location,
    request?.proposed?.location,
  ).filter(
    (change) => change.field !== "latitude" && change.field !== "longitude",
  );
  const mapStates = request
    ? [
        {
          id: "current",
          label: stale
            ? "Current Live"
            : request.status === "pending"
              ? "Current"
              : "When Submitted",
          location:
            stale || request.status === "pending"
              ? request.current?.location
              : request.previous?.location,
        },
        ...(stale
          ? [
              {
                id: "previous",
                label: "When Submitted",
                location: request.previous?.location,
              },
            ]
          : []),
        {
          id: "proposed",
          label: "Requested",
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
          <div className="max-w-6xl space-y-6 pb-12">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                The latest request details could not be loaded.
                <button
                  type="button"
                  className="ml-2 cursor-pointer font-semibold underline"
                  onClick={() => refetch()}
                >
                  Retry
                </button>
              </div>
            )}
            {/* Request context */}
            <section className="rounded-xl border border-stroke bg-background p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Location & Landmarks
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

            {/* Comparison map and adaptive snapshot detail */}
            <section className="space-y-5 rounded-xl border border-stroke bg-background p-5">
              {stale && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  The live business location or landmarks changed after this
                  request was submitted. The backend will check the baseline
                  again if you approve.
                </p>
              )}
              <h2 className="text-base font-semibold text-text-primary">
                {stale ? "Location Comparison" : "Current → Requested"}
              </h2>
              <LocationMapBoundary key={request.id}>
                <LocationComparisonMap states={mapStates} />
              </LocationMapBoundary>
              {stale ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <LocationStateCard
                    title="Current Live"
                    snapshot={request.current}
                  />
                  <LocationStateCard
                    title="When Submitted"
                    snapshot={request.previous}
                  />
                  <LocationStateCard
                    title="Requested"
                    snapshot={request.proposed}
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-stroke bg-surface p-4">
                      <p className="text-xs font-semibold uppercase text-text-secondary">
                        Current address
                      </p>
                      <p className="mt-2 text-sm text-text-primary">
                        {request.previous?.location?.address}
                      </p>
                    </div>
                    <div className="rounded-lg border border-stroke bg-surface p-4">
                      <p className="text-xs font-semibold uppercase text-text-secondary">
                        Requested address
                      </p>
                      <p className="mt-2 text-sm text-text-primary">
                        {request.proposed?.location?.address}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-stroke bg-surface p-4">
                    <h3 className="text-xs font-semibold uppercase text-text-secondary">
                      Coordinates
                    </h3>
                    <div className="mt-2 grid gap-3 text-sm tabular-nums sm:grid-cols-2">
                      <p className="text-text-primary">
                        <span className="block text-xs text-text-secondary">
                          Current
                        </span>
                        {request.previous?.location?.latitude},{" "}
                        {request.previous?.location?.longitude}
                      </p>
                      <p className="text-text-primary">
                        <span className="block text-xs text-text-secondary">
                          Requested
                        </span>
                        {request.proposed?.location?.latitude},{" "}
                        {request.proposed?.location?.longitude}
                      </p>
                    </div>
                  </div>
                  {fieldChanges.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        Changed location fields
                      </h3>
                      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                        {fieldChanges.map((change) => (
                          <div
                            key={change.field}
                            className="rounded-lg bg-surface p-3 text-sm"
                          >
                            <dt className="text-xs text-text-secondary">
                              {FIELD_LABELS[change.field]}
                            </dt>
                            <dd className="mt-1 break-words text-text-primary">
                              {change.previous ?? "—"}{" "}
                              <span aria-hidden="true">→</span>{" "}
                              {change.proposed ?? "—"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </>
              )}
              <LocationLandmarkDiff
                previous={request.previous?.landmarks}
                proposed={request.proposed?.landmarks}
              />
            </section>

            {/* Resolution and review controls */}
            {request.status === "approved" && (
              <section className="rounded-xl border border-stroke bg-background p-5 text-sm text-text-secondary">
                Approved by{" "}
                {request.reviewer?.name || request.reviewer?.email || "Admin"}{" "}
                on {formatDateTime(request.resolved_at)}. The requested location
                and landmark set were applied.
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
