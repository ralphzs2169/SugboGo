import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";

import {
  analyticsMerchant,
  analyticsSuccess,
  deferredAnalytics,
  standardAnalyticsReport,
} from "../../../__tests__/merchantAnalytics.fixtures";
import { getMerchantStandardAnalytics } from "../../../api/merchantAnalytics.service";
import type { MerchantAnalyticsPeriod } from "../../../types/merchantAnalytics.types";
import { merchantStandardAnalyticsKey } from "../merchantAnalyticsQueryKeys";
import useMerchantStandardAnalytics from "../useMerchantStandardAnalytics";

jest.mock("../../../api/merchantAnalytics.service", () => ({
  getMerchantStandardAnalytics: jest.fn(),
}));

const getAnalytics = jest.mocked(getMerchantStandardAnalytics);

describe("useMerchantStandardAnalytics", () => {
  let client: QueryClient;

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    getAnalytics.mockReset();
    getAnalytics.mockResolvedValue(analyticsSuccess());
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("keeps null metrics and complete source metadata unchanged", async () => {
    const report = standardAnalyticsReport({
      profile_visits: null,
      saves_in_period: 0,
    });
    getAnalytics.mockResolvedValue(analyticsSuccess(report));
    const { result } = await renderHook(
      () => useMerchantStandardAnalytics("30"),
      {
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.report).toEqual(report));
    expect(result.current.report?.profile_visits).toBeNull();
    expect(result.current.report?.saves_in_period).toBe(0);
    expect(client.getQueryData(merchantStandardAnalyticsKey(42, "30"))).toEqual(
      report,
    );
  });

  it("retains same-account snapshots but flags old-period activity as a placeholder", async () => {
    const { result, rerender } = await renderHook(
      ({ period }: { period: MerchantAnalyticsPeriod }) =>
        useMerchantStandardAnalytics(period),
      { wrapper: Wrapper, initialProps: { period: "30" } },
    );
    await waitFor(() => expect(result.current.report).not.toBeNull());
    const next = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(next.promise);

    await rerender({ period: "7" });

    expect(getAnalytics).toHaveBeenLastCalledWith("7");
    expect(result.current.isChangingPeriod).toBe(true);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.report?.current_pocket_holders).toBe(18);
    await act(async () =>
      next.resolve(
        analyticsSuccess(standardAnalyticsReport({ profile_visits: 2 })),
      ),
    );
    await waitFor(() => expect(result.current.isChangingPeriod).toBe(false));
    expect(result.current.report?.profile_visits).toBe(2);
  });

  it("never uses another account's cached data or period placeholder", async () => {
    const { result } = await renderHook(
      () => useMerchantStandardAnalytics("30"),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.report?.business.id).toBe(8));
    const next = deferredAnalytics();
    getAnalytics.mockReturnValueOnce(next.promise);

    await act(async () =>
      useAuthStore.setState({ user: analyticsMerchant(99) }),
    );

    expect(result.current.report).toBeNull();
    expect(result.current.isChangingPeriod).toBe(false);
    const other = standardAnalyticsReport({
      business: { id: 99, name: "Another business", status: "active" },
    });
    await act(async () => next.resolve(analyticsSuccess(other)));
    await waitFor(() => expect(result.current.report?.business.id).toBe(99));
    expect(client.getQueryData(merchantStandardAnalyticsKey(42, "30"))).toEqual(
      standardAnalyticsReport(),
    );
    expect(client.getQueryData(merchantStandardAnalyticsKey(99, "30"))).toEqual(
      other,
    );

    await act(async () => useAuthStore.setState({ user: null }));
    expect(result.current.report).toBeNull();
  });

  it("exposes API failure and recovers through refetch", async () => {
    const failure = {
      success: false as const,
      code: "NETWORK_ERROR",
      message: "Offline",
    };
    getAnalytics.mockResolvedValueOnce(failure);
    const { result } = await renderHook(
      () => useMerchantStandardAnalytics("30"),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.error).toEqual(failure));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.report).not.toBeNull();
  });

  it("does not fetch without an authenticated account", async () => {
    useAuthStore.setState({ user: null });
    const { result } = await renderHook(
      () => useMerchantStandardAnalytics("30"),
      {
        wrapper: Wrapper,
      },
    );

    expect(getAnalytics).not.toHaveBeenCalled();
    expect(result.current.report).toBeNull();
  });
});
