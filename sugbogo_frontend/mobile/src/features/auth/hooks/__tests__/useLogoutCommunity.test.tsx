import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { communityReviewsKey } from "@/features/community/hooks/communityReviewQueryKeys";
import { clearTokens } from "@/shared/api/storage.service";

import { useLogout } from "../useLogout";

jest.mock("@/shared/api/storage.service", () => ({
  clearTokens: jest.fn(),
}));
jest.mock("@/features/merchant/stores/merchantRegistrationStore", () => ({
  useMerchantRegistrationStore: {
    getState: () => ({ reset: jest.fn() }),
  },
}));

describe("useLogout Community cache isolation", () => {
  it("clears all user-specific Community filter variants on logout", async () => {
    (clearTokens as jest.Mock).mockResolvedValue(undefined);
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

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(newestKey)).toBeUndefined();
    expect(client.getQueryData(helpfulKey)).toBeUndefined();

    unmount();
    client.clear();
  });
});
