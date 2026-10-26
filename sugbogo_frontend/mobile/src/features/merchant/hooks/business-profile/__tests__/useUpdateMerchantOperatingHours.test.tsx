import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import {
  getMerchantBusinessProfile,
  updateMerchantBusinessOperatingHours,
} from "@/features/merchant/api/merchantBusinessProfile.service";

import { merchantBusinessProfileKey } from "../merchantBusinessProfileQueryKeys";
import useUpdateMerchantOperatingHours from "../useUpdateMerchantOperatingHours";
import useMerchantBusinessProfile from "../useMerchantBusinessProfile";

jest.mock("@/features/merchant/api/merchantBusinessProfile.service", () => ({
  updateMerchantBusinessOperatingHours: jest.fn(),
  getMerchantBusinessProfile: jest.fn(),
}));

describe("useUpdateMerchantOperatingHours", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("saves the week and invalidates owner and Explorer detail only", async () => {
    (updateMerchantBusinessOperatingHours as jest.Mock).mockResolvedValue({
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
      () => useUpdateMerchantOperatingHours(7),
      { wrapper },
    );
    const payload = { hours: [], expected_hours: [] };

    await act(async () => {
      await result.current.updateOperatingHours(payload);
    });

    expect(updateMerchantBusinessOperatingHours).toHaveBeenCalledWith(payload);
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

  it("refetches the persisted week into the shared owner cache after success", async () => {
    const hours = [
      {
        day: "monday",
        is_open: false,
        is_24_hours: false,
        open_time: null,
        close_time: null,
      },
    ];
    jest.mocked(getMerchantBusinessProfile).mockResolvedValue({
      success: true,
      message: "Loaded.",
      data: { id: 7, operating_hours: hours } as any,
    });
    jest.mocked(updateMerchantBusinessOperatingHours).mockResolvedValue({
      success: true,
      message: "Saved.",
      data: hours,
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    client.setQueryData(merchantBusinessProfileKey(42), {
      id: 7,
      operating_hours: [],
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(
      () => ({
        profile: useMerchantBusinessProfile(),
        mutation: useUpdateMerchantOperatingHours(7),
      }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutation.updateOperatingHours({
        hours,
        expected_hours: [],
      });
    });
    await waitFor(() =>
      expect(result.current.profile.business?.operating_hours).toEqual(hours),
    );
    expect(getMerchantBusinessProfile).toHaveBeenCalledTimes(1);
    unmount();
    client.clear();
  });

  it("exposes a conflict without replacing the cached schedule or invalidating on failure", async () => {
    const conflict = {
      success: false,
      code: "BUSINESS_OPERATING_HOURS_EDIT_CONFLICT",
      message: "Review the latest hours.",
    } as const;
    jest
      .mocked(updateMerchantBusinessOperatingHours)
      .mockResolvedValue(conflict);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    const cached = { id: 7, operating_hours: [] };
    client.setQueryData(merchantBusinessProfileKey(42), cached);
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, unmount } = await renderHook(
      () => useUpdateMerchantOperatingHours(7),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.updateOperatingHours({ hours: [], expected_hours: [] }),
      ).rejects.toEqual(conflict);
    });
    expect(client.getQueryData(merchantBusinessProfileKey(42))).toEqual(cached);
    expect(invalidate).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});
