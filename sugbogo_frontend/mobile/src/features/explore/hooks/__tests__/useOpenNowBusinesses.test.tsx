import React, { type PropsWithChildren } from "react";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { LocationObject } from "expo-location";

import { getOpenNowBusinesses } from "../../api/exploreBusiness.service";
import { OPEN_NOW_BUSINESSES_QUERY_KEY } from "../../constants/exploreHomepageQueries";
import useOpenNowBusinesses from "../useOpenNowBusinesses";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../api/exploreBusiness.service", () => ({
  getOpenNowBusinesses: jest.fn(),
}));

const clients: QueryClient[] = [];
const lahug = {
  coords: { latitude: 10.33, longitude: 123.9, accuracy: 15 },
} as LocationObject;
const itPark = {
  coords: { latitude: 10.328, longitude: 123.907, accuracy: 10 },
} as LocationObject;

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  mockFocused = true;
  focusManager.setFocused(true);
  (getOpenNowBusinesses as jest.Mock).mockResolvedValue({
    success: true,
    data: [{ id: 42 }, { id: 7 }],
  });
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  jest.useRealTimers();
  focusManager.setFocused(true);
});

it("does not request businesses without coordinates", async () => {
  const { result } = await renderHook(() => useOpenNowBusinesses(null), {
    wrapper: wrapper(),
  });

  expect(result.current.businesses).toEqual([]);
  expect(getOpenNowBusinesses).not.toHaveBeenCalled();
});

it("preserves server order and separates results for changed coordinates", async () => {
  const { result, rerender } = await renderHook(
    ({ location }: { location: LocationObject }) =>
      useOpenNowBusinesses(location),
    { initialProps: { location: lahug }, wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.businesses).toHaveLength(2));
  expect(result.current.businesses.map((business) => business.id)).toEqual([
    42, 7,
  ]);

  (getOpenNowBusinesses as jest.Mock).mockResolvedValue({
    success: true,
    data: [{ id: 99 }],
  });
  await rerender({ location: itPark });
  await waitFor(() => expect(result.current.businesses[0]?.id).toBe(99));

  expect(getOpenNowBusinesses).toHaveBeenLastCalledWith(
    10.328,
    123.907,
    expect.anything(),
  );
  expect(
    clients[0].getQueryData([...OPEN_NOW_BUSINESSES_QUERY_KEY, 10.33, 123.9]),
  ).toEqual([{ id: 42 }, { id: 7 }]);
});

it("uses explicit fresh coordinates even before the observer location changes", async () => {
  const { result } = await renderHook(
    () => useOpenNowBusinesses(lahug, false),
    {
      wrapper: wrapper(),
    },
  );

  await act(async () => result.current.refreshAtLocation(itPark));

  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(1);
  expect(getOpenNowBusinesses).toHaveBeenCalledWith(
    10.328,
    123.907,
    expect.anything(),
  );
});

it("does not duplicate a successful explicit refresh when the new location observer is enabled", async () => {
  const { result, rerender } = await renderHook(
    ({ location, enabled }) => useOpenNowBusinesses(location, enabled),
    { initialProps: { location: lahug, enabled: false }, wrapper: wrapper() },
  );
  await act(async () => {
    await result.current.refreshAtLocation(itPark);
  });
  await rerender({ location: itPark, enabled: true });
  await waitFor(() => expect(result.current.businesses).toHaveLength(2));
  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(1);
});

it("refreshes opening availability when Explore regains focus", async () => {
  const { result, rerender } = await renderHook(
    () => useOpenNowBusinesses(lahug),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.businesses).toHaveLength(2));

  mockFocused = false;
  await rerender(undefined);
  (getOpenNowBusinesses as jest.Mock).mockResolvedValue({
    success: true,
    data: [],
  });
  mockFocused = true;
  await rerender(undefined);

  await waitFor(() => expect(result.current.businesses).toEqual([]));
});

it("keeps a failed explicit refresh retryable without duplicating it on observer enable", async () => {
  const { result, rerender } = await renderHook(
    ({ enabled }) => useOpenNowBusinesses(itPark, enabled),
    { initialProps: { enabled: false }, wrapper: wrapper() },
  );
  jest.mocked(getOpenNowBusinesses).mockResolvedValueOnce({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  await act(async () => {
    await expect(result.current.refreshAtLocation(itPark)).rejects.toBeTruthy();
  });
  await rerender({ enabled: true });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(1);
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(2);
});

it("recovers a failed explicit refresh on the existing minute cadence", async () => {
  jest.useFakeTimers();
  const { result, rerender } = await renderHook(
    ({ enabled }) => useOpenNowBusinesses(itPark, enabled),
    { initialProps: { enabled: false }, wrapper: wrapper() },
  );
  jest.mocked(getOpenNowBusinesses).mockResolvedValueOnce({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  await act(async () => {
    await expect(result.current.refreshAtLocation(itPark)).rejects.toBeTruthy();
  });
  await rerender({ enabled: true });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeTruthy();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_001);
  });
  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(2);
  expect(result.current.error).toBeNull();
});

it("recovers a failed explicit refresh on foreground return", async () => {
  const { result, rerender } = await renderHook(
    ({ enabled }) => useOpenNowBusinesses(itPark, enabled),
    { initialProps: { enabled: false }, wrapper: wrapper() },
  );
  jest
    .mocked(getOpenNowBusinesses)
    .mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
  await act(async () => {
    await expect(result.current.refreshAtLocation(itPark)).rejects.toBeTruthy();
  });
  await rerender({ enabled: true });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  await act(async () => focusManager.setFocused(false));
  await act(async () => focusManager.setFocused(true));
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(getOpenNowBusinesses).toHaveBeenCalledTimes(2);
});

it("retains results on refresh failure and recovers through the query retry", async () => {
  const { result } = await renderHook(() => useOpenNowBusinesses(lahug), {
    wrapper: wrapper(),
  });
  await waitFor(() => expect(result.current.businesses).toHaveLength(2));
  (getOpenNowBusinesses as jest.Mock).mockResolvedValue({
    success: false,
    message: "Unavailable",
    code: "NETWORK_ERROR",
  });
  await act(async () => {
    await result.current.refetch();
  });

  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.businesses).toHaveLength(2);

  (getOpenNowBusinesses as jest.Mock).mockResolvedValue({
    success: true,
    data: [],
  });
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(result.current.businesses).toEqual([]);
});
