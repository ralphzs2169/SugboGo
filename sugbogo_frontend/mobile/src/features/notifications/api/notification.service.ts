import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  NotificationItem,
  NotificationPage,
  NotificationReadAllResult,
  NotificationUnreadCount,
} from "../types/notification.types";

type NotificationListParams = {
  page: number;
  pageSize: number;
  isRead?: boolean;
};

/** Retrieves one recipient-owned page using the backend read-state filter. */
export function getNotifications({
  page,
  pageSize,
  isRead,
}: NotificationListParams): Promise<ApiResponse<NotificationPage>> {
  const params: Record<string, string> = {
    page: String(page),
    page_size: String(pageSize),
  };

  if (isRead !== undefined) {
    params.is_read = String(isRead);
  }

  return request(apiClient.get("/notifications/", { params }));
}

/** Retrieves the authenticated account's authoritative unread count. */
export function getNotificationUnreadCount(): Promise<
  ApiResponse<NotificationUnreadCount>
> {
  return request(apiClient.get("/notifications/unread-count/"));
}

/** Marks one recipient-owned notification as read. */
export function markNotificationRead(
  notificationId: number,
): Promise<ApiResponse<NotificationItem>> {
  return request(apiClient.post(`/notifications/${notificationId}/read/`));
}

/** Marks every unread notification for the authenticated account as read. */
export function markAllNotificationsRead(): Promise<
  ApiResponse<NotificationReadAllResult>
> {
  return request(apiClient.post("/notifications/read-all/"));
}
