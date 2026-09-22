import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import {
  getCategories,
  getClusters,
  getSpecialtyTags,
} from "../../../api/merchantApplication.service";
import useCategories from "../useCategories";
import useClusters from "../useClusters";
import useSpecialtyTags from "../useSpecialtyTags";

jest.mock("../../../api/merchantApplication.service", () => ({
  getCategories: jest.fn(),
  getClusters: jest.fn(),
  getSpecialtyTags: jest.fn(),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
}

describe("merchant registration option queries", () => {
  it("loads all option resources through React Query", async () => {
    (getClusters as jest.Mock).mockResolvedValue({
      success: true,
      message: "Clusters loaded.",
      data: [{ id: 1, name: "Food", icon: "food" }],
    });
    (getCategories as jest.Mock).mockResolvedValue({
      success: true,
      message: "Categories loaded.",
      data: [{ id: 2, cluster_id: 1, name: "Cafe" }],
    });
    (getSpecialtyTags as jest.Mock).mockResolvedValue({
      success: true,
      message: "Specialty tags loaded.",
      data: [{ id: 3, name: "Coffee" }],
    });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => ({
        clusters: useClusters(),
        categories: useCategories(),
        specialtyTags: useSpecialtyTags(),
      }),
      {
        wrapper: Wrapper,
      },
    );

    await waitFor(() => {
      expect(result.current.clusters.isLoading).toBe(false);
      expect(result.current.categories.isLoading).toBe(false);
      expect(result.current.specialtyTags.isLoading).toBe(false);
    });

    expect(result.current.clusters.clusters).toHaveLength(1);
    expect(result.current.categories.categories).toHaveLength(1);
    expect(result.current.specialtyTags.specialtyTags).toHaveLength(1);
    expect(result.current.clusters.error).toBeNull();
    expect(result.current.categories.error).toBeNull();
    expect(result.current.specialtyTags.error).toBeNull();

    unmount();
    client.clear();
  });

  it("shares fresh option data across consumers", async () => {
    (getSpecialtyTags as jest.Mock).mockResolvedValue({
      success: true,
      message: "Specialty tags loaded.",
      data: [{ id: 3, name: "Coffee" }],
    });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(
      () => ({
        first: useSpecialtyTags(),
        second: useSpecialtyTags(),
      }),
      {
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.first.isLoading).toBe(false));

    expect(result.current.first.specialtyTags).toEqual([
      { id: 3, name: "Coffee" },
    ]);
    expect(result.current.second.specialtyTags).toEqual([
      { id: 3, name: "Coffee" },
    ]);
    expect(getSpecialtyTags).toHaveBeenCalledTimes(1);

    unmount();
    client.clear();
  });

  it("exposes option API failures as query errors", async () => {
    (getCategories as jest.Mock).mockResolvedValue({
      success: false,
      message: "Unable to load categories.",
      code: "NETWORK_ERROR",
    });

    const client = createQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const { result, unmount } = await renderHook(useCategories, {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.categories).toEqual([]);

    unmount();
    client.clear();
  });
});
