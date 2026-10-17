import React, { type PropsWithChildren } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getMapDirectoryPage } from "../../api/mapDiscovery.service";
import {
  DEFAULT_MAP_FILTERS,
  type MapDiscoveryFilters,
} from "../../types/mapDiscovery.types";
import useMapDirectory, { matchesMapFilters } from "../useMapDirectory";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../api/mapDiscovery.service", () => ({
  getMapDirectoryPage: jest.fn(),
}));

const business = {
  id: 1,
  business_name: "Cafe",
  is_hidden_gem: true,
  cluster: { id: 1, name: "Food", icon: "coffee" },
  category: { id: 2, name: "Cafe" },
  specialty_tags: [
    { id: 3, name: "Coffee", color: "blue" as const, icon: null },
  ],
  location: {
    latitude: 10.3,
    longitude: 123.9,
    address: "",
    city: "Cebu City",
    province: "Cebu",
  },
  cover_photo_url: null,
  display_cover_photo_url: null,
};
function response(
  items = [business],
  page = 1,
  total = items.length,
  hasNext = false,
) {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        page_size: 2,
        total_items: total,
        total_pages: Math.ceil(total / 2),
        has_next: hasNext,
        has_previous: page > 1,
      },
    },
  };
}
const clients: QueryClient[] = [];
let appStateChanged: (state: AppStateStatus) => void;
function setup(filters = DEFAULT_MAP_FILTERS, searchId?: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return renderHook(
    ({
      currentFilters,
      id,
    }: {
      currentFilters: MapDiscoveryFilters;
      id?: number;
    }) => useMapDirectory(currentFilters, id),
    {
      initialProps: { currentFilters: filters, id: searchId },
      wrapper: Wrapper,
    },
  );
}
beforeEach(() => {
  mockFocused = true;
  AppState.currentState = "active";
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      appStateChanged = listener;
      return { remove: jest.fn() };
    });
  (getMapDirectoryPage as jest.Mock).mockResolvedValue(response());
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("loads all pages atomically and deduplicates IDs", async () => {
  let finish: (value: unknown) => void = () => {};
  const second = { ...business, id: 2 };
  const third = { ...business, id: 3 };
  (getMapDirectoryPage as jest.Mock).mockImplementation(async (page) =>
    page === 1
      ? response([business, second], 1, 3, true)
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const { result } = await setup();
  await waitFor(() => expect(getMapDirectoryPage).toHaveBeenCalledTimes(2));
  expect(result.current.allBusinesses).toEqual([]);
  expect(result.current.isLoading).toBe(true);
  await act(async () => finish(response([second, third], 2, 3)));
  await waitFor(() =>
    expect(result.current.allBusinesses.map((item) => item.id)).toEqual([
      1, 2, 3,
    ]),
  );
});

it("keeps a failed later page out of the cache and retries the complete directory", async () => {
  (getMapDirectoryPage as jest.Mock).mockImplementation(async (page) =>
    page === 1
      ? response([business, { ...business, id: 2 }], 1, 3, true)
      : { success: false, message: "Offline", code: "NETWORK_ERROR" },
  );
  const { result } = await setup();
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.allBusinesses).toEqual([]);
  (getMapDirectoryPage as jest.Mock).mockResolvedValue(response());
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.allBusinesses).toHaveLength(1));
});

it("retains the last complete snapshot after a background refresh fails", async () => {
  const { result } = await setup();
  await waitFor(() => expect(result.current.allBusinesses).toHaveLength(1));
  (getMapDirectoryPage as jest.Mock).mockImplementation(async (page) =>
    page === 1
      ? response([business, { ...business, id: 2 }], 1, 3, true)
      : { success: false, message: "Offline" },
  );
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.allBusinesses).toEqual([business]);
});

it("does not cache a directory whose advertised total changes or remains incomplete", async () => {
  (getMapDirectoryPage as jest.Mock).mockResolvedValue(
    response([business], 1, 2),
  );
  const { result } = await setup();
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.allBusinesses).toEqual([]);
});

it("applies local taxonomy and gem filters without requests, including clearing filters", async () => {
  const { result, rerender } = await setup();
  await waitFor(() => expect(result.current.businesses).toHaveLength(1));
  await rerender({
    currentFilters: {
      ...DEFAULT_MAP_FILTERS,
      categoryIds: [8, 2],
      clusterId: 1,
      specialtyTagId: 3,
      hiddenGems: true,
    },
  });
  expect(result.current.businesses).toHaveLength(1);
  await rerender({
    currentFilters: { ...DEFAULT_MAP_FILTERS, specialtyTagId: 99 },
  });
  expect(result.current.businesses).toEqual([]);
  await rerender({ currentFilters: DEFAULT_MAP_FILTERS });
  expect(result.current.businesses).toHaveLength(1);
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
  expect(
    matchesMapFilters(business, { ...DEFAULT_MAP_FILTERS, clusterId: 99 }),
  ).toBe(false);
  expect(
    matchesMapFilters(
      { ...business, is_hidden_gem: false },
      { ...DEFAULT_MAP_FILTERS, hiddenGems: true },
    ),
  ).toBe(false);
});

it("caches server Open Now IDs separately and reuses them when toggled", async () => {
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) =>
      response(options.openNow ? [] : [business]),
  );
  const { result, rerender } = await setup();
  await waitFor(() => expect(result.current.businesses).toHaveLength(1));
  await rerender({ currentFilters: { ...DEFAULT_MAP_FILTERS, openNow: true } });
  await waitFor(() => expect(result.current.isLoadingOpenNow).toBe(false));
  expect(result.current.businesses).toEqual([]);
  await rerender({ currentFilters: DEFAULT_MAP_FILTERS });
  expect(result.current.businesses).toHaveLength(1);
  await rerender({ currentFilters: { ...DEFAULT_MAP_FILTERS, openNow: true } });
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(2);
});

it("uses cached selection despite filters and falls back to an unfiltered global ID lookup", async () => {
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) =>
      response(
        options.businessId
          ? [{ ...business, id: options.businessId }]
          : [business],
      ),
  );
  const { result, rerender } = await setup(
    { ...DEFAULT_MAP_FILTERS, categoryIds: [99] },
    1,
  );
  await waitFor(() =>
    expect(result.current.selectedSearchBusiness?.id).toBe(1),
  );
  expect(result.current.businesses).toEqual([]);
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
  await rerender({ currentFilters: DEFAULT_MAP_FILTERS, id: 90 });
  await waitFor(() =>
    expect(result.current.selectedSearchBusiness?.id).toBe(90),
  );
  expect(getMapDirectoryPage).toHaveBeenLastCalledWith(1, expect.anything(), {
    businessId: 90,
  });
});

it("refreshes Open Now only while focused and active, and refreshes stale IDs on return", async () => {
  jest.useFakeTimers();
  const filters = { ...DEFAULT_MAP_FILTERS, openNow: true };
  const { result, rerender } = await setup(filters);
  await waitFor(() => expect(result.current.isLoadingOpenNow).toBe(false));
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(3);
  await act(async () => appStateChanged("background"));
  await act(async () => {
    jest.advanceTimersByTime(120_000);
  });
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(3);
  await act(async () => appStateChanged("active"));
  await waitFor(() => expect(getMapDirectoryPage).toHaveBeenCalledTimes(4));
  mockFocused = false;
  await rerender({ currentFilters: filters });
  await act(async () => {
    jest.advanceTimersByTime(120_000);
  });
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(4);
});

it("cancels an in-flight directory when the screen loses focus", async () => {
  let signal: AbortSignal | undefined;
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    (_page, requestSignal) => {
      signal = requestSignal;
      return new Promise(() => {});
    },
  );
  const { rerender } = await setup();
  await waitFor(() => expect(signal).toBeDefined());
  mockFocused = false;
  await rerender({ currentFilters: DEFAULT_MAP_FILTERS });
  expect(signal?.aborted).toBe(true);
});
