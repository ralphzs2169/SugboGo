import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";

import { getVouchHistory } from "../../api/vouchHistory.service";
import {
  historyBusiness,
  historyPage,
} from "../../__tests__/vouchHistory.fixtures";
import type { VouchHistoryOrdering } from "../../types/vouchHistory.types";
import useVouchHistory from "../useVouchHistory";
import { vouchHistoryQueryKey } from "../vouchHistoryQueryKeys";

let mockUserId: number | undefined = 1;
jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: mockUserId ? { id: mockUserId } : null }),
}));
jest.mock("../../api/vouchHistory.service", () => ({
  getVouchHistory: jest.fn(),
}));

describe("useVouchHistory", () => {
  let client: QueryClient;
  beforeEach(() => {
    mockUserId = 1;
    (getVouchHistory as jest.Mock).mockReset();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("separates users and ordering variants beneath a stable prefix", () => {
    expect(vouchHistoryQueryKey(1, "newest")).toEqual([
      "explorer-vouch-history",
      1,
      "newest",
    ]);
    expect(vouchHistoryQueryKey(1, "oldest")).not.toEqual(
      vouchHistoryQueryKey(1, "newest"),
    );
    expect(vouchHistoryQueryKey(2, "newest")).not.toEqual(
      vouchHistoryQueryKey(1, "newest"),
    );
  });

  it("preserves server page order and uses full-history summary instead of loaded counts", async () => {
    (getVouchHistory as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: historyPage(
          [historyBusiness(20), historyBusiness(10)],
          1,
          11,
          33,
        ),
      })
      .mockResolvedValueOnce({
        success: true,
        data: historyPage([historyBusiness(5)], 2, 11, 33),
      });
    const { result } = await renderHook(() => useVouchHistory("newest"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.summary).toEqual({
      total_businesses: 11,
      total_specialty_vouches: 33,
    });
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(result.current.businesses.map((business) => business.id)).toEqual([
      20, 10, 5,
    ]);
    expect(getVouchHistory).toHaveBeenNthCalledWith(2, "newest", 2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("loads page one with the selected ordering and isolates an account change", async () => {
    (getVouchHistory as jest.Mock).mockResolvedValue({
      success: true,
      data: historyPage(),
    });
    const { result, rerender } = await renderHook(
      ({ ordering }: { ordering: VouchHistoryOrdering }) =>
        useVouchHistory(ordering),
      { wrapper: Wrapper, initialProps: { ordering: "newest" } },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));
    await rerender({ ordering: "oldest" });
    await waitFor(() =>
      expect(getVouchHistory).toHaveBeenCalledWith("oldest", 1),
    );
    mockUserId = 2;
    (getVouchHistory as jest.Mock).mockResolvedValue({
      success: true,
      data: historyPage([historyBusiness(2)]),
    });
    await rerender({ ordering: "oldest" });
    await waitFor(() => expect(result.current.businesses[0]?.id).toBe(2));
    expect(
      client.getQueryData(vouchHistoryQueryKey(1, "oldest")),
    ).toBeDefined();
    expect(
      client.getQueryData(vouchHistoryQueryKey(2, "oldest")),
    ).toBeDefined();
  });

  it("does not request history before authentication is available", async () => {
    mockUserId = undefined;
    await renderHook(() => useVouchHistory("newest"), { wrapper: Wrapper });
    expect(getVouchHistory).not.toHaveBeenCalled();
  });

  it("retains loaded pages on next-page failure and retries the failed page", async () => {
    (getVouchHistory as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: historyPage([historyBusiness()], 1, 11, 20),
      })
      .mockResolvedValueOnce({
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      })
      .mockResolvedValueOnce({
        success: true,
        data: historyPage([historyBusiness(2)], 2, 11, 20),
      });
    const { result } = await renderHook(() => useVouchHistory("newest"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.businesses.map((business) => business.id)).toEqual([
      1,
    ]);
    await act(() => result.current.fetchNextPage());
    expect(getVouchHistory).toHaveBeenLastCalledWith("newest", 2);
    await waitFor(() =>
      expect(result.current.businesses.map((business) => business.id)).toEqual([
        1, 2,
      ]),
    );
  });

  it("retries an initial error and exposes a successful empty summary", async () => {
    (getVouchHistory as jest.Mock)
      .mockResolvedValueOnce({
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      })
      .mockResolvedValueOnce({ success: true, data: historyPage([]) });
    const { result } = await renderHook(() => useVouchHistory("newest"), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.hasData).toBe(false);
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.businesses).toEqual([]);
    expect(result.current.summary).toEqual({
      total_businesses: 0,
      total_specialty_vouches: 0,
    });
    expect(result.current.hasData).toBe(true);
  });
});
