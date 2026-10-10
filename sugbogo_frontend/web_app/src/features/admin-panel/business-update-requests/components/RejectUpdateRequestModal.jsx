import { useEffect } from "react";

import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import Modal from "@/shared/components/modals/Modal";

const REASON_FIELD_ID = "update-request-rejection-reason";

/** Collects the required merchant-facing reason for a rejected proposal. */
export default function RejectUpdateRequestModal({
  isOpen,
  reason,
  error,
  loading,
  onReasonChange,
  onClose,
  onConfirm,
  title = "Reject business name change",
  description = "The reason will be shown to the merchant.",
}) {
  useEffect(() => {
    if (isOpen && error) {
      document.getElementById(REASON_FIELD_ID)?.focus();
    }
  }, [isOpen, error]);

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      showCloseButton={!loading}
    >
      <form onSubmit={handleSubmit} noValidate>
        <TextArea
          id={REASON_FIELD_ID}
          name="rejection_reason"
          label="Reason"
          placeholder="Explain why this change cannot be approved..."
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          error={error}
          rows={5}
          required
          minLength={1}
          maxLength={1000}
          disabled={loading}
          showCharacterCount
        />
        <div className="mt-6 flex justify-end gap-3 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            Reject Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
