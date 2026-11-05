import { useState } from "react";
import { Send, ShieldAlert, UserCheck, UserX } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { useAuthStore } from "@/features/auth/storage/auth.store";

import { canManageUserStatus } from "../../constants/userManagement";
import useUserStatusMutations from "../../hooks/useUserStatusMutations";
import useResendAdminInvitation from "../../hooks/useResendAdminInvitation";
import { canResendAdminInvitation } from "../../utils/adminInvitationUi";
import ReactivateUserModal from "../ReactivateUserModal";
import SuspendUserModal from "../SuspendUserModal";
import UserDetailHeading from "./UserDetailHeading";

function getUnavailableMessage(currentUser, user) {
  if (String(currentUser?.id) === String(user.id)) {
    return "You cannot change the status of your own account.";
  }

  if (!["active", "suspended", "disabled"].includes(user.status)) {
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
  const {
    resendInvitation,
    isResending,
    error: resendError,
  } = useResendAdminInvitation();

  useApiErrorNotification(suspendError, {
    toastId: `admin-user-${user.id}-suspend-error`,
    fallbackMessage: "Unable to suspend the user. Please try again.",
  });
  useApiErrorNotification(reactivateError, {
    toastId: `admin-user-${user.id}-reactivate-error`,
    fallbackMessage: "Unable to reactivate the user. Please try again.",
  });
  useApiErrorNotification(resendError, {
    toastId: `admin-user-${user.id}-invitation-error`,
    fallbackMessage: "Unable to resend the Admin invitation. Please try again.",
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

  async function handleResendInvitation() {
    try {
      await resendInvitation(user.id);
      toast.success("Invitation email sent.");
    } catch {
      // The mutation notification reports delivery failures and allows retry.
    }
  }

  return (
    <>
      <section
        aria-label="Account actions"
        className="min-w-0 rounded-xl border border-stroke bg-background p-4 sm:p-5"
      >
      <UserDetailHeading icon={ShieldAlert} title="Account Actions" />

      <div>
        {canResendAdminInvitation(currentUser, user) ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Complete Admin account setup
              </h3>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Resend the account setup email.
              </p>
            </div>
            <Button size="sm" icon={Send} loading={isResending} onClick={handleResendInvitation}>
              {isResending ? "Sending Invitation..." : "Resend Invitation"}
            </Button>
          </div>
        ) : canManage && user.status === "active" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Suspend account
              </h3>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Restrict this user's access.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={UserX}
              onClick={() => setActiveAction("suspend")}
            >
              Suspend User
            </Button>
          </div>
        ) : canManage && ["suspended", "disabled"].includes(user.status) ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Restore account access
              </h3>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Allow this user to sign in again.
              </p>
            </div>
            <Button
              variant="success"
              size="sm"
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
      </section>

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
    </>
  );
}
