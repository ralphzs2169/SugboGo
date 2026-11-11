import { useState } from "react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";

import useTransitMutations from "../../hooks/useTransitMutations";
import { useTransitPoint } from "../../hooks/useTransitQueries";

/** Check persisted eligibility and confirm one point's permanent deletion. */
export default function TransitPointDeleteModal({ pointId, onClose, onDeleted }) {
  const detail = useTransitPoint(pointId, {
    refetchOnMount: "always",
    retry: false,
  });
  const { deletePoint } = useTransitMutations();
  const [deleteError, setDeleteError] = useState(null);
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    true,
    pointId,
    onClose,
  );
  const point = detail.transitPoint;
  const deletion = deleteError?.response?.data?.errors?.deletion ?? point?.deletion;
  const loading = detail.isLoading || detail.isFetching;
  const verificationFailed = Boolean(
    detail.error || (!loading && (!detail.isFetchedAfterMount || !deletion)),
  );
  const canDelete = !loading && !verificationFailed && deletion?.can_delete === true;

  async function retryEligibility() {
    setDeleteError(null);
    await detail.refetch();
  }

  async function handleDelete() {
    if (!canDelete) return;
    return runSubmission(async (isCurrent) => {
      setDeleteError(null);
      try {
        await deletePoint(pointId);
        if (isCurrent()) {
          onDeleted(pointId);
          toast.success("Transit Point deleted successfully.");
        }
      } catch (error) {
        if (isCurrent()) {
          setDeleteError(error);
        }
      }
    });
  }

  return (
    <Modal
      isOpen
      onClose={close}
      dismissDisabled={isSubmitting}
      title="Delete Transit Point?"
      description="Deletion is permanent and cannot be undone."
      scrollable
    >
      {point && (
        <p className="mb-4 break-words rounded-lg bg-surface p-4 text-sm font-semibold text-text-primary">
          {point.name}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-text-secondary">
          Checking current deletion eligibility…
        </p>
      ) : verificationFailed ? (
        <DataErrorState
          compact
          title="Unable to verify deletion eligibility"
          message={detail.error?.response?.data?.message || "Retry before deleting this Transit Point."}
          onRetry={retryEligibility}
          retryLabel="Retry"
        />
      ) : deletion?.can_delete === false ? (
        <PointDependencies deletion={deletion} />
      ) : (
        <p className="text-sm text-text-secondary">
          This point has no saved dependencies and can be permanently deleted.
        </p>
      )}
      {deleteError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {deleteError.response?.data?.message || "The Transit Point could not be deleted. Please try again."}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          loading={isSubmitting}
          disabled={!canDelete}
        >
          Delete Point
        </Button>
      </div>
    </Modal>
  );
}

/** Show distinct network totals and the backend's bounded identifying examples. */
function PointDependencies({ deletion }) {
  const { counts, examples } = deletion;
  return (
    <div className="space-y-3 text-sm text-text-secondary">
      <p role="status" className="font-semibold text-text-primary">
        This point cannot be deleted while it has saved dependencies.
      </p>
      <ul className="list-inside list-disc space-y-1">
        <li>{counts.directions} directions across {counts.routes} routes</li>
        <li>{counts.origin_directions} origins, {counts.destination_directions} destinations, {counts.ordered_stops} ordered stops</li>
        <li>{counts.transfers} transfers ({counts.alighting_transfers} alighting, {counts.boarding_transfers} boarding)</li>
      </ul>
      <p>
        Reassign transfer connections first, then update each affected direction’s
        endpoints and stops. Pending and ignored transfers also block deletion.
      </p>
      <p className="text-xs">Showing up to {deletion.example_limit} examples per type.</p>
      {examples.routes.length > 0 && (
        <p>Routes: {examples.routes.map((route) => route.code).join(", ")}</p>
      )}
      {examples.directions.length > 0 && (
        <ul aria-label="Affected directions" className="space-y-1">
          {examples.directions.map((direction) => (
            <li key={direction.id} className="break-words">
              {direction.route_code} · Direction #{direction.id}: {direction.origin} → {direction.destination}
            </li>
          ))}
        </ul>
      )}
      {examples.transfers.length > 0 && (
        <ul aria-label="Affected transfers" className="space-y-1">
          {examples.transfers.map((transfer) => (
            <li key={transfer.id} className="break-words">
              Transfer #{transfer.id} ({transfer.status}): {transfer.source_route_code} direction #{transfer.source_variant_id}
              {" → "}{transfer.destination_route_code} direction #{transfer.destination_variant_id}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
