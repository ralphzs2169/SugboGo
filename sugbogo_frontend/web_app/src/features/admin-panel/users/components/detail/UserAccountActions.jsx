import { useState } from "react";
import { ShieldAlert, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useAuthStore } from "@/features/auth/storage/auth.store";

import { canManageUserStatus } from "../../constants/userManagement";
import useUserStatusMutations from "../../hooks/useUserStatusMutations";
import ReactivateUserModal from "../ReactivateUserModal";
import SuspendUserModal from "../SuspendUserModal";

function getUnavailableMessage(currentUser, user) {
  if (String(currentUser?.id) === String(user.id)) {
    return "You cannot change the status of your own account.";
  }

  if (!["active", "suspended"].includes(user.status)) {
    return "This account state cannot be changed through the suspension workflow.";
  }

  return "Your role does not permit changing this user's account status.";
}

export default function UserAccountActions({ user }) {
  const currentUser = useAuthStore((state) => state.user);
  const [activeAction, setActiveAction] = useState(null);
  const {
    suspend,
    reactivate,
    isSuspending,
    isReactivating,
    suspendError,
    reactivateError,
  } = useUserStatusMutations();

  useApiErrorNotification(suspendError, {
    toastId: `admin-user-${user.id}-suspend-error`,
    fallbackMessage: "Unable to suspend the user. Please try again.",
  });
  useApiErrorNotification(reactivateError, {
    toastId: `admin-user-${user.id}-reactivate-error`,
    fallbackMessage: "Unable to reactivate the user. Please try again.",
  });

  const canManage = canManageUserStatus(currentUser, user);

  function closeAction(force = false) {
    if (force || (!isSuspending && !isReactivating)) {
      setActiveAction(null);
    }
  }

  async function handleSuspend(reason) {
    await suspend({ userId: user.id, reason });
    toast.success("User suspended successfully.");
    closeAction(true);
  }

  async function handleReactivate() {
    await reactivate({ userId: user.id });
    toast.success("User reactivated successfully.");
    closeAction(true);
  }

  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Account Actions
      </h2>

      <div className="rounded-xl border border-stroke bg-background p-5">
        {canManage && user.status === "active" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Suspend account access
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Blocks authenticated access and revokes all refresh sessions.
                Linked businesses are not changed.
              </p>
            </div>
            <Button
              variant="danger"
              icon={UserX}
              onClick={() => setActiveAction("suspend")}
            >
              Suspend User
            </Button>
          </div>
        ) : canManage && user.status === "suspended" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Restore account access
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Allows the user to sign in again. Revoked sessions remain
                revoked.
              </p>
            </div>
            <Button
              variant="success"
              icon={UserCheck}
              onClick={() => setActiveAction("reactivate")}
            >
              Reactivate User
            </Button>
          </div>
        ) : (
          <div className="flex gap-3">
            <ShieldAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                No account actions available
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                {getUnavailableMessage(currentUser, user)}
              </p>
            </div>
          </div>
        )}
      </div>

      <SuspendUserModal
        isOpen={activeAction === "suspend"}
        user={user}
        onClose={closeAction}
        onConfirm={handleSuspend}
        loading={isSuspending}
      />
      <ReactivateUserModal
        isOpen={activeAction === "reactivate"}
        user={user}
        onClose={closeAction}
        onConfirm={handleReactivate}
        loading={isReactivating}
      />
    </section>
  );
}
