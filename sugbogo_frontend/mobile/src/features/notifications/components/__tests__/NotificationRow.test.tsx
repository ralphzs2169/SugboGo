import { fireEvent, render } from "@testing-library/react-native";

import type { NotificationItem } from "../../types/notification.types";
import NotificationRow from "../NotificationRow";

function notification(isRead: boolean): NotificationItem {
  return {
    id: 12,
    type: "review_dispute_upheld",
    title: "Review dispute decision",
    body: "Your review dispute was upheld after inspection.",
    target_type: "review_dispute",
    target_id: 6,
    is_read: isRead,
    read_at: isRead ? "2026-10-14T10:30:00Z" : null,
    created_at: "2026-10-14T10:00:00Z",
  };
}

describe("NotificationRow", () => {
  it("keeps a read destination interactive with a restrained affordance", async () => {
    const onPress = jest.fn();
    const item = notification(true);
    const screen = await render(
      <NotificationRow
        notification={item}
        isNavigable
        destinationLabel="review dispute"
        onPress={onPress}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", {
        name: /Read notification\. Review dispute decision/,
      }),
    );

    expect(
      screen.getByTestId("notification-destination-indicator", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it("does not make an informational read notification look navigable", async () => {
    const screen = await render(
      <NotificationRow notification={notification(true)} onPress={jest.fn()} />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.queryByTestId("notification-destination-indicator", {
        includeHiddenElements: true,
      }),
    ).toBeNull();
  });
});
