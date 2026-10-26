import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getMerchantBusinessProfile } from "../../../api/merchantBusinessProfile.service";
import { ROAD_ROUTE_QUERY_KEY } from "@/features/explore/hooks/useRoadRoute";
import * as names from "../../../api/businessNameChange.service";
import * as classifications from "../../../api/classificationChange.service";
import * as locations from "../../../api/locationChange.service";
import * as pending from "../../../api/businessChangePendingStatus.service";
import {
  useMerchantBusinessNameChangeRequest,
  useMerchantBusinessNameChangeRequests,
  useWithdrawMerchantBusinessNameChange,
} from "../../business-name-change/useMerchantBusinessNameChanges";
import {
  useMerchantClassificationChangeRequest,
  useMerchantClassificationChangeRequests,
  useWithdrawMerchantClassificationChange,
} from "../../classification-change/useMerchantClassificationChanges";
import {
  useMerchantLocationChangeRequest,
  useMerchantLocationChangeRequests,
  useWithdrawMerchantLocationChange,
} from "../../location-change/useMerchantLocationChanges";
import { merchantBusinessNameChangeKeys } from "../../business-name-change/businessNameChangeQueryKeys";
import { merchantClassificationChangeKeys } from "../../classification-change/classificationChangeQueryKeys";
import { merchantLocationChangeKeys } from "../../location-change/locationChangeQueryKeys";
import { merchantBusinessProfileKey } from "../../business-profile/merchantBusinessProfileQueryKeys";
import { businessChangePendingStatusQueryKey } from "../businessChangePendingStatusQueryKey";
import useBusinessChangePendingStatus from "../useBusinessChangePendingStatus";

jest.mock("../../../api/businessNameChange.service", () => ({
  getBusinessNameChangeRequests: jest.fn(),
  getBusinessNameChangeRequest: jest.fn(),
  withdrawBusinessNameChange: jest.fn(),
}));
jest.mock("../../../api/classificationChange.service", () => ({
  getClassificationChangeRequests: jest.fn(),
  getClassificationChangeRequest: jest.fn(),
  withdrawClassificationChange: jest.fn(),
}));
jest.mock("../../../api/locationChange.service", () => ({
  getLocationChangeRequests: jest.fn(),
  getLocationChangeRequest: jest.fn(),
  withdrawLocationChange: jest.fn(),
}));
jest.mock("../../../api/businessChangePendingStatus.service", () => ({
  getBusinessChangePendingStatus: jest.fn(),
}));
jest.mock("../../../api/merchantBusinessProfile.service", () => ({
  getMerchantBusinessProfile: jest.fn(),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
const families = [
  {
    name: "business_name",
    keys: merchantBusinessNameChangeKeys,
    detail: useMerchantBusinessNameChangeRequest,
    list: useMerchantBusinessNameChangeRequests,
    withdraw: useWithdrawMerchantBusinessNameChange,
    read: names.getBusinessNameChangeRequest,
    history: names.getBusinessNameChangeRequests,
    remove: names.withdrawBusinessNameChange,
  },
  {
    name: "classification",
    keys: merchantClassificationChangeKeys,
    detail: useMerchantClassificationChangeRequest,
    list: useMerchantClassificationChangeRequests,
    withdraw: useWithdrawMerchantClassificationChange,
    read: classifications.getClassificationChangeRequest,
    history: classifications.getClassificationChangeRequests,
    remove: classifications.withdrawClassificationChange,
  },
  {
    name: "location",
    keys: merchantLocationChangeKeys,
    detail: useMerchantLocationChangeRequest,
    list: useMerchantLocationChangeRequests,
    withdraw: useWithdrawMerchantLocationChange,
    read: locations.getLocationChangeRequest,
    history: locations.getLocationChangeRequests,
    remove: locations.withdrawLocationChange,
  },
] as const;
const success = (data: unknown) => ({ success: true, data, message: "Loaded" });
const page = (status: string) => ({
  items: [{ id: 7, status }],
  eligibility: {
    pending_request_id: status === "pending" ? 7 : null,
    can_submit: status !== "pending",
  },
  pagination: { page: 1, has_next: false },
});

describe.each(families)("$name decision synchronization", (family) => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });
  afterEach(() => useAuthStore.setState({ user: null }));

  it.each(["approved", "rejected"])(
    "refreshes mounted history, eligibility and status after %s is fetched",
    async (status) => {
      const { client, wrapper } = setup();
      client.setQueryData(merchantBusinessProfileKey(42), { id: 8 });
      jest
        .mocked(family.history)
        .mockResolvedValue(success(page("pending")) as never);
      jest
        .mocked(family.read)
        .mockResolvedValue(success({ id: 7, status: "pending" }) as never);
      jest
        .mocked(pending.getBusinessChangePendingStatus)
        .mockResolvedValue(success({ [family.name]: true }) as never);
      const invalidate = jest.spyOn(client, "invalidateQueries");
      const { result, unmount } = await renderHook(
        () => ({
          detail: family.detail(7),
          history: family.list(),
          status: useBusinessChangePendingStatus(),
        }),
        { wrapper },
      );
      await waitFor(() =>
        expect(result.current.detail.request?.status).toBe("pending"),
      );
      jest
        .mocked(family.history)
        .mockResolvedValue(success(page(status)) as never);
      jest
        .mocked(family.read)
        .mockResolvedValue(success({ id: 7, status }) as never);
      jest
        .mocked(pending.getBusinessChangePendingStatus)
        .mockResolvedValue(success({ [family.name]: false }) as never);
      await act(async () => {
        await result.current.detail.refetch();
      });
      await waitFor(() =>
        expect(
          result.current.history.eligibility?.pending_request_id,
        ).toBeNull(),
      );
      await waitFor(() =>
        expect(result.current.status.pendingStatus).toEqual({
          [family.name]: false,
        }),
      );
      expect(result.current.history.latestRequest?.status).toBe(status);
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: family.keys.list(42),
        refetchType: "all",
      });
      expect(
        client.getQueryState(merchantBusinessProfileKey(42))?.isInvalidated,
      ).toBe(status === "approved");
      const calls = invalidate.mock.calls.length;
      await act(async () => {
        await result.current.detail.refetch();
      });
      expect(invalidate.mock.calls).toHaveLength(calls);
      await unmount();
      client.clear();
    },
  );

  it("withdraws without invalidating live business data", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(merchantBusinessProfileKey(42), { id: 8 });
    client.setQueryData(family.keys.list(42), {
      pages: [page("pending")],
      pageParams: [1],
    });
    client.setQueryData(businessChangePendingStatusQueryKey(42), {
      location: true,
    });
    jest
      .mocked(family.remove)
      .mockResolvedValue(success({ id: 7, status: "withdrawn" }) as never);
    const { result, unmount } = await renderHook(() => family.withdraw(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(7);
    });
    expect(client.getQueryState(family.keys.list(42))?.isInvalidated).toBe(
      true,
    );
    expect(
      client.getQueryState(businessChangePendingStatusQueryKey(42))
        ?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(merchantBusinessProfileKey(42))?.isInvalidated,
    ).toBe(false);
    await unmount();
    client.clear();
  });
});

describe("pending status availability", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });
  afterEach(() => useAuthStore.setState({ user: null }));
  it.each(families)(
    "resolves a cold $name notification before targeting business views",
    async (family) => {
      const { client, wrapper } = setup();
      const route = [...ROAD_ROUTE_QUERY_KEY, 8];
      const detail = exploreBusinessDetailKey(8);
      client.setQueryData(route, { route: "old" });
      client.setQueryData(detail, { id: 8 });
      jest
        .mocked(getMerchantBusinessProfile)
        .mockResolvedValue(success({ id: 8 }) as never);
      jest
        .mocked(family.read)
        .mockResolvedValue(success({ id: 7, status: "approved" }) as never);
      const { unmount } = await renderHook(() => family.detail(7), { wrapper });
      await waitFor(() =>
        expect(client.getQueryState(detail)?.isInvalidated).toBe(true),
      );
      expect(client.getQueryState(route)?.isInvalidated).toBe(
        family.name === "location",
      );
      expect(getMerchantBusinessProfile).toHaveBeenCalledTimes(1);
      await unmount();
      client.clear();
    },
  );
  it("distinguishes failure from none and retains a last-known status", async () => {
    const { client, wrapper } = setup();
    jest.mocked(pending.getBusinessChangePendingStatus).mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const { result, unmount } = await renderHook(
      () => useBusinessChangePendingStatus(),
      { wrapper },
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.hasData).toBe(false);
    expect(result.current.pendingStatus).toBeNull();
    const none = {
      business_name: false,
      classification: false,
      location: false,
    };
    jest
      .mocked(pending.getBusinessChangePendingStatus)
      .mockResolvedValue(success(none) as never);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.pendingStatus).toEqual(none));
    jest.mocked(pending.getBusinessChangePendingStatus).mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.hasData).toBe(true);
    expect(result.current.pendingStatus).toEqual(none);
    await unmount();
    client.clear();
  });
});
