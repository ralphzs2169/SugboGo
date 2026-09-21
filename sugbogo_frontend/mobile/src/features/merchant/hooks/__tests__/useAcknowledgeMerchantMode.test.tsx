import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { acknowledgeMerchantMode } from "../../api/merchantApplication.service";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";
import useAcknowledgeMerchantMode from "../useAcknowledgeMerchantMode";

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({
      user: {
        id: 42,
      },
    }),
}));

jest.mock("../../api/merchantApplication.service", () => ({
  acknowledgeMerchantMode: jest.fn(),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        gcTime: Infinity,
      },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useAcknowledgeMerchantMode", () => {
  it("invalidates the centralized application-status key", async () => {
    (acknowledgeMerchantMode as jest.Mock).mockResolvedValue({
      success: true,
      message: "Merchant mode acknowledged.",
      data: {
        status: "approved",
        merchant_mode_acknowledged: true,
        highest_completed_step: 5,
        review_sla_min_business_days: 3,
        review_sla_max_business_days: 5,
      },
    });

    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      useAcknowledgeMerchantMode,
      {
        wrapper,
      },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantApplicationKeys.status(42),
    });

    unmount();
    client.clear();
  });
});
