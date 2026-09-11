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
      20,
      10,
    ]);
    expect(result.current.totalItems).toBe(3);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => {
      expect(result.current.businesses.map((business) => business.id)).toEqual([
        20,
        10,
        5,
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
