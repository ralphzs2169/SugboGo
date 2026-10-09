import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import * as service from "@/features/merchant/api/classificationChange.service";
import { merchantBusinessProfileKey } from "@/features/merchant/hooks/business-profile/merchantBusinessProfileQueryKeys";
import type { ClassificationChangeRequest } from "@/features/merchant/types/classificationChange.types";

import { merchantClassificationChangeKeys } from "../classificationChangeQueryKeys";
import {
  useMerchantClassificationChangeRequests,
  useSubmitMerchantClassificationChange,
  useWithdrawMerchantClassificationChange,
} from "../useMerchantClassificationChanges";

jest.mock("@/features/merchant/api/classificationChange.service", () => ({
  getClassificationChangeRequests: jest.fn(),
  getClassificationChangeRequest: jest.fn(),
  submitClassificationChange: jest.fn(),
  withdrawClassificationChange: jest.fn(),
}));

const pendingRequest: ClassificationChangeRequest = {
  id: 7,
  request_type: "classification",
  status: "pending",
  previous: {
    category: { id: 2, name: "Restaurants" },
    cluster: { id: 1, name: "Food" },
    specialty_tags: [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ],
  },
  proposed: {
    category: { id: 4, name: "Creative Arts" },
    cluster: { id: 5, name: "Culture" },
    specialty_tags: [
      { id: 2, name: "B" },
      { id: 3, name: "C" },
      { id: 4, name: "D" },
    ],
  },
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
};

function page(
  items: ClassificationChangeRequest[],
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

describe("classification change React Query hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("loads history page by page in backend order", async () => {
    (service.getClassificationChangeRequests as jest.Mock)
      .mockResolvedValueOnce(page([pendingRequest], 1, true))
      .mockResolvedValueOnce(page([{ ...pendingRequest, id: 6 }], 2, false));
    const { client, wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => useMerchantClassificationChangeRequests(),
      { wrapper },
    );
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    expect(result.current.pendingRequest?.id).toBe(7);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.requests.map((item) => item.id)).toEqual([7, 6]),
    );
    expect(service.getClassificationChangeRequests).toHaveBeenNthCalledWith(
      2,
      2,
    );
    unmount();
    client.clear();
  });

  it("submits only category and tags without changing live profile data", async () => {
    (service.submitClassificationChange as jest.Mock).mockResolvedValue({
      success: true,
      message: "Submitted.",
      data: pendingRequest,
    });
    const { client, wrapper } = setup();
    const profile = {
      id: 10,
      category: pendingRequest.previous.category,
      cluster: pendingRequest.previous.cluster,
      specialty_tags: pendingRequest.previous.specialty_tags,
    };
    client.setQueryData(merchantBusinessProfileKey(42), profile);
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useSubmitMerchantClassificationChange(),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({
        proposed_category_id: 4,
        proposed_specialty_tag_ids: [2, 3, 4],
      });
    });
    expect(service.submitClassificationChange).toHaveBeenCalledWith({
      proposed_category_id: 4,
      proposed_specialty_tag_ids: [2, 3, 4],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantClassificationChangeKeys.list(42),
      refetchType: "all",
    });
    expect(client.getQueryData(merchantBusinessProfileKey(42))).toEqual(
      profile,
    );
    unmount();
    client.clear();
  });

  it("withdraws without invalidating live profile or Explorer detail", async () => {
    (service.withdrawClassificationChange as jest.Mock).mockResolvedValue({
      success: true,
      message: "Withdrawn.",
      data: { ...pendingRequest, status: "withdrawn" },
    });
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useWithdrawMerchantClassificationChange(),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync(7);
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantClassificationChangeKeys.list(42),
      refetchType: "all",
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantClassificationChangeKeys.detail(42, 7),
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(10),
    });
    unmount();
    client.clear();
  });

  it("refreshes owner and Explorer detail once when an approved request is observed", async () => {
    (service.getClassificationChangeRequests as jest.Mock).mockResolvedValue(
      page([{ ...pendingRequest, status: "approved" }], 1, false),
    );
    const { client, wrapper } = setup();
    client.setQueryData(merchantBusinessProfileKey(42), {
      id: 10,
      category: pendingRequest.previous.category,
      cluster: pendingRequest.previous.cluster,
      specialty_tags: pendingRequest.previous.specialty_tags,
    });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useMerchantClassificationChangeRequests(),
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
