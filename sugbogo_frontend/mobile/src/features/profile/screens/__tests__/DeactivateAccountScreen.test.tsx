import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { useDeactivateAccount } from "@/features/auth/hooks/useDeactivateAccount";
import { useAuthStore } from "@/features/auth/store/auth.store";
import AccountSettingsScreen from "../AccountSettingsScreen";
import DeactivateAccountScreen from "../DeactivateAccountScreen";

let mockConfirmAction: () => Promise<void>;

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/features/auth/hooks/useDeactivateAccount");
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
    if (props.confirmText === "Deactivate") mockConfirmAction = props.onConfirm;
    return (
      <View>
        <Text>{props.title}</Text>
        {props.message}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.confirmText}
          accessibilityState={{ disabled: props.isLoading }}
          disabled={props.isLoading}
          onPress={props.onConfirm}
        >
          <Text>{props.confirmText}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.cancelText}
          disabled={props.isLoading}
          onPress={props.onCancel}
        >
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
  email: "cebu@example.com",
  role: "explorer" as const,
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
  has_usable_password: true,
};
const mutateAsync = jest.fn();

describe("Account deactivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user, isAuthenticated: true });
    jest
      .mocked(useDeactivateAccount)
      .mockReturnValue({ mutateAsync, isPending: false } as any);
    mutateAsync.mockResolvedValue(undefined);
  });

  it("opens deactivation from Account Settings", async () => {
    const screen = await render(<AccountSettingsScreen />);
    await fireEvent.press(screen.getByText("Deactivate account"));
    expect(router.push).toHaveBeenCalledWith("/profile/deactivate-account");
  });

  it("requires a password and permits cancellation without submitting", async () => {
    const screen = await render(<DeactivateAccountScreen />);
    await fireEvent.press(screen.getByText("Deactivate account"));
    expect(screen.queryByText("Deactivate your account?")).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Original739!",
    );
    await fireEvent.press(screen.getByText("Deactivate account"));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Deactivate your account?")).toBeNull();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("requires final consent and preserves password whitespace", async () => {
    const screen = await render(<DeactivateAccountScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "  Original739!  ",
    );
    await fireEvent.press(screen.getByText("Deactivate account"));
    expect(mutateAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Deactivate" }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({
      current_password: "  Original739!  ",
      confirm_deactivation: true,
    });
  });

  it("keeps validation errors recoverable without silently dismissing confirmation", async () => {
    mutateAsync.mockRejectedValueOnce({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid input.",
      errors: { current_password: ["Incorrect password."] },
    });
    const screen = await render(<DeactivateAccountScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Wrong739!",
    );
    await fireEvent.press(screen.getByText("Deactivate account"));
    await fireEvent.press(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Deactivate your account?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Go back" }));
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Correct739!",
    );
    await fireEvent.press(screen.getByText("Deactivate account"));
    await fireEvent.press(screen.getByRole("button", { name: "Deactivate" }));
    expect(mutateAsync).toHaveBeenLastCalledWith({
      current_password: "Correct739!",
      confirm_deactivation: true,
    });
  });

  it("guards repeated submission while a request is unresolved", async () => {
    let finish!: () => void;
    mutateAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const screen = await render(<DeactivateAccountScreen />);
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "Original739!",
    );
    await fireEvent.press(screen.getByText("Deactivate account"));
    await act(async () => {
      const first = mockConfirmAction();
      const second = mockConfirmAction();
      expect(mutateAsync).toHaveBeenCalledTimes(1);
      finish();
      await Promise.all([first, second]);
    });
  });

  it("disables password input and submission while pending", async () => {
    jest
      .mocked(useDeactivateAccount)
      .mockReturnValue({ mutateAsync, isPending: true } as any);
    const screen = await render(<DeactivateAccountScreen />);
    expect(screen.getByLabelText("Current password").props.editable).toBe(
      false,
    );
    await fireEvent.press(screen.getByText("Deactivate account"));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("directs passwordless users to the existing recovery setup flow", async () => {
    useAuthStore.setState({
      user: { ...user, has_oauth_accounts: true, has_usable_password: false },
    });
    const screen = await render(<DeactivateAccountScreen />);
    expect(screen.queryByLabelText("Current password")).toBeNull();
    await fireEvent.press(screen.getByText("Set up a password"));
    expect(router.push).toHaveBeenCalledWith("/profile/change-password");
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
