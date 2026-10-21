import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import * as service from "../../../api/merchantPlusAnalytics.service";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import {
  plusStatus,
  plusSuccess,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import {
  peerReport,
  recommendationsReport,
  refreshAcknowledgement,
  storedInsightsReport,
} from "../../../__tests__/merchantAdvancedAnalytics.fixtures";
import type { RecommendationRefreshResult } from "../../../types/merchantAdvancedAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../../../types/merchantAnalytics.types";
import useMerchantPlusAccess from "../useMerchantPlusAccess";
import {
  useMerchantPlusPeers,
  useMerchantPlusRecommendations,
  useMerchantPlusStoredInsights,
} from "../useMerchantAdvancedAnalytics";
import {
  merchantPlusReportKey,
  merchantPlusReportScope,
} from "../merchantPlusAnalyticsQueryKeys";

jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusPeers: jest.fn(),
  getMerchantPlusRecommendations: jest.fn(),
  refreshMerchantPlusRecommendations: jest.fn(),
  getMerchantPlusStoredInsights: jest.fn(),
}));

describe("advanced report cache and mutation isolation", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  function useReports(period: MerchantAnalyticsPeriod = "30") {
    const access = useMerchantPlusAccess();
    const peers = useMerchantPlusPeers({ period }, access.allowed);
    const recommendations = useMerchantPlusRecommendations(
      { period },
      access.allowed,
    );
    const insights = useMerchantPlusStoredInsights(access.allowed);
    return { access, peers, recommendations, insights };
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    jest
      .mocked(service.getMerchantPlusStatus)
      .mockReset()
      .mockResolvedValue(plusSuccess(plusStatus()));
    jest
      .mocked(service.getMerchantPlusPeers)
      .mockReset()
      .mockResolvedValue(plusSuccess(peerReport()));
    jest
      .mocked(service.getMerchantPlusRecommendations)
      .mockReset()
      .mockResolvedValue(plusSuccess(recommendationsReport()));
    jest
      .mocked(service.getMerchantPlusStoredInsights)
      .mockReset()
      .mockResolvedValue(plusSuccess(storedInsightsReport()));
    jest
      .mocked(service.refreshMerchantPlusRecommendations)
      .mockReset()
      .mockResolvedValue(plusSuccess(refreshAcknowledgement()));
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("includes account and period while keeping stored insights independent of period", async () => {
    const { result, rerender } = await renderHook(
      ({ period }: { period: MerchantAnalyticsPeriod }) => useReports(period),
      { wrapper: Wrapper, initialProps: { period: "30" } },
    );
    await waitFor(() => expect(result.current.insights.data).toBeDefined());
    await rerender({ period: "7" });
    await waitFor(() =>
      expect(service.getMerchantPlusPeers).toHaveBeenLastCalledWith(
        { period: "7" },
        expect.anything(),
      ),
    );
    expect(service.getMerchantPlusStoredInsights).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryData(merchantPlusReportKey(42, "peers", { period: "30" })),
    ).toBeDefined();
    expect(
      client.getQueryData(merchantPlusReportKey(42, "peers", { period: "7" })),
    ).toBeDefined();
  });

  it("clears all advanced report caches after authoritative Plus denial", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.peers.data).toBeDefined());
    jest.mocked(service.getMerchantPlusPeers).mockResolvedValueOnce({
      success: false,
      code: "PLUS_REQUIRED",
      message: "Plus required",
    });
    await act(async () => {
      await result.current.peers.refetch();
    });
    await waitFor(() => expect(result.current.access.allowed).toBe(false));
    expect(
      client
        .getQueriesData({ queryKey: merchantPlusReportScope(42) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
  });

  it("does not expose old account data or late mutation acknowledgements after switching", async () => {
    let finish!: (value: ApiResponse<RecommendationRefreshResult>) => void;
    jest.mocked(service.refreshMerchantPlusRecommendations).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(result.current.recommendations.data).toBeDefined(),
    );
    await act(async () => {
      result.current.recommendations.requestRefresh();
    });
    await waitFor(() =>
      expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(
        1,
      ),
    );
    const other = peerReport();
    other.business = { ...other.business, id: 99, name: "Other business" };
    jest
      .mocked(service.getMerchantPlusPeers)
      .mockResolvedValue(plusSuccess(other));
    await act(async () =>
      useAuthStore.setState({ user: analyticsMerchant(99) }),
    );
    await waitFor(() =>
      expect(result.current.peers.data?.business.id).toBe(99),
    );
    await act(async () => finish(plusSuccess(refreshAcknowledgement())));
    expect(result.current.recommendations.refreshResult).toBeUndefined();
    expect(result.current.recommendations.refreshError).toBeNull();
    expect(
      client.getQueryData(merchantPlusReportKey(99, "peers", { period: "30" })),
    ).toEqual(other);
  });

  it("applies Plus denial from explicit refresh without retrying the mutation", async () => {
    jest
      .mocked(service.refreshMerchantPlusRecommendations)
      .mockResolvedValueOnce({
        success: false,
        code: "PLUS_REQUIRED",
        message: "Plus required",
      });
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(result.current.recommendations.data).toBeDefined(),
    );
    await act(async () => result.current.recommendations.requestRefresh());
    await waitFor(() => expect(result.current.access.allowed).toBe(false));
    expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid refresh taps without submitting duplicate POST requests", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(result.current.recommendations.data).toBeDefined(),
    );
    await act(async () => {
      result.current.recommendations.requestRefresh();
      result.current.recommendations.requestRefresh();
    });
    await waitFor(() =>
      expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(
        1,
      ),
    );
  });

  it("expires the server cooldown locally without another generation request", async () => {
    const { result, rerender } = await renderHook(
      ({ period }: { period: MerchantAnalyticsPeriod }) => useReports(period),
      { wrapper: Wrapper, initialProps: { period: "30" } },
    );
    await waitFor(() =>
      expect(result.current.recommendations.data).toBeDefined(),
    );
    jest.useFakeTimers();
    try {
      jest
        .mocked(service.refreshMerchantPlusRecommendations)
        .mockResolvedValueOnce({
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests.",
          errors: { retry_after: 30 },
        } as never);
      await act(async () => result.current.recommendations.requestRefresh());
      await waitFor(() =>
        expect(result.current.recommendations.isThrottled).toBe(true),
      );
      await rerender({ period: "7" });
      await waitFor(() =>
        expect(result.current.recommendations.data).toBeDefined(),
      );
      expect(result.current.recommendations.isThrottled).toBe(true);
      await act(async () => result.current.recommendations.requestRefresh());
      expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(
        1,
      );
      await act(async () => jest.advanceTimersByTime(30_000));
      expect(result.current.recommendations.isThrottled).toBe(false);
      expect(service.refreshMerchantPlusRecommendations).toHaveBeenCalledTimes(
        1,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
