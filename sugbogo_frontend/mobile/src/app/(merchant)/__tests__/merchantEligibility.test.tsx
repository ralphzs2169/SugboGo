import { act, cleanup, render } from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import MerchantLayout from "../_layout";
const mockRouter = { replace: jest.fn() };
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  const Stack = () => <Text>Merchant routes</Text>;
  Stack.Screen = function MockScreen() {
    return null;
  };
  return { Stack, useRouter: () => mockRouter };
});
jest.mock("@/shared/components/LoadingScreen", () => {
  const { Text } = jest.requireActual("react-native");
  return { __esModule: true, default: () => <Text>Restoring session</Text> };
});

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    isLoading: false,
    isAuthenticated: true,
    user: { id: 1, role: "merchant" } as any,
  });
  useAppModeStore.setState({ activeMode: "merchant" });
});
afterEach(async () => {
  await cleanup();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
});
test("waits for unresolved sessions without exposing Merchant routes", async () => {
  useAuthStore.setState({ isLoading: true });
  const screen = await render(<MerchantLayout />);
  expect(screen.getByText("Restoring session")).toBeTruthy();
  expect(screen.queryByText("Merchant routes")).toBeNull();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
test("retains existing unauthenticated login handling", async () => {
  useAuthStore.setState({ isAuthenticated: false, user: null });
  const screen = await render(<MerchantLayout />);
  expect(screen.queryByText("Merchant routes")).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith("/(auth)/login");
});
test("allows a Merchant regardless of their Explorer mode preference", async () => {
  useAppModeStore.setState({ activeMode: "explorer" });
  const screen = await render(<MerchantLayout />);
  expect(screen.getByText("Merchant routes")).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});
test("replaces invalid deep links and does not loop on rerender", async () => {
  useAuthStore.setState({ user: { id: 1, role: "explorer" } as any });
  const screen = await render(<MerchantLayout />);
  expect(screen.queryByText("Merchant routes")).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
  expect(useAppModeStore.getState().activeMode).toBe("explorer");
  await screen.rerender(<MerchantLayout />);
  expect(mockRouter.replace).toHaveBeenCalledTimes(1);
});
test("removes mounted Merchant UI immediately after a role change", async () => {
  const screen = await render(<MerchantLayout />);
  await act(() =>
    useAuthStore.setState({ user: { id: 1, role: "explorer" } as any }),
  );
  expect(screen.queryByText("Merchant routes")).toBeNull();
  expect(mockRouter.replace).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
});
