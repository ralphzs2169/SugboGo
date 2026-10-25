import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import LogoutConfirmationModal from "../LogoutConfirmationModal";
import { useLogoutConfirmationStore } from "../../store/logoutConfirmation.store";

const mockLogout = jest.fn();

jest.mock("../../hooks/useLogout", () => ({
  useLogout: () => ({ logout: mockLogout }),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

// Use the real dialog to exercise its loading feedback and disabled actions.
function ProfileRoute() {
  const open = useLogoutConfirmationStore((state) => state.open);
  return <Pressable accessibilityLabel="Request logout" onPress={open} />;
}

function Harness({ showProfile = true }: { showProfile?: boolean }) {
  return (
    <View>
      {showProfile ? <ProfileRoute /> : <Text>Sign in screen</Text>}
      <LogoutConfirmationModal />
    </View>
  );
}

describe("shared logout confirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLogoutConfirmationStore.setState({ isOpen: false });
  });

  it("cancels without logging out", async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Request logout"));
    await fireEvent.press(screen.getByLabelText("Cancel"));

    expect(mockLogout).not.toHaveBeenCalled();
    expect(useLogoutConfirmationStore.getState().isOpen).toBe(false);
  });

  it("keeps loading after the profile unmounts and blocks repeated confirmation", async () => {
    let finishCleanup!: (success: boolean) => void;
    mockLogout.mockReturnValue(new Promise<boolean>((resolve) => {
      finishCleanup = resolve;
    }));
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Request logout"));
    await fireEvent.press(screen.getByLabelText("Logout"));

    expect(screen.getByText("Logging out...")).toBeTruthy();
    expect(screen.getByLabelText("Logout")).toBeDisabled();
    expect(screen.getByLabelText("Cancel")).toBeDisabled();

    await screen.rerender(<Harness showProfile={false} />);
    expect(screen.getByText("Logging out...")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Logout"));
    await fireEvent.press(screen.getByLabelText("Cancel"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(useLogoutConfirmationStore.getState().isOpen).toBe(true);

    await act(async () => finishCleanup(true));
    expect(useLogoutConfirmationStore.getState().isOpen).toBe(false);
    expect(screen.queryByText("Logging out...")).toBeNull();
  });

  it("ends loading when local cleanup reports a failure", async () => {
    mockLogout.mockResolvedValue(false);
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Request logout"));
    await fireEvent.press(screen.getByLabelText("Logout"));

    expect(useLogoutConfirmationStore.getState().isOpen).toBe(false);
    expect(screen.queryByText("Logging out...")).toBeNull();
  });

  it("recovers the dialog state after an unexpected rejection", async () => {
    mockLogout.mockRejectedValue(new Error("Unexpected cleanup failure"));
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Request logout"));
    await fireEvent.press(screen.getByLabelText("Logout"));

    expect(useLogoutConfirmationStore.getState().isOpen).toBe(false);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: "error",
    }));
    expect(screen.queryByText("Logging out...")).toBeNull();
  });
});
