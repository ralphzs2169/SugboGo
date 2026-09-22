import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { searchNearbyLandmarksService } from "@/shared/api/googlePlaces.service";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import useNearbyLandmarks from "../useNearbyLandmarks";

jest.mock("@/shared/api/googlePlaces.service", () => ({
  searchNearbyLandmarksService: jest.fn(),
}));

jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const nearbyLandmark = {
  id: "backend-id",
  name: "Cebu Monument",
  address: "Cebu City",
  latitude: 10.3158,
  longitude: 123.8855,
  source: "google" as const,
  placeId: "place-1",
};

describe("useNearbyLandmarks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMerchantRegistrationStore.getState().reset();
  });

  it("does not request landmarks until both coordinates are available", async () => {
    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => useNearbyLandmarks(10.3157, null),
      {
        wrapper,
      },
    );

    expect(result.current.isLoadingLandmarks).toBe(false);
    expect(result.current.landmarks).toEqual([]);
    expect(searchNearbyLandmarksService).not.toHaveBeenCalled();

    unmount();
    client.clear();
  });

  it("fetches and maps nearby landmark suggestions", async () => {
    (searchNearbyLandmarksService as jest.Mock).mockResolvedValue({
      success: true,
      message: "Nearby landmarks loaded.",
      data: {
        landmarks: [
          nearbyLandmark,
          {
            ...nearbyLandmark,
            id: "missing-place-id",
            placeId: undefined,
          },
        ],
      },
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => useNearbyLandmarks(10.3157, 123.8854),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.isLoadingLandmarks).toBe(false));

    expect(searchNearbyLandmarksService).toHaveBeenCalledWith(
      10.3157,
      123.8854,
    );
    expect(result.current.landmarks).toEqual([
      {
        ...nearbyLandmark,
        id: "place-1",
      },
    ]);
    expect(result.current.error).toBeNull();

    unmount();
    client.clear();
  });

  it("exposes API failures as query errors", async () => {
    const response: ApiError = {
      success: false,
      message: "Unable to load nearby landmarks.",
      code: "NETWORK_ERROR",
    };

    (searchNearbyLandmarksService as jest.Mock).mockResolvedValue(response);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => useNearbyLandmarks(10.3157, 123.8854),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.error).toEqual(response));

    expect(result.current.landmarks).toEqual([]);

    unmount();
    client.clear();
  });

  it("reuses the cached result for consumers with identical coordinates", async () => {
    (searchNearbyLandmarksService as jest.Mock).mockResolvedValue({
      success: true,
      message: "Nearby landmarks loaded.",
      data: {
        landmarks: [nearbyLandmark],
      },
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => ({
        first: useNearbyLandmarks(10.3157, 123.8854),
        second: useNearbyLandmarks(10.3157, 123.8854),
      }),
      {
        wrapper,
      },
    );

    await waitFor(() =>
      expect(result.current.first.landmarks).toHaveLength(1),
    );

    expect(result.current.second.landmarks).toEqual(
      result.current.first.landmarks,
    );
    expect(searchNearbyLandmarksService).toHaveBeenCalledTimes(1);

    unmount();
    client.clear();
  });

  it("keeps cached suggestions visible during a manual refetch", async () => {
    let resolveRefetch: (value: {
      success: true;
      message: string;
      data: { landmarks: typeof nearbyLandmark[] };
    }) => void = () => undefined;
    const pendingRefetch = new Promise<{
      success: true;
      message: string;
      data: { landmarks: typeof nearbyLandmark[] };
    }>((resolve) => {
      resolveRefetch = resolve;
    });

    (searchNearbyLandmarksService as jest.Mock)
      .mockResolvedValueOnce({
        success: true,
        message: "Nearby landmarks loaded.",
        data: {
          landmarks: [nearbyLandmark],
        },
      })
      .mockReturnValueOnce(pendingRefetch);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => useNearbyLandmarks(10.3157, 123.8854),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.landmarks).toHaveLength(1));

    await act(async () => {
      void result.current.refetch();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.isRefetchingLandmarks).toBe(true),
    );
    expect(result.current.landmarks[0].name).toBe("Cebu Monument");

    resolveRefetch({
      success: true,
      message: "Nearby landmarks refreshed.",
      data: {
        landmarks: [
          {
            ...nearbyLandmark,
            name: "Refreshed Monument",
          },
        ],
      },
    });

    await waitFor(() =>
      expect(result.current.landmarks[0].name).toBe("Refreshed Monument"),
    );

    unmount();
    client.clear();
  });

  it("does not overwrite user-edited selected landmarks on refetch", async () => {
    const customLandmark = {
      id: "custom-1",
      name: "My Custom Landmark",
      address: "Near the shop",
      latitude: 10.3159,
      longitude: 123.8856,
      source: "custom" as const,
    };

    useMerchantRegistrationStore
      .getState()
      .setSelectedLandmarks([customLandmark]);

    (searchNearbyLandmarksService as jest.Mock).mockResolvedValue({
      success: true,
      message: "Nearby landmarks loaded.",
      data: {
        landmarks: [nearbyLandmark],
      },
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(
      () => useNearbyLandmarks(10.3157, 123.8854),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.landmarks).toHaveLength(1));

    await act(async () => {
      await result.current.refetch();
    });

    expect(
      useMerchantRegistrationStore.getState().selectedLandmarks,
    ).toEqual([customLandmark]);

    unmount();
    client.clear();
  });

  it("preserves imperative system-error handling for confirmation", async () => {
    const response: ApiError = {
      success: false,
      message: "Unable to reach the server.",
      code: "NETWORK_ERROR",
    };

    (searchNearbyLandmarksService as jest.Mock).mockResolvedValue(response);

    const client = createQueryClient();
    const wrapper = createWrapper(client);

    const { result, unmount } = await renderHook(useNearbyLandmarks, {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.searchNearbyLandmarks(10.3157, 123.8854),
      ).resolves.toEqual({
        success: false,
        landmarks: [],
      });
    });

    expect(handleSystemError).toHaveBeenCalledWith(response);

    unmount();
    client.clear();
  });
});
