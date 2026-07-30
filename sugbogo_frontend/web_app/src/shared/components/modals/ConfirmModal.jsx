import Modal from "./Modal";
import Button from "../Button";
import { Trash2 } from "lucide-react";

/**
 * A modal component that prompts the user for confirmation before performing an action.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Determines if the modal is open.
 * @param {Function} props.onClose - Function to call when the modal is closed.
 * @param {Function} props.onConfirm - Function to call when the user confirms the action.
 * @param {string} [props.title="Confirm Delete"] - The title of the modal.
 * @param {string} [props.description] - Optional description text for the modal.
 * @param {boolean} [props.loading=false] - Indicates if the action is in progress.
 * @returns {JSX.Element} The ConfirmModal component.
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
