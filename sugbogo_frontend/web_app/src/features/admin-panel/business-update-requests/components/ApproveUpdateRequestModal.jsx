import { ArrowDown } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

/**
 * Confirms a business name change before approval.
 *
 * Presents the current and requested names in a vertical comparison,
 * emphasizing the proposed name and the immediate public update.
 */
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
      {/* Vertical name comparison */}
      <div className="min-w-0">
        {/* Current live name */}
        <div className="rounded-xl bg-surface p-4">
          <p className="text-xs font-medium text-text-secondary">
            Current live name
          </p>

          <p className="mt-2 break-words text-lg font-medium text-text-primary">
            {request?.current_business_name || "Not provided"}
          </p>
        </div>

        {/* Circular downward arrow */}
        <div className="relative z-10 -my-2 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-background shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
            <ArrowDown
              size={18}
              className="text-text-secondary"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Requested business name */}
        <div className="rounded-xl border border-stroke bg-background p-4">
          <p className="text-xs font-semibold text-text-secondary">
            Requested name
          </p>

          <p className="mt-2 break-words text-xl font-bold text-text-primary">
            {request?.proposed_business_name || "Not provided"}
          </p>
        </div>
      </div>

      {/* Confirmation actions */}
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
