import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import {
  useConfirmEmailChange,
  useEmailChange,
} from "@/features/auth/hooks/useEmailChange";
import { useAuthStore } from "@/features/auth/store/auth.store";
import ConfirmEmailChangeScreen from "@/features/auth/screens/ConfirmEmailChangeScreen";
import AccountSettingsScreen from "../AccountSettingsScreen";
import ChangeEmailScreen from "../ChangeEmailScreen";

let mockParams: Record<string, string | string[]>;
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/features/auth/hooks/useEmailChange");
jest.mock("../../hooks/useUnsavedChanges", () => ({
  useUnsavedChangesGuard: () => ({
    showConfirm: false,
    confirmLeave: jest.fn(),
    cancelLeave: jest.fn(),
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return function MockModal(props: any) {
    if (!props.visible) return null;
    return (
      <View>
        <Text>{props.title}</Text>
        {props.message}
        <Pressable onPress={props.onConfirm} disabled={props.isLoading}>
          <Text>{props.confirmText}</Text>
        </Pressable>
        <Pressable onPress={props.onCancel} disabled={props.isLoading}>
          <Text>{props.cancelText}</Text>
        </Pressable>
      </View>
    );
  };
});

const user = {
  id: 1,
  first_name: "Cebu",
  last_name: "Explorer",
  gender: null,
  email: "old@example.com",
  role: "explorer" as const,
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
  has_usable_password: true,
};
const send = jest.fn();
const cancel = jest.fn();
const confirm = jest.fn();
const refetch = jest.fn();
let mockState: any;

describe("Email change screens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user, isAuthenticated: true });
    mockParams = {
      request_id: "99999999-1111-4444-8888-111111111111",
      token: "emailed-secret",
    };
    mockState = {
      status: {
        isPending: false,
        isError: false,
        data: { current_email: user.email, pending: null },
        error: null,
        refetch,
      },
      requestChange: { mutateAsync: send, isPending: false },
      cancelChange: { mutateAsync: cancel, isPending: false },
    };
    jest.mocked(useEmailChange).mockImplementation(() => mockState);
    jest
      .mocked(useConfirmEmailChange)
      .mockReturnValue({ mutateAsync: confirm, isPending: false } as any);
    send.mockResolvedValue({
      new_email: "new@example.com",
      expires_at: "2026-10-20T10:30:00Z",
    });
    cancel.mockResolvedValue(undefined);
    confirm.mockResolvedValue({ user_id: user.id, email: "new@example.com" });
  });

  it("opens email management from Account Settings", async () => {
    const screen = await render(<AccountSettingsScreen />);
    await fireEvent.press(screen.getByText("Change email"));
    expect(router.push).toHaveBeenCalledWith("/profile/change-email");
  });

  it("requires a different valid email and password before submitting", async () => {
    const screen = await render(<ChangeEmailScreen />);
    await fireEvent.press(screen.getByText("Send verification email"));
    expect(send).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("New email"),
      "OLD@EXAMPLE.COM",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Original739!",
    );
    await fireEvent.press(screen.getByText("Send verification email"));
    expect(send).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("New email"),
      "  NEW@example.com  ",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "  Original739!  ",
    );
    await fireEvent.press(screen.getByText("Send verification email"));
    expect(send).toHaveBeenCalledWith({
      new_email: "NEW@example.com",
      current_password: "  Original739!  ",
    });
    expect(screen.getByLabelText("Current password").props.value).toBe("");
    expect(useAuthStore.getState().user?.email).toBe(user.email);
  });

  it("keeps server field errors recoverable without clearing the form", async () => {
    send.mockRejectedValueOnce({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid input.",
      errors: { new_email: ["This email is unavailable."] },
    });
    const screen = await render(<ChangeEmailScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("New email"),
      "new@example.com",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Original739!",
    );
    await fireEvent.press(screen.getByText("Send verification email"));
    await waitFor(() =>
      expect(screen.getByText("This email is unavailable.")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Current password").props.value).toBe(
      "Original739!",
    );
  });

  it("restores pending state and requires confirmation to cancel it", async () => {
    mockState.status.data.pending = {
      new_email: "pending@example.com",
      expires_at: "2026-10-20T10:30:00Z",
    };
    const screen = await render(<ChangeEmailScreen />);
    expect(screen.getByText("pending@example.com")).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel pending change"));
    expect(cancel).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Keep change"));
    expect(cancel).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Cancel pending change"));
    await fireEvent.press(screen.getByText("Cancel change"));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("provides retry for status failures and prevents sending from unresolved state", async () => {
    mockState.status = {
      ...mockState.status,
      data: undefined,
      isError: true,
      error: {
        success: false,
        code: "NETWORK_ERROR",
        message: "No connection.",
      },
    };
    const screen = await render(<ChangeEmailScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: /Tap to retry/i }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("New email")).toBeNull();
  });

  it("uses password setup for passwordless accounts", async () => {
    useAuthStore.setState({
      user: { ...user, has_oauth_accounts: true, has_usable_password: false },
    });
    const screen = await render(<ChangeEmailScreen />);
    expect(screen.queryByLabelText("Current password")).toBeNull();
    await fireEvent.press(screen.getByText("Set up a password"));
    expect(router.push).toHaveBeenCalledWith("/profile/change-password");
  });

  it("disables request fields while delivery is pending", async () => {
    mockState.requestChange.isPending = true;
    const screen = await render(<ChangeEmailScreen />);
    expect(screen.getByLabelText("New email").props.editable).toBe(false);
    expect(screen.getByLabelText("Current password").props.editable).toBe(
      false,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Send verification email" }),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("never automatically confirms a deep link and requires password submission", async () => {
    const screen = await render(<ConfirmEmailChangeScreen />);
    expect(confirm).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Confirm email change"));
    expect(confirm).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "  Original739!  ",
    );
    await fireEvent.press(screen.getByText("Confirm email change"));
    expect(confirm).toHaveBeenCalledWith({
      ...mockParams,
      current_password: "  Original739!  ",
    });
    await waitFor(() => expect(screen.getByText("Email changed")).toBeTruthy());
  });

  it("rejects incomplete and repeated query parameters without a request", async () => {
    mockParams = { request_id: ["one", "two"], token: "secret" };
    const screen = await render(<ConfirmEmailChangeScreen />);
    expect(screen.queryByLabelText("Current password")).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("retains link errors for recovery and uses the current local account on exit", async () => {
    confirm.mockRejectedValueOnce({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid link.",
      errors: { token: ["This link has expired."] },
    });
    const screen = await render(<ConfirmEmailChangeScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Original739!",
    );
    await fireEvent.press(screen.getByText("Confirm email change"));
    await waitFor(() =>
      expect(screen.getByText("This link has expired.")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("Go back"));
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
