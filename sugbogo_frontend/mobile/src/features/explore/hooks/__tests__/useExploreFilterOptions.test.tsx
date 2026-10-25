import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getExploreFilterOptions } from "../../api/exploreBusiness.service";
import useExploreFilterOptions, {
  EXPLORE_FILTER_OPTIONS_QUERY_KEY,
} from "../useExploreFilterOptions";

jest.mock("../../api/exploreBusiness.service", () => ({
  getExploreFilterOptions: jest.fn(),
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { client, Wrapper };
}

it("exposes a failed taxonomy separately from a successful empty response and recovers on Retry", async () => {
  (getExploreFilterOptions as jest.Mock).mockRejectedValueOnce(
    new Error("Offline"),
  );
  const { client, Wrapper } = setup();
  const { result, unmount } = await renderHook(useExploreFilterOptions, {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.hasOptions).toBe(false);
  expect(result.current.isLoading).toBe(false);
  (getExploreFilterOptions as jest.Mock).mockResolvedValueOnce({
    success: true,
    data: { clusters: [], categories: [], specialty_tags: [] },
  });
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.hasOptions).toBe(true));
  expect(result.current.error).toBeNull();
  unmount();
  client.clear();
});

it("retains cached choices when an explicit refresh fails", async () => {
  const { client, Wrapper } = setup();
  const options = {
    clusters: [{ id: 1, name: "Food", icon: "utensils" }],
    categories: [],
    specialty_tags: [],
  };
  client.setQueryData(EXPLORE_FILTER_OPTIONS_QUERY_KEY, options);
  (getExploreFilterOptions as jest.Mock).mockRejectedValueOnce(
    new Error("Offline"),
  );
  const { result, unmount } = await renderHook(useExploreFilterOptions, {
    wrapper: Wrapper,
  });
  expect(getExploreFilterOptions).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.refetch();
  });
  expect(result.current.hasOptions).toBe(true);
  expect(result.current.options).toEqual(options);
  expect(result.current.error).toBeTruthy();
  unmount();
  client.clear();
});
