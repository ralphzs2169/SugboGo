import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

function DecisionDialog({ target, notes, onNotesChange, onClose, onConfirm, pending, error }) {
  if (!target) {
    return null;
  }

  const isReject = target.decision === "reject";
  const consequence = isReject
    ? target.reviewStatus === "rejected"
      ? "This review is already rejected. All remaining pending community reports will be marked as confirmed without rejecting the review again."
      : "The review will be rejected and all pending community reports for this review will be marked as confirmed. It will no longer remain published."
    : "The review will remain published and all pending community reports for this review will be dismissed.";

  return (
    <Modal
      isOpen
      title={isReject ? "Reject this review?" : "Keep this review?"}
      description={`Review #${target.reviewId}`}
      onClose={onClose}
      showCloseButton={!pending}
    >
      <div className="space-y-4">
        <p className="rounded-lg border border-stroke bg-surface p-4 text-sm leading-6 text-text-secondary">
          {consequence}
        </p>
        <label className="block text-sm font-medium text-text-primary">
          Moderation notes <span className="text-text-secondary">(at least 20 characters)</span>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={4}
            maxLength={2000}
            disabled={pending}
            className="mt-2 w-full rounded-lg border border-stroke bg-background p-3 text-sm text-text-primary focus:border-stroke-active focus:outline-none"
            placeholder="Explain the review decision"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error.response?.data?.message || "The review decision could not be saved. Please try again."}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant={isReject ? "danger" : "secondary"}
            onClick={onConfirm}
            loading={pending}
            disabled={notes.trim().length < 20}
          >
            {isReject ? "Reject Review" : "Keep Review"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default DecisionDialog;
