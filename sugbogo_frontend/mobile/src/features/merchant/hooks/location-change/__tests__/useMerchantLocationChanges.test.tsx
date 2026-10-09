import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { MAP_PREVIEW_QUERY_KEY } from "@/features/explore/hooks/useMapPreviewBusinesses";
import { ROAD_ROUTE_QUERY_KEY } from "@/features/explore/hooks/useRoadRoute";
import { DIRECT_JOURNEYS_QUERY_KEY } from "@/features/explore/hooks/useDirectJourneys";
import { DIRECT_JOURNEY_MAP_QUERY_KEY } from "@/features/explore/hooks/useDirectJourneyMap";
import * as service from "@/features/merchant/api/locationChange.service";
import { merchantBusinessProfileKey } from "@/features/merchant/hooks/business-profile/merchantBusinessProfileQueryKeys";
import type { LocationChangeRequest } from "@/features/merchant/types/locationChange.types";

import { merchantLocationChangeKeys } from "../locationChangeQueryKeys";
import {
  useMerchantLocationChangeRequests,
  useSubmitMerchantLocationChange,
  useWithdrawMerchantLocationChange,
} from "../useMerchantLocationChanges";

jest.mock("@/features/merchant/api/locationChange.service", () => ({
  getLocationChangeRequests: jest.fn(),
  getLocationChangeRequest: jest.fn(),
  submitLocationChange: jest.fn(),
  withdrawLocationChange: jest.fn(),
}));

const location = {
  latitude: 10.31,
  longitude: 123.88,
  address: "Current address",
  city: "Cebu City",
  province: "Cebu",
  postal_code: "6000",
};

const pendingRequest: LocationChangeRequest = {
  id: 107,
  request_type: "location",
  status: "pending",
  previous: { location: { ...location, id: 8 }, landmarks: [] },
  proposed: {
    location: { ...location, longitude: 123.89, address: "New address" },
    landmarks: [],
  },
  submitted_at: "2026-10-03T10:00:00Z",
  resolved_at: null,
  rejection_reason: null,
  reason: "Our business location has changed.",
};

function page(
  items: LocationChangeRequest[],
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
        cooldown_duration_hours: 72,
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

describe("merchant location change queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("loads newest-first history page by page", async () => {
    (service.getLocationChangeRequests as jest.Mock)
      .mockResolvedValueOnce(page([pendingRequest], 1, true))
      .mockResolvedValueOnce(page([{ ...pendingRequest, id: 106 }], 2, false));
    const { client, wrapper } = setup();
    const { result, unmount } = await renderHook(
      () => useMerchantLocationChangeRequests(),
      { wrapper },
    );

    await waitFor(() => expect(result.current.pendingRequest?.id).toBe(107));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.requests.map((item) => item.id)).toEqual([
        107, 106,
      ]),
    );
    expect(service.getLocationChangeRequests).toHaveBeenNthCalledWith(2, 2);
    unmount();
    client.clear();
  });

  it("submits an empty complete landmark set without mutating live profile", async () => {
    (service.submitLocationChange as jest.Mock).mockResolvedValue({
      success: true,
      message: "Submitted.",
      data: pendingRequest,
    });
    const { client, wrapper } = setup();
    const profile = { id: 10, location };
    client.setQueryData(merchantBusinessProfileKey(42), profile);
    const { result, unmount } = await renderHook(
      () => useSubmitMerchantLocationChange(),
      { wrapper },
    );
    const payload = {
      proposed_location: pendingRequest.proposed.location,
      proposed_landmarks: [],
      reason: "Our business location has changed.",
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });
    expect(service.submitLocationChange).toHaveBeenCalledWith(payload);
    expect(client.getQueryData(merchantBusinessProfileKey(42))).toEqual(
      profile,
    );
    expect(
      client.getQueryData(merchantLocationChangeKeys.detail(42, 107)),
    ).toEqual(pendingRequest);
    unmount();
    client.clear();
  });

  it("withdraws only request state", async () => {
    (service.withdrawLocationChange as jest.Mock).mockResolvedValue({
      success: true,
      message: "Withdrawn.",
      data: { ...pendingRequest, status: "withdrawn" },
    });
    const { client, wrapper } = setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useWithdrawMerchantLocationChange(),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync(107);
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantLocationChangeKeys.list(42),
      refetchType: "all",
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
    });
    unmount();
    client.clear();
  });

  it("refreshes each location-dependent cache once on observed approval", async () => {
    (service.getLocationChangeRequests as jest.Mock).mockResolvedValue(
      page([{ ...pendingRequest, status: "approved" }], 1, false),
    );
    const { client, wrapper } = setup();
    client.setQueryData(merchantBusinessProfileKey(42), { id: 10 });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useMerchantLocationChangeRequests(),
      { wrapper },
    );

    await waitFor(() =>
      expect(result.current.latestRequest?.status).toBe("approved"),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(6));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(10),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: MAP_PREVIEW_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [...ROAD_ROUTE_QUERY_KEY, 10],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [...DIRECT_JOURNEYS_QUERY_KEY, 10],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [...DIRECT_JOURNEY_MAP_QUERY_KEY, 10],
    });
    unmount();
    client.clear();
  });
});
