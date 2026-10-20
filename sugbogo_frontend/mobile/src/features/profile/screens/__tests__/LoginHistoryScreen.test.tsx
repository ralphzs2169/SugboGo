import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import useLoginHistory from "../../hooks/useLoginHistory";
import AccountSettingsScreen from "../AccountSettingsScreen";
import LoginHistoryScreen from "../LoginHistoryScreen";

jest.mock("../../hooks/useLoginHistory");
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("lottie-react-native", () => "LottieView");
jest.mock("@/shared/components/Skeleton", () => "Skeleton");
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const refetch = jest.fn();
const fetchNextPage = jest.fn();
const events = [
  {
    id: 1,
    method: "google" as const,
    outcome: "failed" as const,
    platform: "Android",
    client: "Mobile app",
    ip_address: "192.0.2.1",
    created_at: "2026-10-20T06:00:00Z",
  },
];

function state(overrides: Partial<ReturnType<typeof useLoginHistory>> = {}) {
  // Query internals are irrelevant to the screen's user-visible states.
  jest.mocked(useLoginHistory).mockReturnValue({
    events,
    data: { pages: [], pageParams: [] },
    isPending: false,
    isError: false,
    isRefetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    isFetching: false,
    refetch,
    fetchNextPage,
    ...overrides,
  } as ReturnType<typeof useLoginHistory>);
}

describe("LoginHistoryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state();
  });

  it("opens history from account settings and shows outcome and client metadata", async () => {
    const settings = await render(<AccountSettingsScreen />);
    await fireEvent.press(settings.getByText("Login history"));
    expect(router.push).toHaveBeenCalledWith("/profile/login-history");
    await settings.unmount();
    const screen = await render(<LoginHistoryScreen />);
    expect(screen.getByText("Unsuccessful sign-in")).toBeTruthy();
    expect(screen.getByText("Google · Android · Mobile app")).toBeTruthy();
    expect(screen.getByText("Network address: 192.0.2.1")).toBeTruthy();
  });

  it("distinguishes loading, empty history, and a retryable request failure", async () => {
    state({ events: [], data: undefined, isPending: true });
    const screen = await render(<LoginHistoryScreen />);
    expect(screen.getByLabelText("Loading login history")).toBeTruthy();
    state({ events: [], data: undefined, isError: true });
    await screen.rerender(<LoginHistoryScreen />);
    expect(screen.queryByText("No recent sign-in activity")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    state({ events: [] });
    await screen.rerender(<LoginHistoryScreen />);
    expect(screen.getByText("No recent sign-in activity")).toBeTruthy();
  });

  it("preserves loaded rows when pagination fails and retries the failed page", async () => {
    state({ isFetchNextPageError: true, isError: true, hasNextPage: true });
    const screen = await render(<LoginHistoryScreen />);
    expect(screen.getByText("Unsuccessful sign-in")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: /Tap to retry/i }),
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });
});
