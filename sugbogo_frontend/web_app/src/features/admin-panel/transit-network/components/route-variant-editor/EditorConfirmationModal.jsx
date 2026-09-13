import { AlertTriangle } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

/**
 * Confirms destructive editor actions with explicit stay/cancel and proceed choices.
 */
export default function EditorConfirmationModal({
  isOpen,
  title,
  description,
  warning,
  confirmLabel,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      description={description}
    >
      {/* Confirmation context */}
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p className="text-sm leading-relaxed text-text-secondary">
          {warning}
        </p>
      </div>

      {/* Confirmation actions */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Keep Editing
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
