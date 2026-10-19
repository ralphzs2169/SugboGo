import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import type {
  ApiError,
  ApiResponse,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";

import { getPocketCollections } from "../../api/pockets.service";
import type { PocketCollectionListResponse } from "../../types/pockets.types";
import { pocketCollectionsQueryKey } from "../pocketQueryKeys";
import usePocketCollections from "../usePocketCollections";

jest.mock("../../api/pockets.service", () => ({
  getPocketCollections: jest.fn(),
}));

const initialAuthState = useAuthStore.getState();
const apiError: ApiError = {
  success: false,
  code: "NETWORK_ERROR",
  message: "Offline",
};

function user(id: number): User {
  return {
    id,
    first_name: "Pocket",
    last_name: "Explorer",
    gender: null,
    email: `pocket-${id}@example.com`,
    role: "explorer",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  };
}

function page(
  ids: number[],
  pageNumber = 1,
  hasNext = false,
  totalCount = ids.length,
): ApiSuccessWithData<PocketCollectionListResponse> {
  return {
    success: true,
    message: "Success.",
    data: {
      items: ids.map((id) => ({
        id,
        name: id === 20 ? "Favorites" : `Pocket ${id}`,
        is_default: id === 20,
        business_count: 0,
        created_at: "2026-10-19T02:00:00Z",
        updated_at: "2026-10-19T02:00:00Z",
      })),
      pagination: {
        page: pageNumber,
        page_size: 2,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / 2),
        has_next: hasNext,
        has_previous: pageNumber > 1,
      },
    },
  };
}

function pendingResponse() {
  let resolve!: (response: ApiResponse<PocketCollectionListResponse>) => void;
  const promise = new Promise<ApiResponse<PocketCollectionListResponse>>(
    (done) => {
      resolve = done;
    },
  );
  return { promise, resolve };
}

describe("usePocketCollections", () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.mocked(getPocketCollections).mockReset();
    useAuthStore.setState({
      user: user(1),
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState(initialAuthState);
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  it("separates collection queries by user beneath the Pocket prefix", () => {
    expect(pocketCollectionsQueryKey(1)).toEqual(["pockets", 1, "collections"]);
    expect(pocketCollectionsQueryKey(2)).not.toEqual(
      pocketCollectionsQueryKey(1),
    );
    expect(pocketCollectionsQueryKey(null)).not.toEqual(
      pocketCollectionsQueryKey(1),
    );
  });

  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: user(1), isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user: user(1), isAuthenticated: true, isLoading: true },
  ])(
    "blocks automatic and manual requests for unavailable auth state %#",
    async (state) => {
      useAuthStore.setState(state);
      const { result } = await renderHook(() => usePocketCollections(), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.refetch();
        await result.current.fetchNextPage();
      });

      expect(getPocketCollections).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isAuthLoading).toBe(state.isLoading);
      expect(result.current.collections).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.hasData).toBe(false);
    },
  );

  it("starts page one only after authentication restoration completes", async () => {
    useAuthStore.setState({ isLoading: true });
    jest.mocked(getPocketCollections).mockResolvedValue(page([20]));
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    expect(getPocketCollections).not.toHaveBeenCalled();

    await act(async () => useAuthStore.setState({ isLoading: false }));

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(getPocketCollections).toHaveBeenCalledTimes(1);
    expect(getPocketCollections).toHaveBeenCalledWith(1);
  });

  it("exposes initial loading until the first response arrives", async () => {
    const pending = pendingResponse();
    jest.mocked(getPocketCollections).mockReturnValue(pending.promise);
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.hasData).toBe(false);
    expect(result.current.collections).toEqual([]);

    await act(async () => pending.resolve(page([20])));

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });

  it("preserves backend order, deduplicates overlapping pages, and stops at the last page", async () => {
    const next = pendingResponse();
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20, 10], 1, true, 3))
      .mockReturnValueOnce(next.promise);
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    const firstCollections = result.current.collections;
    expect(firstCollections.map((collection) => collection.id)).toEqual([
      20, 10,
    ]);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      void result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefetching).toBe(false);
    expect(result.current.collections).toBe(firstCollections);

    await act(async () => next.resolve(page([10, 5], 2, false, 3)));

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(
      result.current.collections.map((collection) => collection.id),
    ).toEqual([20, 10, 5]);
    expect(getPocketCollections).toHaveBeenNthCalledWith(2, 2);
    expect(result.current.hasNextPage).toBe(false);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
  });

  it("preserves the API error and retries to a successful empty result without fallback data", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([]));
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.error).toEqual(apiError));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasData).toBe(false);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.collections).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("inherits the QueryClient retry policy", async () => {
    client.setDefaultOptions({
      queries: { retry: 1, retryDelay: 0, gcTime: Infinity },
    });
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([20]));
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
    expect(getPocketCollections).toHaveBeenNthCalledWith(1, 1);
    expect(getPocketCollections).toHaveBeenNthCalledWith(2, 1);
    expect(result.current.error).toBeNull();
  });

  it("retains stable collections while refreshing and adopts the refreshed server data", async () => {
    const refresh = pendingResponse();
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20]))
      .mockReturnValueOnce(refresh.promise);
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    const collections = result.current.collections;

    await act(async () => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.collections).toBe(collections);

    await act(async () => refresh.resolve(page([20, 10])));

    await waitFor(() => expect(result.current.isRefetching).toBe(false));
    expect(
      result.current.collections.map((collection) => collection.id),
    ).toEqual([20, 10]);
    expect(result.current.totalCount).toBe(2);
    expect(getPocketCollections).toHaveBeenNthCalledWith(2, 1);
  });

  it("keeps loaded collections after a refresh error and allows retry", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20]))
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([20, 10]));
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toEqual(apiError));
    expect(result.current.hasData).toBe(true);
    expect(
      result.current.collections.map((collection) => collection.id),
    ).toEqual([20]);
    expect(result.current.totalCount).toBe(1);

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.collections).toHaveLength(2);
  });

  it("retains earlier pages after a next-page error and retries the failed page", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20, 10], 1, true, 3))
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([5], 2, false, 3));
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.hasData).toBe(true);
    expect(result.current.collections).toHaveLength(2);
    expect(result.current.totalCount).toBe(3);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.isFetchNextPageError).toBe(false),
    );
    expect(
      result.current.collections.map((collection) => collection.id),
    ).toEqual([20, 10, 5]);
    expect(getPocketCollections).toHaveBeenNthCalledWith(2, 2);
    expect(getPocketCollections).toHaveBeenNthCalledWith(3, 2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("isolates account changes, blocks old-owner refetches, and hides data on sign-out", async () => {
    const nextAccount = pendingResponse();
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([20]))
      .mockReturnValueOnce(nextAccount.promise);
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await act(async () => useAuthStore.setState({ user: user(2) }));
    expect(result.current.collections).toEqual([]);
    expect(result.current.hasData).toBe(false);
    await act(async () => nextAccount.resolve(page([30])));
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.collections[0].id).toBe(30);
    expect(client.getQueryData(pocketCollectionsQueryKey(1))).toBeDefined();
    expect(client.getQueryData(pocketCollectionsQueryKey(2))).toBeDefined();

    await act(async () => {
      await client.refetchQueries({
        queryKey: pocketCollectionsQueryKey(1),
        exact: true,
        type: "all",
      });
    });
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
    expect(result.current.collections[0].id).toBe(30);

    await act(async () => useAuthStore.getState().clearUser());
    expect(result.current.collections).toEqual([]);
    expect(result.current.hasData).toBe(false);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.isEnabled).toBe(false);
  });

  it("does not expose a previous account's late response to the current account", async () => {
    const firstAccount = pendingResponse();
    jest
      .mocked(getPocketCollections)
      .mockReturnValueOnce(firstAccount.promise)
      .mockResolvedValueOnce(page([30]));
    const { result } = await renderHook(() => usePocketCollections(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(getPocketCollections).toHaveBeenCalledTimes(1));
    await act(async () => useAuthStore.setState({ user: user(2) }));
    await waitFor(() => expect(result.current.collections[0]?.id).toBe(30));

    await act(async () => firstAccount.resolve(page([20])));

    expect(result.current.userId).toBe(2);
    expect(
      result.current.collections.map((collection) => collection.id),
    ).toEqual([30]);
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
  });
});
