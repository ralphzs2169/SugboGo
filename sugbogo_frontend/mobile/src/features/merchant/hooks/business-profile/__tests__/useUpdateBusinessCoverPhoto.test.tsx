import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { exploreBusinessDetailKey } from "@/features/explore/hooks/reviewQueryKeys";
import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { updateMerchantBusinessCoverPhoto } from "@/features/merchant/api/merchantBusinessProfile.service";

import { merchantBusinessProfileKey } from "../merchantBusinessProfileQueryKeys";
import useUpdateBusinessCoverPhoto from "../useUpdateBusinessCoverPhoto";

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
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result, unmount } = await renderHook(
      () => useUpdateBusinessCoverPhoto(7),
      {
        wrapper: createWrapper(client),
      },
    );

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
    unmount();
    client.clear();
  });
});
