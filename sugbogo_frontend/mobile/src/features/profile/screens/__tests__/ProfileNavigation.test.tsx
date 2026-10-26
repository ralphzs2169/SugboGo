import type { PropsWithChildren } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import ProfileScreen from "../ProfileScreen";

type FocusEffect = () => void | (() => void);
const mockFocusEffects = new Set<FocusEffect>();
const mockBlurEffects = new Map<FocusEffect, void | (() => void)>();
let mockFocused = true;
let mockMerchant = false;
const mockRefetchStatus = jest.fn();
const mockSetActiveMode = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useNavigation: () => ({ isFocused: () => mockFocused }),
  useFocusEffect: (effect: FocusEffect) => {
    const React = jest.requireActual<typeof import("react")>("react");
    React.useEffect(() => {
      mockFocusEffects.add(effect);
      mockBlurEffects.set(effect, effect());
      return () => {
        mockBlurEffects.get(effect)?.();
        mockFocusEffects.delete(effect);
        mockBlurEffects.delete(effect);
      };
    }, [effect]);
  },
}));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        first_name: "Cebu",
        last_name: "Explorer",
        role: mockMerchant ? "merchant" : "explorer",
      },
    }),
}));
jest.mock("@/features/app-mode/store/appMode.store", () => ({
  useAppModeStore: (selector: (state: unknown) => unknown) =>
    selector({ setActiveMode: mockSetActiveMode }),
}));
jest.mock("../../hooks/useApplicationStatus", () => ({
  __esModule: true,
  default: () => ({
    status: null,
    merchantModeAcknowledged: mockMerchant,
    isLoading: false,
    error: false,
    hasResolvedStatus: true,
    refetch: mockRefetchStatus,
  }),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../components/ProfileScrollView", () => ({
  __esModule: true,
  default: ({ children }: PropsWithChildren) => children,
}));
jest.mock("../../components/ProfileActivitySummary", () => () => null);
jest.mock("../../components/AppVersion", () => () => null);
jest.mock("../../components/ProfileHeader", () => {
  const SafePressable = jest.requireActual(
    "@/shared/components/SafePressable",
  ).default;
  return function Header({ onEditProfile }: { onEditProfile: () => void }) {
    return (
      <SafePressable
        accessibilityLabel="Edit profile"
        onPress={onEditProfile}
      />
    );
  };
});
jest.mock("../../components/MerchantPortalCard", () => {
  const SafePressable = jest.requireActual(
    "@/shared/components/SafePressable",
  ).default;
  return function Portal({ onPress }: { onPress: () => void }) {
    return (
      <SafePressable
        accessibilityLabel="Open Merchant Portal"
        onPress={onPress}
      />
    );
  };
});

async function leaveAndReturn() {
  await act(async () => {
    mockFocused = false;
    for (const cleanup of mockBlurEffects.values()) cleanup?.();
  });
  await act(async () => {
    mockFocused = true;
    for (const effect of mockFocusEffects)
      mockBlurEffects.set(effect, effect());
  });
}

describe("Profile screen navigation dispatches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocused = true;
    mockMerchant = false;
  });

  it("dispatches only once for two rapid taps on the same real menu row", async () => {
    const screen = await render(<ProfileScreen />);
    const row = screen.getByText("My Reviews");
    await fireEvent.press(row);
    await fireEvent.press(row);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/profile/reviews-submitted");
  });

  it("shares one guard across different rows while focus remains on Profile", async () => {
    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText("My Reviews"));
    await fireEvent.press(screen.getByText("My Interests"));
    expect(mockFocused).toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/profile/reviews-submitted");
  });

  it("stays locked through slow focus changes and unlocks after returning", async () => {
    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText("My Pockets"));
    await act(async () => {
      await Promise.resolve();
    });
    await fireEvent.press(screen.getByText("My Interests"));
    await fireEvent.press(screen.getByText("My Pockets"));
    expect(router.push).toHaveBeenCalledTimes(1);
    await leaveAndReturn();
    await fireEvent.press(screen.getByText("My Interests"));
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith("/profile/your-interests");
  });

  it.each(["Edit profile", "Open Merchant Portal"])(
    "shares the row guard with %s",
    async (label) => {
      const screen = await render(<ProfileScreen />);
      await fireEvent.press(screen.getByLabelText(label));
      await fireEvent.press(screen.getByText("Account Settings"));
      await fireEvent.press(screen.getByLabelText(label));
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith(
        label === "Edit profile"
          ? "/profile/edit-profile"
          : "/profile/merchant-portal",
      );
    },
  );

  it("blocks a conflicting Merchant mode replacement after a row push", async () => {
    mockMerchant = true;
    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText("My Reviews"));
    await fireEvent.press(screen.getByText("Switch to Merchant"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockSetActiveMode).not.toHaveBeenCalled();
  });

  it("blocks a conflicting row push after switching Merchant mode", async () => {
    mockMerchant = true;
    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText("Switch to Merchant"));
    await fireEvent.press(screen.getByText("My Reviews"));
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
    expect(mockSetActiveMode).toHaveBeenCalledTimes(1);
  });

  it("does not lock navigation for the non-navigating Language placeholder", async () => {
    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText("Language"));
    await fireEvent.press(screen.getByText("My Interests"));
    expect(router.push).toHaveBeenCalledWith("/profile/your-interests");
  });
});
