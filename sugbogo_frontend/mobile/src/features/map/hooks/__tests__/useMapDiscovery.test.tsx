import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

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
