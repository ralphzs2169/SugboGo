import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { communityReviewsKey } from "@/features/community/hooks/communityReviewQueryKeys";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { clearSessionTokens } from "@/shared/api/storage.service";

import { useLogout } from "../useLogout";

jest.mock("@/shared/api/storage.service", () => ({
  clearSessionTokens: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/savedJourneys.service", () => ({
  clearSavedJourneys: jest.fn(),
}));
jest.mock("@/features/merchant/stores/merchantRegistrationStore", () => ({
  useMerchantRegistrationStore: {
    getState: () => ({ reset: jest.fn() }),
  },
}));

describe("useLogout account cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    beginAuthSession();
    useAuthStore.setState({
      user: {
        id: 7,
        first_name: "Merchant",
        last_name: "Account",
        gender: null,
        email: "merchant@example.com",
        role: "merchant",
        status: "active",
        has_completed_interest_selection: true,
        has_custom_profile_picture: false,
        has_oauth_accounts: false,
      },
      isAuthenticated: true,
    });
    useAppModeStore.setState({ activeMode: "merchant" });
  });

  it("clears all user-specific Community filter variants on logout", async () => {
    jest.mocked(clearSessionTokens).mockResolvedValue(true);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const newestKey = communityReviewsKey();
    const helpfulKey = communityReviewsKey({
      ordering: "most_helpful",
      clusterId: 3,
      categoryIds: [5],
      specialtyTagId: 8,
      hasPhotos: true,
    });
    client.setQueryData(newestKey, { pages: [{ items: [{ id: 1 }] }] });
    client.setQueryData(helpfulKey, { pages: [{ items: [{ id: 2 }] }] });

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(() => useLogout(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.logout()).resolves.toBe(true);
    });

    expect(clearSessionTokens).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(newestKey)).toBeUndefined();
    expect(client.getQueryData(helpfulKey)).toBeUndefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");

    unmount();
    client.clear();
  });
});
