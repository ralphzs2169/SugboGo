import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import VerifyEmailScreen from "../VerifyEmailScreen";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
let mockParams: Record<string, unknown> = {};
const mockVerify = jest.fn();
const mockResend = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-linking", () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));
jest.mock("../../hooks/useVerifyEmail", () => ({
  useVerifyEmail: () => ({ handleVerifyEmail: mockVerify }),
}));
jest.mock("../../hooks/useResendVerification", () => ({
  useResendVerification: () => ({
    handleResendVerification: mockResend,
    loading: false,
  }),
}));
jest.mock("../../store/verification.store", () => ({
  useVerificationStore: (select: (state: unknown) => unknown) =>
    select({ pendingEmail: "test@example.invalid" }),
}));
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(() => true),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock(
  "../../components/EmailConfirmationLayout",
  () =>
    function MockEmailConfirmationLayout({
      children,
      onResend,
    }: {
      children: React.ReactNode;
      onResend: () => void;
    }) {
      const { View, Pressable, Text } = jest.requireActual("react-native");
      return (
        <View>
          <Pressable onPress={onResend}>
            <Text>Resend</Text>
          </Pressable>
          {children}
        </View>
      );
    },
);
jest.mock(
  "../../components/BottomAuthLink",
  () =>
    function MockBottomAuthLink({ onPress }: { onPress: () => void }) {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable onPress={onPress}>
          <Text>Back to Login</Text>
        </Pressable>
      );
    },
);
jest.mock(
  "@/shared/components/LoadingScreen",
  () =>
    function MockLoadingScreen() {
      const { Text } = jest.requireActual("react-native");
      return <Text>Verifying Email</Text>;
    },
);
jest.mock(
  "@/shared/components/Button",
  () =>
    function MockButton({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress: () => void;
      disabled: boolean;
    }) {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          disabled={disabled}
          onPress={onPress}
        >
          <Text>{title}</Text>
        </Pressable>
      );
    },
);

describe("verification error recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { uid: "user-id", token: "verification-token" };
    mockResend.mockResolvedValue({ success: true });
  });

  it.each([
    "NETWORK_ERROR",
    "REQUEST_TIMEOUT",
    "SERVER_ERROR",
    "INVALID_TOKEN",
  ])("releases loading and permits retry after %s", async (code) => {
    mockVerify.mockResolvedValueOnce({
      success: false,
      code,
      message: "Verification unavailable",
    });
    const screen = await render(<VerifyEmailScreen />);
    await waitFor(() =>
      expect(screen.queryByText("Verifying Email")).toBeNull(),
    );
    expect(screen.getByText("Verification unavailable")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    mockVerify.mockResolvedValueOnce({ success: true });
    await fireEvent.press(
      screen.getByRole("button", { name: "Retry verification" }),
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified"),
    );
    expect(mockVerify).toHaveBeenCalledTimes(2);
    await screen.unmount();
  });

  it("recovers from thrown failures and keeps the login escape available", async () => {
    mockVerify.mockRejectedValueOnce(new Error("Unexpected failure"));
    const screen = await render(<VerifyEmailScreen />);
    await waitFor(() =>
      expect(screen.queryByText("Verifying Email")).toBeNull(),
    );
    expect(
      screen.getByRole("button", { name: "Retry verification" }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Back to Login"));
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/login");
    await screen.unmount();
  });

  it("rejects incomplete or repeated link parameters without consuming a token", async () => {
    mockParams = { uid: ["one", "two"], token: "token" };
    const screen = await render(<VerifyEmailScreen />);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(screen.getByText(/link is incomplete/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry verification" }),
    ).toBeNull();
    await screen.unmount();
  });

  it("keeps verification retry available when resending also fails", async () => {
    mockVerify.mockResolvedValueOnce({
      success: false,
      message: "Verification unavailable",
    });
    mockResend.mockResolvedValueOnce({ success: false, code: "NETWORK_ERROR" });
    const screen = await render(<VerifyEmailScreen />);
    await waitFor(() =>
      expect(screen.queryByText("Verifying Email")).toBeNull(),
    );
    await fireEvent.press(screen.getByText("Resend"));
    expect(
      screen.getByRole("button", { name: "Retry verification" }),
    ).toBeTruthy();
    await screen.unmount();
  });

  it("releases the loading view if a pending link is replaced by an incomplete link", async () => {
    let resolve!: (value: unknown) => void;
    mockVerify.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const screen = await render(<VerifyEmailScreen />);
    expect(screen.getByText("Verifying Email")).toBeTruthy();
    mockParams = { uid: "missing-token" };
    await screen.rerender(<VerifyEmailScreen />);
    expect(screen.queryByText("Verifying Email")).toBeNull();
    expect(screen.getByText(/link is incomplete/)).toBeTruthy();
    await act(async () => resolve({ success: true }));
    expect(mockReplace).not.toHaveBeenCalled();
    await screen.unmount();
  });

  it("does not navigate when an obsolete verification finishes after unmount", async () => {
    let resolve!: (value: unknown) => void;
    mockVerify.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const screen = await render(<VerifyEmailScreen />);
    await screen.unmount();
    await act(async () => resolve({ success: true }));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
