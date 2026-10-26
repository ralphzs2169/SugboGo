import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { updateMerchantBusinessCoverPhoto } from "@/features/merchant/api/merchantBusinessProfile.service";

import { merchantBusinessProfileKey } from "../merchantBusinessProfileQueryKeys";
import useUpdateBusinessCoverPhoto from "../useUpdateBusinessCoverPhoto";
import { invalidateBusinessDisplayCover } from "../invalidateBusinessDisplayCover";
import {
  MAP_DIRECTORY_QUERY_KEY,
  MAP_DIRECTORY_DATA_QUERY_KEY,
  MAP_BUSINESS_QUERY_KEY,
  mapBusinessQueryKey,
} from "@/features/map/hooks/mapDirectoryQueryKeys";

jest.mock("@/features/merchant/api/merchantBusinessProfile.service", () => ({
  updateMerchantBusinessCoverPhoto: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: jest.fn(),
      renderAsync: jest.fn(async () => ({
        saveAsync: jest.fn(async () => ({ uri: "file:///processed.jpg" })),
      })),
    })),
  },
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity },
    },
  });
}

describe("useUpdateBusinessCoverPhoto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 42 } as any });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it("keeps image processing and refreshes merchant and Explorer data", async () => {
    (updateMerchantBusinessCoverPhoto as jest.Mock).mockResolvedValue({
      success: true,
      message: "Updated.",
      data: {
        cover_photo_url: "https://example.com/cover.jpg",
        cover_photo_retry_after: null,
        cover_photo_update: { limit: 3, remaining: 2, resets_at: null },
      },
    });

    const client = createQueryClient();
    const affectedKeys = [MAP_DIRECTORY_DATA_QUERY_KEY, mapBusinessQueryKey(7)];
    const untouchedKeys = [
      mapBusinessQueryKey(8),
      [...MAP_DIRECTORY_QUERY_KEY, "open-now"],
      ["unrelated-business-data"],
    ];
    for (const queryKey of [...affectedKeys, ...untouchedKeys]) {
      client.setQueryData(queryKey, []);
    }
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useUpdateBusinessCoverPhoto(7),
      {
        wrapper: createWrapper(client),
      },
    );

    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.updateCoverPhoto("file:///selected.jpg");
    });

    expect(updateMerchantBusinessCoverPhoto).toHaveBeenCalledWith(
      expect.any(FormData),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: merchantBusinessProfileKey(42),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: exploreBusinessDetailKey(7),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: DISCOVERY_FEED_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: MAP_DIRECTORY_DATA_QUERY_KEY,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: mapBusinessQueryKey(7) });
    expect(invalidate).toHaveBeenCalledTimes(10);
    for (const queryKey of affectedKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    for (const queryKey of untouchedKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(false);
    }
    unmount();
    client.clear();
  });

  it("refreshes the allowance after a backend rate-limit rejection", async () => {
    (updateMerchantBusinessCoverPhoto as jest.Mock).mockResolvedValue({
      success: false,
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests.",
      errors: { retry_after: 86400 },
    });

    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useUpdateBusinessCoverPhoto(7),
      {
        wrapper: createWrapper(client),
      },
    );

    await act(async () => {
      await expect(
        result.current.updateCoverPhoto("file:///selected.jpg"),
      ).rejects.toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: merchantBusinessProfileKey(42),
      });
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
    unmount();
    client.clear();
  });

  it("invalidates compact presentation entries conservatively when the business ID is unavailable", async () => {
    const client = createQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    client.setQueryData(mapBusinessQueryKey(7), []);
    client.setQueryData(mapBusinessQueryKey(8), []);
    const openNowKey = [...MAP_DIRECTORY_QUERY_KEY, "open-now"];
    client.setQueryData(openNowKey, [7]);
    await invalidateBusinessDisplayCover(client);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: MAP_BUSINESS_QUERY_KEY });
    expect(client.getQueryState(mapBusinessQueryKey(7))?.isInvalidated).toBe(true);
    expect(client.getQueryState(mapBusinessQueryKey(8))?.isInvalidated).toBe(true);
    expect(client.getQueryState(openNowKey)?.isInvalidated).toBe(false);
    client.clear();
  });
});
