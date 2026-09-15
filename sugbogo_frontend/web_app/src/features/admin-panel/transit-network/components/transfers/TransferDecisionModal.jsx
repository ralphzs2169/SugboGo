import toast from "react-hot-toast";
import { Check, X } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

import useTransitMutations from "../../hooks/useTransitMutations";
import { formatVariantLabel } from "../../utils/transitFormatters";

/**
 * Confirms an explicit pending-transfer decision before invoking its dedicated
 * backend status action.
 */
export default function TransferDecisionModal({
  transfer,
  action,
  onClose,
  onSaved,
}) {
  const {
    confirmTransfer,
    ignoreTransfer,
    isConfirmingTransfer,
    isIgnoringTransfer,
  } = useTransitMutations();
  const isConfirming = action === "confirm";
  const isSubmitting = isConfirming
    ? isConfirmingTransfer
    : isIgnoringTransfer;

  async function handleReview() {
    try {
      const savedTransfer = isConfirming
        ? await confirmTransfer(transfer.id)
        : await ignoreTransfer(transfer.id);

      toast.success(
        isConfirming
          ? "Transit transfer confirmed successfully."
          : "Transit transfer ignored successfully.",
      );
      onSaved(savedTransfer);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `The transit transfer could not be ${isConfirming ? "confirmed" : "ignored"}.`,
      );
    }
  }

  return (
    <Modal
      isOpen={Boolean(transfer && action)}
      onClose={onClose}
      title={isConfirming ? "Confirm Transit Transfer?" : "Ignore Transit Transfer?"}
      description={
        isConfirming
          ? "Confirmed transfers can participate in future routing behavior."
          : "Ignored transfers remain recorded but will not participate in routing."
      }
    >
      {/* Review summary */}
      <p className="rounded-lg bg-surface p-4 text-sm text-text-secondary">
        {formatVariantLabel(transfer?.source_variant)} to {" "}
        {formatVariantLabel(transfer?.destination_variant)}
      </p>

      {/* Review actions */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant={isConfirming ? "success" : "danger"}
          icon={isConfirming ? Check : X}
          loading={isSubmitting}
          onClick={handleReview}
        >
          {isConfirming ? "Confirm Transfer" : "Ignore Transfer"}
        </Button>
      </div>
    </Modal>
  );
}
