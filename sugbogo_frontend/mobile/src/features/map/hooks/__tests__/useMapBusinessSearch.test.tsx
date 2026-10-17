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

it("debounces global search, ignores short/closed input, and reuses Explore's cache", async () => {
  (getDiscoveryResults as jest.Mock).mockResolvedValue(response(42));
  const { client, hook } = setup();
  const { result, rerender, unmount } = await hook;
  await rerender({ search: "c", isOpen: true });
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

it("hides stale text results during debounce and ignores a late previous response", async () => {
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
