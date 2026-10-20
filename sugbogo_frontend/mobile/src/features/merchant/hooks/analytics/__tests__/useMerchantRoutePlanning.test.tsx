import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "../../../__tests__/merchantAnalytics.fixtures";
import { routePlanningReport } from "../../../__tests__/routePlanningAnalytics.fixtures";
import { getMerchantRoutePlanning } from "../../../api/merchantRoutePlanning.service";
import useMerchantRoutePlanning from "../useMerchantRoutePlanning";
import { merchantRoutePlanningKey } from "../merchantAnalyticsQueryKeys";
import type { MerchantAnalyticsPeriod } from "../../../types/merchantAnalytics.types";

jest.mock("../../../api/merchantRoutePlanning.service", () => ({
  getMerchantRoutePlanning: jest.fn(),
}));
const getReport = jest.mocked(getMerchantRoutePlanning);
describe("independent route-planning query", () => {
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
    getReport
      .mockReset()
      .mockResolvedValue({
        success: true,
        message: "Success",
        data: routePlanningReport(),
      });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });
  it("gates on focus and keys periods separately without relabeling old counts", async () => {
    const { result, rerender } = await renderHook(
      ({
        period,
        enabled,
      }: {
        period: MerchantAnalyticsPeriod;
        enabled: boolean;
      }) => ({ ...useMerchantRoutePlanning(period, enabled) }),
      {
        wrapper: Wrapper,
        initialProps: {
          period: "30" as MerchantAnalyticsPeriod,
          enabled: false,
        },
      },
    );
    expect(getReport).not.toHaveBeenCalled();
    await rerender({ period: "30", enabled: true });
    await waitFor(() => expect(result.current.data?.total_requests).toBe(4));
    getReport.mockReturnValueOnce(new Promise(() => {}));
    await rerender({ period: "7", enabled: true });
    expect(result.current.data).toBeUndefined();
    expect(merchantRoutePlanningKey(42, "7")).not.toEqual(
      merchantRoutePlanningKey(42, "30"),
    );
  });
  it("retains cached data after an error and recovers via refetch", async () => {
    const { result } = await renderHook(
      () => ({ ...useMerchantRoutePlanning("30") }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    getReport.mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data?.total_requests).toBe(4);
    getReport.mockResolvedValue({
      success: true,
      message: "Success",
      data: routePlanningReport({
        total_requests: 0,
        distinct_explorer_accounts: 0,
        road_route_requests: 0,
        jeepney_requests: 0,
      }),
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data?.total_requests).toBe(0);
  });
  it("does not display another account's cached report", async () => {
    const { result } = await renderHook(
      () => ({ ...useMerchantRoutePlanning("30") }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    getReport.mockReturnValueOnce(new Promise(() => {}));
    await act(async () =>
      useAuthStore.setState({ user: analyticsMerchant(43) }),
    );
    await waitFor(() => expect(getReport).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
  });
});
