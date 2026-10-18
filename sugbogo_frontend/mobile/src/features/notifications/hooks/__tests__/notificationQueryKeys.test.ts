import {
  NOTIFICATIONS_QUERY_KEY,
  notificationKeys,
} from "../notificationQueryKeys";

describe("notificationKeys", () => {
  it("isolates every resource by authenticated account", () => {
    expect(NOTIFICATIONS_QUERY_KEY).toEqual(["notifications"]);
    expect(notificationKeys.list(4, "all")).toEqual([
      "notifications",
      4,
      "list",
      "all",
    ]);
    expect(notificationKeys.list(9, "all")).not.toEqual(
      notificationKeys.list(4, "all"),
    );
    expect(notificationKeys.unreadCount(4)).toEqual([
      "notifications",
      4,
      "unread-count",
    ]);
  });

  it("keeps server-side filters in independent cache entries", () => {
    expect(notificationKeys.list(4, "all")).not.toEqual(
      notificationKeys.list(4, "unread"),
    );
    expect(notificationKeys.list(4, "all").slice(0, 3)).toEqual(
      notificationKeys.lists(4),
    );
  });
});
