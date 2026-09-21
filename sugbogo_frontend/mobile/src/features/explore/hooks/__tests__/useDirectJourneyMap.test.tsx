import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { getDirectJourneyMap } from "../../api/directJourney.service";
import useDirectJourneyMap, {
  directJourneyMapQueryKey,
} from "../useDirectJourneyMap";

jest.mock("../../api/directJourney.service", () => ({
  getDirectJourneyMap: jest.fn(),
}));

describe("useDirectJourneyMap", () => {
  it("waits for valid IDs and includes the selected journey in its key", async () => {
    (getDirectJourneyMap as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        journey: {
          jeepney_route_code: "14D",
        },
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
      ReturnType<typeof useDirectJourneyMap>,
      { routeVariantId: number }
    >(
      ({ routeVariantId }) =>
        useDirectJourneyMap(21, routeVariantId, 2, 4),
      {
        initialProps: {
          routeVariantId: 0,
        },
        wrapper: Wrapper,
      },
    );

    expect(getDirectJourneyMap).not.toHaveBeenCalled();

    await rerender({ routeVariantId: 8 });
    await waitFor(() => expect(result.current.journey).not.toBeNull());

    expect(getDirectJourneyMap).toHaveBeenCalledWith(21, 8, 2, 4);
    expect(
      queryClient.getQueryData(
        directJourneyMapQueryKey(21, 8, 2, 4),
      ),
    ).toEqual({
      journey: {
        jeepney_route_code: "14D",
      },
    });

    queryClient.clear();
  });
});
