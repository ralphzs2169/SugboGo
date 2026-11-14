import { fireEvent, render, waitFor } from "@testing-library/react-native";
import VerifyEmailScreen from "../VerifyEmailScreen";

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
let mockParams: Record<string, unknown> = {};
let mockPendingEmail: string | null = null;
const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockSetPendingEmail = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-linking", () => ({ canOpenURL: jest.fn(), openURL: jest.fn() }));
jest.mock("../../hooks/useVerifyEmail", () => ({
  useVerifyEmail: () => ({ handleVerifyEmail: mockVerify }),
}));
jest.mock("../../hooks/useResendVerification", () => ({
  useResendVerification: () => ({ handleResendVerification: mockResend }),
}));
jest.mock("../../store/verification.store", () => ({
  useVerificationStore: (select: (state: unknown) => unknown) =>
    select({ pendingEmail: mockPendingEmail, setPendingEmail: mockSetPendingEmail }),
}));
jest.mock("@/shared/utils/apiErrors", () => ({
  ...jest.requireActual("@/shared/utils/apiErrors"),
  handleSystemError: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("../../components/AuthLayout", () => function MockLayout({
  children,
}: { children: React.ReactNode }) {
  const { View } = jest.requireActual("react-native");
  return <View>{children}</View>;
});
jest.mock("../../components/EmailConfirmationLayout", () => function MockEmail({
  children,
  onResend,
}: { children: React.ReactNode; onResend: () => void }) {
  const { Pressable, View } = jest.requireActual("react-native");
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Resend email" onPress={onResend} />
      {children}
    </View>
  );
});
jest.mock("../../components/BottomAuthLink", () => function MockLink({
  actionText,
  onPress,
}: { actionText: string; onPress: () => void }) {
  const { Pressable } = jest.requireActual("react-native");
  return <Pressable accessibilityRole="button" accessibilityLabel={actionText} onPress={onPress} />;
});
jest.mock("@/shared/components/AppText", () => {
  const { Text } = jest.requireActual("react-native");
  return Text;
});
jest.mock("@/shared/components/Button", () => function MockButton({
  title,
  onPress,
}: { title: string; onPress: () => void }) {
  const { Pressable } = jest.requireActual("react-native");
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} />;
});
jest.mock("@/shared/components/form/PasswordInput", () => {
  const { TextInput } = jest.requireActual("react-native");
  return TextInput;
});
jest.mock("@/shared/components/form/FormInput", () => {
  const { TextInput } = jest.requireActual("react-native");
  return TextInput;
});

describe("email verification with mailbox password setup", () => {
  const password = "Mailbox-owner-password-546!";
  const confirm = "Verify and set password";

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { uid: "legacy-user-id", token: "legacy-token" };
    mockPendingEmail = null;
    mockResend.mockResolvedValue({ success: true });
  });

  it("waits for the mailbox holder to choose and explicitly submit a password", async () => {
    mockVerify.mockResolvedValue({ success: true });
    const screen = await render(<VerifyEmailScreen />);
    expect(mockVerify).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: confirm }));
    expect(mockVerify).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("New password"), password);
    await fireEvent.changeText(screen.getByLabelText("Confirm password"), password);
    await fireEvent.press(screen.getByRole("button", { name: confirm }));

    expect(mockVerify).toHaveBeenCalledWith("legacy-user-id", "legacy-token", password, password);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified");
  });

  it("permits retry after a transport error", async () => {
    mockVerify.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Try again",
    });
    mockVerify.mockResolvedValueOnce({ success: true });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("New password"), password);
    await fireEvent.changeText(screen.getByLabelText("Confirm password"), password);
    await fireEvent.press(screen.getByRole("button", { name: confirm }));
    expect(mockVerify).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Try again")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: confirm }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified"));
  });

  it("supports resending from the normal check-inbox screen", async () => {
    mockParams = {};
    mockPendingEmail = "test@example.invalid";
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(mockResend).toHaveBeenCalledWith(mockPendingEmail);
  });

  it("can request fresh proof when there is no local pending email", async () => {
    mockParams = { uid: ["duplicate", "uid"] };
    const screen = await render(<VerifyEmailScreen />);
    expect(screen.getByText(/link is incomplete/)).toBeTruthy();
    expect(mockVerify).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Email address"), "person@example.invalid");
    await fireEvent.press(screen.getByRole("button", { name: "Send verification email" }));
    expect(mockResend).toHaveBeenCalledWith("person@example.invalid");
  });
});
