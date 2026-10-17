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
  visibilityReport,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import useMerchantPlusAccess from "../useMerchantPlusAccess";
import { useMerchantPlusVisibility } from "../useMerchantPlusAnalytics";
import {
  merchantPlusReportKey,
  merchantPlusReportScope,
} from "../merchantPlusAnalyticsQueryKeys";
import type {
  AnalyticsInterval,
  MerchantPlusStatus,
} from "../../../types/merchantPlusAnalytics.types";
import type { MerchantAnalyticsPeriod } from "../../../types/merchantAnalytics.types";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

jest.mock("../../../api/merchantPlusAnalytics.service", () => ({
  getMerchantPlusStatus: jest.fn(),
  getMerchantPlusVisibility: jest.fn(),
}));
const status = jest.mocked(service.getMerchantPlusStatus);
const visibility = jest.mocked(service.getMerchantPlusVisibility);

describe("server-gated, account-scoped Plus queries", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  function useReports(
    period: MerchantAnalyticsPeriod = "30",
    interval: AnalyticsInterval = "daily",
  ) {
    const access = useMerchantPlusAccess();
    const report = useMerchantPlusVisibility(
      { period },
      interval,
      access.allowed,
    );
    return { access, report };
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    useAuthStore.setState({ user: analyticsMerchant() });
    status.mockReset().mockResolvedValue(plusSuccess(plusStatus()));
    visibility.mockReset().mockResolvedValue(plusSuccess(visibilityReport()));
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("waits for entitlement and never requests restricted reports", async () => {
    let finish!: (response: ApiResponse<MerchantPlusStatus>) => void;
    status.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    expect(result.current.access.state).toBe("loading");
    expect(visibility).not.toHaveBeenCalled();
    await act(async () => finish(plusSuccess(plusStatus(false))));
    await waitFor(() => expect(result.current.access.state).toBe("restricted"));
    expect(visibility).not.toHaveBeenCalled();
  });

  it("treats status failure as an error and recovers via its own refetch", async () => {
    status.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.access.state).toBe("error"));
    expect(visibility).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.access.refetch();
    });
    await waitFor(() =>
      expect(result.current.report.data?.metrics.profile_visits.value).toBe(24),
    );
  });

  it("separates periods, intervals and custom date selections in cache", async () => {
    const { result, rerender } = await renderHook(
      ({
        period,
        interval,
      }: {
        period: MerchantAnalyticsPeriod;
        interval: AnalyticsInterval;
      }) => useReports(period, interval),
      { wrapper: Wrapper, initialProps: { period: "30", interval: "daily" } },
    );
    await waitFor(() => expect(result.current.report.data).toBeDefined());
    expect(
      result.current.report.data?.metrics.profile_visits.change.value,
    ).toBeNull();
    await rerender({ period: "7", interval: "weekly" });
    await waitFor(() => expect(visibility).toHaveBeenCalledTimes(2));
    expect(visibility).toHaveBeenLastCalledWith(
      { period: "7" },
      "weekly",
      expect.anything(),
    );
    expect(
      client.getQueryData(
        merchantPlusReportKey(42, "visibility", { period: "30" }, "daily"),
      ),
    ).toBeDefined();
    expect(
      merchantPlusReportKey(42, "visibility", {
        period: "custom",
        start_date: "2026-10-01",
        end_date: "2026-10-02",
      }),
    ).not.toEqual(
      merchantPlusReportKey(42, "visibility", {
        period: "custom",
        start_date: "2026-10-01",
        end_date: "2026-10-03",
      }),
    );
  });

  it("purges previously cached reports after a confirmed status downgrade", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.report.data).toBeDefined());
    status.mockResolvedValueOnce(plusSuccess(plusStatus(false)));
    await act(async () => {
      await result.current.access.refetch();
    });
    await waitFor(() => expect(result.current.access.allowed).toBe(false));
    expect(result.current.report.data).toBeUndefined();
    expect(
      client
        .getQueriesData({ queryKey: merchantPlusReportScope(42) })
        .every(([, data]) => data === undefined),
    ).toBe(true);
  });

  it("revokes access and clears cached data after PLUS_REQUIRED, even during refetch", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.report.data).toBeDefined());
    visibility.mockResolvedValueOnce({
      success: false,
      code: "PLUS_REQUIRED",
      message: "Merchant Plus is required.",
    });
    await act(async () => {
      await result.current.report.refetch();
    });
    await waitFor(() => expect(result.current.access.state).toBe("restricted"));
    expect(result.current.report.data).toBeUndefined();
    expect(visibility).toHaveBeenCalledTimes(2);
  });

  it("does not reuse another account's report while its access is being checked", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.report.data).toBeDefined());
    let finish!: (response: ApiResponse<MerchantPlusStatus>) => void;
    status.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () =>
      useAuthStore.setState({ user: analyticsMerchant(99) }),
    );
    expect(result.current.report.data).toBeUndefined();
    expect(result.current.access.allowed).toBe(false);
    const other = plusStatus(false);
    other.business.id = 99;
    await act(async () => finish(plusSuccess(other)));
    await waitFor(() => expect(result.current.access.state).toBe("restricted"));
    expect(visibility).toHaveBeenCalledTimes(1);
  });

  it("does not let an older in-flight status response undo a report denial", async () => {
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.report.data).toBeDefined());
    let finish!: (response: ApiResponse<MerchantPlusStatus>) => void;
    status.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await act(async () => {
      void result.current.access.refetch();
    });
    visibility.mockResolvedValueOnce({
      success: false,
      code: "PLUS_REQUIRED",
      message: "Merchant Plus is required.",
    });
    await act(async () => {
      await result.current.report.refetch();
    });
    await waitFor(() => expect(result.current.access.allowed).toBe(false));
    await act(async () => finish(plusSuccess(plusStatus())));
    expect(result.current.access.state).toBe("restricted");
    expect(result.current.report.data).toBeUndefined();
  });

  it("ignores a late successful report after access was revoked", async () => {
    let finish!: (
      response: Awaited<ReturnType<typeof service.getMerchantPlusVisibility>>,
    ) => void;
    visibility.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useReports(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(visibility).toHaveBeenCalledTimes(1));
    status.mockResolvedValueOnce(plusSuccess(plusStatus(false)));
    await act(async () => {
      await result.current.access.refetch();
    });
    await waitFor(() => expect(result.current.access.allowed).toBe(false));
    await act(async () => finish(plusSuccess(visibilityReport())));
    expect(result.current.report.data).toBeUndefined();
    expect(
      client.getQueryData(
        merchantPlusReportKey(42, "visibility", { period: "30" }, "daily"),
      ),
    ).toBeUndefined();
  });
});
