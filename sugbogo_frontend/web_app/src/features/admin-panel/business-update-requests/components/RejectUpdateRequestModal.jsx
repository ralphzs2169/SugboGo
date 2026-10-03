import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

/** Collects the required merchant-facing reason for a rejected proposal. */
export default function RejectUpdateRequestModal({
  isOpen,
  reason,
  error,
  loading,
  onReasonChange,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reject business name change"
      description="The reason will be shown to the merchant."
      showCloseButton={!loading}
    >
      {/* Merchant-facing feedback */}
      <label
        htmlFor="update-request-rejection-reason"
        className="block text-sm font-semibold text-text-primary"
      >
        Reason <span className="text-red-600">*</span>
      </label>
      <textarea
        id="update-request-rejection-reason"
        value={reason}
        maxLength={1000}
        required
        rows={5}
        disabled={loading}
        onChange={(event) => onReasonChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "update-request-rejection-error" : undefined}
        className="mt-2 w-full resize-y rounded-lg border border-stroke bg-background p-3 text-sm text-text-primary outline-none focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10 disabled:opacity-50"
      />
      {error && (
        <p
          id="update-request-rejection-error"
          className="mt-1 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-text-secondary">
        {reason.length}/1000 characters
      </p>
      <div className="mt-6 flex justify-end gap-3 border-t border-stroke pt-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          Reject Request
        </Button>
      </div>
    </Modal>
  );
}
