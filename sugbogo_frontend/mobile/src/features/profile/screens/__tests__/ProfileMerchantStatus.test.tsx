import type { PropsWithChildren } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import ErrorState from "@/shared/components/ErrorState";
import MerchantPortalCard from "../../components/MerchantPortalCard";
import ProfileScreen from "../ProfileScreen";
import { useLogoutConfirmationStore } from "@/features/auth/store/logoutConfirmation.store";

const mockRefetchApplicationStatus = jest.fn();
let mockRole = "explorer";

let mockStatusState = {
  status: null as "draft" | "submitted" | "rejected" | "approved" | null,
  merchantModeAcknowledged: false,
  isLoading: false,
  isRefetching: false,
  error: false,
  hasResolvedStatus: true,
  refetch: mockRefetchApplicationStatus,
};

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useFocusEffect: (callback: () => void) => callback(),
  useNavigation: () => ({
    isFocused: () => true,
  }),
}));

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        first_name: "Cebu",
        last_name: "Explorer",
        email: "explorer@example.com",
        role: mockRole,
      },
    }),
}));

jest.mock("@/features/app-mode/store/appMode.store", () => ({
  useAppModeStore: (selector: (state: unknown) => unknown) =>
    selector({
      setActiveMode: jest.fn(),
    }),
}));

jest.mock("../../hooks/useApplicationStatus", () => ({
  __esModule: true,
  default: () => mockStatusState,
}));

jest.mock("@/features/auth/hooks/useLogout", () => ({
  useLogout: () => ({
    logout: jest.fn(),
  }),
}));

jest.mock("../../components/MerchantPortalCard", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: jest.fn(() => null),
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
jest.mock("../../components/AppVersion", () => () => null);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);
jest.mock("../../components/ProfileScrollView", () => ({
  __esModule: true,
  default: ({ children }: PropsWithChildren) => children,
}));

describe("ProfileScreen merchant status", () => {
  it("opens the shared logout confirmation from the explorer profile", async () => {
    useLogoutConfirmationStore.setState({ isOpen: false });
    const screen = await render(<ProfileScreen />);

    await fireEvent.press(screen.getByText("Logout"));

    expect(useLogoutConfirmationStore.getState().isOpen).toBe(true);
    useLogoutConfirmationStore.getState().close();
    screen.unmount();
  });

  const mockMerchantPortalCard = MerchantPortalCard as jest.Mock;
  const mockErrorState = ErrorState as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = "explorer";
    mockStatusState = {
      status: null,
      merchantModeAcknowledged: false,
      isLoading: false,
      isRefetching: false,
      error: false,
      hasResolvedStatus: true,
      refetch: mockRefetchApplicationStatus,
    };
  });
  it.each(["explorer", "merchant"])(
    "reserves merchant access during initial loading without showing a guessed state for %s",
    async (role) => {
      mockRole = role;
      mockStatusState.isLoading = true;
      mockStatusState.hasResolvedStatus = false;
      const screen = await render(<ProfileScreen />);
      expect(screen.getByLabelText("Loading merchant access")).toBeTruthy();
      expect(mockMerchantPortalCard).not.toHaveBeenCalled();
      expect(screen.queryByText("Switch to Merchant")).toBeNull();
      expect(screen.getByText("Settings & Support")).toBeTruthy();
      mockStatusState = {
        ...mockStatusState,
        isLoading: false,
        hasResolvedStatus: true,
        status: role === "merchant" ? "approved" : "draft",
        merchantModeAcknowledged: role === "merchant",
      };
      await screen.rerender(<ProfileScreen />);
      expect(screen.queryByLabelText("Loading merchant access")).toBeNull();
      if (role === "merchant") {
        expect(screen.getByText("Switch to Merchant")).toBeTruthy();
        expect(mockMerchantPortalCard).not.toHaveBeenCalled();
      } else {
        expect(mockMerchantPortalCard).toHaveBeenCalledWith(
          expect.objectContaining({ status: "draft" }),
          undefined,
        );
      }
    },
  );

  it.each(["explorer", "merchant"])(
    "keeps resolved %s merchant access visible during background refresh",
    async (role) => {
      mockRole = role;
      mockStatusState.status = role === "merchant" ? "approved" : "submitted";
      mockStatusState.merchantModeAcknowledged = role === "merchant";
      const screen = await render(<ProfileScreen />);
      mockStatusState.isRefetching = true;
      await screen.rerender(<ProfileScreen />);
      expect(screen.queryByLabelText("Loading merchant access")).toBeNull();
      if (role === "merchant") {
        expect(screen.getByText("Switch to Merchant")).toBeTruthy();
      } else {
        expect(mockMerchantPortalCard).toHaveBeenLastCalledWith(
          expect.objectContaining({ status: "submitted" }),
          undefined,
        );
      }
    },
  );
  it("opens the existing My Pockets profile route", async () => {
    const screen = await render(<ProfileScreen />);
    await fireEvent.press(screen.getByText("My Pockets"));
    expect(router.push).toHaveBeenCalledWith("/profile/my-pockets");
  });

  it("shows merchant onboarding after a successful empty status", async () => {
    const screen = await render(<ProfileScreen />);

    expect(mockMerchantPortalCard).toHaveBeenCalledWith(
      expect.objectContaining({
        status: null,
      }),
      undefined,
    );
    expect(mockErrorState).not.toHaveBeenCalled();

    screen.unmount();
  });

  it("shows a retry state instead of false merchant onboarding on error", async () => {
    mockStatusState = {
      ...mockStatusState,
      error: true,
      hasResolvedStatus: false,
    };

    const screen = await render(<ProfileScreen />);

    expect(mockErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Unable to load merchant status",
      }),
      undefined,
    );
    expect(mockMerchantPortalCard).not.toHaveBeenCalled();

    screen.unmount();
  });

  it("preserves cached merchant UI after a background refetch error", async () => {
    mockStatusState = {
      ...mockStatusState,
      status: "submitted",
      error: true,
      hasResolvedStatus: true,
    };

    const screen = await render(<ProfileScreen />);

    expect(mockMerchantPortalCard).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "submitted",
      }),
      undefined,
    );
    expect(mockErrorState).not.toHaveBeenCalled();

    screen.unmount();
  });

  it("shows a non-blocking retry when cached empty status cannot refresh", async () => {
    mockStatusState = {
      ...mockStatusState,
      error: true,
      hasResolvedStatus: true,
    };

    const screen = await render(<ProfileScreen />);

    expect(mockMerchantPortalCard).toHaveBeenCalledWith(
      expect.objectContaining({ status: null }),
      undefined,
    );
    expect(mockErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "section",
        title: "Unable to refresh merchant status",
      }),
      undefined,
    );

    const retry = mockErrorState.mock.lastCall[0].onPrimaryAction;
    retry();
    expect(mockRefetchApplicationStatus).toHaveBeenCalledTimes(2);

    screen.unmount();
  });

  it("retains focus refetching for externally changed application status", async () => {
    const screen = await render(<ProfileScreen />);

    expect(mockRefetchApplicationStatus).toHaveBeenCalledTimes(1);

    screen.unmount();
  });
});
