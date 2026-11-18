import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getDiscoveryFeed } from "../../api/exploreBusiness.service";
import useDiscoveryFeed, {
  DISCOVERY_FEED_QUERY_KEY,
} from "../useDiscoveryFeed";

jest.mock("../../api/exploreBusiness.service", () => ({
  getDiscoveryFeed: jest.fn(),
}));

const clients: QueryClient[] = [];

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

function setupClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
  clients.push(client);

  /** Supplies React Query state to the Discovery feed hook. */
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return {
    client,
    wrapper: Wrapper,
  };
}

describe("useDiscoveryFeed", () => {
  it("keeps the last successful feed after a background refresh fails", async () => {
    const items = [{ id: 20, business_name: "Loaded business" }];
    (getDiscoveryFeed as jest.Mock)
      .mockResolvedValueOnce({ success: true, data: { items, pagination: {} } })
      .mockResolvedValueOnce({
        success: false,
        code: "NETWORK_ERROR",
        message: "Offline",
      });
    const { client, wrapper } = setupClient();
    const hook = await renderHook(useDiscoveryFeed, { wrapper });
    try {
      await waitFor(() =>
        expect(hook.result.current.businesses).toEqual(items),
      );
      await act(async () => {
        await client.invalidateQueries({ queryKey: DISCOVERY_FEED_QUERY_KEY });
      });
      await waitFor(() => expect(hook.result.current.error).toBeTruthy());
      expect(hook.result.current.businesses).toEqual(items);
    } finally {
      await hook.unmount();
      client.clear();
    }
  });
  it("loads the ranked first page with a stable React Query key", async () => {
    const rankedItems = [
      { id: 20, business_name: "Backend First" },
      { id: 10, business_name: "Backend Second" },
    ];
    const data = {
      items: rankedItems,
      pagination: {
        page: 1,
        page_size: 10,
        total_items: 2,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    };
    (getDiscoveryFeed as jest.Mock).mockResolvedValue({
      success: true,
      data,
    });
    const { client, wrapper } = setupClient();

    const { result } = await renderHook(useDiscoveryFeed, { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getDiscoveryFeed).toHaveBeenCalledTimes(1);
    expect(result.current.businesses).toBe(rankedItems);
    expect(result.current.businesses.map((business) => business.id)).toEqual([
      20, 10,
    ]);
    expect(client.getQueryData(DISCOVERY_FEED_QUERY_KEY)).toBe(data);
    expect(result.current.refetch).toEqual(expect.any(Function));
  });
});
