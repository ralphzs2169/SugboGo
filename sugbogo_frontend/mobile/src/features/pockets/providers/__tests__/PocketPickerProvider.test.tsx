import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import { onlineManager } from "@tanstack/react-query";
import { Pressable, View } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import PocketPickerSheet from "../../components/PocketPickerSheet";
import PocketPickerProvider from "../PocketPickerProvider";
import { usePocketPicker } from "../PocketPickerContext";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../../components/PocketPickerSheet", () =>
  jest.fn(({ ownerId }: { ownerId: number }) => {
    const { View } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return (
      <View testID="picker-selection" accessibilityLabel={String(ownerId)} />
    );
  }),
);
const initialAuth = useAuthStore.getState();
const user: User = {
  id: 1,
  first_name: "Pocket",
  last_name: "Explorer",
  gender: null,
  email: "pocket@example.com",
  role: "explorer",
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};
function Controls() {
  const picker = usePocketPicker();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close 42"
        onPress={() => picker?.closePocketPicker?.(42)}
      />
      {[42, 7].map((id) => (
        <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${id}`}
          onPress={() => picker?.openPocketPicker(id)}
        />
      ))}
    </View>
  );
}
describe("PocketPickerProvider", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    jest.mocked(PocketPickerSheet).mockClear();
  });
  afterEach(async () => {
    await cleanup();
    useAuthStore.setState(initialAuth);
    onlineManager.setOnline(true);
  });
  async function host() {
    return render(
      <PocketPickerProvider>
        <Controls />
      </PocketPickerProvider>,
    );
  }
  it("hosts one selection and ignores attempts to stack another business", async () => {
    const screen = await host();
    await fireEvent.press(screen.getByRole("button", { name: "Open 42" }));
    const original = jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0];
    expect(original?.businessId).toBe(42);
    await fireEvent.press(screen.getByRole("button", { name: "Open 7" }));
    expect(
      jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0].businessId,
    ).toBe(42);
    await act(async () => original?.onDismiss());
    await fireEvent.press(screen.getByRole("button", { name: "Open 7" }));
    expect(
      jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0].businessId,
    ).toBe(7);
  });
  it("requires sign-in for guests and waits through restoration", async () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
    const screen = await host();
    await fireEvent.press(screen.getByRole("button", { name: "Open 42" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(PocketPickerSheet).not.toHaveBeenCalled();
    await act(async () => useAuthStore.setState({ isLoading: false }));
    await fireEvent.press(screen.getByRole("button", { name: "Open 42" }));
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
    expect(PocketPickerSheet).not.toHaveBeenCalled();
  });
  it("drops old-session selection and ignores its delayed dismissal callback", async () => {
    const screen = await host();
    await fireEvent.press(screen.getByRole("button", { name: "Open 42" }));
    const previous = jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0];
    await act(async () => {
      beginAuthSession();
      useAuthStore.setState({ user: { ...user, id: 2 } });
    });
    await waitFor(() =>
      expect(screen.queryByTestId("picker-selection")).toBeNull(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Open 7" }));
    await act(async () => previous?.onDismiss());
    expect(jest.mocked(PocketPickerSheet).mock.calls.at(-1)?.[0]).toMatchObject(
      { ownerId: 2, businessId: 7 },
    );
  });

  it("revokes profile selection and rejects the previous workflow after reconnect", async () => {
    const screen = await host();
    await fireEvent.press(screen.getByRole("button", { name: "Open 42" }));
    const previous = jest.mocked(PocketPickerSheet).mock.calls.at(-1)![0];
    expect(previous.isCurrent?.()).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Close 42" }));
    expect(screen.queryByTestId("picker-selection")).toBeNull();
    expect(previous.isCurrent?.()).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Open 42" }));
    const next = jest.mocked(PocketPickerSheet).mock.calls.at(-1)![0];
    await act(async () => onlineManager.setOnline(false));
    expect(screen.queryByTestId("picker-selection")).toBeNull();
    await act(async () => onlineManager.setOnline(true));
    expect(next.isCurrent?.()).toBe(false);
    expect(screen.queryByTestId("picker-selection")).toBeNull();
  });
});
