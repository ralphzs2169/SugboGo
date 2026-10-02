import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { updateMerchantBusinessPhotos } from "@/features/merchant/api/merchantBusinessProfile.service";

import { merchantBusinessProfileKey } from "../merchantBusinessProfileQueryKeys";
import useUpdateMerchantBusinessPhotos from "../useUpdateMerchantBusinessPhotos";

jest.mock("@/features/merchant/api/merchantBusinessProfile.service", () => ({
  updateMerchantBusinessPhotos: jest.fn(),
}));

describe("useUpdateMerchantBusinessPhotos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("saves once and invalidates owner and Explorer detail", async () => {
    (updateMerchantBusinessPhotos as jest.Mock).mockResolvedValue({
      success: true,
      message: "Updated.",
      data: [],
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(
      () => useUpdateMerchantBusinessPhotos(7),
      { wrapper },
    );
    const payload = new FormData();

    await act(async () => {
      await result.current.savePhotos(payload);
    });

    expect(updateMerchantBusinessPhotos).toHaveBeenCalledWith(payload);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
      refetchType: "all",
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(7),
    });
    unmount();
    client.clear();
  });
});
