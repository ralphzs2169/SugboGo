import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import { acknowledgeMerchantMode } from "../../api/merchantApplication.service";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";
import useAcknowledgeMerchantMode from "../useAcknowledgeMerchantMode";

jest.mock("../../api/merchantApplication.service", () => ({
  acknowledgeMerchantMode: jest.fn(),
}));

const explorerUser: User = {
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

const acknowledgedStatus = {
  status: "approved" as const,
  merchant_mode_acknowledged: true,
  highest_completed_step: 5,
  review_sla_min_business_days: 3,
  review_sla_max_business_days: 5,
};

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
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: explorerUser, isAuthenticated: true });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("updates the status cache and auth role, then invalidates status", async () => {
    (acknowledgeMerchantMode as jest.Mock).mockResolvedValue({
      success: true,
      message: "Merchant mode acknowledged.",
      data: acknowledgedStatus,
    });

    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useAcknowledgeMerchantMode, {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantApplicationKeys.status(42),
    });
    expect(client.getQueryData(merchantApplicationKeys.status(42))).toEqual(
      acknowledgedStatus,
    );
    expect(useAuthStore.getState().user).toEqual({
      ...explorerUser,
      role: "merchant",
    });

    unmount();
    client.clear();
  });

  it("does not unlock merchant mode when acknowledgement fails", async () => {
    const error = {
      success: false,
      message: "Unable to acknowledge Merchant Mode.",
      code: "NETWORK_ERROR",
    };
    (acknowledgeMerchantMode as jest.Mock).mockResolvedValue(error);

    const client = createQueryClient();
    const { result, unmount } = await renderHook(useAcknowledgeMerchantMode, {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toEqual(error);
    });

    expect(useAuthStore.getState().user?.role).toBe("explorer");
    expect(
      client.getQueryData(merchantApplicationKeys.status(42)),
    ).toBeUndefined();

    unmount();
    client.clear();
  });
});
