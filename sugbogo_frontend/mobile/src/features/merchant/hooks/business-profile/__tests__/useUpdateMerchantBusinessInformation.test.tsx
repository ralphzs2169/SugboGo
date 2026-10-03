import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { updateMerchantBusinessInformation } from "@/features/merchant/api/merchantBusinessProfile.service";

import { merchantBusinessProfileKey } from "../merchantBusinessProfileQueryKeys";
import useUpdateMerchantBusinessInformation from "../useUpdateMerchantBusinessInformation";

jest.mock("@/features/merchant/api/merchantBusinessProfile.service", () => ({
  updateMerchantBusinessInformation: jest.fn(),
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useUpdateMerchantBusinessInformation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("submits the focused payload and refreshes owner and Explorer detail", async () => {
    (updateMerchantBusinessInformation as jest.Mock).mockResolvedValue({
      success: true,
      message: "Updated.",
      data: {
        description: "Updated business description",
        contact_number: "09171234567",
        business_email: "hello@example.com",
        website: "https://example.com",
      },
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    client.setQueryData(merchantBusinessProfileKey(42), {
      id: 7,
      description: "Old description",
      business_name: "Sugbo Bistro",
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useUpdateMerchantBusinessInformation(7),
      { wrapper: createWrapper(client) },
    );
    const changes = { description: "Updated business description" };

    await act(async () => {
      await result.current.updateInformation(changes);
    });

    expect(updateMerchantBusinessInformation).toHaveBeenCalledWith(changes);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
      refetchType: "all",
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(7),
    });
    expect(client.getQueryData(merchantBusinessProfileKey(42))).toEqual(
      expect.objectContaining({
        id: 7,
        business_name: "Sugbo Bistro",
        description: "Updated business description",
      }),
    );
    unmount();
    client.clear();
  });
});
