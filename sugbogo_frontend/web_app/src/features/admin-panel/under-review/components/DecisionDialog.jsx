import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import Modal from "@/shared/components/modals/Modal";

const QUICK_REASONS = [
  {
    label: "Harassment",
    text: "The review contains harassing or abusive content that violates the community guidelines.",
  },
  {
    label: "Threatening content",
    text: "The review contains threatening or violent language that violates the community guidelines.",
  },
  {
    label: "Other policy violation",
    text: "The review contains content that violates the community guidelines.",
  },
];

function appendQuickReason(notes, reason) {
  const current = notes.trim();
  return [current, reason].filter(Boolean).join("\n").slice(0, 2000);
}

function DecisionDialog({
  decision,
  reviewId,
  pending,
  notes = "",
  onNotesChange,
  error,
  onClose,
  onConfirm,
}) {
  if (!decision || !reviewId) {
    return null;
  }

  const isReject = decision === "reject";
  const title = isReject
    ? "Reject this review?"
    : "Approve and publish this review?";
  const consequence = isReject
    ? "The review will be rejected and will not be published. This decision cannot be undone here."
    : "The review will be published and become visible to Explorers and the business.";
  const actionLabel = isReject ? "Reject Review" : "Approve & Publish";

  return (
    <Modal
      isOpen
      title={title}
      description={`Review #${reviewId}`}
      onClose={onClose}
      showCloseButton={!pending}
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-stroke bg-surface p-4">
          <p className="text-sm leading-6 text-text-secondary">{consequence}</p>
        </div>
        {isReject && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-text-primary">Quick reasons</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map(({ label, text }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onNotesChange(appendQuickReason(notes, text))}
                    disabled={pending}
                    className="rounded-full border border-stroke bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-stroke-active hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <TextArea
              id="under-review-moderation-notes"
              name="moderationNotes"
              label="Moderation Notes"
              placeholder="Explain why this review should be rejected, or choose a quick reason above..."
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              error={error}
              rows={5}
              required
              minLength={20}
              maxLength={2000}
              showCharacterCount
              disabled={pending}
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={isReject ? "danger" : "success"}
            onClick={onConfirm}
            loading={pending}
            disabled={pending || (isReject && notes.trim().length < 20)}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default DecisionDialog;
