import { fireEvent, render } from "@testing-library/react-native";

import ExploreTopBar from "../ExploreTopBar";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotificationUnreadCount: () => ({ unreadCount: 2 }),
}));

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");

  return { ...actual, useSafeAreaInsets: () => ({ top: 0 }) };
});

describe("ExploreTopBar notification entry", () => {
  it("opens the shared inbox from the Explorer home header", async () => {
    const screen = await render(
      <ExploreTopBar
        clusters={[]}
        selectedClusterId={null}
        onSelectCluster={jest.fn()}
        onPressSearch={jest.fn()}
        onPressFilters={jest.fn()}
      />,
    );

    fireEvent.press(
      screen.getByRole("button", { name: "Notifications, 2 unread" }),
    );

    expect(mockPush).toHaveBeenCalledWith("/notifications");
  });
});
