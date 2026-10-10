import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import * as service from "@/features/merchant/api/businessNameChange.service";
import type { BusinessNameChangeRequest } from "@/features/merchant/types/businessNameChange.types";
import { merchantBusinessProfileKey } from "@/features/merchant/hooks/business-profile/merchantBusinessProfileQueryKeys";

import { merchantBusinessNameChangeKeys } from "../businessNameChangeQueryKeys";
import {
  useMerchantBusinessNameChangeRequests,
  useSubmitMerchantBusinessNameChange,
  useWithdrawMerchantBusinessNameChange,
} from "../useMerchantBusinessNameChanges";

jest.mock("@/features/merchant/api/businessNameChange.service", () => ({
  getBusinessNameChangeRequests: jest.fn(),
  getBusinessNameChangeRequest: jest.fn(),
  submitBusinessNameChange: jest.fn(),
  withdrawBusinessNameChange: jest.fn(),
}));

const pendingRequest: BusinessNameChangeRequest = {
  id: 7,
  request_type: "business_name" as const,
  previous_business_name: "Sugbo Bistro",
  proposed_business_name: "Sugbo Heritage Bistro",
  status: "pending" as const,
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
  reason: "We are updating our business identity.",
};

function page(
  items: BusinessNameChangeRequest[],
  number: number,
  hasNext: boolean,
) {
  return {
    success: true,
    message: "Success.",
    data: {
      items,
      eligibility: {
        can_submit: !items.some((item) => item.status === "pending"),
        reason: items.some((item) => item.status === "pending")
          ? ("pending" as const)
          : null,
        cooldown_duration_hours: 168,
        cooldown_until: null,
        last_approved_request_id: null,
        pending_request_id:
          items.find((item) => item.status === "pending")?.id ?? null,
      },
      pagination: {
        page: number,
        page_size: 10,
        total_items: hasNext ? 2 : items.length,
        total_pages: hasNext ? 2 : number,
        has_next: hasNext,
        has_previous: number > 1,
      },
    },
  };
}

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("business name change React Query hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("loads history page by page in backend order", async () => {
    (service.getBusinessNameChangeRequests as jest.Mock)
      .mockResolvedValueOnce(page([pendingRequest], 1, true))
      .mockResolvedValueOnce(page([{ ...pendingRequest, id: 6 }], 2, false));
    const { client, wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => useMerchantBusinessNameChangeRequests(),
      { wrapper },
    );

    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    expect(result.current.totalRequests).toBe(2);
    expect(result.current.pendingRequest?.id).toBe(7);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.requests.map((item) => item.id)).toEqual([7, 6]),
    );
    expect(result.current.totalRequests).toBe(2);
    expect(service.getBusinessNameChangeRequests).toHaveBeenNthCalledWith(2, 2);
    unmount();
    client.clear();
  });

  it("submits without changing or invalidating the live business profile", async () => {
    (service.submitBusinessNameChange as jest.Mock).mockResolvedValue({
      success: true,
      message: "Submitted.",
      data: pendingRequest,
    });
    const { client, wrapper } = setup();
    client.setQueryData(merchantBusinessProfileKey(42), {
      id: 10,
      business_name: "Sugbo Bistro",
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useSubmitMerchantBusinessNameChange(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({
        proposed_business_name: "Sugbo Heritage Bistro",
        reason: "We are updating our business identity.",
      });
    });
    expect(service.submitBusinessNameChange).toHaveBeenCalledWith({
      proposed_business_name: "Sugbo Heritage Bistro",
      reason: "We are updating our business identity.",
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessNameChangeKeys.list(42),
      refetchType: "all",
    });
    expect(client.getQueryData(merchantBusinessProfileKey(42))).toEqual({
      id: 10,
      business_name: "Sugbo Bistro",
    });
    unmount();
    client.clear();
  });

  it("withdraws and refreshes request queries only", async () => {
    (service.withdrawBusinessNameChange as jest.Mock).mockResolvedValue({
      success: true,
      message: "Withdrawn.",
      data: { ...pendingRequest, status: "withdrawn" },
    });
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useWithdrawMerchantBusinessNameChange(),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync(7);
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessNameChangeKeys.list(42),
      refetchType: "all",
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessNameChangeKeys.detail(42, 7),
    });
    expect(
      client.getQueryData(merchantBusinessNameChangeKeys.detail(42, 7)),
    ).toEqual(expect.objectContaining({ status: "withdrawn" }));
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(10),
    });
    unmount();
    client.clear();
  });

  it("refreshes live owner and Explorer detail once after observing approval", async () => {
    (service.getBusinessNameChangeRequests as jest.Mock).mockResolvedValue(
      page([{ ...pendingRequest, status: "approved" }], 1, false),
    );
    const { client, wrapper } = setup();
    client.setQueryData(merchantBusinessProfileKey(42), {
      id: 10,
      business_name: "Sugbo Bistro",
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useMerchantBusinessNameChangeRequests(),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.latestRequest?.status).toBe("approved"),
    );
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: merchantBusinessProfileKey(42),
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: exploreBusinessDetailKey(10),
      });
    });
    expect(invalidate).toHaveBeenCalledTimes(2);
    unmount();
    client.clear();
  });
});
