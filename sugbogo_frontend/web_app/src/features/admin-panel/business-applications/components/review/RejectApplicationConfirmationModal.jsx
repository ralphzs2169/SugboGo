import Modal from "@/shared/components/modals/Modal";
import Button from "@/shared/components/Button";

/**
 * Confirms the final rejection decision and gives the administrator
 * a final review of the feedback that will be sent to the applicant.
 *
 * The feedback summary is independently scrollable so the confirmation
 * actions remain visible regardless of how much feedback was entered.
 */
export default function RejectApplicationConfirmationModal({
  isOpen,
  selectedSections,
  feedback,
  sections,
  onClose,
  onConfirm,
  loading = false,
  businessName,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reject "${businessName}"?`}
      description="Review the feedback below before rejecting this application."
    >
      <div className="flex max-h-[70vh] flex-col">
        {/* Feedback summary */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 themed-scrollbar">
          <div className="space-y-4">
            {selectedSections.map((sectionValue) => {
              const section = sections.find(
                (item) => item.value === sectionValue,
              );

              if (!section) {
                return null;
              }

              return (
                <div
                  key={sectionValue}
                  className="rounded-lg border border-stroke bg-surface p-4"
                >
                  <h3 className="text-sm font-semibold text-text-primary">
                    {section.label}
                  </h3>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                    {feedback[sectionValue]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation actions */}
        <div className="mt-6 flex shrink-0 justify-end gap-3 border-t border-stroke pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            loading={loading}
          >
            Reject Application
          </Button>
        </div>
      </div>
    </Modal>
  );
}
