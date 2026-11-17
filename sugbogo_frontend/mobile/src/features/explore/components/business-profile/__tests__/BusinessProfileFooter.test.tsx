import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getApplicationStatus } from "@/features/merchant/api/merchantApplication.service";
import { merchantApplicationKeys } from "@/features/merchant/hooks/merchantApplicationQueryKeys";
import { getProfile } from "@/features/profile/api/profile.service";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";

import BusinessProfileFooter from "../BusinessProfileFooter";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual("react").useEffect(effect, [effect]);
  },
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/features/merchant/api/merchantApplication.service", () => ({
  getApplicationStatus: jest.fn(),
}));
jest.mock("@/features/profile/api/profile.service", () => ({
  getProfile: jest.fn(),
}));

const explorer: User = {
  id: 42,
  first_name: "Alex",
  last_name: "Rivera",
  gender: null,
  email: "alex@example.com",
  role: "explorer",
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};

const merchant: User = { ...explorer, role: "merchant" };

const approved = {
  status: "approved" as const,
  merchant_mode_acknowledged: false,
  highest_completed_step: 5,
  review_sla_min_business_days: 3,
  review_sla_max_business_days: 5,
};

const mockGetApplicationStatus = jest.mocked(getApplicationStatus);
const mockGetProfile = jest.mocked(getProfile);
let queryClient: QueryClient;

async function renderOwnerFooter() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BusinessProfileFooter isOwnBusiness />
    </QueryClientProvider>,
  );
}

const button = { name: "Manage My Business" };

beforeEach(() => {
  jest.resetAllMocks();
  beginAuthSession();
  useAuthStore.getState().setUser(explorer);
  useAppModeStore.getState().resetActiveMode();
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
});

afterEach(() => {
  invalidateAuthSession();
  useAuthStore.getState().clearUser();
  queryClient.clear();
});

it.each([explorer, merchant])(
  "opens first-time acknowledgement for a newly approved owner with the $role role",
  async (user) => {
    useAuthStore.getState().setUser(user);
    queryClient.setQueryData(merchantApplicationKeys.status(user.id), {
      ...approved,
      status: "submitted",
    });
    mockGetApplicationStatus.mockResolvedValue({
      success: true,
      message: "",
      data: approved,
    });

    const screen = await renderOwnerFooter();
    await fireEvent.press(screen.getByRole("button", button));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/(explorer)/profile/merchant-portal",
        params: { continueTo: "business-profile" },
      }),
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
  },
);

it("refreshes a stale Explorer role before opening an acknowledged owner's profile", async () => {
  mockGetApplicationStatus.mockResolvedValue({
    success: true,
    message: "",
    data: { ...approved, merchant_mode_acknowledged: true },
  });
  mockGetProfile.mockResolvedValue({ success: true, message: "", data: merchant });
  jest.mocked(router.replace).mockImplementation(() => {
    expect(useAuthStore.getState().user).toEqual(merchant);
    expect(useAppModeStore.getState().activeMode).toBe("merchant");
  });

  const screen = await renderOwnerFooter();
  await fireEvent.press(screen.getByRole("button", button));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/(merchant)/(tabs)/profile"),
  );
  expect(mockGetProfile).toHaveBeenCalledTimes(1);
  expect(router.push).not.toHaveBeenCalled();
});

it("keeps the business profile accessible to an existing Merchant without an application", async () => {
  useAuthStore.getState().setUser(merchant);
  mockGetApplicationStatus.mockResolvedValue({
    success: true,
    message: "",
    data: null,
  });

  const screen = await renderOwnerFooter();
  await fireEvent.press(screen.getByRole("button", button));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/(merchant)/(tabs)/profile"),
  );
  expect(mockGetProfile).not.toHaveBeenCalled();
});

it("shows an error after a failed status check and lets the owner retry", async () => {
  useAuthStore.getState().setUser(merchant);
  mockGetApplicationStatus
    .mockResolvedValueOnce({ success: false, message: "", code: "UNEXPECTED" })
    .mockResolvedValueOnce({
      success: true,
      message: "",
      data: { ...approved, merchant_mode_acknowledged: true },
    });

  const screen = await renderOwnerFooter();
  await fireEvent.press(screen.getByRole("button", button));

  await waitFor(() =>
    expect(Toast.show).toHaveBeenCalledWith({
      type: "error",
      text1: "Unable to open business management",
      text2: "Please try again.",
    }),
  );
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole("button", button)).toBeEnabled();

  await fireEvent.press(screen.getByRole("button", button));

  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/(merchant)/(tabs)/profile"),
  );
});
