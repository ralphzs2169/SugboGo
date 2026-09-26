import { UserCheck } from "lucide-react";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";

export default function ReactivateUserModal({
  isOpen,
  user,
  onClose,
  onConfirm,
  loading = false,
}) {
  function handleClose() {
    if (!loading) {
      onClose();
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reactivate User?"
      description={
        user
          ? `Reactivate ${user.name || user.email}'s SugboGo account.`
          : "Reactivate this SugboGo account."
      }
      showCloseButton={!loading}
    >
      <div className="space-y-5">
        <div className="flex gap-3 rounded-lg border border-stroke bg-surface p-4">
          <UserCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-success"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm leading-6 text-text-secondary">
            The user will be able to sign in to SugboGo again. Previously
            revoked refresh sessions will not be restored.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-stroke pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={onConfirm}
            loading={loading}
          >
            Reactivate User
          </Button>
        </div>
      </div>
    </Modal>
  );
}
