import { useRef, useState } from "react";

import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import Modal from "@/shared/components/modals/Modal";

/** Captures a Super Admin's attestation for the account shown when the dialog opened. */
export default function VerifyUserEmailModal({ user, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const submitting = useRef(false);
  const normalizedReason = reason.trim();
  const valid = normalizedReason.length > 0 && normalizedReason.length <= 1000 && confirmed;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!valid || loading || submitting.current) return;

    submitting.current = true;
    try {
      await onConfirm({
        reason: normalizedReason,
        ownership_confirmed: confirmed,
        verification_snapshot: user.verification_snapshot,
      });
    } catch {
      // The existing mutation notification displays the error while the form stays open.
    } finally {
      submitting.current = false;
    }
  }

  function handleClose() {
    if (!loading && !submitting.current) onClose();
  }

  return (
    <Modal
      isOpen
      title="Verify email address?"
      description="This action bypasses the normal email verification link."
      onClose={handleClose}
      showCloseButton={!loading}
      scrollable
    >
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
        <div className="rounded-lg border border-stroke bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">{user.name}</p>
          <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">{user.email}</p>
        </div>
        <TextArea
          id="manual-verification-reason"
          label="Reason for manual verification"
          placeholder="Explain why verification is necessary and how you confirmed account ownership."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={1000}
          disabled={loading}
          required
        />
        <p className="text-xs text-text-secondary">
          Omit passwords, codes, and links from the reason.
        </p>
        <label className="flex items-start gap-3 rounded-lg border border-stroke p-3 text-sm leading-6 text-text-primary">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-primary"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={loading}
            required
          />
          <span>I independently confirmed control of this email address and the account credential.</span>
        </label>
        <div className="flex flex-wrap justify-end gap-3 border-t border-stroke pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid} loading={loading}>
            Confirm Verification
          </Button>
        </div>
      </form>
    </Modal>
  );
}
