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
jest.mock("../../hooks/useMyReviews", () => ({
  useMyReviews: () => ({
    data: {},
    totalCount: 8,
    isLoading: false,
    error: null,
  }),
}));
jest.mock("../../hooks/useVouchHistory", () => ({
  __esModule: true,
  default: () => ({
    summary: { total_specialty_vouches: 12 },
    isLoading: false,
    error: null,
  }),
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
  it("opens activity from the summary and uses available totals", async () => {
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByLabelText("Pockets: count unavailable"));
    expect(router.push).toHaveBeenLastCalledWith("/profile/my-pockets");
    await fireEvent.press(screen.getByLabelText("Vouches: 12"));
    expect(router.push).toHaveBeenLastCalledWith("/profile/vouch-history");
    await fireEvent.press(screen.getByLabelText("Reviews: 8"));
    expect(router.push).toHaveBeenLastCalledWith("/profile/reviews-submitted");

    expect(screen.queryByText("My Pockets")).toBeNull();
    expect(screen.getByText("Activity Timeline")).toBeTruthy();
    await fireEvent.press(screen.getByText("Activity Timeline"));
    expect(router.push).toHaveBeenLastCalledWith("/profile/activity-timeline");
    expect(screen.queryByText("My Impact")).toBeNull();
    expect(screen.getByText("Language")).toBeTruthy();
    expect(screen.queryByText("Sync Now")).toBeNull();
  });

  it("navigates from Your Interests to the profile editor route", async () => {
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByText("My Interests"));

    expect(router.push).toHaveBeenCalledWith("/profile/your-interests");
  });
});
