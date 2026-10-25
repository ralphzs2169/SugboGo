import React, { type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { getDiscoveryResults } from "../../api/exploreBusiness.service";
import useDiscoveryResults, {
  getDiscoveryResultsQueryKey,
} from "../useDiscoveryResults";

jest.mock("../../api/exploreBusiness.service", () => ({
  getDiscoveryResults: jest.fn(),
}));

function setupClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return Wrapper;
}

const criteria = {
  search: "coffee",
  clusterId: 3,
  categoryIds: [7, 4, 7],
  specialtyTagId: 12,
};

describe("useDiscoveryResults", () => {
  it.each(["text", "taxonomy"])(
    "retains rows during a %s update without stale attribution",
    async (change) => {
      let finishUpdate: (value: unknown) => void = () => {};
      (getDiscoveryResults as jest.Mock)
        .mockResolvedValueOnce({
          success: true,
          data: {
            items: [{ id: 42 }],
            used_fuzzy_fallback: true,
            pagination: { page: 1, total_items: 2, has_next: true },
          },
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishUpdate = resolve;
            }),
        );
      const { result, rerender, unmount } = await renderHook(
        ({ search, clusterId }: { search: string; clusterId: number }) =>
          useDiscoveryResults({ ...criteria, search, clusterId }),
        {
          initialProps: { search: "coffee", clusterId: 3 },
          wrapper: setupClient(),
        },
      );
      await waitFor(() => expect(result.current.isCurrentData).toBe(true));
      expect(result.current.usedFuzzyFallback).toBe(true);
      await rerender({
        search: change === "text" ? "pastry" : "coffee",
        clusterId: change === "taxonomy" ? 4 : 3,
      });
      await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
      expect(result.current.businesses).toEqual([{ id: 42 }]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isCurrentData).toBe(false);
      expect(result.current.highlightQuery).toBe("");
      expect(result.current.usedFuzzyFallback).toBe(false);
      expect(result.current.hasNextPage).toBe(false);
      const items = change === "text" ? [] : [{ id: 43 }];
      await act(async () => {
        finishUpdate({
          success: true,
          data: {
            items,
            used_fuzzy_fallback: false,
            pagination: { page: 1, total_items: items.length, has_next: false },
          },
        });
      });
      await waitFor(() => expect(result.current.isCurrentData).toBe(true));
      expect(result.current.businesses).toEqual(items);
      expect(result.current.isPlaceholderData).toBe(false);
      expect(result.current.highlightQuery).toBe(
        change === "text" ? "pastry" : "coffee",
      );
      expect(getDiscoveryResults).toHaveBeenCalledTimes(2);
      await rerender({
        search: change === "text" ? "pastry" : "coffee",
        clusterId: change === "taxonomy" ? 4 : 3,
      });
      expect(getDiscoveryResults).toHaveBeenCalledTimes(2);
      expect(result.current.isFetching).toBe(false);
      await unmount();
    },
  );

  it("uses only backend metadata and hides presentation state while the query is disabled", async () => {
    (getDiscoveryResults as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 42 }],
        used_fuzzy_fallback: true,
        pagination: { page: 1, total_items: 1, has_next: false },
      },
    });
    const { result, rerender, unmount } = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useDiscoveryResults({ ...criteria, search: "advventre" }, enabled),
      { initialProps: { enabled: true }, wrapper: setupClient() },
    );
    await waitFor(() => expect(result.current.usedFuzzyFallback).toBe(true));
    expect(result.current.highlightQuery).toBe("advventre");
    await rerender({ enabled: false });
    expect(result.current.usedFuzzyFallback).toBe(false);
    expect(result.current.highlightQuery).toBe("");
    await unmount();
  });

  it.each([false, undefined])(
    "does not infer fuzzy results when metadata is %s",
    async (flag) => {
      (getDiscoveryResults as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          items: [{ id: 42, business_name: "Adventure" }],
          used_fuzzy_fallback: flag,
          pagination: { page: 1, total_items: 1, has_next: false },
        },
      });
      const { result, unmount } = await renderHook(
        () => useDiscoveryResults({ ...criteria, search: "advventre" }),
        { wrapper: setupClient() },
      );
      await waitFor(() => expect(result.current.businesses).toHaveLength(1));
      expect(result.current.usedFuzzyFallback).toBe(false);
      await unmount();
    },
  );

  it.each(["refresh", "next-page"])(
    "preserves loaded pages after %s failure",
    async (operation) => {
      const loadedPage = {
        items: [{ id: 20 }],
        pagination: { page: 1, total_items: 2, has_next: true },
      };
      (getDiscoveryResults as jest.Mock)
        .mockResolvedValueOnce({ success: true, data: loadedPage })
        .mockResolvedValueOnce({
          success: false,
          code: "NETWORK_ERROR",
          message: "Offline",
        });
      const { result, unmount } = await renderHook(
        () => useDiscoveryResults(criteria),
        {
          wrapper: setupClient(),
        },
      );
      await waitFor(() =>
        expect(result.current.businesses).toEqual([{ id: 20 }]),
      );
      await act(async () => {
        if (operation === "refresh") {
          await result.current.refetch();
        } else {
          await result.current.fetchNextPage();
        }
      });
      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.businesses).toEqual([{ id: 20 }]);
      expect(result.current.hasNextPage).toBe(true);
      expect(result.current.isFetchNextPageError).toBe(
        operation === "next-page",
      );

      (getDiscoveryResults as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: {
          items: [{ id: 21 }],
          pagination: { page: 2, total_items: 2, has_next: false },
        },
      });
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() =>
        expect(result.current.businesses).toEqual([{ id: 20 }, { id: 21 }]),
      );
      unmount();
    },
  );
  it("normalizes ID keys and preserves backend page ordering", async () => {
    (getDiscoveryResults as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        data: {
          items: [{ id: 20 }, { id: 10 }],
          pagination: {
            page: 1,
            total_items: 3,
            has_next: true,
          },
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          items: [{ id: 5 }],
          pagination: {
            page: 2,
            total_items: 3,
            has_next: false,
          },
        },
      });

    const { result, unmount } = await renderHook(
      () => useDiscoveryResults(criteria),
      {
        wrapper: setupClient(),
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getDiscoveryResults).toHaveBeenNthCalledWith(
      1,
      {
        ...criteria,
        categoryIds: [4, 7],
      },
      1,
    );
    expect(result.current.businesses.map((business) => business.id)).toEqual([
      20, 10,
    ]);
    expect(result.current.totalItems).toBe(3);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(result.current.businesses.map((business) => business.id)).toEqual([
        20, 10, 5,
      ]);
    });
    expect(result.current.hasNextPage).toBe(false);
    unmount();
  });

  it("uses only normalized criteria values in the query key", () => {
    expect(getDiscoveryResultsQueryKey(criteria)).toEqual([
      "explore-discovery-results",
      "coffee",
      3,
      [4, 7],
      12,
    ]);
  });
});
