import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/storage/auth.store";
import { getSessionGeneration } from "@/shared/api/storage";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { notificationKeys } from "../queries/notificationQueries";
import { markAllNotificationsRead, markNotificationRead } from "../services/notificationService";
import { getNotificationDestination } from "../utils/notificationDestination";
import { useNotificationSession } from "./useNotifications";
import { PREVIEW_READ_ERROR, useNotificationPreview } from "../preview/notificationPreview";

/** Coordinate read mutations and trusted navigation within the originating session. */
export default function useNotificationActions({ onRead, onNavigate, surface }) {
  const { userId, enabled } = useNotificationSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const busyRef = useRef(false);
  const preview = useNotificationPreview();
  const previewing = import.meta.env.DEV && preview.scenario !== "live";

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
  const error = read.error || readAll.error;
  useApiErrorNotification(error, {
    toastId: `admin-notification-${surface}-read-error`,
    fallbackMessage: "Unable to mark notifications as read. Please try again.",
  });

  async function selectNotification(notification) {
    if (previewing) {
      if (!enabled || preview.scenario === "marking") return;
      if (preview.scenario === "read-error") return;
      preview.markRead(notification.id);
      onRead?.();
      return;
    }
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
    } catch {
      // The mutation owns both persistent feedback and the deduplicated error toast.
    } finally {
      busyRef.current = false;
    }
  }

  async function markAllRead() {
    if (previewing) {
      if (!enabled || ["marking", "read-error"].includes(preview.scenario)) return;
      preview.markRead();
      onRead?.();
      return;
    }
    if (!enabled || busyRef.current) return;
    busyRef.current = true;
    read.reset();
    readAll.reset();
    try {
      await readAll.mutateAsync({ generation: getSessionGeneration() });
    } catch {
      // Keep the surface open so the same action can be retried.
    } finally {
      busyRef.current = false;
    }
  }

  return {
    selectNotification,
    markAllRead,
    busy: previewing ? preview.scenario === "marking" : read.isPending || readAll.isPending,
    isMarkingAll: previewing ? preview.scenario === "marking" : readAll.isPending,
    error: previewing
      ? preview.scenario === "read-error" ? PREVIEW_READ_ERROR : null
      : error,
    retry: () => {
      if (previewing) return preview.setScenario("mixed");
      if (read.isError) return selectNotification(read.variables.notification);
      return markAllRead();
    },
  };
}
