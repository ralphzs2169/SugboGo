import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { getRoadRoute } from "../../api/roadRoute.service";
import useRoadRoute, { roadRouteQueryKey } from "../useRoadRoute";

jest.mock("../../api/roadRoute.service", () => ({
  getRoadRoute: jest.fn(),
}));

describe("useRoadRoute", () => {
  it("waits for coordinates and keeps them in the query key", async () => {
    (getRoadRoute as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        route: null,
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
      },
    });

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    }

    const { result, rerender } = await renderHook<
      ReturnType<typeof useRoadRoute>,
      {
        latitude: number | null;
        longitude: number | null;
      }
    >(
      ({ latitude, longitude }) => useRoadRoute(21, latitude, longitude),
      {
        initialProps: {
          latitude: null,
          longitude: null,
        },
        wrapper: Wrapper,
      },
    );

    expect(getRoadRoute).not.toHaveBeenCalled();

    await rerender({
      latitude: 10.123,
      longitude: 123.456,
    });

    await waitFor(() => expect(result.current.result).not.toBeNull());

    expect(getRoadRoute).toHaveBeenCalledWith(21, 10.123, 123.456);
    expect(
      queryClient.getQueryData(
        roadRouteQueryKey(21, 10.123, 123.456),
      ),
    ).toEqual({
      route: null,
    });

    queryClient.clear();
  });
});
