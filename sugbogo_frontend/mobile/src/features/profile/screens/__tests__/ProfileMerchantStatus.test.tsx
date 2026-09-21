import type { PropsWithChildren } from "react";
import { render } from "@testing-library/react-native";

import ErrorState from "@/shared/components/ErrorState";
import MerchantPortalCard from "../../components/MerchantPortalCard";
import ProfileScreen from "../ProfileScreen";

const mockRefetchApplicationStatus = jest.fn();

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
        role: "explorer",
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

jest.mock("../../components/ProfileHeader", () => () => null);
jest.mock("../../components/AppVersion", () => () => null);
jest.mock("@/shared/components/modals/ConfirmModal", () => () => null);
jest.mock("../../components/ProfileScrollView", () => ({
  __esModule: true,
  default: ({ children }: PropsWithChildren) => children,
}));

describe("ProfileScreen merchant status", () => {
  const mockMerchantPortalCard = MerchantPortalCard as jest.Mock;
  const mockErrorState = ErrorState as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
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

  it("retains focus refetching for externally changed application status", async () => {
    const screen = await render(<ProfileScreen />);

    expect(mockRefetchApplicationStatus).toHaveBeenCalledTimes(1);

    screen.unmount();
  });
});
