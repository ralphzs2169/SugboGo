import Modal from "./Modal";
import Button from "../Button";
import { Trash2 } from "lucide-react";

/**
 * A modal component that prompts the user for confirmation before performing an action.
 *
 */

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Delete",
  description,
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
    >
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <Button
          variant="danger"
          icon={Trash2}
          onClick={onConfirm}
          loading={loading}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
