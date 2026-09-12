import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getSimilarBusinesses } from "../../api/exploreBusiness.service";
import useSimilarBusinesses from "../useSimilarBusinesses";

jest.mock("../../api/exploreBusiness.service", () => ({
  getSimilarBusinesses: jest.fn(),
}));

describe("useSimilarBusinesses", () => {
  it("uses the viewed business ID in the query key and reloads for navigation", async () => {
    (getSimilarBusinesses as jest.Mock).mockImplementation(
      async (businessId: number) => ({
        success: true,
        data: [{ id: businessId + 100 }],
      }),
    );
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
      },
    });

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, rerender } = await renderHook<
      ReturnType<typeof useSimilarBusinesses>,
      { businessId: number }
    >(
      ({ businessId }) => useSimilarBusinesses(businessId),
      {
        initialProps: {
          businessId: 7,
        },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.businesses[0].id).toBe(107);
    expect(client.getQueryData(["similar-businesses", 7])).toEqual([
      { id: 107 },
    ]);

    await act(async () => {
      rerender({ businessId: 9 });
    });

    await waitFor(() => expect(result.current.businesses[0]?.id).toBe(109));
    expect(getSimilarBusinesses).toHaveBeenNthCalledWith(1, 7);
    expect(getSimilarBusinesses).toHaveBeenNthCalledWith(2, 9);
    expect(client.getQueryData(["similar-businesses", 9])).toEqual([
      { id: 109 },
    ]);
    client.clear();
  });
});
