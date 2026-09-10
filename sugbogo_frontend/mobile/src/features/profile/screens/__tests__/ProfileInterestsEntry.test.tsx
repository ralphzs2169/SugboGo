import type { PropsWithChildren } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import ProfileScreen from "../ProfileScreen";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useFocusEffect: (callback: () => void) => callback(),
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        first_name: "Cebu",
        last_name: "Explorer",
        email: "explorer@example.com",
        role: "explorer",
      },
    }),
}));
jest.mock("@/features/app-mode/store/appMode.store", () => ({
  useAppModeStore: (selector: (state: unknown) => unknown) =>
    selector({ setActiveMode: jest.fn() }),
}));
jest.mock("../../hooks/useApplicationStatus", () => ({
  __esModule: true,
  default: () => ({
    status: null,
    merchantModeAcknowledged: false,
    isLoading: true,
    refetch: jest.fn(),
  }),
}));
jest.mock("@/features/auth/hooks/useLogout", () => ({
  useLogout: () => ({ logout: jest.fn() }),
}));
jest.mock("../../components/ProfileHeader", () => () => null);
jest.mock("../../components/MerchantPortalCard", () => () => null);
jest.mock("../../components/AppVersion", () => () => null);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);
jest.mock("../../components/ProfileScrollView", () => ({
  __esModule: true,
  default: ({ children }: PropsWithChildren) => children,
}));

describe("Profile interests entry", () => {
  it("navigates from Your Interests to the profile editor route", async () => {
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByText("Your Interests"));

    expect(router.push).toHaveBeenCalledWith("/profile/your-interests");
  });
});
