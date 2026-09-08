import { AlertTriangle, CheckCircle } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import REVIEW_DISPUTE_DECISION_CONFIG from "../../config/reviewDisputeDecisionConfig";

/**
 * Gives administrators a final, decision-specific review before resolving a
 * dispute. The mutation is only reachable through this modal's confirmation
 * action, while Go Back preserves the notes held by the parent drawer.
 */
export default function ResolveDisputeConfirmationModal({
  isOpen,
  decision,
  notes,
  onClose,
  onConfirm,
  loading = false,
}) {
  const config = decision
    ? REVIEW_DISPUTE_DECISION_CONFIG[decision]
    : null;

  if (!config) {
    return null;
  }

  const DecisionIcon = decision === "uphold" ? AlertTriangle : CheckCircle;
  const iconClassName =
    decision === "uphold" ? "text-red-600" : "text-primary";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.confirmationTitle}
      description={config.confirmationDescription}
      showCloseButton={!loading}
      lockBodyScroll={false}
    >
      <div className="space-y-5">
        {/* Decision outcome */}
        <div className="flex gap-3 rounded-lg border border-stroke bg-surface p-4">
          <DecisionIcon
            className={`mt-0.5 h-5 w-5 shrink-0 ${iconClassName}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <p className="text-sm leading-6 text-text-secondary">
            {config.outcomeMessage}
          </p>
        </div>

        {/* Moderation notes summary */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Moderation Notes
          </h3>

          <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-stroke bg-background p-4 themed-scrollbar">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">
              {notes}
            </p>
          </div>
        </div>

        {/* Confirmation actions */}
        <div className="flex justify-end gap-3 border-t border-stroke pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Go Back
          </Button>

          <Button
            type="button"
            variant={config.confirmVariant}
            onClick={onConfirm}
            loading={loading}
          >
            {config.confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
