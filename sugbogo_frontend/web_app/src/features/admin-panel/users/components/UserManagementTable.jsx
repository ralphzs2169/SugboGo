import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ShieldCheck, UsersRound } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "@/features/admin-panel/components/data-table/DataTable";
import FilterMenu from "@/features/admin-panel/components/data-table/FilterMenu";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import Button from "@/shared/components/Button";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import getUserColumns from "../columns/userColumns";
import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from "../constants/userManagement";
import useUsers from "../hooks/useUsers";
import useResendAdminInvitation from "../hooks/useResendAdminInvitation";
import useUserStatusMutations from "../hooks/useUserStatusMutations";
import useUserTableState from "../hooks/useUserTableState";
import {
  canCreateAdmin,
  getCreateAdminFeedback,
} from "../utils/adminInvitationUi";
import CreateAdminModal from "./CreateAdminModal";
import ReactivateUserModal from "./ReactivateUserModal";
import SuspendUserModal from "./SuspendUserModal";

export default function UserManagementTable() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeAction, setActiveAction] = useState(null);

  const tableState = useUserTableState();
  const usersQuery = useUsers(tableState.params);
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
    error: resendInvitationError,
  } = useResendAdminInvitation();

  useApiErrorNotification(usersQuery.error, {
    toastId: "admin-users-load-error",
    fallbackMessage: "Unable to load users. Please try again.",
  });
  useApiErrorNotification(suspendError, {
    toastId: "admin-user-suspend-error",
    fallbackMessage: "Unable to suspend the user. Please try again.",
  });
  useApiErrorNotification(reactivateError, {
    toastId: "admin-user-reactivate-error",
    fallbackMessage: "Unable to reactivate the user. Please try again.",
  });
  useApiErrorNotification(resendInvitationError, {
    toastId: "admin-invitation-resend-error",
    fallbackMessage: "Unable to resend the Admin invitation. Please try again.",
  });

  function openAction(action, user) {
    setSelectedUser(user);
    setActiveAction(action);
  }

  function closeAction(force = false) {
    if (force || (!isSuspending && !isReactivating)) {
      setSelectedUser(null);
      setActiveAction(null);
    }
  }

  async function handleSuspend(reason) {
    await suspend({
      userId: selectedUser.id,
      reason,
    });
    toast.success("User suspended successfully.");
    closeAction(true);
  }

  async function handleReactivate() {
    await reactivate({
      userId: selectedUser.id,
    });
    toast.success("User reactivated successfully.");
    closeAction(true);
  }

  function handleAdminCreated(result) {
    const feedback = getCreateAdminFeedback(result);

    if (feedback.kind === "success") {
      toast.success(feedback.message);
      return;
    }

    toast(feedback.message, {
      id: "admin-invitation-delivery-warning",
      duration: 6000,
    });
  }

  async function handleResendInvitation(user) {
    try {
      await resendInvitation(user.id);
      toast.success("Invitation email sent.");
    } catch {
      // The mutation error is formatted by the shared API notification hook.
    }
  }

  const columns = getUserColumns({
    currentUser,
    onViewUser: (user) => navigate(`/admin-panel/users/${user.id}`),
    onSuspendUser: (user) => openAction("suspend", user),
    onReactivateUser: (user) => openAction("reactivate", user),
    onResendInvitation: handleResendInvitation,
    isResendingInvitation: isResending,
  });

  function renderFilters() {
    return (
      <FilterMenu
        filters={[
          {
            key: "role",
            label: "Role",
            icon: UsersRound,
            options: USER_ROLE_OPTIONS,
            value: tableState.roleFilter,
            onChange: tableState.setRoleFilter,
          },
          {
            key: "status",
            label: "Status",
            icon: ShieldCheck,
            options: USER_STATUS_OPTIONS,
            value: tableState.statusFilter,
            onChange: tableState.setStatusFilter,
          },
        ]}
      />
    );
  }

  function renderHeaderActions() {
    if (!canCreateAdmin(currentUser)) {
      return null;
    }

    return (
      <Button icon={Plus} onClick={() => setIsCreateAdminOpen(true)}>
        Add Admin
      </Button>
    );
  }

  return (
    <>
      <DataTable
        data={usersQuery.users}
        columns={columns}
        isLoading={usersQuery.isLoading}
        isFetching={usersQuery.isFetching}
        error={usersQuery.error}
        onRetry={usersQuery.refetch}
        pagination={tableState.pagination}
        state={{
          globalFilter: tableState.globalFilter,
          sorting: tableState.sorting,
        }}
        pageCount={usersQuery.pageCount}
        totalItems={usersQuery.totalItems}
        onPaginationChange={tableState.setPagination}
        onGlobalFilterChange={tableState.setGlobalFilter}
        onSortingChange={tableState.setSorting}
        hasActiveFilters={tableState.hasActiveFilters}
        onResetFilters={tableState.handleResetFilters}
        isSearching={tableState.isSearching}
        config={{
          searchPlaceholder: "Search by name or email...",
          emptyState: {
            title: "No users yet",
            description: "Registered SugboGo users will appear here.",
            icon: <UsersRound className="h-10 w-10 text-text-secondary" />,
          },
          noResultsState: {
            title: "No users found",
          },
          errorState: {
            title: "Unable to load users",
            message: "The requested users could not be loaded.",
          },
        }}
        slots={{
          renderFilters,
          renderHeaderActions,
        }}
      />

      <CreateAdminModal
        isOpen={isCreateAdminOpen}
        onClose={() => setIsCreateAdminOpen(false)}
        onCreated={handleAdminCreated}
      />

      <SuspendUserModal
        isOpen={activeAction === "suspend"}
        user={selectedUser}
        onClose={closeAction}
        onConfirm={handleSuspend}
        loading={isSuspending}
      />
      <ReactivateUserModal
        isOpen={activeAction === "reactivate"}
        user={selectedUser}
        onClose={closeAction}
        onConfirm={handleReactivate}
        loading={isReactivating}
      />
    </>
  );
}
