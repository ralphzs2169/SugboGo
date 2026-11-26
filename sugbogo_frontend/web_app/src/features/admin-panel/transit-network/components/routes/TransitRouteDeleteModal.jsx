import { useState } from "react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import Modal from "@/shared/components/modals/Modal";
import useModalSubmission from "@/shared/hooks/useModalSubmission";

import useTransitMutations from "../../hooks/useTransitMutations";
import { useJeepneyRoute, useRouteVariant } from "../../hooks/useTransitQueries";

const detailOptions = { refetchOnMount: "always", retry: false };

/** Verify the selected record and explain its deletion before enabling confirmation. */
export default function TransitRouteDeleteModal({ target, onClose, onDeleted }) {
  const isRoute = target.kind === "route";
  const routeDetail = useJeepneyRoute(isRoute ? target.id : null, detailOptions);
  const variantDetail = useRouteVariant(isRoute ? null : target.id, detailOptions);
  const detail = isRoute ? routeDetail : variantDetail;
  const record = isRoute ? routeDetail.route : variantDetail.variant;
  const { deleteRoute, deleteVariant } = useTransitMutations();
  const [deleteError, setDeleteError] = useState(null);
  const { isSubmitting, runSubmission, close } = useModalSubmission(
    true,
    target,
    onClose,
  );

  const rejectedDeletion = deleteError?.response?.data?.errors?.deletion;
  const deletion = rejectedDeletion ?? record?.deletion;
  const loading = detail.isLoading || detail.isFetching;
  const verificationFailed = Boolean(
    detail.error || (!loading && (!detail.isFetchedAfterMount || !deletion)),
  );
  const canDelete = !loading && !verificationFailed && deletion?.can_delete === true;
  const label = isRoute ? "Route" : "Direction";

  async function retryEligibility() {
    setDeleteError(null);
    await detail.refetch();
  }

  async function handleDelete() {
    if (!canDelete) return;

    return runSubmission(async (isCurrent) => {
      setDeleteError(null);
      try {
        const remove = isRoute ? deleteRoute : deleteVariant;
        await remove(target.id);
        if (isCurrent()) {
          onDeleted(target.kind);
          toast.success(label + " deleted successfully.");
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
      title={"Delete " + label + "?"}
      description="Deletion is permanent and cannot be undone."
      scrollable
    >
      {record && (
        <p className="mb-4 break-words rounded-lg bg-surface p-4 text-sm font-semibold text-text-primary">
          {isRoute ? record.code : (
            <>{record.route_code} · {record.origin.name} → {record.destination.name}</>
          )}
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
          message={detail.error?.response?.data?.message || "Retry before deleting this record."}
          onRetry={retryEligibility}
          retryLabel="Retry"
        />
      ) : (
        <div className="space-y-2 text-sm text-text-secondary">
          {isRoute ? (
            <p>
              {deletion.variant_count > 0
                ? <>Saved directions remaining: {deletion.variant_count}.</>
                : "This route is empty. Deletion removes its route code."}
            </p>
          ) : (
            <p>
              The path and its {deletion.membership_count} ordered stop
              {deletion.membership_count === 1 ? " assignment" : " assignments"} will
              be removed. The transit points stay in the network.
            </p>
          )}
          {!canDelete && (
            <p role={rejectedDeletion ? "alert" : "status"} className="font-semibold text-text-primary">
              {deletion.reason}
            </p>
          )}
        </div>
      )}

      {deleteError && !rejectedDeletion && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {deleteError.response?.data?.message || "Deletion failed. Please try again."}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={isSubmitting} disabled={!canDelete}>
          Delete {label}
        </Button>
      </div>
    </Modal>
  );
}
