import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import Modal from "@/shared/components/modals/Modal";

export default function SuspendUserModal({
  isOpen,
  user,
  onClose,
  onConfirm,
  loading = false,
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function handleClose() {
    if (!loading) {
      setReason("");
      setError("");
      onClose();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedReason = reason.trim();

    if (!normalizedReason) {
      setError("Please provide a reason for suspending this user.");
      return;
    }

    setError("");
    await onConfirm(normalizedReason);
    setReason("");
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Suspend User?"
      description={
        user
          ? `Suspend ${user.name || user.email}'s SugboGo account.`
          : "Suspend this SugboGo account."
      }
      showCloseButton={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-stroke bg-surface p-4">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm leading-6 text-text-secondary">
            The user will no longer be able to access their SugboGo account
            while suspended. Their linked business will remain active.
          </p>
        </div>

        <TextArea
          id="suspension-reason"
          name="reason"
          label="Reason"
          placeholder="Describe why this account is being suspended."
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (error) setError("");
          }}
          error={error}
          rows={4}
          required
        />

        <div className="flex justify-end gap-3 border-t border-stroke pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={loading}
            disabled={!reason.trim()}
          >
            Suspend User
          </Button>
        </div>
      </form>
    </Modal>
  );
}
