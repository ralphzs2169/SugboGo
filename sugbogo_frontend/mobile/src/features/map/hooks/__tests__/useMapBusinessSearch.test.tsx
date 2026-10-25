import React, { type PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { getDiscoveryResults } from "@/features/explore/api/exploreBusiness.service";
import useMapBusinessSearch from "../useMapBusinessSearch";

jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  getDiscoveryResults: jest.fn(),
}));

function response(id: number) {
  return {
    success: true,
    data: {
      items: [{ id }],
      pagination: { page: 1, has_next: false, total_items: 1 },
    },
  };
}

function setup(search = "", isOpen = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return {
    client,
    hook: renderHook(
      ({ search, isOpen }: { search: string; isOpen: boolean }) =>
        useMapBusinessSearch(search, isOpen),
      { initialProps: { search, isOpen }, wrapper: Wrapper },
    ),
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("debounces global search, ignores empty/closed input, and reuses Explore's cache", async () => {
  (getDiscoveryResults as jest.Mock).mockResolvedValue(response(42));
  const { client, hook } = setup();
  const { result, rerender, unmount } = await hook;
  await rerender({ search: "   ", isOpen: true });
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(getDiscoveryResults).not.toHaveBeenCalled();
  await rerender({ search: " coffee ", isOpen: true });
  await act(async () => {
    jest.advanceTimersByTime(349);
  });
  expect(getDiscoveryResults).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  await waitFor(() => expect(result.current.businesses[0]?.id).toBe(42));
  expect(getDiscoveryResults).toHaveBeenCalledWith(
    {
      search: "coffee",
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
    },
    1,
  );
  await rerender({ search: "coffee", isOpen: false });
  expect(result.current.businesses).toEqual([]);
  await rerender({ search: "coffee", isOpen: true });
  expect(result.current.businesses[0]?.id).toBe(42);
  expect(getDiscoveryResults).toHaveBeenCalledTimes(1);
  await unmount();
  client.clear();
});

it("clears fuzzy metadata and highlighting during a new draft or sheet closure", async () => {
  (getDiscoveryResults as jest.Mock).mockResolvedValue({
    ...response(42),
    data: { ...response(42).data, used_fuzzy_fallback: true },
  });
  const { client, hook } = setup("advventre", true);
  const { result, rerender, unmount } = await hook;
  await act(async () => jest.advanceTimersByTime(350));
  await waitFor(() => expect(result.current.usedFuzzyFallback).toBe(true));
  expect(result.current.highlightQuery).toBe("advventre");

  await rerender({ search: "coffee", isOpen: true });
  expect(result.current.usedFuzzyFallback).toBe(false);
  expect(result.current.highlightQuery).toBe("");
  expect(result.current.businesses).toEqual([{ id: 42 }]);
  expect(result.current.isUpdating).toBe(true);
  expect(result.current.isInitialLoading).toBe(false);
  expect(result.current.isCurrentData).toBe(false);
  await rerender({ search: "advventre", isOpen: false });
  expect(result.current.usedFuzzyFallback).toBe(false);
  expect(result.current.highlightQuery).toBe("");
  await unmount();
  client.clear();
});

it("ignores a late previous response without completed rows to retain", async () => {
  let finishOld: (value: unknown) => void = () => {};
  (getDiscoveryResults as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockResolvedValueOnce(response(77));
  const { client, hook } = setup("coffee", true);
  const { result, rerender, unmount } = await hook;
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await waitFor(() => expect(getDiscoveryResults).toHaveBeenCalledTimes(1));
  await rerender({ search: "pastry", isOpen: true });
  expect(result.current.businesses).toEqual([]);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await waitFor(() => expect(result.current.businesses[0]?.id).toBe(77));
  await act(async () => {
    finishOld(response(42));
  });
  expect(result.current.businesses[0]?.id).toBe(77);
  await unmount();
  client.clear();
});

it("uses a full loader only for a real initial request and retains completed rows until replacement", async () => {
  let finishFirst: (value: unknown) => void = () => {};
  let finishSecond: (value: unknown) => void = () => {};
  (getDiscoveryResults as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSecond = resolve;
        }),
    );
  const { client, hook } = setup("coffee", true);
  const { result, rerender, unmount } = await hook;
  expect(result.current.isInitialLoading).toBe(false);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await waitFor(() => expect(result.current.isInitialLoading).toBe(true));
  await act(async () => {
    finishFirst(response(42));
  });
  await waitFor(() => expect(result.current.businesses).toEqual([{ id: 42 }]));
  await rerender({ search: "coffee", isOpen: true });
  expect(result.current.isUpdating).toBe(false);
  expect(getDiscoveryResults).toHaveBeenCalledTimes(1);

  await rerender({ search: "pastry", isOpen: true });
  expect(result.current.businesses).toEqual([{ id: 42 }]);
  expect(result.current.isUpdating).toBe(true);
  expect(result.current.isInitialLoading).toBe(false);
  expect(result.current.highlightQuery).toBe("");
  expect(result.current.isCurrentData).toBe(false);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await waitFor(() => expect(getDiscoveryResults).toHaveBeenCalledTimes(2));
  expect(result.current.businesses).toEqual([{ id: 42 }]);
  expect(result.current.isPlaceholderData).toBe(true);
  expect(result.current.isInitialLoading).toBe(false);
  expect(result.current.hasNextPage).toBe(false);
  await act(async () => {
    finishSecond({
      success: true,
      data: {
        items: [],
        pagination: { page: 1, has_next: false, total_items: 0 },
      },
    });
  });
  await waitFor(() => expect(result.current.businesses).toEqual([]));
  expect(result.current.isCurrentData).toBe(true);
  expect(result.current.isUpdating).toBe(false);
  expect(result.current.isPending).toBe(false);
  await unmount();
  client.clear();
});

it("exposes request failure and refetch recovery", async () => {
  (getDiscoveryResults as jest.Mock)
    .mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    })
    .mockResolvedValueOnce(response(99));
  const { client, hook } = setup("coffee", true);
  const { result, unmount } = await hook;
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.businesses[0]?.id).toBe(99));
  await unmount();
  client.clear();
});
