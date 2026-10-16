import { fireEvent, render } from "@testing-library/react-native";

import MerchantDashboardScreen from "../MerchantDashboardScreen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("@/features/notifications/hooks/useNotifications", () => ({
  useNotificationUnreadCount: () => ({ unreadCount: 4 }),
}));

describe("MerchantDashboardScreen", () => {
  it("opens the same shared inbox from the Merchant header", async () => {
    const screen = await render(<MerchantDashboardScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: "Notifications, 4 unread" }),
    );

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(mockPush).toHaveBeenCalledWith("/notifications");
  });
});
