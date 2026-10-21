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
  unansweredReviewsSummary,
} from "../../../__tests__/merchantAnalytics.fixtures";
import { getMerchantUnansweredReviews } from "../../../api/merchantAnalytics.service";
import useMerchantUnansweredReviews from "../useMerchantUnansweredReviews";
import {
  merchantUnansweredReviewsKey,
  MERCHANT_STANDARD_ANALYTICS_QUERY_KEY,
} from "../merchantAnalyticsQueryKeys";

jest.mock("../../../api/merchantAnalytics.service", () => ({
  getMerchantUnansweredReviews: jest.fn(),
}));
const getSummary = jest.mocked(getMerchantUnansweredReviews);

describe("independent account-scoped backlog query", () => {
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
    getSummary.mockReset().mockResolvedValue({
      success: true,
      message: "Success",
      data: unansweredReviewsSummary(),
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
  });

  it("waits for focus and reuses its snapshot across unrelated period changes", async () => {
    const { result, rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useMerchantUnansweredReviews(enabled),
      { wrapper: Wrapper, initialProps: { enabled: false } },
    );
    expect(getSummary).not.toHaveBeenCalled();
    await rerender({ enabled: true });
    await waitFor(() => expect(result.current.data?.total_unanswered).toBe(8));
    expect(getSummary).toHaveBeenCalledWith(expect.anything());
    expect(merchantUnansweredReviewsKey(42)).toEqual([
      ...MERCHANT_STANDARD_ANALYTICS_QUERY_KEY,
      42,
      "unanswered-reviews",
    ]);
    await rerender({ enabled: true });
    expect(getSummary).toHaveBeenCalledTimes(1);
  });

  it("keeps cached data during a failed refetch and can recover independently", async () => {
    const { result } = await renderHook(
      () => ({ ...useMerchantUnansweredReviews() }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    getSummary.mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.total_unanswered).toBe(8);
    await waitFor(() => expect(result.current.error).toBeTruthy());
    getSummary.mockResolvedValue({
      success: true,
      message: "Success",
      data: unansweredReviewsSummary(),
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it("never shows a previous account's cached summary while switching accounts", async () => {
    const { result } = await renderHook(
      () => ({ ...useMerchantUnansweredReviews() }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());
    getSummary.mockReturnValueOnce(new Promise(() => {}));
    await act(async () =>
      useAuthStore.setState({ user: analyticsMerchant(43) }),
    );
    await waitFor(() => expect(getSummary).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(merchantUnansweredReviewsKey(42))).toBeDefined();
  });
});
