import apiClient from "@/shared/api/apiClient.service";

import {
  getNotifications,
  getNotificationUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../notification.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({
  request: (value: unknown) => value,
}));

describe("notification service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ success: true });
    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });
  });

  it("serializes pagination and the optional backend read filter", async () => {
    await getNotifications({ page: 2, pageSize: 20, isRead: false });

    expect(apiClient.get).toHaveBeenCalledWith("/notifications/", {
      params: { page: "2", page_size: "20", is_read: "false" },
    });

    await getNotifications({ page: 1, pageSize: 20 });

    expect(apiClient.get).toHaveBeenLastCalledWith("/notifications/", {
      params: { page: "1", page_size: "20" },
    });
  });

  it("uses the verified unread and read endpoints", async () => {
    await getNotificationUnreadCount();
    await markNotificationRead(42);
    await markAllNotificationsRead();

    expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count/");
    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/notifications/42/read/",
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/notifications/read-all/",
    );
  });
});
