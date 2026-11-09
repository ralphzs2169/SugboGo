import apiClient from "@/shared/api/apiClient";

/** Read one recipient-owned page through the shared cancellable API client. */
export async function fetchNotifications(params, { signal } = {}) {
  const response = await apiClient.get("/notifications/", { params, signal });
  return response.data.data;
}

/** Read the authoritative unread count independently of notification history. */
export async function fetchNotificationUnreadCount({ signal } = {}) {
  const response = await apiClient.get("/notifications/unread-count/", { signal });
  return response.data.data;
}

/** Mark one owned notification read without accepting client-authored content. */
export async function markNotificationRead(notificationId) {
  const response = await apiClient.post(`/notifications/${notificationId}/read/`);
  return response.data.data;
}

/** Mark the current recipient's unread inbox read. */
export async function markAllNotificationsRead() {
  const response = await apiClient.post("/notifications/read-all/");
  return response.data.data;
}
