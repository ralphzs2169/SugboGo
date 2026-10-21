import { fireEvent, render } from "@testing-library/react-native";

import ExploreTopBar from "../ExploreTopBar";
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: jest.requireActual("react-native").View },
  cancelAnimation: jest.fn(),
  Easing: { inOut: () => undefined, quad: undefined },
  ReduceMotion: { System: "system" },
  useAnimatedStyle: () => ({}),
  useReducedMotion: jest.fn(() => false),
  useSharedValue: (initial: number) => {
    const value = jest.requireActual("react").useRef({
      value: initial,
      set: jest.fn(),
    });
    return value.current;
  },
  withSequence: jest.fn(() => 0),
  withTiming: jest.fn((value: number) => value),
}));

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => true,
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
