import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import { getClassificationDiff } from "../utils/classificationDiff";

/** Confirms that approval will atomically apply the requested live classification. */
export default function ApproveClassificationRequestModal({
  isOpen,
  request,
  loading,
  onClose,
  onConfirm,
}) {
  const diff = getClassificationDiff(request?.previous, request?.proposed);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve classification change?"
      description="This will immediately update the business category and active specialties."
      showCloseButton={!loading}
    >
      {/* Requested change summary */}
      <dl className="space-y-3 rounded-lg border border-stroke bg-surface p-4 text-sm">
        <div>
          <dt className="text-text-secondary">Category</dt>
          <dd className="mt-1 font-semibold text-text-primary">
            {request?.previous?.category?.name || "—"}
            {diff.categoryChanged ? (
              <>
                {" "}
                <span aria-hidden="true">→</span>{" "}
                {request?.proposed?.category?.name || "—"}
              </>
            ) : (
              <span className="ml-2 text-xs font-normal text-text-secondary">
                Unchanged
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Cluster</dt>
          <dd className="mt-1 font-semibold text-text-primary">
            {request?.previous?.cluster?.name || "—"}
            {diff.clusterChanged ? (
              <>
                {" "}
                <span aria-hidden="true">→</span>{" "}
                {request?.proposed?.cluster?.name || "—"}
              </>
            ) : (
              <span className="ml-2 text-xs font-normal text-text-secondary">
                Unchanged
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Specialties to remove</dt>
          <dd className="mt-1 font-medium text-text-primary">
            {diff.removedSpecialties.map((tag) => tag.name).join(", ") ||
              "None"}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Specialties to add</dt>
          <dd className="mt-1 font-medium text-text-primary">
            {diff.addedSpecialties.map((tag) => tag.name).join(", ") || "None"}
          </dd>
        </div>
      </dl>
      <div className="mt-6 flex justify-end gap-3 border-t border-stroke pt-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="success" onClick={onConfirm} loading={loading}>
          Approve Request
        </Button>
      </div>
    </Modal>
  );
}
