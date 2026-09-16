import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { getDirectJourneys } from "../../api/directJourney.service";
import useDirectJourneys, {
  directJourneysQueryKey,
} from "../useDirectJourneys";

jest.mock("../../api/directJourney.service", () => ({
  getDirectJourneys: jest.fn(),
}));

describe("useDirectJourneys", () => {
  it("waits for coordinates and keeps them in the query key", async () => {
    (getDirectJourneys as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        route_options: [],
        reason: "no_direct_route_match",
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
      ReturnType<typeof useDirectJourneys>,
      {
        latitude: number | null;
        longitude: number | null;
      }
    >(
      ({ latitude, longitude }) =>
        useDirectJourneys(21, latitude, longitude),
      {
        initialProps: {
          latitude: null as number | null,
          longitude: null as number | null,
        },
        wrapper: Wrapper,
      },
    );

    expect(getDirectJourneys).not.toHaveBeenCalled();

    await rerender({
      latitude: 10.3,
      longitude: 123.88,
    });

    await waitFor(() => expect(result.current.result).not.toBeNull());

    expect(getDirectJourneys).toHaveBeenCalledWith(21, 10.3, 123.88);
    expect(
      queryClient.getQueryData(
        directJourneysQueryKey(21, 10.3, 123.88),
      ),
    ).toEqual({
      route_options: [],
      reason: "no_direct_route_match",
    });

    queryClient.clear();
  });
});
