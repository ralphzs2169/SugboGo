import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { AuthResponse } from "@/features/auth/types/auth.types";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { clearSessionTokens, saveSessionTokens } from "@/shared/api/storage.service";
import VerifyEmailScreen from "../VerifyEmailScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRouter = { replace: mockReplace, push: mockPush };
let mockParams: Record<string, unknown> = {};
let mockPendingEmail: string | null = null;
const mockVerify = jest.fn();
const mockResend = jest.fn();
const mockSetPendingEmail = jest.fn();
const mockClearPendingEmail = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
  useFocusEffect: (effect: React.EffectCallback) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("@/shared/api/storage.service", () => ({
  clearSessionTokens: jest.fn(),
  saveSessionTokens: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn().mockResolvedValue(undefined),
  rememberOfflineResources: jest.fn().mockResolvedValue(undefined),
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
    select({
      pendingEmail: mockPendingEmail,
      setPendingEmail: mockSetPendingEmail,
      clearPendingEmail: mockClearPendingEmail,
    }),
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

const session: AuthResponse = {
  access: "header.access.signature",
  refresh: "header.refresh.signature",
  user: {
    id: 123,
    first_name: "Explorer",
    last_name: "Account",
    gender: null,
    email: "explorer@example.com",
    role: "explorer",
    status: "active",
    has_completed_interest_selection: false,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const result = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { result, resolve };
}

describe("email verification with the registration password", () => {
  const password = "Registration-password-546!";
  const submit = "Verify email";

  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { uid: "legacy-user-id", token: "legacy-token" };
    mockPendingEmail = null;
    mockResend.mockResolvedValue({ success: true });
    invalidateAuthSession();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isSigningIn: false,
    });
    jest.mocked(saveSessionTokens).mockResolvedValue(true);
    jest.mocked(clearSessionTokens).mockResolvedValue(true);
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

    expect(mockVerify).toHaveBeenCalledWith("legacy-user-id", "legacy-token", password, true);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified");
  });

  it.each([
    [false, "/(setup)/interests"],
    [true, "/(explorer)/(tabs)/explore"],
  ])("installs the session before routing with completed interests %s", async (completed, route) => {
    const user = { ...session.user, has_completed_interest_selection: completed };
    const write = deferred<boolean>();
    jest.mocked(saveSessionTokens).mockReturnValueOnce(write.result);
    mockVerify.mockResolvedValue({ success: true, data: { ...session, user } });

    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await act(() => {
      void fireEvent.press(screen.getByRole("button", { name: submit }));
    });
    expect(saveSessionTokens).toHaveBeenCalledWith(session.access, session.refresh, expect.any(Number));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => write.resolve(true));
    expect(useAuthStore.getState().user).toEqual(user);
    expect(mockClearPendingEmail).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(route);
  });

  it.each([
    { ...session, refresh: undefined },
    { ...session, user: { ...session.user, role: "merchant" } },
    { ...session, user: { ...session.user, has_completed_interest_selection: undefined } },
  ])("uses ordinary sign-in when the response cannot establish an Explorer session", async (data) => {
    mockVerify.mockResolvedValue({ success: true, data });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(saveSessionTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified");
  });

  it("falls back to ordinary sign-in after a SecureStore failure", async () => {
    jest.mocked(saveSessionTokens).mockRejectedValueOnce(new Error("SecureStore unavailable"));
    mockVerify.mockResolvedValue({ success: true, data: session });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(clearSessionTokens).toHaveBeenCalledWith(expect.any(Number));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockClearPendingEmail).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(auth)/email-verified");
  });

  it.each([123, 456])("keeps the active session for account %i", async (id) => {
    const currentUser = { ...session.user, id };
    beginAuthSession();
    useAuthStore.getState().setUser(currentUser);
    mockVerify.mockResolvedValue({ success: true, data: session });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(mockVerify).toHaveBeenCalledWith("legacy-user-id", "legacy-token", password, false);
    expect(saveSessionTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(currentUser);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it.each([
    ["sign-in", () => beginAuthSession()],
    ["restoration", () => beginAuthSession("restore")],
    ["sign-out", () => invalidateAuthSession()],
  ])("ignores a response superseded by %s", async (_activity, changeSession) => {
    const response = deferred<{ success: true; data: AuthResponse }>();
    mockVerify.mockReturnValue(response.result);
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await act(() => {
      void fireEvent.press(screen.getByRole("button", { name: submit }));
    });
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    changeSession();
    await act(async () => response.resolve({ success: true, data: session }));

    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(saveSessionTokens).not.toHaveBeenCalled();
    expect(mockClearPendingEmail).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("yields to another sign-in that starts while SecureStore is writing", async () => {
    const write = deferred<boolean>();
    jest.mocked(saveSessionTokens).mockReturnValueOnce(write.result);
    mockVerify.mockResolvedValue({ success: true, data: session });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await act(() => {
      void fireEvent.press(screen.getByRole("button", { name: submit }));
    });

    useAuthStore.getState().setSigningIn(true);
    await act(async () => write.resolve(true));

    expect(clearSessionTokens).toHaveBeenCalledWith(expect.any(Number));
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("discards a delayed response when a different verification link opens", async () => {
    const response = deferred<{ success: true; data: AuthResponse }>();
    mockVerify.mockReturnValue(response.result);
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await act(() => {
      void fireEvent.press(screen.getByRole("button", { name: submit }));
    });

    mockParams = { uid: "different-user", token: "different-token" };
    await screen.rerender(<VerifyEmailScreen />);
    await act(async () => response.resolve({ success: true, data: session }));

    expect(screen.getByLabelText("Password").props.value).toBe("");
    expect(saveSessionTokens).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows a password field error without installing a session", async () => {
    mockVerify.mockResolvedValue({
      success: false,
      code: "VALIDATION_ERROR",
      errors: { password: ["Enter the password you used to register."] },
    });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(screen.getByLabelText("Password").props.error).toMatch(/password you used to register/);
    expect(saveSessionTokens).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows the retry interval when verification password attempts are locked", async () => {
    mockVerify.mockResolvedValue({
      success: false,
      code: "ACCOUNT_LOCKED",
      message: "Password sign-in is temporarily unavailable.",
      errors: { retry_after: 60 },
    });
    const screen = await render(<VerifyEmailScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), password);
    await fireEvent.press(screen.getByRole("button", { name: submit }));

    expect(screen.getByText(/try again in 1 minute/i)).toBeTruthy();
    expect(screen.getByLabelText("Password").props.value).toBe("");
    expect(saveSessionTokens).not.toHaveBeenCalled();
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

    expect(screen.getByText(/go back to log in if your email was already verified/i)).toBeTruthy();
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
