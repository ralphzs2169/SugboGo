import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type {
  ExploreBusiness,
  ExploreBusinessListResponse,
} from "@/features/explore/types/exploreBusiness.types";
import type { User } from "@/features/users/types/user.types";
import type {
  ApiError,
  ApiResponse,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";

import { getPocketCollectionBusinesses } from "../../api/pockets.service";
import {
  pocketCollectionBusinessesQueryKey,
  pocketCollectionQueryKey,
  pocketCollectionsQueryKey,
} from "../pocketQueryKeys";
import usePocketCollectionBusinesses from "../usePocketCollectionBusinesses";

jest.mock("../../api/pockets.service", () => ({
  getPocketCollectionBusinesses: jest.fn(),
}));

const initialAuthState = useAuthStore.getState();
const apiError: ApiError = {
  success: false,
  code: "NETWORK_ERROR",
  message: "Offline",
};
const notFound: ApiError = {
  success: false,
  code: "NOT_FOUND",
  message: "The Pocket could not be found.",
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

function business(id: number): ExploreBusiness {
  return {
    id,
    business_name: `Business ${id}`,
    cover_photo_url: null,
    display_cover_photo_url: null,
    review_count: 0,
    overall_vibe: null,
    is_pocketed: true,
    cluster: { id: 1, name: "Culinary", icon: "utensils" },
    category: { id: 8, name: "Cafe" },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.89,
    },
  };
}

function page(
  ids: number[],
  pageNumber = 1,
  hasNext = false,
  total = ids.length,
): ApiSuccessWithData<ExploreBusinessListResponse> {
  return {
    success: true,
    message: "Success.",
    data: {
      items: ids.map(business),
      pagination: {
        page: pageNumber,
        page_size: 2,
        total_items: total,
        total_pages: Math.ceil(total / 2),
        has_next: hasNext,
        has_previous: pageNumber > 1,
      },
    },
  };
}

function pendingResponse() {
  let resolve!: (response: ApiResponse<ExploreBusinessListResponse>) => void;
  const promise = new Promise<ApiResponse<ExploreBusinessListResponse>>(
    (done) => {
      resolve = done;
    },
  );
  return { promise, resolve };
}

describe("usePocketCollectionBusinesses", () => {
  let client: QueryClient;

  beforeEach(() => {
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockReset()
      .mockResolvedValue(page([81, 7]));
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

  it("scopes contents by user and collection beneath the existing prefixes", () => {
    expect(pocketCollectionBusinessesQueryKey(1, 20)).toEqual([
      ...pocketCollectionQueryKey(1, 20),
      "businesses",
    ]);
    expect(pocketCollectionBusinessesQueryKey(1, 20)).not.toEqual(
      pocketCollectionBusinessesQueryKey(2, 20),
    );
    expect(pocketCollectionBusinessesQueryKey(1, 20)).not.toEqual(
      pocketCollectionBusinessesQueryKey(1, 7),
    );
  });

  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: user(1), isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user: user(1), isAuthenticated: true, isLoading: true },
  ])(
    "blocks automatic, refetch, and next-page requests for auth state %#",
    async (state) => {
      useAuthStore.setState(state);
      const { result } = await renderHook(
        () => usePocketCollectionBusinesses(20),
        { wrapper: Wrapper },
      );
      await act(async () => {
        await result.current.refetch();
        await result.current.fetchNextPage();
      });
      expect(getPocketCollectionBusinesses).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isAuthLoading).toBe(state.isLoading);
      expect(result.current.businesses).toEqual([]);
      expect(result.current.hasData).toBe(false);
    },
  );

  it.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])("guards invalid collection ID %s", async (collectionId) => {
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(collectionId),
      { wrapper: Wrapper },
    );
    await act(async () => {
      await result.current.refetch();
      await result.current.fetchNextPage();
    });
    expect(getPocketCollectionBusinesses).not.toHaveBeenCalled();
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.businesses).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it("waits for authentication restoration and exposes initial loading", async () => {
    const pending = pendingResponse();
    useAuthStore.setState({ isLoading: true });
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockReturnValueOnce(pending.promise);
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    expect(getPocketCollectionBusinesses).not.toHaveBeenCalled();
    await act(async () => useAuthStore.setState({ isLoading: false }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasData).toBe(false);
    await act(async () => pending.resolve(page([81, 7])));
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(getPocketCollectionBusinesses).toHaveBeenCalledWith(20, 1);
    expect(result.current.isLoading).toBe(false);
  });

  it("preserves membership order, deduplicates overlapping pages, and stops at the last page", async () => {
    const next = pendingResponse();
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([81, 7], 1, true, 3))
      .mockReturnValueOnce(next.promise);
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));
    const original = result.current.businesses;
    await act(async () => {
      void result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
    expect(result.current.businesses).toBe(original);
    expect(result.current.isRefetching).toBe(false);
    await act(async () => next.resolve(page([7, 40], 2, false, 3)));
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.businesses.map((item) => item.id)).toEqual([
      81, 7, 40,
    ]);
    expect(result.current.totalCount).toBe(3);
    expect(getPocketCollectionBusinesses).toHaveBeenNthCalledWith(2, 20, 2);
    expect(result.current.hasNextPage).toBe(false);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
  });

  it("keeps empty success distinct from an initial error and supports retry", async () => {
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([]));
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.error).toEqual(apiError));
    expect(result.current.hasData).toBe(false);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.businesses).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("inherits the configured retry policy", async () => {
    client.setDefaultOptions({
      queries: { retry: 1, retryDelay: 0, gcTime: Infinity },
    });
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([81]));
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    expect(getPocketCollectionBusinesses).toHaveBeenNthCalledWith(2, 20, 1);
  });

  it("retains businesses during refresh and refresh failure", async () => {
    const refresh = pendingResponse();
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([81]))
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce(page([7]));
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));
    const original = result.current.businesses;
    await act(async () => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.businesses).toBe(original);
    await act(async () => refresh.resolve(apiError));
    await waitFor(() => expect(result.current.error).toEqual(apiError));
    expect(result.current.businesses).toBe(original);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.businesses.map((item) => item.id)).toEqual([7]);
  });

  it("retains loaded pages after a next-page 404 and retries the failed page", async () => {
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([81, 7], 1, true, 3))
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(page([40], 2, false, 3));
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true));
    expect(result.current.businesses.map((item) => item.id)).toEqual([81, 7]);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() =>
      expect(result.current.isFetchNextPageError).toBe(false),
    );
    expect(result.current.businesses.map((item) => item.id)).toEqual([
      81, 7, 40,
    ]);
    expect(getPocketCollectionBusinesses).toHaveBeenNthCalledWith(3, 20, 2);
  });

  it("isolates account changes and late responses, blocks old-owner refetches, and hides rows on sign-out", async () => {
    const previous = pendingResponse();
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(notFound);
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(1),
    );
    await act(async () => useAuthStore.setState({ user: user(2) }));
    await waitFor(() => expect(result.current.error).toEqual(notFound));
    await act(async () => previous.resolve(page([81])));
    expect(result.current.businesses).toEqual([]);
    expect(result.current.userId).toBe(2);
    expect(
      client.getQueryData(pocketCollectionBusinessesQueryKey(2, 20)),
    ).toBeUndefined();
    await act(async () => {
      await client.refetchQueries({
        queryKey: pocketCollectionBusinessesQueryKey(1, 20),
        exact: true,
        type: "all",
      });
    });
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    await act(async () => useAuthStore.getState().clearUser());
    await act(async () => {
      await result.current.refetch();
      await result.current.fetchNextPage();
    });
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    expect(result.current.hasData).toBe(false);
    expect(result.current.businesses).toEqual([]);
  });

  it("isolates collection changes and late responses, then guards an invalid identity", async () => {
    const previous = pendingResponse();
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(page([7]));
    const { result, rerender } = await renderHook(
      ({ collectionId }: { collectionId: number | null }) =>
        usePocketCollectionBusinesses(collectionId),
      { initialProps: { collectionId: 20 }, wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(1),
    );
    await rerender({ collectionId: 30 });
    await waitFor(() => expect(result.current.businesses[0]?.id).toBe(7));
    await act(async () => previous.resolve(page([81])));
    expect(result.current.businesses.map((item) => item.id)).toEqual([7]);
    expect(getPocketCollectionBusinesses).toHaveBeenNthCalledWith(2, 30, 1);
    await rerender({ collectionId: null });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(result.current.businesses).toEqual([]);
    expect(result.current.hasData).toBe(false);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
  });

  it("refreshes through the existing collection prefix without affecting another account", async () => {
    client.setQueryData(pocketCollectionBusinessesQueryKey(2, 30), {
      pages: [page([40]).data],
      pageParams: [1],
    });
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([81]))
      .mockResolvedValueOnce(page([7]));
    const { result } = await renderHook(
      () => usePocketCollectionBusinesses(20),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: pocketCollectionsQueryKey(1),
      });
    });
    await waitFor(() => expect(result.current.businesses[0]?.id).toBe(7));
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    expect(
      client.getQueryState(pocketCollectionBusinessesQueryKey(2, 30))
        ?.isInvalidated,
    ).toBe(false);
  });
});
