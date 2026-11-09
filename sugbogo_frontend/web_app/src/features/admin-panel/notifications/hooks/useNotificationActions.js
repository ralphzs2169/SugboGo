import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/storage/auth.store";
import { getSessionGeneration } from "@/shared/api/storage";
import toast from "react-hot-toast";
import { notificationKeys } from "../queries/notificationQueries";
import { markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { getNotificationDestination } from "../utils/notificationDestination";
import { useNotificationSession } from "./useNotifications";

/** Coordinate read mutations and trusted navigation within the originating session. */
export default function useNotificationActions({ onRead, onNavigate, surface }) {
  const { userId, enabled } = useNotificationSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const busyRef = useRef(false);

  function isCurrent(generation) {
    const state = useAuthStore.getState();
    return (
      generation === getSessionGeneration() &&
      state.user?.id === userId && state.isAuthenticated && !state.isLoading &&
      ["admin", "super_admin"].includes(state.user?.role)
    );
  }

  async function reconcile(_result, { generation }) {
    if (!isCurrent(generation)) return;
    onRead?.();
    await queryClient.invalidateQueries({ queryKey: notificationKeys.account(userId) });
  }

  const read = useMutation({
    mutationFn: ({ notification }) => markNotificationRead(notification.id),
    onSuccess: reconcile,
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: reconcile,
  });

  /** Report a failed user action once without replacing successfully loaded content. */
  function notifyReadError(error) {
    toast.error(
      error.response?.data?.message || "Unable to mark notifications as read. Please try again.",
      { id: `admin-notification-${surface}-read-error` },
    );
  }

  async function selectNotification(notification) {
    if (!enabled || busyRef.current) return;
    busyRef.current = true;
    const generation = getSessionGeneration();
    read.reset();
    readAll.reset();
    try {
      if (!notification.is_read) {
        await read.mutateAsync({ notification, generation });
      }
      if (!isCurrent(generation)) return;
      onNavigate?.();
      navigate(getNotificationDestination(notification) ?? "/admin-panel/notifications");
    } catch (error) {
      if (isCurrent(generation)) notifyReadError(error);
    } finally {
      busyRef.current = false;
    }
  }

  async function markAllRead() {
    if (!enabled || busyRef.current) return;
    busyRef.current = true;
    read.reset();
    readAll.reset();
    const generation = getSessionGeneration();
    try {
      await readAll.mutateAsync({ generation });
    } catch (error) {
      if (isCurrent(generation)) notifyReadError(error);
    } finally {
      busyRef.current = false;
    }
  }

  return {
    selectNotification,
    markAllRead,
    busy: read.isPending || readAll.isPending,
    isMarkingAll: readAll.isPending,
  };
}
