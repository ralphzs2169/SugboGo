import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { getRecommendations } from "../../api/exploreBusiness.service";
import useRecommendations, {
  RECOMMENDATIONS_QUERY_KEY,
} from "../useRecommendations";

jest.mock("../../api/exploreBusiness.service", () => ({
  getRecommendations: jest.fn(),
}));

describe("useRecommendations", () => {
  it("keeps the first backend page in its received order", async () => {
    const data = {
      items: [
        { id: 42, business_name: "Backend First" },
        { id: 7, business_name: "Backend Second" },
      ],
      pagination: {
        page: 1,
        page_size: 10,
        total_items: 2,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    };
    (getRecommendations as jest.Mock).mockResolvedValue({
      success: true,
      data,
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result } = await renderHook(useRecommendations, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.businesses.map((business) => business.id)).toEqual([
      42, 7,
    ]);
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toBe(data);
  });
});
