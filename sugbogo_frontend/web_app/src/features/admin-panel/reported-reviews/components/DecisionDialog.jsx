import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import Modal from "@/shared/components/modals/Modal";

const MIN_MODERATION_NOTES_LENGTH = 20;
const MAX_MODERATION_NOTES_LENGTH = 2000;

const DECISION_TEMPLATES = {
  confirm: [
    {
      value: "issue-confirmed",
      label: "Reported issue confirmed",
      text: "The reported issue was confirmed after reviewing the available evidence.",
    },
    {
      value: "evidence-supports",
      label: "Evidence supports reports",
      text: "The available evidence supports the submitted community reports.",
    },
    {
      value: "guidelines-violation",
      label: "Guidelines violation",
      text: "The review was found to violate the community guidelines.",
    },
  ],

  dismiss: [
    {
      value: "insufficient-evidence",
      label: "Insufficient evidence",
      text: "There is insufficient evidence to confirm the reported issue.",
    },
    {
      value: "issue-not-found",
      label: "Issue not found",
      text: "The reported issue could not be confirmed after reviewing the content.",
    },
    {
      value: "report-not-supported",
      label: "Report not supported",
      text: "The available evidence does not support the submitted community reports.",
    },
  ],

  reject: [
    {
      value: "policy-violation",
      label: "Policy violation confirmed",
      text: "The review contains content that violates the community guidelines.",
    },
    {
      value: "evidence-supports-removal",
      label: "Evidence supports removal",
      text: "The available evidence supports removing this review.",
    },
    {
      value: "reported-content-confirmed",
      label: "Reported content confirmed",
      text: "The reported content was confirmed during moderation review.",
    },
  ],

  keep: [
    {
      value: "no-violation",
      label: "No policy violation",
      text: "No policy violation was found after reviewing the content.",
    },
    {
      value: "insufficient-removal-evidence",
      label: "Insufficient evidence",
      text: "There is insufficient evidence to justify removing this review.",
    },
    {
      value: "within-guidelines",
      label: "Within guidelines",
      text: "The review remains within the community guidelines.",
    },
  ],
};

function DecisionDialog({
  target,
  notes,
  onNotesChange,
  onClose,
  onConfirm,
  pending,
  error,
}) {
  if (!target) {
    return null;
  }

  const alreadyRejected = target.reviewStatus === "rejected";

  // Preserve support for the previous rejected-review "reject" action
  // while using the newer explicit "confirm" decision.
  const isConfirm =
    target.decision === "confirm" ||
    (alreadyRejected && target.decision === "reject");

  const isReject = target.decision === "reject" && !alreadyRejected;

  let title;
  let consequence;
  let actionLabel;
  let actionVariant;
  let templateType;

  if (alreadyRejected && isConfirm) {
    title = "Confirm these reports?";
    consequence =
      "All remaining pending community reports will be marked as confirmed. " +
      "The review will remain rejected.";
    actionLabel = "Confirm Reports";
    actionVariant = "primary";
    templateType = "confirm";
  } else if (alreadyRejected) {
    title = "Dismiss these reports?";
    consequence =
      "All remaining pending community reports will be dismissed. " +
      "The review will remain rejected.";
    actionLabel = "Dismiss Reports";
    actionVariant = "secondary";
    templateType = "dismiss";
  } else if (isReject) {
    title = "Reject this review?";
    consequence =
      "The review will be rejected and all pending community reports for this " +
      "review will be marked as confirmed. It will no longer remain published.";
    actionLabel = "Reject Review";
    actionVariant = "danger";
    templateType = "reject";
  } else {
    title = "Keep this review?";
    consequence =
      "The review will remain published and all pending community reports for " +
      "this review will be dismissed.";
    actionLabel = "Keep Review";
    actionVariant = "secondary";
    templateType = "keep";
  }

  const templates = DECISION_TEMPLATES[templateType] ?? [];
  const trimmedLength = notes.trim().length;
  const notesValid = trimmedLength >= MIN_MODERATION_NOTES_LENGTH;

  function handleNotesChange(event) {
    onNotesChange(event.target.value);
  }

  function handleTemplateClick(template) {
    const currentNotes = notes.trim();

    const nextNotes = currentNotes
      ? `${currentNotes}\n${template.text}`
      : template.text;

    onNotesChange(nextNotes.slice(0, MAX_MODERATION_NOTES_LENGTH));
  }

  return (
    <Modal
      isOpen
      title={title}
      description={`Review #${target.reviewId}`}
      onClose={onClose}
      showCloseButton={!pending}
    >
      <div className="space-y-5">
        {/* Decision consequence */}
        <div className="rounded-lg border border-stroke bg-surface p-4">
          <p className="text-sm leading-6 text-text-secondary">{consequence}</p>
        </div>

        {/* Quick note templates */}
        <div>
          <p className="text-xs font-semibold text-text-secondary">
            Quick reasons
          </p>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.value}
                type="button"
                onClick={() => handleTemplateClick(template)}
                disabled={pending}
                className="
                  cursor-pointer rounded-full px-3 py-1.5
                  text-xs font-medium text-text-primary
                  shadow-sm ring-1 ring-inset ring-stroke
                  transition-all
                  hover:bg-surface-hover hover:ring-stroke-strong
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {/* Moderation notes */}
        <TextArea
          id="reported-review-moderation-notes"
          name="moderationNotes"
          label="Moderation Notes"
          placeholder="Explain the basis for this decision, or choose a quick reason above..."
          value={notes}
          onChange={handleNotesChange}
          rows={6}
          minLength={MIN_MODERATION_NOTES_LENGTH}
          maxLength={MAX_MODERATION_NOTES_LENGTH}
          showCharacterCount
          disabled={pending}
        />

        {/* API error */}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error.response?.data?.message ||
              "The review decision could not be saved. Please try again."}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>

          <Button
            variant={actionVariant}
            onClick={onConfirm}
            loading={pending}
            disabled={!notesValid || pending}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default DecisionDialog;
