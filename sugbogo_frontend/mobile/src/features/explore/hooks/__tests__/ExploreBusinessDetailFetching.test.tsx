import type { PropsWithChildren } from "react";
import { act, render, renderHook } from "@testing-library/react-native";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { businessFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import { getExploreBusinessDetail } from "../../api/exploreBusiness.service";
import { getBusinessReviewPreview } from "../../api/reviewBusiness.service";
import { recentBusinessDetails } from "../../services/recentBusinessDetails.service";
import { EXPLORE_BUSINESS_DETAIL_STALE_TIME_MS } from "../exploreBusinessDetailQueryPolicy";
import { ReviewDerivedDataSyncProvider } from "../ReviewDerivedDataSyncProvider";
import { exploreBusinessDetailKey } from "../reviewQueryKeys";
import useExploreBusinessProfile from "../useExploreBusinessProfile";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("../../api/reviewBusiness.service", () => ({
  getBusinessReviewPreview: jest.fn(),
}));

describe("Explore business detail request lifecycle", () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFocused = true;
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.mocked(getExploreBusinessDetail).mockImplementation(async (id) => ({
      success: true,
      message: "Loaded",
      data: { ...businessFixture(), id },
    }));
    jest.mocked(getBusinessReviewPreview).mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { reviews: [], total_count: 0, user_review: null },
    });
  });

  afterEach(async () => {
    await client.cancelQueries();
    client.clear();
    await recentBusinessDetails.flush();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    jest.useRealTimers();
  });

  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  async function settle() {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });
  }

  it("shares a completed profile read with a later provider and reuses it on return", async () => {
    const profile = await renderHook(() => useExploreBusinessProfile(21), {
      wrapper: Wrapper,
    });
    await settle();
    expect(profile.result.current.business?.id).toBe(21);
    const provider = await render(
      <ReviewDerivedDataSyncProvider businessId={21} />,
      { wrapper: Wrapper },
    );
    await settle();
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);

    mockFocused = false;
    await provider.rerender(<ReviewDerivedDataSyncProvider businessId={21} />);
    mockFocused = true;
    await provider.rerender(<ReviewDerivedDataSyncProvider businessId={21} />);
    await act(async () => focusManager.setFocused(false));
    await act(async () => focusManager.setFocused(true));
    await settle();
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    await provider.unmount();
    await profile.unmount();

    const reopened = await renderHook(() => useExploreBusinessProfile(21), {
      wrapper: Wrapper,
    });
    const remounted = await render(
      <ReviewDerivedDataSyncProvider businessId={21} />,
      { wrapper: Wrapper },
    );
    await settle();
    expect(reopened.result.current.business?.id).toBe(21);
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    await remounted.unmount();
    await reopened.unmount();
  });

  it("fetches expired detail when reopening the profile", async () => {
    client.setQueryData(exploreBusinessDetailKey(21), businessFixture(), {
      updatedAt: Date.now() - EXPLORE_BUSINESS_DETAIL_STALE_TIME_MS - 1,
    });
    const profile = await renderHook(() => useExploreBusinessProfile(21), {
      wrapper: Wrapper,
    });
    await settle();
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    expect(profile.result.current.business?.id).toBe(21);
    await profile.unmount();
  });

  it("refreshes invalidated fresh detail without touching another business", async () => {
    const otherBusiness = { ...businessFixture(), id: 22 };
    client.setQueryData(exploreBusinessDetailKey(22), otherBusiness);
    const profile = await renderHook(() => useExploreBusinessProfile(21), {
      wrapper: Wrapper,
    });
    const provider = await render(
      <ReviewDerivedDataSyncProvider businessId={21} />,
      { wrapper: Wrapper },
    );
    await settle();
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(1);
    await act(async () => {
      await client.invalidateQueries({ queryKey: exploreBusinessDetailKey(21) });
    });
    await settle();
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2);
    expect(getExploreBusinessDetail).toHaveBeenLastCalledWith(21);
    expect(client.getQueryData(exploreBusinessDetailKey(22))).toBe(otherBusiness);
    expect(
      client.getQueryState(exploreBusinessDetailKey(22))?.isInvalidated,
    ).toBe(false);
    await provider.unmount();
    await profile.unmount();
  });

  it("obtains a new authoritative receipt on reconnect even with fresh detail", async () => {
    const profile = await renderHook(() => useExploreBusinessProfile(21), {
      wrapper: Wrapper,
    });
    await settle();
    const receipt = profile.result.current.successfulFetch;
    expect(receipt).not.toBeNull();
    await act(async () => onlineManager.setOnline(false));
    await act(async () => onlineManager.setOnline(true));
    await settle();
    expect(getExploreBusinessDetail).toHaveBeenCalledTimes(2);
    expect(profile.result.current.successfulFetch).not.toBe(receipt);
    await profile.unmount();
  });
});
