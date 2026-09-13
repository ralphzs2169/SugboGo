import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getExploreCollection } from "../../api/exploreBusiness.service";
import useExploreCollection, {
  getExploreCollectionQueryKey,
} from "../useExploreCollection";

jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreCollection: jest.fn(),
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
  clusterId: 3,
  categoryIds: [7, 4, 7],
  specialtyTagId: 12,
};

describe("useExploreCollection", () => {
  it("keys by collection and normalized filters while preserving page order", async () => {
    (getExploreCollection as jest.Mock)
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
      () => useExploreCollection("hidden-gems", criteria),
      {
        wrapper: setupClient(),
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(getExploreCollection).toHaveBeenNthCalledWith(
      1,
      "hidden-gems",
      {
        ...criteria,
        categoryIds: [4, 7],
      },
      1,
    );
    expect(result.current.totalItems).toBe(3);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(result.current.businesses.map((business) => business.id)).toEqual([
        20, 10, 5,
      ]);
    });
    unmount();
  });

  it("includes collection type and normalized taxonomy in the query key", () => {
    expect(getExploreCollectionQueryKey("interests", criteria)).toEqual([
      "explore-collections",
      "interests",
      3,
      [4, 7],
      12,
    ]);
  });
});
