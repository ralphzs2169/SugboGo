import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import * as service from "../../../api/merchantPlusAnalytics.service";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import {
  plusStatus,
  plusSuccess,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import {
  peerReport,
  storedInsightsReport,
} from "../../../__tests__/merchantAdvancedAnalytics.fixtures";
import type { MerchantAnalyticsPeriod } from "../../../types/merchantAnalytics.types";
import useMerchantPlusAccess from "../useMerchantPlusAccess";
import {
  useMerchantPlusPeers,
  useMerchantReviewInsights,
} from "../useMerchantAdvancedAnalytics";
import {
  merchantPlusReportKey,
  merchantPlusReportScope,
} from "../merchantPlusAnalyticsQueryKeys";

jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusPeers: jest.fn(),
  getMerchantPlusStoredInsights: jest.fn(),
}));

describe("advanced report cache isolation", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  function useReports(period: MerchantAnalyticsPeriod = "30") {
    const access = useMerchantPlusAccess();
    const peers = useMerchantPlusPeers({ period }, access.allowed);
    const insights = useMerchantReviewInsights(true);
    return { access, peers, insights };
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
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
      .mocked(service.getMerchantPlusStoredInsights)
      .mockReset()
      .mockResolvedValue(plusSuccess(storedInsightsReport()));
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
    await waitFor(() => expect(result.current.insights.data).toBeDefined());
    jest.mocked(service.getMerchantPlusPeers).mockResolvedValueOnce({
      success: false,
      code: "PLUS_REQUIRED",
      message: "Plus required",
    });
    await act(async () => {
      await result.current.peers.refetch();
    });
    await waitFor(() => expect(result.current.access.allowed).toBe(false));
    expect(result.current.insights.data).toBeDefined();
    expect(
      client
        .getQueriesData({ queryKey: merchantPlusReportScope(42) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
  });

  it("loads peers for the new account after switching", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.peers.data).toBeDefined());
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
    expect(
      client.getQueryData(merchantPlusReportKey(99, "peers", { period: "30" })),
    ).toEqual(other);
  });
});
