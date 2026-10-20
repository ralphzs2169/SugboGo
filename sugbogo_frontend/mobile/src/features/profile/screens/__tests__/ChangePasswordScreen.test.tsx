import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { useChangePassword } from "@/features/auth/hooks/useChangePassword";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { invalidateAuthSession } from "@/shared/api/authSessionGeneration.service";

import AccountSettingsScreen from "../AccountSettingsScreen";
import ChangePasswordScreen from "../ChangePasswordScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/features/auth/hooks/useChangePassword");
jest.mock("@/features/auth/hooks/useLogout");
jest.mock("../../hooks/useUnsavedChanges", () => ({
  useUnsavedChangesGuard: () => ({
    showConfirm: false,
    confirmLeave: jest.fn(),
    cancelLeave: jest.fn(),
  }),
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

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
const logout = jest.fn();

async function fillForm(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.changeText(
    screen.getByLabelText("Current password"),
    "Original739!",
  );
  await fireEvent.changeText(
    screen.getByLabelText("New password"),
    "Replacement981!",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Confirm new password"),
    "Replacement981!",
  );
}

describe("Account password management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user, isAuthenticated: true });
    (useChangePassword as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    (useLogout as jest.Mock).mockReturnValue({ logout });
    logout.mockImplementation(async () => {
      invalidateAuthSession();
      return true;
    });
    mutateAsync.mockResolvedValue(undefined);
  });

  it("opens password management from Account Settings", async () => {
    const screen = await render(<AccountSettingsScreen />);
    expect(screen.getByText(user.email)).toBeTruthy();
    await fireEvent.press(screen.getByText("Change password"));
    expect(router.push).toHaveBeenCalledWith("/profile/change-password");
  });

  it("requires all fields and rejects a mismatched confirmation without submitting", async () => {
    const screen = await render(<ChangePasswordScreen />);
    await fireEvent.press(screen.getByText("Save password"));
    expect(screen.getByText("Enter your current password.")).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
    await fillForm(screen);
    await fireEvent.changeText(
      screen.getByLabelText("Confirm new password"),
      "Mismatch981!",
    );
    await fireEvent.press(screen.getByText("Save password"));
    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits the exact passwords and keeps server field errors retryable", async () => {
    mutateAsync.mockRejectedValueOnce({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid input.",
      errors: { current_password: ["Your current password is incorrect."] },
    });
    const screen = await render(<ChangePasswordScreen />);
    await fillForm(screen);
    await fireEvent.press(screen.getByText("Save password"));
    await waitFor(() =>
      expect(
        screen.getByText("Your current password is incorrect."),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText("New password").props.value).toBe(
      "Replacement981!",
    );
    expect(logout).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("Current password"),
      "  Correct739!  ",
    );
    await fireEvent.press(screen.getByText("Save password"));
    expect(mutateAsync).toHaveBeenLastCalledWith({
      current_password: "  Correct739!  ",
      new_password: "Replacement981!",
      confirm_password: "Replacement981!",
    });
  });

  it("keeps request failures visible and preserves entered passwords", async () => {
    mutateAsync.mockRejectedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "No connection.",
    });
    const screen = await render(<ChangePasswordScreen />);
    await fillForm(screen);
    await fireEvent.press(screen.getByText("Save password"));
    await waitFor(() =>
      expect(screen.getByText("No connection.")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Current password").props.value).toBe(
      "Original739!",
    );
  });

  it("disables fields and submission while a change is pending", async () => {
    (useChangePassword as jest.Mock).mockReturnValue({
      mutateAsync,
      isPending: true,
    });
    const screen = await render(<ChangePasswordScreen />);
    expect(screen.getByLabelText("Current password").props.editable).toBe(
      false,
    );
    const button = screen.getByRole("button", { name: "Save password" });
    expect(button.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(button);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("routes OAuth-only users to recovery after local sign-out", async () => {
    useAuthStore.setState({
      user: { ...user, has_oauth_accounts: true, has_usable_password: false },
    });
    const screen = await render(<ChangePasswordScreen />);
    expect(screen.queryByLabelText("Current password")).toBeNull();
    await fireEvent.press(screen.getByText("Continue to email recovery"));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: "/(auth)/forgot-password",
        params: { email: user.email },
      }),
    );
    expect(logout).toHaveBeenCalledTimes(1);
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("keeps password change available for linked accounts with a password", async () => {
    useAuthStore.setState({ user: { ...user, has_oauth_accounts: true } });
    const screen = await render(<ChangePasswordScreen />);
    expect(screen.getByLabelText("Current password")).toBeTruthy();
  });
});
