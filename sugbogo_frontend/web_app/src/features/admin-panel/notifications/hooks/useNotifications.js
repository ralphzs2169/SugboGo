import { useQuery } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/storage/auth.store";
import {
  notificationCountOptions,
  notificationListOptions,
} from "../queries/notificationQueries";

/** Admit only a restored, authenticated administrative account to inbox reads. */
export function useNotificationSession() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const enabled = Boolean(
    !isLoading && isAuthenticated && user?.id &&
    ["admin", "super_admin"].includes(user.role),
  );
  return { userId: user?.id, role: user?.role, enabled };
}

/** Read a page only while its surface and administrative session are active. */
export function useNotifications(params, { enabled = true } = {}) {
  const session = useNotificationSession();
  return useQuery({
    ...notificationListOptions(session.userId, params),
    enabled: session.enabled && enabled,
  });
}

/** Share count data between the header poller and the history page. */
export function useNotificationUnreadCount(options) {
  const session = useNotificationSession();
  return useQuery({
    ...notificationCountOptions(session.userId, options),
    enabled: session.enabled,
  });
}
