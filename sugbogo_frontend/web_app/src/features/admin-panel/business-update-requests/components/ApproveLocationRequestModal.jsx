import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

import { getLandmarkDiff } from "../utils/locationDiff";

/** Confirms replacement of the live location and complete landmark set with the frozen proposal. */
export default function ApproveLocationRequestModal({
  isOpen,
  request,
  loading,
  onClose,
  onConfirm,
}) {
  const diff = getLandmarkDiff(
    request?.previous?.landmarks,
    request?.proposed?.landmarks,
  );
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve location change?"
      description="This will replace the business's live location and landmark set with the reviewed request."
      showCloseButton={!loading}
    >
      {/* Decision summary */}
      <dl className="space-y-3 rounded-lg border border-stroke bg-surface p-4 text-sm">
        <div>
          <dt className="text-text-secondary">Current</dt>
          <dd className="mt-1 font-medium text-text-primary">
            {request?.previous?.location?.address || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Requested</dt>
          <dd className="mt-1 font-medium text-text-primary">
            {request?.proposed?.location?.address || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Landmarks</dt>
          <dd className="mt-1 font-medium text-text-primary">
            {diff.removed.length} removed · {diff.added.length} added
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
