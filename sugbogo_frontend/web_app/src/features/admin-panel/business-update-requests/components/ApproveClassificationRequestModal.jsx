import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

/** Confirms that approval will atomically apply the requested live classification. */
export default function ApproveClassificationRequestModal({
  isOpen,
  request,
  loading,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approve classification change?"
      description="This will immediately update the business category and active specialties."
      showCloseButton={!loading}
    >
      {/* Decision summary */}
      <dl className="space-y-3 rounded-lg border border-stroke bg-surface p-4 text-sm">
        <div>
          <dt className="text-text-secondary">Current category</dt>
          <dd className="mt-1 font-semibold text-text-primary">
            {request?.current?.category?.name}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Requested category</dt>
          <dd className="mt-1 font-semibold text-text-primary">
            {request?.proposed?.category?.name}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Requested specialties</dt>
          <dd className="mt-1 text-text-primary">
            {request?.proposed?.specialty_tags
              ?.map((tag) => tag.name)
              .join(", ")}
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
