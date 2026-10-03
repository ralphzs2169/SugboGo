import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

/** Confirms the immediate public business-name change before approval. */
export default function ApproveUpdateRequestModal({
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
      title="Approve business name change?"
      description="This will immediately update the business's public name."
      showCloseButton={!loading}
    >
      {/* Decision summary */}
      <dl className="space-y-3 rounded-lg border border-stroke bg-surface p-4 text-sm">
        <div>
          <dt className="text-text-secondary">Current live name</dt>
          <dd className="mt-1 font-semibold text-text-primary">
            {request?.current_business_name}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Requested name</dt>
          <dd className="mt-1 font-semibold text-text-primary">
            {request?.proposed_business_name}
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
