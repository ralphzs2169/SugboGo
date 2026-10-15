import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getMapDiscoveryBusinesses } from "../../api/mapDiscovery.service";
import useMapDiscovery from "../useMapDiscovery";
import type { MapBounds } from "../../types/mapDiscovery.types";

jest.mock("../../api/mapDiscovery.service", () => ({
  getMapDiscoveryBusinesses: jest.fn(),
}));

it("disables absent and invalid bounds and reuses the normalized geographic cache", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue({
    success: true,
    data: { items: [], pagination: { has_next: false } },
  });
  const { result, rerender, unmount } = await renderHook(
    ({ bounds }: { bounds: MapBounds | null }) => useMapDiscovery(bounds),
    { initialProps: { bounds: null }, wrapper: Wrapper },
  );
  expect(getMapDiscoveryBusinesses).not.toHaveBeenCalled();
  await rerender({ bounds: { north: 11, south: 10, east: 124, west: 123.9 } });
  expect(getMapDiscoveryBusinesses).not.toHaveBeenCalled();
  await rerender({
    bounds: { north: 10.400001, south: 10.3, east: 124, west: 123.9 },
  });
  await waitFor(() => expect(result.current.pagination).toBeDefined());
  await rerender({
    bounds: { north: 10.400002, south: 10.3, east: 124, west: 123.9 },
  });
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
  await unmount();
  client.clear();
});

it("reuses normalized filter caches and separates different applied filter sets", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue({
    success: true,
    data: { items: [], pagination: { has_next: false } },
  });
  const bounds = { north: 10.4, south: 10.3, east: 124, west: 123.9 };
  const { result, rerender, unmount } = await renderHook(
    ({
      categoryIds,
      hiddenGems,
    }: {
      categoryIds: number[];
      hiddenGems: boolean;
    }) =>
      useMapDiscovery(bounds, {
        clusterId: null,
        specialtyTagId: null,
        categoryIds,
        hiddenGems,
        openNow: false,
      }),
    {
      initialProps: { categoryIds: [4, 3, 4], hiddenGems: true },
      wrapper: Wrapper,
    },
  );
  await waitFor(() => expect(result.current.pagination).toBeDefined());
  await rerender({ categoryIds: [3, 4], hiddenGems: true });
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
  await rerender({ categoryIds: [3, 4], hiddenGems: false });
  await waitFor(() => expect(result.current.pagination).toBeDefined());
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(2);
  await rerender({ categoryIds: [4, 3], hiddenGems: true });
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(2);
  await unmount();
  client.clear();
});

it("stops Open Now interval refresh after a backend viewport limit error", async () => {
  jest.useFakeTimers();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue({
    success: false,
    code: "VALIDATION_ERROR",
    errors: { bounds: ["Zoom in"] },
  });
  const { result, unmount } = await renderHook(
    () =>
      useMapDiscovery(
        { north: 10.4, south: 10.3, east: 124, west: 123.9 },
        {
          clusterId: null,
          categoryIds: [],
          specialtyTagId: null,
          hiddenGems: false,
          openNow: true,
        },
      ),
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(result.current.error).toBeTruthy());
  await act(async () => {
    jest.advanceTimersByTime(120_000);
  });
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
  await unmount();
  client.clear();
  jest.useRealTimers();
});
