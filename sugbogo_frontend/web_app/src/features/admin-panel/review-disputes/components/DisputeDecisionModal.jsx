import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import Modal from "@/shared/components/modals/Modal";

import REVIEW_DISPUTE_DECISION_CONFIG, {
  MIN_MODERATION_NOTES_LENGTH,
  appendDisputeTemplate,
} from "../config/reviewDisputeDecisionConfig";

export default function DisputeDecisionModal({
  decision,
  disputeId,
  notes,
  error,
  pending,
  requiresAcknowledgement = false,
  acknowledged = false,
  refreshRequired = false,
  refreshing = false,
  onNotesChange,
  onAcknowledgementChange,
  onClose,
  onConfirm,
}) {
  const config = decision && REVIEW_DISPUTE_DECISION_CONFIG[decision];

  if (!config || !disputeId) {
    return null;
  }

  function appendTemplate(text) {
    onNotesChange(appendDisputeTemplate(notes, text));
  }

  return (
    <Modal
      isOpen
      title={config.confirmationTitle}
      description={`Dispute #${disputeId}`}
      onClose={onClose}
      showCloseButton={!pending && !refreshing}
      scrollable
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && !refreshRequired && (!requiresAcknowledgement || acknowledged)) {
            onConfirm();
          }
        }}
      >
        <div className="rounded-lg border border-stroke bg-surface p-4">
          <p className="text-sm leading-6 text-text-secondary">
            {config.outcomeMessage}
          </p>
        </div>
        {refreshRequired && (
          <p role="alert" className="text-sm leading-6 text-danger">
            {error}
          </p>
        )}
        {requiresAcknowledgement && (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-text-secondary">
              Uphold rejects the current review. Explain why rejecting its current
              content is justified, even when the filing-time content changed or
              its snapshot is unavailable.
            </p>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-6 text-text-primary">
              <input
                type="checkbox"
                name="acknowledgeReviewChanges"
                checked={acknowledged}
                onChange={(event) => onAcknowledgementChange(event.target.checked)}
                disabled={pending || refreshRequired}
                required
                className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <span>
                I have inspected the current review and understand that Uphold rejects it.
              </span>
            </label>
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-text-primary">Quick reasons</p>
          <div className="flex flex-wrap gap-2">
            {config.templates.map((template) => (
              <button
                key={template.value}
                type="button"
                disabled={pending || refreshRequired}
                onClick={() => appendTemplate(template.text)}
                className="rounded-full border border-stroke bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-stroke-active hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info disabled:opacity-50"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
        <TextArea
          id="dispute-moderation-notes"
          name="adminNotes"
          label="Moderation Notes"
          placeholder={requiresAcknowledgement
            ? "Explain why rejecting the current review is justified..."
            : "Explain the basis for this decision, or choose a quick reason above..."}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          error={refreshRequired ? "" : error}
          rows={5}
          required
          minLength={MIN_MODERATION_NOTES_LENGTH}
          showCharacterCount
          disabled={pending || refreshRequired}
        />
        <div className="flex flex-wrap justify-end gap-2 border-t border-stroke pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending || refreshing}>
            {refreshing ? "Refreshing investigation…" : refreshRequired ? "Review latest content" : "Cancel"}
          </Button>
          <Button
            type="submit"
            variant={decision === "uphold" ? "danger" : "primary"}
            loading={pending}
            disabled={pending
              || refreshRequired
              || (requiresAcknowledgement && !acknowledged)
              || notes.trim().length < MIN_MODERATION_NOTES_LENGTH}
          >
            {decision === "uphold" ? "Uphold Dispute" : "Dismiss Dispute"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
