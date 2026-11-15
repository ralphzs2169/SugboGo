import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import VerifyEmailScreen from "../VerifyEmailScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRouter = { replace: mockReplace, push: mockPush };
let mockParams: Record<string, unknown> = {};
let mockPendingEmail: string | null = null;
const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockSetPendingEmail = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: (ref: { current: { present: () => void } | null }) =>
    ref.current?.present(),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { TextInput, View } = jest.requireActual("react-native");
  return {
    BottomSheetModal: React.forwardRef(function MockBottomSheet(
      {
        children,
        onDismiss,
        onChange,
      }: {
        children: React.ReactNode;
        onDismiss: () => void;
        onChange: (index: number) => void;
      },
      ref: React.Ref<unknown>,
    ) {
      const [open, setOpen] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => {
          setOpen(true);
          onChange(0);
        },
        dismiss: () => {
          setOpen(false);
          onDismiss();
        },
      }));
      return open ? <View testID="verification-recovery-sheet">{children}</View> : null;
    }),
    BottomSheetScrollView: View,
    BottomSheetTextInput: TextInput,
    BottomSheetBackdrop: () => null,
  };
});
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
  const { TextInput, View } = jest.requireActual("react-native");
  return function MockPasswordInput({
    rightElement,
    ...props
  }: import("react-native").TextInputProps & { rightElement?: React.ReactNode }) {
    return (
      <View>
        {rightElement}
        <TextInput {...props} />
      </View>
    );
  };
});
jest.mock("@/shared/components/form/FormInput", () => {
  const { TextInput } = jest.requireActual("react-native");
  return TextInput;
});

describe("email verification with the registration password", () => {
  const password = "Registration-password-546!";
  const submit = "Verify email";

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { uid: "legacy-user-id", token: "legacy-token" };
    mockPendingEmail = null;
    mockResend.mockResolvedValue({ success: true });
  });

  it("does not redeem the link until the user enters their registration password", async () => {
    mockVerify.mockResolvedValue({ success: true });
    const screen = await render(<VerifyEmailScreen />);
    expect(mockVerify).not.toHaveBeenCalled();

    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: submit }));
    expect(mockVerify).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(mockVerify).toHaveBeenCalledWith("legacy-user-id", "legacy-token", password);
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
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));
    expect(mockVerify).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Try again")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: submit }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified"));
  });

  it("opens the existing password recovery screen without redeeming the link", async () => {
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));
    expect(mockPush).toHaveBeenCalledWith("/(auth)/forgot-password");
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("supports resending from the normal check-inbox screen", async () => {
    mockParams = {};
    mockPendingEmail = "test@example.invalid";
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(mockResend).toHaveBeenCalledWith(mockPendingEmail);
  });

  it("offers fresh proof instead of password retry after the server rejects the link", async () => {
    mockPendingEmail = "signup@example.invalid";
    mockVerify.mockResolvedValue({
      success: false,
      code: "INVALID_VERIFICATION_LINK",
    });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("button", { name: submit })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(mockResend).toHaveBeenCalledWith(mockPendingEmail);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/verify-email");
  });

  it("resends directly to the saved signup address from password confirmation", async () => {
    mockPendingEmail = "signup@example.invalid";
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));

    expect(mockResend).toHaveBeenCalledWith(mockPendingEmail);
    expect(mockSetPendingEmail).toHaveBeenCalledWith(mockPendingEmail);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/verify-email");
    expect(mockVerify).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Email address")).toBeNull();
  });

  it("collects an unknown address in a recovery sheet before sending", async () => {
    const screen = await render(<VerifyEmailScreen />);
    expect(screen.queryByLabelText("Email address")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(mockResend).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    const sheet = within(screen.getByTestId("verification-recovery-sheet"));
    expect(sheet.getByLabelText("Email address")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Send verification email" }));
    expect(mockResend).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Email address"), "other@example.invalid");
    await fireEvent.press(screen.getByRole("button", { name: "Send verification email" }));
    expect(mockResend).toHaveBeenCalledWith("other@example.invalid");
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/verify-email");
  });

  it("dismisses recovery without losing the password or sending email", async () => {
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Email address")).toBeNull();
    expect(screen.getByLabelText("Password").props.value).toBe(password);
    expect(mockResend).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("opens recovery when the saved resend address needs correcting", async () => {
    mockPendingEmail = "previous@example.invalid";
    mockResend.mockResolvedValueOnce({
      success: false,
      code: "USER_NOT_FOUND",
    });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    const sheet = within(screen.getByTestId("verification-recovery-sheet"));
    expect(sheet.getByLabelText("Email address").props.value).toBe(mockPendingEmail);
    await fireEvent.changeText(sheet.getByLabelText("Email address"), "current@example.invalid");
    await fireEvent.press(sheet.getByRole("button", { name: "Send verification email" }));
    expect(mockResend).toHaveBeenLastCalledWith("current@example.invalid");
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/verify-email");
  });

  it("keeps password confirmation available when resending fails and supports retry", async () => {
    mockPendingEmail = "signup@example.invalid";
    mockResend.mockRejectedValueOnce(new Error("Connection lost"));
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText("Password").props.value).toBe(password);

    await fireEvent.press(screen.getByRole("button", { name: "Resend email" }));
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/verify-email");
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
