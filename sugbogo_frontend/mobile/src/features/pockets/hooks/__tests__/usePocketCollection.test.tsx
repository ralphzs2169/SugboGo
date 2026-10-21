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

import { getPocketCollection } from "../../api/pockets.service";
import type { PocketCollection } from "../../types/pockets.types";
import {
  pocketCollectionQueryKey,
  pocketCollectionsQueryKey,
} from "../pocketQueryKeys";
import usePocketCollection from "../usePocketCollection";

jest.mock("../../api/pockets.service", () => ({
  getPocketCollection: jest.fn(),
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

function metadata(id = 20, count = 0): ApiSuccessWithData<PocketCollection> {
  return {
    success: true,
    message: "Pocket retrieved successfully.",
    data: {
      id,
      name: id === 20 ? "Favorites" : `Pocket ${id}`,
      is_default: id === 20,
      business_count: count,
      created_at: "2026-10-19T02:00:00Z",
      updated_at: "2026-10-19T03:00:00Z",
    },
  };
}

function pendingResponse() {
  let resolve!: (response: ApiResponse<PocketCollection>) => void;
  const promise = new Promise<ApiResponse<PocketCollection>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("usePocketCollection", () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.mocked(getPocketCollection).mockReset().mockResolvedValue(metadata());
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

  it("scopes metadata by user and collection beneath the collection prefix", () => {
    expect(pocketCollectionQueryKey(1, 20)).toEqual([
      ...pocketCollectionsQueryKey(1),
      20,
    ]);
    expect(pocketCollectionQueryKey(1, 20)).not.toEqual(
      pocketCollectionQueryKey(2, 20),
    );
    expect(pocketCollectionQueryKey(1, 20)).not.toEqual(
      pocketCollectionQueryKey(1, 7),
    );
    expect(pocketCollectionQueryKey(null, 20)).not.toEqual(
      pocketCollectionQueryKey(1, 20),
    );
    expect(pocketCollectionQueryKey(1, null)).not.toEqual(
      pocketCollectionQueryKey(1, 20),
    );
  });

  it.each([metadata(20), metadata(7, 4)])(
    "loads collection $data.id metadata including zero-business Favorites",
    async (response) => {
      jest.mocked(getPocketCollection).mockResolvedValue(response);
      const { result } = await renderHook(
        () => usePocketCollection(response.data.id),
        { wrapper: Wrapper },
      );

      await waitFor(() => expect(result.current.hasData).toBe(true));
      expect(getPocketCollection).toHaveBeenCalledTimes(1);
      expect(getPocketCollection).toHaveBeenCalledWith(response.data.id);
      expect(result.current.collection).toEqual(response.data);
      expect(
        client.getQueryData(pocketCollectionQueryKey(1, response.data.id)),
      ).toEqual(response.data);
      expect(result.current.error).toBeNull();
    },
  );

  it("exposes initial loading without synthesizing metadata", async () => {
    const pending = pendingResponse();
    jest.mocked(getPocketCollection).mockReturnValue(pending.promise);
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.collection).toBeNull();
    expect(result.current.hasData).toBe(false);

    await act(async () => pending.resolve(metadata()));

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
  });

  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: user(1), isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user: user(1), isAuthenticated: true, isLoading: true },
  ])(
    "guards automatic and manual requests for unavailable auth state %#",
    async (state) => {
      useAuthStore.setState(state);
      client.setQueryData(pocketCollectionQueryKey(1, 20), metadata().data);
      const { result } = await renderHook(() => usePocketCollection(20), {
        wrapper: Wrapper,
      });

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
      expect(getPocketCollection).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.isAuthLoading).toBe(state.isLoading);
      expect(result.current.hasData).toBe(false);
      expect(result.current.collection).toBeNull();
    },
  );

  it("fetches only after authentication restoration finishes", async () => {
    useAuthStore.setState({ isLoading: true });
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });
    expect(getPocketCollection).not.toHaveBeenCalled();

    await act(async () => useAuthStore.setState({ isLoading: false }));

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.isEnabled).toBe(true);
    expect(getPocketCollection).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    "rejects invalid collection ID %s for automatic and manual requests",
    async (collectionId) => {
      const { result } = await renderHook(
        () => usePocketCollection(collectionId),
        {
          wrapper: Wrapper,
        },
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
      expect(getPocketCollection).not.toHaveBeenCalled();
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.collection).toBeNull();
      expect(result.current.hasData).toBe(false);
    },
  );

  it("hides loaded metadata when the collection ID becomes invalid", async () => {
    const { result, rerender } = await renderHook(
      ({ collectionId }: { collectionId: number | null }) =>
        usePocketCollection(collectionId),
      { initialProps: { collectionId: 20 }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await rerender({ collectionId: null });
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.collection).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(getPocketCollection).toHaveBeenCalledTimes(1);
  });

  it.each([
    { user: null, isAuthenticated: false, isLoading: false },
    { user: null, isAuthenticated: true, isLoading: false },
    { user: user(1), isAuthenticated: false, isLoading: false },
    { user: user(1), isAuthenticated: true, isLoading: true },
  ])(
    "revalidates auth inside a manual refetch before rerendering state %#",
    async (state) => {
      const { result } = await renderHook(() => usePocketCollection(20), {
        wrapper: Wrapper,
      });
      await waitFor(() => expect(result.current.hasData).toBe(true));

      await act(async () => {
        useAuthStore.setState(state);
        await result.current.refetch();
      });

      expect(getPocketCollection).toHaveBeenCalledTimes(1);
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.collection).toBeNull();
      expect(result.current.hasData).toBe(false);
    },
  );

  it("isolates account changes and blocks cached queries belonging to the old account", async () => {
    const nextAccount = pendingResponse();
    const otherCollection = metadata(30).data;
    client.setQueryData(pocketCollectionQueryKey(2, 30), otherCollection);
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockReturnValueOnce(nextAccount.promise);
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await act(async () => useAuthStore.setState({ user: user(2) }));

    expect(result.current.collection).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(result.current.userId).toBe(2);
    await act(async () => nextAccount.resolve(notFound));
    await waitFor(() => expect(result.current.error).toEqual(notFound));
    await act(async () => {
      await client.refetchQueries({
        queryKey: pocketCollectionQueryKey(1, 20),
        exact: true,
        type: "all",
      });
    });

    expect(getPocketCollection).toHaveBeenCalledTimes(2);
    expect(result.current.collection).toBeNull();
    expect(client.getQueryData(pocketCollectionQueryKey(1, 20))).toEqual(
      metadata().data,
    );
    expect(
      client.getQueryData(pocketCollectionQueryKey(2, 20)),
    ).toBeUndefined();
    expect(client.getQueryData(pocketCollectionQueryKey(2, 30))).toEqual(
      otherCollection,
    );
  });

  it("does not expose a previous account's late response", async () => {
    const previousAccount = pendingResponse();
    jest
      .mocked(getPocketCollection)
      .mockReturnValueOnce(previousAccount.promise)
      .mockResolvedValueOnce(notFound);
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(getPocketCollection).toHaveBeenCalledTimes(1));

    await act(async () => useAuthStore.setState({ user: user(2) }));
    await waitFor(() => expect(result.current.error).toEqual(notFound));
    await act(async () => previousAccount.resolve(metadata()));

    expect(result.current.userId).toBe(2);
    expect(result.current.collection).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(result.current.error).toEqual(notFound);
    expect(
      client.getQueryData(pocketCollectionQueryKey(2, 20)),
    ).toBeUndefined();
  });

  it("switches collection IDs without displaying the previous collection", async () => {
    const nextCollection = pendingResponse();
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockReturnValueOnce(nextCollection.promise);
    const { result, rerender } = await renderHook(
      ({ collectionId }: { collectionId: number }) =>
        usePocketCollection(collectionId),
      { initialProps: { collectionId: 20 }, wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await rerender({ collectionId: 7 });

    expect(result.current.collection).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(result.current.isLoading).toBe(true);
    await act(async () => nextCollection.resolve(metadata(7, 4)));
    await waitFor(() => expect(result.current.collection?.id).toBe(7));
    expect(getPocketCollection).toHaveBeenNthCalledWith(2, 7);
    expect(client.getQueryData(pocketCollectionQueryKey(1, 20))).toEqual(
      metadata().data,
    );
    expect(client.getQueryData(pocketCollectionQueryKey(1, 7))).toEqual(
      metadata(7, 4).data,
    );
  });

  it("does not replace the current collection with a previous collection's late response", async () => {
    const previousCollection = pendingResponse();
    jest
      .mocked(getPocketCollection)
      .mockReturnValueOnce(previousCollection.promise)
      .mockResolvedValueOnce(metadata(7, 4));
    const { result, rerender } = await renderHook(
      ({ collectionId }: { collectionId: number }) =>
        usePocketCollection(collectionId),
      { initialProps: { collectionId: 20 }, wrapper: Wrapper },
    );
    await waitFor(() => expect(getPocketCollection).toHaveBeenCalledTimes(1));

    await rerender({ collectionId: 7 });
    await waitFor(() => expect(result.current.collection?.id).toBe(7));
    await act(async () => previousCollection.resolve(metadata()));

    expect(result.current.collection).toEqual(metadata(7, 4).data);
    expect(client.getQueryData(pocketCollectionQueryKey(1, 20))).toEqual(
      metadata().data,
    );
  });

  it("preserves API errors and supports a manual retry without fallback metadata", async () => {
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(metadata());
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.error).toEqual(apiError));
    expect(result.current.collection).toBeNull();
    expect(result.current.hasData).toBe(false);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.collection).toEqual(metadata().data);
    expect(getPocketCollection).toHaveBeenCalledTimes(2);
  });

  it("inherits the QueryClient retry policy", async () => {
    client.setDefaultOptions({
      queries: { retry: 1, retryDelay: 0, gcTime: Infinity },
    });
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(metadata());
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(getPocketCollection).toHaveBeenCalledTimes(2);
    expect(getPocketCollection).toHaveBeenNthCalledWith(1, 20);
    expect(getPocketCollection).toHaveBeenNthCalledWith(2, 20);
    expect(result.current.error).toBeNull();
  });

  it("retains metadata during refresh failure and adopts the retried response", async () => {
    const refresh = pendingResponse();
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce(metadata(20, 3));
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    const original = result.current.collection;

    await act(async () => {
      void result.current.refetch();
    });
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.collection).toBe(original);
    await act(async () => refresh.resolve(apiError));
    await waitFor(() => expect(result.current.error).toEqual(apiError));
    expect(result.current.hasData).toBe(true);
    expect(result.current.collection).toBe(original);

    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.collection?.business_count).toBe(3);
  });

  it("refreshes metadata through the existing collection prefix without touching another account", async () => {
    const otherAccount = metadata(30).data;
    const overview = { pages: [], pageParams: [] };
    client.setQueryData(pocketCollectionsQueryKey(1), overview);
    client.setQueryData(pocketCollectionQueryKey(2, 30), otherAccount);
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(metadata(20, 3));
    const { result } = await renderHook(() => usePocketCollection(20), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await act(async () => {
      await client.invalidateQueries({
        queryKey: pocketCollectionsQueryKey(1),
      });
    });

    await waitFor(() =>
      expect(result.current.collection?.business_count).toBe(3),
    );
    expect(getPocketCollection).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(pocketCollectionsQueryKey(1))).toEqual(overview);
    expect(
      client.getQueryState(pocketCollectionsQueryKey(1))?.isInvalidated,
    ).toBe(true);
    expect(client.getQueryData(pocketCollectionQueryKey(2, 30))).toEqual(
      otherAccount,
    );
    expect(
      client.getQueryState(pocketCollectionQueryKey(2, 30))?.isInvalidated,
    ).toBe(false);
  });
});
